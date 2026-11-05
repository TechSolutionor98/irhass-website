"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { adminAPI, categoriesAPI, apiRequest, productsAdminAPI } from "../../services/api"
import { Search, User, Package, Percent, Plus, Minus, Trash2, Save, FileText, PauseCircle, Truck, Store } from "lucide-react"
import { visibleStores, findStore } from "../../data/stores"
import { orderCustomerName, orderCustomerEmail, orderCustomerPhone } from "../../utils/orderCustomer"
import { useNavigate, useSearchParams } from "react-router-dom"

const currency = (n) =>
  `Rs ${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Line prices are edited as free text, so "" and "9." have to read as numbers
// without turning the running totals into NaN.
const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// The price typed on a line is the NET figure -- what the goods cost before tax. It is
// shown back exactly as typed, and VAT is added on top at this document's own rate. So a
// 4,000.00 line stays 4,000.00 under "Total without VAT", and at 5% it is charged 4,200.00.
//
// Order items are stored VAT-inclusive, because that is what every invoice in the admin
// splits its per-line VAT back out of.
const lineCharged = (netAmount, rate) => num(netAmount) * (1 + num(rate) / 100)
const PRICE_MODES = [
  { id: "regular", label: "Regular price" },
  { id: "wholesale", label: "Wholesale price" },
]

// Wholesale is optional per product -- fall back to the regular price rather
// than billing zero for a product nobody has set a wholesale price on.
const priceFor = (product, mode) => {
  const regular = num(product?.offerPrice || product?.price || 0)
  if (mode !== "wholesale") return regular
  const wholesale = product?.wholesalePrice
  return wholesale === null || wholesale === undefined || wholesale === "" ? regular : num(wholesale)
}

export default function CreateOrder() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // Set when a document was recalled from the Recent Quotation page: saving then
  // updates that document instead of raising a second copy of it.
  const recalledId = searchParams.get("id")
  const [recalledDoc, setRecalledDoc] = useState(null)
  // Everything the unmount auto-save needs, refreshed on every render. A cleanup
  // function closes over the state it was created with, so the live values have
  // to be parked somewhere it can read them.
  const autoSaveRef = useRef({ enabled: false })
  // How many documents are parked. Drives the On Hold button in the header --
  // there is nothing to go and look at until at least one exists.
  const [heldCount, setHeldCount] = useState(0)
  const [loadingRecalled, setLoadingRecalled] = useState(Boolean(recalledId))
  const [loadError, setLoadError] = useState("")

  const [mode, setMode] = useState("order")
  const [sendCustomerEmail, setSendCustomerEmail] = useState(false)

  // Users
  const [userQuery, setUserQuery] = useState("")
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)

  // Editable shipping info for order
  const [shipping, setShipping] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
  })
  const [updateUserProfile, setUpdateUserProfile] = useState(false)

  // Collection from a branch, the same choice the storefront checkout offers.
  // A pickup order has no delivery address, so the address fields give way to a
  // branch and a number to call when it is ready.
  const [deliveryType, setDeliveryType] = useState("home")
  const [pickupDetails, setPickupDetails] = useState({ storeId: "", phone: "" })

  // Products search/filters
  const [productQuery, setProductQuery] = useState("")
  const [parentCategories, setParentCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [brands, setBrands] = useState([])
  const [filters, setFilters] = useState({
    parentCategory: "",
    subcategory: "",
    brand: "",
  })
  const [productResults, setProductResults] = useState([])
  const productSearchRef = useRef(null)
  const [priceMode, setPriceMode] = useState("regular")

  // Order items and pricing
  const [items, setItems] = useState([])
  const [shippingPrice, setShippingPrice] = useState(0)
  const [taxRate, setTaxRate] = useState(5)
  // Lets the rate be picked from the usual two instead of typed every time; anything
  // else is still possible through "Custom".
  const [taxCustom, setTaxCustom] = useState(false)
  // A discount can be entered either as money off or as a percentage of the goods.
  // Only the resolved money figure is ever sent -- the mode is a data-entry aid.
  const [discountMode, setDiscountMode] = useState("amount")
  const [discountInput, setDiscountInput] = useState(0)
  // One free-form extra line (handling, packing, surcharge...). It travels as a payment
  // charge, so the invoice lists it beside any other fee without a special case.
  const [additionalChargeName, setAdditionalChargeName] = useState("Additional charges")
  const [additionalCharge, setAdditionalCharge] = useState(0)
  // Printed on the document when on. Off by default: a cash sale should not
  // advertise a transfer account.
  const [showBankDetails, setShowBankDetails] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState("cod")

  // Custom line item
  const [customName, setCustomName] = useState("")
  const [customPrice, setCustomPrice] = useState("")
  const [customQuantity, setCustomQuantity] = useState(1)

  // What the customer pays for the goods, VAT included -- the figure on the
  // line rows.
  // The lines as typed -- catalogue prices, VAT included at the standard rate.
  const itemsListed = useMemo(
    () => items.reduce((sum, it) => sum + num(it.price) * num(it.quantity), 0),
    [items],
  )
  // Typed prices are already net, so nothing is taken out here.
  const itemsNet = itemsListed
  // VAT at whatever rate this document is set to. Zero means an exempt sale, and
  // the total below drops accordingly rather than quietly keeping the VAT.
  // A percentage discount comes off the goods before VAT -- which is how it reads on
  // screen ("10% off the items"), not a slice of the shipping or the tax.
  const discountAmount = useMemo(
    () =>
      discountMode === "percent"
        ? Math.max(0, itemsNet * (num(discountInput) / 100))
        : Math.max(0, num(discountInput)),
    [discountMode, discountInput, itemsNet],
  )

  const additionalChargesTotal = useMemo(() => Math.max(0, num(additionalCharge)), [additionalCharge])

  // What the VAT is actually charged on: the goods after any discount, plus delivery
  // and any extra charge. Both of those are held exclusive of VAT here, exactly as on a
  // customer order. Taxing the undiscounted goods would overstate the VAT, and leaving
  // the charges out would undercharge it.
  const taxableBase = useMemo(
    () => Math.max(0, itemsNet - discountAmount + num(shippingPrice) + additionalChargesTotal),
    [itemsNet, discountAmount, shippingPrice, additionalChargesTotal],
  )
  const taxPrice = useMemo(() => taxableBase * (num(taxRate) / 100), [taxableBase, taxRate])
  // Same shape the server recomputes with:
  // itemsPrice + shipping + charges + tax - discount === taxableBase + tax.
  const totalPrice = useMemo(() => taxableBase + taxPrice, [taxableBase, taxPrice])

  // The rate picker falls back to "Custom" for anything that is not one of the two
  // presets, so a rate like 0.01 shows its own input rather than a blank select.
  const isPresetRate = num(taxRate) === 0 || num(taxRate) === 5
  const taxSelectValue = taxCustom || !isPresetRate ? "custom" : String(num(taxRate))
  const showTaxInput = taxCustom || !isPresetRate

  useEffect(() => {
    let cancelled = false
    const loadHeldCount = async () => {
      try {
        const held = await adminAPI.getQuotations({ quotationStatus: "Hold" })
        if (!cancelled) setHeldCount(Array.isArray(held) ? held.length : 0)
      } catch (e) {
        // Not worth an error on screen -- the button simply stays hidden.
        console.error("[create-document] held count error:", e)
      }
    }
    loadHeldCount()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!recalledId) return

    let cancelled = false
    const load = async () => {
      try {
        setLoadingRecalled(true)
        setLoadError("")
        const doc = await adminAPI.getQuotation(recalledId)
        if (cancelled) return

        setRecalledDoc(doc)
        setMode(doc.stagedAs === "order" ? "order" : "quotation")
        // A collection has no shippingAddress -- the customer lives on
        // pickupDetails instead -- so the contact fields are resolved rather
        // than read from one place. Reading shippingAddress directly is why a
        // recalled pickup document came back with an empty customer.
        setShipping({
          name: orderCustomerName(doc),
          email: orderCustomerEmail(doc),
          phone: orderCustomerPhone(doc),
          address: doc.shippingAddress?.address || "",
          city: doc.shippingAddress?.city || "",
          state: doc.shippingAddress?.state || "",
          zipCode: doc.shippingAddress?.zipCode || "",
        })
        setSelectedUser(doc.user && typeof doc.user === "object" ? doc.user : null)
        setItems(
          (doc.orderItems || []).map((it, index) => {
            const price = num(it.price)
            const productId = typeof it.product === "object" ? it.product?._id : it.product
            return {
              key: productId || `recalled-${index}`,
              product: productId || null,
              name: it.name,
              image: it.image || "/placeholder.svg",
              price,
              quantity: num(it.quantity) || 1,
              sku: it.sku || (typeof it.product === "object" ? it.product?.sku : "") || "",
              isCustom: !productId,
              // The prices on a recalled document are the ones already agreed, so
              // both modes resolve to them -- flipping the toggle cannot quietly
              // reprice a quotation the customer has already seen.
              regularPrice: price,
              wholesalePrice: price,
              hasWholesale: true,
              priceEdited: false,
            }
          }),
        )
        setDeliveryType(doc.deliveryType === "pickup" ? "pickup" : "home")
        setPickupDetails({
          storeId: doc.pickupDetails?.storeId || "",
          phone: doc.pickupDetails?.phone || "",
        })
        setShippingPrice(num(doc.shippingPrice))
        // Only the money figure is stored, so a recalled document always reopens in
        // amount mode -- the percentage that produced it is not recoverable.
        setDiscountMode("amount")
        setDiscountInput(num(doc.discountAmount))
        const savedCharge = Array.isArray(doc.paymentCharges) ? doc.paymentCharges[0] : null
        setAdditionalChargeName(savedCharge?.name || "Additional charges")
        setAdditionalCharge(num(savedCharge?.amount))
        const savedRate = Number.isFinite(Number(doc.taxRate)) ? Number(doc.taxRate) : 5
        setTaxRate(savedRate)
        setTaxCustom(savedRate !== 0 && savedRate !== 5)
        setShowBankDetails(Boolean(doc.showBankDetails))
        setPaymentMethod(doc.actualPaymentMethod || doc.paymentMethod || "cod")
      } catch (e) {
        if (!cancelled) setLoadError(e?.message || "Could not open this document.")
      } finally {
        if (!cancelled) setLoadingRecalled(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [recalledId])

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        if (!userQuery?.trim()) {
          setUsers([])
          return
        }
        const data = await adminAPI.getUsers({ search: userQuery.trim() })
        setUsers(Array.isArray(data) ? data : [])
      } catch (e) {
        console.error("[create-document] user search error:", e)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [userQuery])

  useEffect(() => {
    const load = async () => {
      try {
        const [cats, subs, brandsRes] = await Promise.all([
          categoriesAPI.getAll(),
          apiRequest("/api/subcategories"),
          apiRequest("/api/brands"),
        ])
        setParentCategories(cats || [])
        setSubcategories(subs || [])
        setBrands(brandsRes || [])
      } catch (e) {
        console.error("[create-document] load filters error:", e)
      }
    }
    load()
  }, [])

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const params = {}
        if (productQuery?.trim()) params.search = productQuery.trim()
        if (filters.parentCategory) params.parentCategory = filters.parentCategory
        if (filters.subcategory) params.subcategory = filters.subcategory
        if (filters.brand) {
          const brandObj = brands.find((b) => b._id === filters.brand)
          if (brandObj?.name) {
            params.search = params.search ? `${params.search} ${brandObj.name}` : brandObj.name
          }
        }
        if (!params.search && !params.parentCategory && !params.subcategory) {
          setProductResults([])
          return
        }
        const data = await productsAdminAPI.search({ ...params, limit: 20, page: 1 })
        setProductResults(data?.products || [])
      } catch (e) {
        console.error("[create-document] product search error:", e)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [productQuery, filters, brands])

  const onSelectUser = (u) => {
    setSelectedUser(u)
    setUsers([])
    setUserQuery("")
    setShipping({
      name: u?.name || "",
      email: u?.email || "",
      phone: u?.phone || "",
      address: u?.address?.street || "",
      city: u?.address?.city || "",
      state: u?.address?.state || "",
      zipCode: u?.address?.zipCode || "",
    })
  }

  // Adding a product clears the search and its suggestions, the same way picking
  // a customer clears the user search. Focus stays in the box so the next
  // product can be typed straight away.
  const clearProductSearch = () => {
    setProductQuery("")
    setProductResults([])
    productSearchRef.current?.focus()
  }

  const addProduct = (p) => {
    const price = priceFor(p, priceMode)
    const existing = items.find((it) => it.key === p._id)
    if (existing) {
      setItems((prev) => prev.map((it) => (it.key === p._id ? { ...it, quantity: (it.quantity || 0) + 1 } : it)))
      clearProductSearch()
      return
    }

    setItems((prev) => [
      ...prev,
      {
        key: p._id,
        product: p._id,
        name: p.name,
        image: p.image || "/placeholder.svg",
        price,
        quantity: 1,
        sku: p.sku,
        isCustom: false,
        // Kept so switching the price mode can re-price this line, and so an
        // edited price can be told apart from the catalogue one.
        regularPrice: priceFor(p, "regular"),
        wholesalePrice: priceFor(p, "wholesale"),
        hasWholesale: !(p?.wholesalePrice === null || p?.wholesalePrice === undefined || p?.wholesalePrice === ""),
        priceEdited: false,
      },
    ])
    clearProductSearch()
  }

  const addCustomItem = () => {
    const name = customName.trim()
    const price = Number(customPrice)
    const quantity = Number(customQuantity)

    if (!name || Number.isNaN(price) || price <= 0 || Number.isNaN(quantity) || quantity <= 0) {
      alert("Please enter valid custom item name, price, and quantity")
      return
    }

    const key = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setItems((prev) => [
      ...prev,
      {
        key,
        product: null,
        name,
        image: "/placeholder.svg",
        price,
        quantity,
        sku: "CUSTOM",
        isCustom: true,
      },
    ])

    setCustomName("")
    setCustomPrice("")
    setCustomQuantity(1)
  }

  /** Type a quantity directly. Blank is allowed while typing; it settles to 1 on blur. */
  const setQty = (itemKey, raw) => {
    const next = raw === "" ? "" : Math.max(1, Math.floor(Number(raw) || 1))
    setItems((prev) => prev.map((it) => (it.key === itemKey ? { ...it, quantity: next } : it)))
  }

  const updateQty = (itemKey, delta) => {
    setItems((prev) =>
      prev
        .map((it) => (it.key === itemKey ? { ...it, quantity: Math.max(1, (it.quantity || 1) + delta) } : it))
        .filter((it) => (it.quantity || 1) > 0),
    )
  }

  const removeItem = (itemKey) => setItems((prev) => prev.filter((it) => it.key !== itemKey))

  // An edited price lives on this document only. Nothing here writes back to
  // the product, so the catalogue price is untouched.
  const updateItemPrice = (itemKey, value) =>
    setItems((prev) => prev.map((it) => (it.key === itemKey ? { ...it, price: value, priceEdited: true } : it)))

  const resetItemPrice = (itemKey) =>
    setItems((prev) =>
      prev.map((it) =>
        it.key === itemKey && !it.isCustom
          ? { ...it, price: priceMode === "wholesale" ? it.wholesalePrice : it.regularPrice, priceEdited: false }
          : it,
      ),
    )

  // Switching the mode re-prices catalogue lines, but leaves a price the admin
  // typed by hand alone -- that edit was deliberate.
  const changePriceMode = (nextMode) => {
    setPriceMode(nextMode)
    setItems((prev) =>
      prev.map((it) =>
        it.isCustom || it.priceEdited
          ? it
          : { ...it, price: nextMode === "wholesale" ? it.wholesalePrice : it.regularPrice },
      ),
    )
  }

  const hasContact = shipping.name && shipping.email && shipping.phone
  const canSubmit =
    items.length > 0 &&
    hasContact &&
    (deliveryType === "pickup" ? Boolean(pickupDetails.storeId) : Boolean(shipping.address))

  // Parking a document leaves the admin ready for the next one, so the form is
  // cleared rather than the page navigated away from.
  const resetForm = () => {
    setItems([])
    setSelectedUser(null)
    setShipping({ name: "", email: "", phone: "", address: "", city: "", state: "", zipCode: "" })
    setDeliveryType("home")
    setPickupDetails({ storeId: "", phone: "" })
    setShippingPrice(0)
    setDiscountMode("amount")
    setDiscountInput(0)
    setAdditionalChargeName("Additional charges")
    setAdditionalCharge(0)
    setTaxCustom(false)
    setShowBankDetails(false)
    setSendCustomerEmail(false)
    setUpdateUserProfile(false)
    setProductQuery("")
    setProductResults([])
    setFilters({ parentCategory: "", subcategory: "", brand: "" })
  }

  // One shape for every way this document can be saved -- the buttons, and the
  // auto-save that runs when the screen is left.
  const buildPayload = (hold = false) => ({
      // Falls back to whoever the recalled document already belonged to, so
      // reopening and saving never quietly detaches it from its customer.
      userId: selectedUser?._id || recalledDoc?.user?._id || recalledDoc?.user || null,
      documentType: mode,
      // Held documents stay on the Recent Quotation page marked On Hold until
      // someone releases them.
      quotationStatus: hold ? "Hold" : "Draft",
      sendCustomerEmail,
      orderItems: items.map((it) => ({
        name: it.name,
        quantity: Number(it.quantity) || 1,
        image: it.image || "/placeholder.svg",
        // The price the document actually charges: the net price typed here with
        // this document's VAT added. Stored VAT-inclusive so the invoice's line
        // totals add up to the order total at any rate.
        price: Number(lineCharged(num(it.price), taxRate).toFixed(2)),
        // Stamped equal to the charged price on purpose. The price an admin types
        // IS the agreed price -- there is no RRP behind it. Without this the
        // invoice falls back to the product's catalogue price to find a "base",
        // and anything typed below catalogue shows up as a discount nobody gave.
        basePrice: Number(lineCharged(num(it.price), taxRate).toFixed(2)),
        product: it.product || undefined,
      })),
      deliveryType,
      // The server keeps whichever half matches the delivery type and drops
      // the other, so both are sent and it decides.
      shippingAddress: {
        name: shipping.name,
        email: shipping.email,
        phone: shipping.phone,
        address: shipping.address,
        city: shipping.city,
        state: shipping.state,
        zipCode: shipping.zipCode,
      },
      pickupDetails:
        deliveryType === "pickup"
          ? {
              // The branch name, address and phone are copied onto the order
              // rather than referenced, so an order still reads correctly if a
              // branch is later renamed or closed.
              phone: pickupDetails.phone || shipping.phone,
              // The customer travels with the collection, since there is no
              // shipping address on this order to carry them.
              name: shipping.name,
              location: findStore(pickupDetails.storeId)?.name || "",
              storeId: pickupDetails.storeId,
              storeAddress: findStore(pickupDetails.storeId)?.address || "",
              storePhone: findStore(pickupDetails.storeId)?.phone || "",
              email: shipping.email,
            }
          : undefined,
      itemsPrice: Number(itemsNet.toFixed(2)),
      shippingPrice: Number((Number(shippingPrice) || 0).toFixed(2)),
      taxPrice: Number(taxPrice.toFixed(2)),
      // Sent so the invoice can split each line at this rate rather than
      // assuming the store default.
      taxRate: num(taxRate),
      showBankDetails,
      discountAmount: Number(discountAmount.toFixed(2)),
      paymentCharges:
        additionalChargesTotal > 0
          ? [
              {
                name: additionalChargeName.trim() || "Additional charges",
                amount: Number(additionalChargesTotal.toFixed(2)),
              },
            ]
          : [],
      totalPrice: Number(totalPrice.toFixed(2)),
      paymentMethod: paymentMethod === "tabby" ? "card" : paymentMethod,
      actualPaymentMethod: paymentMethod,
      customerNotes: "",
      status: "New",
  })

  // Saving without any of the on-screen feedback, for the moment the admin
  // navigates away. It cannot await or report anything -- the screen is already
  // going -- so it fires the request and lets it finish on its own.
  const autoSaveOnLeave = () => {
    const snapshot = autoSaveRef.current

    // `disabled` is read here rather than relying on `enabled`, which is
    // computed during render. A deliberate save sets disabled *after* the last
    // render -- nothing re-renders between the save and navigating away -- so
    // `enabled` is still true at unmount and the auto-save would file a second,
    // identical document as a Draft beside the one just saved.
    if (!snapshot?.enabled || snapshot.disabled) return

    const payload = { ...snapshot.payload, quotationStatus: "Draft" }
    const request = snapshot.recalledId
      ? adminAPI.updateQuotation(snapshot.recalledId, payload)
      : adminAPI.createOrder(payload)

    request.catch((e) => console.error("[create-document] auto-save failed:", e))
  }

  // Refreshed every render so the unmount cleanup below reads live values.
  // Nothing is auto-saved unless there is actually something worth keeping: a
  // customer and at least one line. Opening the screen and clicking away must
  // not litter Recent Quotation with empty drafts.
  autoSaveRef.current = {
    enabled: items.length > 0 && Boolean(shipping.name) && !autoSaveRef.current?.disabled,
    disabled: autoSaveRef.current?.disabled || false,
    recalledId,
    payload: buildPayload(false),
  }

  useEffect(
    () => () => {
      autoSaveOnLeave()
    },
    [],
  )

  // A document that has already reached the Orders queues -- either because it
  // was moved there, or because this is the order itself. It stays fully
  // editable; what changes is that there is no draft to park any more, and the
  // edit has to reach the live order.
  const isLiveOrder = recalledDoc?.documentType === "order"
  const isConverted = recalledDoc?.quotationStatus === "Converted" || Boolean(recalledDoc?.convertedOrderId)
  const editingLiveWork = isLiveOrder || isConverted

  const handleCreate = async (hold = false) => {
    try {
      if (updateUserProfile && selectedUser?._id) {
        await adminAPI.updateUser(selectedUser._id, {
          name: shipping.name,
          email: shipping.email,
          phone: shipping.phone,
          address: {
            street: shipping.address,
            city: shipping.city,
            state: shipping.state,
            zipCode: shipping.zipCode,
          },
        })
      }

      const payload = buildPayload(hold)

      // Saved deliberately, so the auto-save must not fire again as this screen
      // unmounts on the way to the next page.
      autoSaveRef.current.disabled = true

      const created = recalledId
        ? await adminAPI.updateQuotation(recalledId, payload)
        : await adminAPI.createOrder(payload)
      const label = mode === "quotation" ? "Quotation" : "Order"

      // A customer typed in by hand now gets an account, so the next document
      // for them can be found through the user search above. The temp password
      // is shown once and never again -- it is not stored in readable form.
      const account = created?.customerAccount
      const accountNote = account?.created
        ? `\n\nA customer account was created for ${account.email}.\n` +
          `Temporary password: ${account.tempPassword}\n` +
          "They will be asked to change it when they first sign in. " +
          "If you do not pass it on, they can use Forgot Password instead."
        : ""

      // Both modes stage the document. It only reaches the Orders queues when
      // an admin moves it across from the Recent Quotation page.
      alert(
        `${label} ${recalledId ? "saved" : "created"} successfully. #${created?._id?.slice?.(-6) || ""}\n\n` +
          (hold
            ? 'It is parked On Hold. Use the "On Hold" button at the top of this page to recall it.'
            : 'It is saved on the Recent Quotation page. Use "Move to Orders" there when it is ready to be fulfilled.') +
          accountNote,
      )

      // Parking a new document keeps the admin here, with the On Hold counter in
      // the header now one higher and the form ready for the next one. Everything
      // else goes to the staging list to be acted on.
      if (hold && !recalledId) {
        setHeldCount((count) => count + 1)
        resetForm()
        return
      }

      // Back to wherever this document actually lives.
      navigate(isLiveOrder ? "/admin/orders" : "/admin/orders/quotations")
    } catch (e) {
      console.error("[create-document] create error:", e)
      alert(e?.message || "Failed to create document")
    }
  }

  return (
    <div className="ml-64 p-6">
      {recalledId && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <div className="text-sm text-blue-900">
            {loadingRecalled ? (
              "Opening the saved document..."
            ) : loadError ? (
              <span className="text-red-700">{loadError}</span>
            ) : (
              <>
                Editing <span className="font-semibold">#{String(recalledDoc?._id || "").slice(-6)}</span>
                {recalledDoc?.quotationStatus === "Hold" && (
                  <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                    On Hold
                  </span>
                )}
                {editingLiveWork && (
                  <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    {isLiveOrder ? "Live order" : "Moved to Orders"}
                  </span>
                )}
                <span className="block text-xs text-blue-800">
                  {isConverted
                    ? "Saving updates this document and the order made from it, so the two cannot disagree."
                    : "Saving updates this document. It will not create a second copy."}
                </span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              // Cancel means discard. Without this the auto-save would write the
              // very edits the admin just backed out of.
              autoSaveRef.current.disabled = true
              navigate(isLiveOrder ? "/admin/orders" : "/admin/orders/quotations")
            }}
            className="rounded border border-blue-300 px-3 py-1.5 text-sm text-blue-800 hover:bg-blue-100"
          >
            Discard changes
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{recalledId ? "Edit Order / Quotation" : "Create Order / Create Quotation"}</h1>
        <div className="flex flex-wrap items-center gap-3">
          {heldCount > 0 && (
            <button
              type="button"
              onClick={() => navigate("/admin/orders/quotations?status=Hold")}
              className="inline-flex items-center gap-2 rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-800 hover:bg-orange-100"
              title="Open the documents parked on hold, to recall or release them"
            >
              <PauseCircle size={16} />
              On Hold ({heldCount})
            </button>
          )}

          <div className="inline-flex rounded-md border overflow-hidden">
          <button
            type="button"
            onClick={() => setMode("order")}
            className={`px-4 py-2 text-sm ${mode === "order" ? "bg-lime-600 text-white" : "bg-white text-gray-700"}`}
          >
            Create Order
          </button>
          <button
            type="button"
            onClick={() => setMode("quotation")}
            className={`px-4 py-2 text-sm ${mode === "quotation" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
          >
            Create Quotation
          </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <User size={18} />
              <h2 className="font-semibold">Users</h2>
            </div>
            <div className="inline-flex rounded-md border overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => setDeliveryType("home")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${
                  deliveryType === "home" ? "bg-lime-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Truck size={14} />
                Home delivery
              </button>
              <button
                type="button"
                onClick={() => setDeliveryType("pickup")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${
                  deliveryType === "pickup" ? "bg-lime-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Store size={14} />
                Pick up from store
              </button>
            </div>
          </div>
          <div className="relative">
            <input
              type="text"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Search users by name or email"
              className="w-full border rounded px-3 py-2 pr-8"
            />
            <Search className="absolute right-2 top-2.5 text-gray-400" size={18} />
          </div>
          {users.length > 0 && (
            <div className="border rounded mt-2 max-h-56 overflow-auto">
              {users.map((u) => (
                <button
                  key={u._id}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-gray-50"
                  onClick={() => onSelectUser(u)}
                >
                  <div className="font-medium">{u.name}</div>
                  <div className="text-sm text-gray-600">{u.email}</div>
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="Name"
                value={shipping.name}
                onChange={(e) => setShipping((s) => ({ ...s, name: e.target.value }))}
                className="border rounded px-3 py-2"
              />
              <input
                placeholder="Email"
                value={shipping.email}
                onChange={(e) => setShipping((s) => ({ ...s, email: e.target.value }))}
                className="border rounded px-3 py-2"
              />
              <input
                placeholder="Phone"
                value={shipping.phone}
                onChange={(e) => setShipping((s) => ({ ...s, phone: e.target.value }))}
                className="border rounded px-3 py-2"
              />
              {deliveryType === "home" && (
                <input
                  placeholder="Address"
                  value={shipping.address}
                  onChange={(e) => setShipping((s) => ({ ...s, address: e.target.value }))}
                  className="border rounded px-3 py-2 col-span-2"
                />
              )}
              {deliveryType === "home" && (
                <>
                  <input
                    placeholder="City"
                    value={shipping.city}
                    onChange={(e) => setShipping((s) => ({ ...s, city: e.target.value }))}
                    className="border rounded px-3 py-2"
                  />
                  <input
                    placeholder="State"
                    value={shipping.state}
                    onChange={(e) => setShipping((s) => ({ ...s, state: e.target.value }))}
                    className="border rounded px-3 py-2"
                  />
                  <input
                    placeholder="Zip Code"
                    value={shipping.zipCode}
                    onChange={(e) => setShipping((s) => ({ ...s, zipCode: e.target.value }))}
                    className="border rounded px-3 py-2"
                  />
                </>
              )}
            </div>

            {deliveryType === "pickup" && (
              <div className="mt-1 rounded-lg border border-lime-200 bg-lime-50/60 p-3">
                <label className="block text-sm font-medium text-gray-800" htmlFor="pickup-store">
                  Collect from
                </label>
                <select
                  id="pickup-store"
                  value={pickupDetails.storeId}
                  onChange={(e) => setPickupDetails((p) => ({ ...p, storeId: e.target.value }))}
                  className="mt-1 w-full rounded border bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select a branch</option>
                  {visibleStores().map((store) => (
                    <option key={store.storeId} value={store.storeId}>
                      {store.name}
                    </option>
                  ))}
                </select>

                {findStore(pickupDetails.storeId) && (
                  <p className="mt-2 text-xs leading-relaxed text-gray-600">
                    {findStore(pickupDetails.storeId).address}
                    <span className="mt-0.5 block text-gray-500">
                      Branch phone: {findStore(pickupDetails.storeId).phone}
                    </span>
                  </p>
                )}

                <input
                  placeholder="Contact number for collection (optional)"
                  value={pickupDetails.phone}
                  onChange={(e) => setPickupDetails((p) => ({ ...p, phone: e.target.value }))}
                  className="mt-2 w-full rounded border px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Left blank, the customer&apos;s phone above is used. No delivery address is needed for a
                  collection.
                </p>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm mt-2">
              <input
                type="checkbox"
                checked={updateUserProfile}
                onChange={(e) => setUpdateUserProfile(e.target.checked)}
              />
              Update user profile with above details
            </label>

            <label className="flex items-start gap-2 text-sm mt-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={sendCustomerEmail}
                onChange={(e) => setSendCustomerEmail(e.target.checked)}
              />
              <span>
                Email the customer a copy
                <span className="block text-xs text-gray-500">
                  Leave unticked to save it without sending anything.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2 text-sm mt-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={showBankDetails}
                onChange={(e) => setShowBankDetails(e.target.checked)}
              />
              <span>
                Show bank details on receipt
                <span className="block text-xs text-gray-500">
                  Prints our account details on the printed document.
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Package size={18} />
              <h2 className="font-semibold">Products</h2>
            </div>
            <div className="inline-flex rounded-md border overflow-hidden text-sm">
              {PRICE_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => changePriceMode(m.id)}
                  className={`px-3 py-1.5 ${
                    priceMode === m.id ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-500 -mt-2 mb-3">
            {priceMode === "wholesale"
              ? "Products are added at their wholesale price. Anything without one falls back to the regular price."
              : "Products are added at their regular price."}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="relative md:col-span-3">
              <input
                ref={productSearchRef}
                type="text"
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="Search by SKU or name"
                className="w-full border rounded px-3 py-2 pr-8"
              />
              <Search className="absolute right-2 top-2.5 text-gray-400" size={18} />
            </div>
            <select
              value={filters.parentCategory}
              onChange={(e) => setFilters((f) => ({ ...f, parentCategory: e.target.value, subcategory: "" }))}
              className="border rounded px-2 py-2"
            >
              <option value="">All Categories</option>
              {parentCategories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={filters.subcategory}
              onChange={(e) => setFilters((f) => ({ ...f, subcategory: e.target.value }))}
              className="border rounded px-2 py-2"
            >
              <option value="">All Subcategories</option>
              {subcategories
                .filter(
                  (s) =>
                    !filters.parentCategory ||
                    s.category === filters.parentCategory ||
                    s.category?._id === filters.parentCategory,
                )
                .map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
            </select>
            <select
              value={filters.brand}
              onChange={(e) => setFilters((f) => ({ ...f, brand: e.target.value }))}
              className="border rounded px-2 py-2"
            >
              <option value="">All Brands</option>
              {brands.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {productResults.length > 0 && (
            <div className="border rounded mt-3 max-h-56 overflow-auto">
              {productResults.map((p) => (
                <div key={p._id} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0">
                  <div>
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-xs text-gray-500">SKU: {p.sku || "-"}</div>
                    <div className="text-xs text-gray-600">{currency(p.offerPrice || p.price || 0)}</div>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 bg-lime-600 text-white text-sm px-3 py-1 rounded"
                    onClick={() => addProduct(p)}
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 border-t pt-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={16} />
              <h3 className="font-semibold text-sm">Custom Line Item</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input
                type="text"
                placeholder="Product Name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="border rounded px-2 py-2 md:col-span-2"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Price"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                className="border rounded px-2 py-2"
              />
              <input
                type="number"
                min="1"
                step="1"
                placeholder="Qty"
                value={customQuantity}
                onChange={(e) => setCustomQuantity(e.target.value)}
                className="border rounded px-2 py-2"
              />
            </div>
            <button
              type="button"
              onClick={addCustomItem}
              className="mt-2 inline-flex items-center gap-1 bg-blue-600 text-white text-sm px-3 py-1 rounded"
            >
              <Plus size={14} /> Add Custom Product
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-3">Items</h2>
          {items.length === 0 ? (
            <div className="text-sm text-gray-500">No items selected yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Product</th>
                    <th className="text-center py-2">Qty</th>
                    <th className="text-right py-2">Price</th>
                    <th className="text-right py-2">Total</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.key} className="border-b">
                      <td className="py-2">
                        <div className="font-medium">{it.name}</div>
                        <div className="text-xs text-gray-500">SKU: {it.sku || "-"}</div>
                        {it.isCustom && <div className="text-xs text-blue-600">Custom Item</div>}
                      </td>
                      <td className="py-2">
                        <div className="flex items-center justify-center gap-2">
                          <button type="button" onClick={() => updateQty(it.key, -1)} className="p-1 border rounded">
                            <Minus size={14} />
                          </button>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={it.quantity}
                            onChange={(e) => setQty(it.key, e.target.value)}
                            onBlur={(e) => setQty(it.key, e.target.value === "" ? 1 : e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            className="w-16 border rounded px-2 py-1 text-center"
                          />
                          <button type="button" onClick={() => updateQty(it.key, 1)} className="p-1 border rounded">
                            <Plus size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="py-2">
                        <div className="flex flex-col items-end gap-1">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={it.price}
                            onChange={(e) => updateItemPrice(it.key, e.target.value)}
                            className="w-28 border rounded px-2 py-1 text-right"
                            aria-label={`Price for ${it.name}`}
                          />
                          {it.priceEdited && !it.isCustom && (
                            <button
                              type="button"
                              onClick={() => resetItemPrice(it.key)}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Edited &middot; reset
                            </button>
                          )}
                          {!it.priceEdited && !it.isCustom && priceMode === "wholesale" && !it.hasWholesale && (
                            <span className="text-xs text-amber-600">No wholesale price</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        {currency(num(it.price) * num(it.quantity))}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeItem(it.key)}
                          className="p-1 text-red-600 hover:text-red-700"
                          title="Remove item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={5} className="py-2 text-xs text-gray-500">
                      Prices are entered without VAT &mdash; the figures above are the net amounts.
                      VAT is added on top at the Tax/Vat rate beside the totals; set it to 0 for an
                      exempt sale. Editing a price changes this document only; the product itself is
                      never touched.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-3">Totals</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Total without VAT</span>
              <span>{currency(itemsNet)}</span>
            </div>

            {/* Discount — money off, or a percentage of the goods. */}
            <div className="flex justify-between items-center gap-2">
              <span className="flex items-center gap-1">
                <Percent size={14} />
                Discount
              </span>
              <div className="flex items-center gap-1">
                <select
                  value={discountMode}
                  onChange={(e) => setDiscountMode(e.target.value)}
                  className="border rounded px-1 py-1 text-xs bg-white"
                >
                  <option value="amount">Rs</option>
                  <option value="percent">%</option>
                </select>
                <input
                  type="number"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  className="w-24 border rounded px-2 py-1 text-right"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            {discountMode === "percent" && discountAmount > 0 && (
              <div className="flex justify-between text-xs text-gray-500">
                <span>{num(discountInput)}% of items</span>
                <span>- {currency(discountAmount)}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span>
                Shipping charges <span className="text-xs text-gray-500">(excl. VAT)</span>
              </span>
              <input
                type="number"
                value={shippingPrice}
                onChange={(e) => setShippingPrice(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                className="w-28 border rounded px-2 py-1 text-right"
                min="0"
                step="0.01"
              />
            </div>

            {/* Additional charges — one free-form extra line, shown on the invoice. */}
            <div className="flex justify-between items-center gap-2">
              <input
                type="text"
                value={additionalChargeName}
                onChange={(e) => setAdditionalChargeName(e.target.value)}
                placeholder="Additional charges"
                className="min-w-0 flex-1 border rounded px-2 py-1 text-sm"
              />
              <input
                type="number"
                value={additionalCharge}
                onChange={(e) => setAdditionalCharge(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                className="w-28 border rounded px-2 py-1 text-right"
                min="0"
                step="0.01"
              />
            </div>

            {/* VAT — pick the usual rates, or type any other. */}
            <div className="flex justify-between items-center gap-2">
              <span>Tax/Vat</span>
              <div className="flex items-center gap-1">
                <select
                  value={taxSelectValue}
                  onChange={(e) => {
                    if (e.target.value === "custom") {
                      setTaxCustom(true)
                    } else {
                      setTaxCustom(false)
                      setTaxRate(Number(e.target.value))
                    }
                  }}
                  className="border rounded px-1 py-1 text-xs bg-white"
                >
                  <option value="0">Without VAT</option>
                  <option value="5">5% (standard)</option>
                  <option value="custom">Custom</option>
                </select>
                {showTaxInput && (
                  <input
                    type="number"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="w-20 border rounded px-2 py-1 text-right"
                    min="0"
                    step="0.01"
                  />
                )}
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 text-xs">
                VAT on items after discount + charges
              </span>
              <span>{currency(taxPrice)}</span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span>Payment Method</span>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-40 border rounded px-2 py-1 text-right text-sm bg-white"
              >
                <option value="cod">Cash on Delivery (COD)</option>
                <option value="card">Debit/Credit Card</option>
                <option value="tabby">Tabby (Pay Later)</option>
                <option value="tamara">Tamara (Split Payments)</option>
              </select>
            </div>

            <div className="border-t pt-2 flex justify-between font-semibold">
              <span>Total Amount</span>
              <span>{currency(totalPrice)}</span>
            </div>
          </div>

          <button
            disabled={!canSubmit}
            onClick={() => handleCreate(false)}
            className={`mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded text-white ${
              canSubmit ? "bg-lime-600 hover:bg-lime-700" : "bg-gray-400 cursor-not-allowed"
            }`}
            title={!canSubmit ? "Add at least one item and fill shipping details" : `Create ${mode}`}
          >
            <Save size={16} />
            {recalledId
              ? `Save ${mode === "quotation" ? "Quotation" : "Order"}`
              : mode === "quotation"
                ? "Create Quotation"
                : "Create Order"}
          </button>

          {/* Parking only makes sense for work that has not been sent to the
              warehouse. A live order is already in a queue with its own status. */}
          {!editingLiveWork && (
            <button
              disabled={!canSubmit}
              onClick={() => handleCreate(true)}
              className={`mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded border ${
                canSubmit
                  ? "border-orange-300 text-orange-700 hover:bg-orange-50"
                  : "border-gray-200 text-gray-400 cursor-not-allowed"
              }`}
              title={
                !canSubmit
                  ? "Add at least one item and fill shipping details"
                  : "Save it parked on the Recent Quotation page"
              }
            >
              <PauseCircle size={16} />
              {recalledId ? "Save & keep On Hold" : "Save on Hold"}
            </button>
          )}

          <p className="text-xs text-gray-500 mt-2">
            {editingLiveWork ? (
              <>
                {isLiveOrder
                  ? "This is a live order. Saving updates it in place and leaves its status, payment state and tracking untouched."
                  : "This document has been moved to Orders. Saving updates both it and the order made from it."}{" "}
                Leaving this page saves your changes automatically &mdash; press Discard changes to leave without
                saving.
              </>
            ) : recalledId ? (
              <>
                Saving keeps it on <span className="font-medium">Recent Quotation</span>. The plain save releases a
                held document back to Draft; use <span className="font-medium">Save &amp; keep On Hold</span> to
                leave it parked. Leaving this page saves your changes as a Draft automatically &mdash; press
                Discard changes to leave without saving.
              </>
            ) : (
              <>
                Saved to <span className="font-medium">Recent Quotation</span> first. It reaches the Orders queues
                only when you move it there. <span className="font-medium">Save on Hold</span> parks it there
                instead, until you release it. Leaving this page with a customer and at least one item saves it
                as a Draft automatically, so nothing is lost.
              </>
            )}
          </p>

          {discountAmount > 0 && (
            <p className="text-xs text-gray-500 mt-2">Note: Special discount will appear on the invoice.</p>
          )}
        </div>
      </div>
    </div>
  )
}
