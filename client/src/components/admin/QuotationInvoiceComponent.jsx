// The invoice for documents raised on the Create Order/Quotation screen.
//
// Deliberately a separate file from InvoiceComponent: a storefront order and an
// admin-raised document describe different things. Here the price an admin typed is
// the agreed price -- there is no catalogue "was" price behind it -- so this one never
// shows a saving it had to infer. Changing one invoice no longer disturbs the other.
import React, { forwardRef } from "react"
import { getInvoiceBreakdown } from "../../utils/invoiceBreakdown"
import { computeBaseSubtotal, deriveBaseDiscount } from "../../utils/orderPricing"
import { getPaymentMethodDisplay, getOrderCountryName, formatOrderPrice } from "../../utils/paymentUtils"
import { splitItemsVat, formatVatRateLabel, splitVatInclusive } from "../../utils/vat"
import { orderPickupStore } from "../../utils/orderCustomer"

// Our own trading details. Kept here rather than typed into the markup so the header
// reads from one place.
// PLACEHOLDERS -- these print on documents customers receive, so they must be replaced
// with the real registered details before any invoice or quotation is issued. They are
// left obviously blank rather than carried over from the previous owner, whose company,
// tax number and bank account were printing on this shop's paperwork.
const COMPANY = {
  name: "IRHA'S WARDROBE",
  address: "[registered business address], Pakistan",
  phone: "[customer service number]",
  email: "sales@irhaas.com",
  website: "https://www.irhaas.com",
  trn: "[NTN / STRN]",
}

// Printed only when the document was saved with "Show bank details on receipt".
const BANK = [
  ["BANK NAME", "[bank name]"],
  ["ACCOUNT TYPE", "PKR ACCOUNT"],
  ["ACCOUNT NAME", "[account title]"],
  ["ACCOUNT NUMBER", "[account number]"],
  ["IBAN NUMBER", "[IBAN]"],
  ["SWIFT CODE", "[SWIFT]"],
]

/** One "LABEL  ...  value" line with its Arabic caption, as the reference invoice has. */
function Row({ label, ar, value, wide = false }) {
  if (!value) return null
  return (
    // shrink-0 on the label and the Arabic matters: without it flex squeezes them and
    // the Arabic collapses to one letter per line.
    // Fixed-width label so every value lines up in its own column, exactly as the
    // reference invoice has it, with the Arabic pinned to the right edge.
    <div className={`flex items-baseline gap-2 text-[12px] leading-[22px] ${wide ? "sm:col-span-2" : ""}`}>
      <span className="w-[124px] shrink-0 font-bold text-black">{label}:</span>
      <span className="min-w-0 flex-1 break-words font-bold text-black">{value}</span>
      {/* bdi + isolate: without it the Latin label and value either side can reorder the
          Arabic run, which is what printed it back to front. */}
      <bdi dir="rtl" style={ARABIC_ISOLATED} className="shrink-0 text-[11px] font-bold text-black">
        {ar}:
      </bdi>
    </div>
  )
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

/** 0-999 in words; the building block for the amount written out in full. */
function threeDigitsToWords(n) {
  if (n === 0) return ""
  if (n < 20) return ONES[n]
  if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`
  return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${threeDigitsToWords(n % 100)}` : ""}`
}

/**
 * "Rs 4,100.50" -> "Four Thousand One Hundred Dirhams and Fifty Fils".
 * Written out because an invoice that states the amount only in figures is easier to
 * alter after it leaves us.
 */
function amountInWords(amount) {
  const value = Math.max(0, Number(amount) || 0)
  const dirhams = Math.floor(value)
  const fils = Math.round((value - dirhams) * 100)

  if (dirhams === 0 && fils === 0) return "Zero Dirhams"

  const scales = [
    [1e9, "Billion"],
    [1e6, "Million"],
    [1e3, "Thousand"],
  ]
  let rest = dirhams
  const parts = []
  for (const [size, name] of scales) {
    const count = Math.floor(rest / size)
    if (count > 0) {
      parts.push(`${threeDigitsToWords(count)} ${name}`)
      rest -= count * size
    }
  }
  if (rest > 0) parts.push(threeDigitsToWords(rest))

  const dirhamWords = parts.length ? `${parts.join(" ")} Dirham${dirhams === 1 ? "" : "s"}` : ""
  const filsWords = fils > 0 ? `${threeDigitsToWords(fils)} Fils` : ""
  return [dirhamWords, filsWords].filter(Boolean).join(" and ")
}

/** A column heading with its Arabic caption underneath. */
function Th({ children, align = "text-center" }) {
  return (
    <th className={`border border-lime-300 px-3 py-2 text-xs font-bold leading-tight ${align}`}>{children}</th>
  )
}

// Named explicitly so the browser cannot fall back to a Nastaliq (Urdu-style) face,
// which is what made the Arabic look like a different script.
const ARABIC_FONT = { fontFamily: '"Noto Sans Arabic", "Noto Naskh Arabic", "Segoe UI", Tahoma, Arial, sans-serif' }

// Same face, plus bidi isolation so a run of Arabic is laid out on its own and never
// reordered by the Latin text sitting beside it.
const ARABIC_ISOLATED = { ...ARABIC_FONT, unicodeBidi: "isolate", direction: "rtl" }

function Ar({ children }) {
  return (
    // textAlign is set inline, not via a class: direction:rtl is also inline, and an
    // inline rule beats the class, so the caption kept resolving to the right edge.
    <bdi
      dir="rtl"
      style={{ ...ARABIC_ISOLATED, textAlign: "center", display: "block", width: "100%" }}
      className="text-xs font-bold text-white"
    >
      {children}
    </bdi>
  )
}

const QuotationInvoiceComponent = forwardRef(({ order, showStatus, isQuotation = true }, ref) => {

  const formatPrice = (price) => {
    return formatOrderPrice(price, order)
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString()
  }

  const resolvedItems = Array.isArray(order?.orderItems) ? order.orderItems : []
  
  // Separate protection items from regular items
  const protectionItems = resolvedItems.filter(item => item.isProtection || item.protectionData || item.protectionFor)
  const regularItems = resolvedItems.filter(item => !item.isProtection && !item.protectionData && !item.protectionFor)
  
  const baseSubtotal = computeBaseSubtotal(regularItems)

  const { subtotal, shipping, tax, total, vatRate, couponCode, couponDiscount, referralDiscount, loyaltyDiscount, displaySubtotal, displayTotal, codFee,
    codShippingFee,
    isCOD,
    paymentCharges,
    hasPaymentCharges,
    paymentChargesTotal,
  } = getInvoiceBreakdown(order)
  // Only a base price stamped on the line itself counts here. The shared helper also
  // falls back to the linked product's catalogue price, which on an admin document
  // turns any price typed below catalogue into a discount the admin never gave.
  const hasStampedBase = regularItems.some((item) => Number(item?.basePrice) > 0)
  const derivedDiscount = hasStampedBase ? deriveBaseDiscount(baseSubtotal, subtotal) : 0

  // Prices, and the fees added to them, are VAT-inclusive. The VAT line therefore
  // *states* the tax already contained in the total rather than charging it again --
  // adding 5% on top here would bill the customer more than they actually paid. Taking
  // it from displayTotal is what makes the stated VAT cover the shipping and
  // COD/Tabby/Tamara handling fees as well as the goods.
  // Stored prices are VAT-inclusive, so a line shown "without VAT" has it taken back out.
  const exVat = (amount) => splitVatInclusive(Number(amount) || 0, vatRate).net

  const feesTotal = hasPaymentCharges
    ? paymentChargesTotal
    : isCOD
      ? Number(codFee || 0) + Number(codShippingFee || 0)
      : 0

  // The settlement panel. Built so it can only ever balance:
  //   SUBTOTAL - DISCOUNT = AFTER DISCOUNT = NET AMOUNT = what was actually charged.
  const discountTotal =
    Number(couponDiscount || order.discountAmount || 0) + Number(referralDiscount || 0) + Number(loyaltyDiscount || 0)
  const grossBeforeDiscount = displayTotal + discountTotal

  // TOTAL VAT is the tax already inside the amount charged, never added to it: take the
  // goods left after the discount, strip their VAT, and whatever separates that (plus
  // the fees, which are charged net) from the total is the tax.
  //
  // It is derived rather than summed from the item rows on purpose -- an older order
  // whose fees were never taxed still prints the exact amount its customer paid, and a
  // discount correctly reduces the tax rather than leaving the rows' pre-discount total.
  const goodsGrossAfterDiscount = Math.max(0, Number(subtotal || 0) - discountTotal)
  const vatShown = Math.max(0, displayTotal - exVat(goodsGrossAfterDiscount) - shipping - feesTotal)
  const paidAmount = order.isPaid ? displayTotal : 0
  const dueAmount = Math.max(0, displayTotal - paidAmount)

  // Prices include VAT, so each line is split at this document's own rate. The
  // column footers are summed from these same figures, so what is printed
  // always adds up.
  const vatLabel = formatVatRateLabel(vatRate)
  // On an exempt (0%) document the net, the VAT and the total are all the same
  // figure, so those two columns say nothing and are dropped.
  const showVatColumns = vatRate > 0
  const regularVat = splitItemsVat(regularItems, vatRate)
  const protectionVat = splitItemsVat(protectionItems, vatRate)
  const vatByKey = new Map(
    [...regularVat.lines, ...protectionVat.lines].map((line) => [line.item, line]),
  )
  const lineVat = (item) => vatByKey.get(item) || { net: 0, vat: 0, gross: 0 }

  // Three documents, one template:
  //   still a quotation (draft / on hold)  -> QUOTATION, no TRN
  //   converted and carrying VAT           -> TAX INVOICE + TRN + Arabic wording
  //   converted with no VAT                -> Performa Invoice, no TRN
  // Only a VAT-bearing invoice is a tax document, so only that one may show the TRN.
  // Once a quotation has been moved to Orders it is no longer an offer, so the same
  // record stops printing as one. The quotation row keeps its own status, but the
  // document it produces now reads as the invoice it became.
  const isConverted = Boolean(order.convertedOrderId) || order.quotationStatus === "Converted"
  const showAsQuotation = isQuotation && !isConverted
  const isTaxDocument = !showAsQuotation && vatRate > 0
  const documentNumber = `#${String(order?._id || "").slice(-6)}`

  const pickup = order.deliveryType === "pickup"
  const addr = pickup ? order.pickupDetails || {} : order.shippingAddress || {}
  const customer = {
    name: addr.name || addr.fullName || order.user?.name || "",
    address: pickup
      ? orderPickupStore(order).address || ""
      : [addr.address, addr.city, addr.state, addr.zipCode, addr.country].filter(Boolean).join(", "),
    email: addr.email || order.user?.email || "",
    phone: addr.phone || "",
  }

  // The item columns are headed "... AED", so repeating the currency in every cell
  // only crowds them. The totals below still print it.
  const amountOnly = (value) =>
    Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const currentDate = new Date().toLocaleDateString()
  const orderDate = new Date(order.createdAt).toLocaleDateString()

  return (
    <div ref={ref} className="bg-white px-8 pt-8 pb-8 max-w-4xl mx-auto font-sans">
      {/* Header: our own trading details, laid out like the trade invoice this document
          is modelled on. */}
      <div className="text-black">
        <div className="flex items-start justify-between gap-6">
          {/* Left: brand mark, then the TRN and the document title stacked beneath it,
              exactly as the trade invoice this is modelled on. */}
          <div className="flex-shrink-0">
            <img src="/logo.png" alt="Irha's Wardrobe" className="h-20 w-auto max-w-[240px] object-contain object-left" />
            {showAsQuotation ? (
              <p className="mt-1 text-base font-bold leading-tight">QUOTATION</p>
            ) : isTaxDocument ? (
              <>
                <p className="mt-1 text-sm font-bold text-green-700">TRN: {COMPANY.trn}</p>
                <p className="text-base font-bold leading-tight">
                  TAX INVOICE <span dir="rtl" style={ARABIC_ISOLATED} className="font-normal text-black">ضريبة مبسطة</span>
                </p>
              </>
            ) : (
              <p className="mt-1 text-xl font-bold leading-tight text-red-600">Performa Invoice</p>
            )}
          </div>

          {/* Middle: who is issuing it. */}
          <div className="min-w-0 flex-1 text-sm font-semibold leading-5">
            <p>{COMPANY.name}</p>
            <p>{COMPANY.address}</p>
            <p>
              Mobile: {COMPANY.phone} Email:
            </p>
            <p>
              {COMPANY.email} {COMPANY.website}
            </p>
          </div>

          {/* Right: the storefront the document came from. */}
          <div className="flex-shrink-0 text-right">
            <img src="/logo.png" alt="Irha's Wardrobe" className="h-12 w-auto max-w-[140px] object-contain object-right ml-auto" />
            
          </div>
        </div>

        <div className="mt-2 border-t-2 border-lime-600" />
      </div>

      {/* Who it is for, and which document it is. */}
      <div className="mt-3 rounded-lg border border-gray-300 bg-[#f4f3f9] px-4 py-2">
        <div className="grid grid-cols-1 gap-x-6 gap-y-0 sm:grid-cols-2">
          {/* The grid fills row by row, so these alternate left/right column. The
              address goes last: it is the one value that wraps to several lines, and
              anywhere earlier it pushes the rows beside it out of alignment. */}
          <Row label="CUS NAME" ar="اسم العميل" value={customer.name} />
          <Row label={showAsQuotation ? "QUOTATION No" : "INV No"} ar="رقم الفاتورة" value={documentNumber} />
          <Row label="EMAIL" ar="البريد الإلكتروني" value={customer.email} />
          <Row label="DATE" ar="تاريخ الفاتورة" value={orderDate} />
          <Row label="PHONE" ar="رقم الهاتف" value={customer.phone} />
          <Row label="PAYMENT METHOD" ar="طريقة الدفع" value={getPaymentMethodDisplay(order)} />
          <Row label="CUS ADD" ar="عنوان العميل" value={customer.address} wide />
          <Row label="TRACKING ID" ar="رقم التتبع" value={order.trackingId} />
        </div>
      </div>

      {/* Items */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse border-b-2 border-lime-700">
          <thead>
            <tr className="bg-lime-700 text-white">
              <Th>
                PRODUCT NAME<Ar>اسم المنتج</Ar>
              </Th>
              <Th>
                <span className="block">U.Price</span>
                <span className="block">Rs</span>
                <Ar>سعر الوحدة</Ar>
              </Th>
              <Th>
                <span className="block">QUANTITY</span>
                <Ar>الكمية</Ar>
              </Th>
              <Th>
                <span className="block">TOTAL</span>
                <span className="block">Rs</span>
                <Ar>الإجمالي</Ar>
              </Th>
              {showVatColumns && (
                <>
                  <Th>
                    <span className="block">TAX</span>
                    <span className="block">Rs</span>
                    <Ar>الضريبة</Ar>
                  </Th>
                  <Th>
                    <span className="block">SUBTOTAL</span>
                    <span className="block">Rs</span>
                    <Ar>المجموع الفرعي</Ar>
                  </Th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {[...regularItems, ...protectionItems].map((item, index) => {
              const split = lineVat(item)
              const qty = Number(item.quantity) || 0
              const unitNet = qty > 0 ? split.net / qty : split.net
              return (
                <tr key={index} className="border-b border-lime-200">
                  <td className="border-x border-lime-200 px-3 py-2 text-sm">
                    {/* Capped at three lines so one very long product name cannot stretch the row
                        and leave the other columns floating in white space. The full name is
                        kept in the title attribute. */}
                    <div
                      className="font-medium text-gray-900 overflow-hidden"
                      style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}
                      title={item.name}
                    >
                      {item.name}
                    </div>
                    {item.selectedColorData && (
                      <div className="text-xs text-gray-600">Color: {item.selectedColorData.color}</div>
                    )}
                    {item.selectedDosData && (
                      <div className="text-xs text-gray-600">OS: {item.selectedDosData.dosType}</div>
                    )}
                  </td>
                  <td className="border-r border-lime-200 px-3 py-2 text-right text-sm">{amountOnly(unitNet)}</td>
                  <td className="border-r border-lime-200 px-3 py-2 text-center text-sm">{item.quantity} Pc</td>
                  <td className="border-r border-lime-200 px-3 py-2 text-right text-sm">{amountOnly(split.net)}</td>
                  {showVatColumns && (
                    <>
                      <td className="border-r border-lime-200 px-3 py-2 text-right text-sm">{amountOnly(split.vat)}</td>
                      <td className="border-r border-lime-200 px-3 py-2 text-right text-sm font-semibold">
                        {amountOnly(split.gross)}
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Settlement: what is owed on the left, how the total was reached on the right. */}
      <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="text-sm space-y-1">
          <Row label="PAID AMOUNT" ar="المبلغ المدفوع" value={formatPrice(paidAmount)} />
          <Row label="DUE AMOUNT" ar="المبلغ المستحق" value={formatPrice(dueAmount)} />
          {shipping > 0 && <Row label="SHIPPING CHARGES" ar="رسوم الشحن" value={formatPrice(shipping)} />}
          {paymentCharges?.map((charge, idx) => (
            <Row key={idx} label={charge.name?.toUpperCase()} ar="رسوم إضافية" value={formatPrice(charge.amount)} />
          ))}

          <div className="pt-2">
            <p className="font-bold">AMOUNT IN WORDS</p>
            <p className="text-gray-800">{amountInWords(displayTotal)}</p>
          </div>
        </div>

        <div className="text-sm">
          <div className="space-y-1">
            <Row label="SUBTOTAL" ar="المجموع الفرعي" value={formatPrice(grossBeforeDiscount)} />
            <Row label="DISCOUNT" ar="الخصم" value={formatPrice(discountTotal)} />
            <Row label="AFTER DISCOUNT" ar="المبلغ بعد الخصم" value={formatPrice(displayTotal)} />
            {vatRate > 0 && <Row label="TOTAL VAT" ar="إجمالي ضريبة القيمة المضافة" value={formatPrice(vatShown)} />}
          </div>

          <div className="mt-2 flex items-center justify-between gap-3 rounded bg-lime-700 px-3 py-2 text-white">
            <span className="text-sm font-bold">NET AMOUNT</span>
            <span className="text-base font-bold">{formatPrice(displayTotal)}</span>
            <span dir="rtl" style={ARABIC_ISOLATED} className="text-sm">المبلغ الصافي</span>
          </div>
        </div>
      </div>

      {/* Bank details, when this document was saved asking for them. */}
      {order.showBankDetails && (
        <div className="mt-5 border-t border-gray-300 pt-3 text-sm">
          <p className="font-bold">
            *BANK DETAILS: <span dir="rtl" style={ARABIC_ISOLATED} className="text-sm font-normal text-black">تفاصيل البنك</span>
          </p>
          <ul className="mt-1 space-y-0.5">
            {BANK.map(([label, value]) => (
              <li key={label}>
                - {label}: {value}
              </li>
            ))}
            <li>- Cheques to be issued in Favour of &quot;{COMPANY.name}&quot;</li>
            <li>- Mention Invoice number while making the Bank Transfer.</li>
          </ul>
        </div>
      )}

      {/* Notes */}
      {(order.customerNotes || order.notes) && (
        <div className="mt-4 text-sm">
          <p className="font-bold">NOTES</p>
          <p className="text-gray-800">{order.customerNotes || order.notes}</p>
        </div>
      )}

      <div className="mt-6 flex items-end justify-between text-sm">
        <p className="font-bold">For {COMPANY.name}</p>
        <p className="font-bold">Stamp &amp; Signatory</p>
      </div>

      <p className="mt-4 text-center text-sm font-bold">Thank You For Choosing Irhaas</p>

      <div className="text-xs text-end mt-2 opacity-80">🖨️ Printed: {currentDate}</div>
    </div>
  )
})

export default QuotationInvoiceComponent
