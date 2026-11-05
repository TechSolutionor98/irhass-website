import { findStore } from "../data/stores"

// Who an order belongs to, wherever their details ended up.
//
// A delivery order keeps the customer on `shippingAddress`, but a collection has
// no delivery address -- the server stores `pickupDetails` instead and drops
// shippingAddress entirely. Reading `shippingAddress.name` directly therefore
// shows "N/A" for every pickup order, which is how a real customer went missing
// from the Recent Quotation list.
//
// Every screen that names a customer should go through these, so a new delivery
// type can never quietly blank the column again.

export const orderCustomerName = (order = {}) =>
  order?.shippingAddress?.name || order?.pickupDetails?.name || order?.user?.name || ""

export const orderCustomerEmail = (order = {}) =>
  order?.shippingAddress?.email || order?.pickupDetails?.email || order?.user?.email || ""

export const orderCustomerPhone = (order = {}) =>
  order?.shippingAddress?.phone || order?.pickupDetails?.phone || order?.user?.phone || ""

export const isPickupOrder = (order = {}) => order?.deliveryType === "pickup"

/** The branch an order is collected from, or "" for a delivery. */
export const orderPickupBranch = (order = {}) =>
  isPickupOrder(order) ? order?.pickupDetails?.location || "" : ""

// The branch an order is collected from, with the catalogue filling any gaps.
//
// Until the order schema was taught to keep them, `storeAddress` and
// `storePhone` were dropped on save -- so older collection orders show only a
// storeId. Falling back to the store list means those orders still print a real
// branch address instead of "N/A", with no data migration.
export const orderPickupStore = (order = {}) => {
  const stored = order?.pickupDetails || {}
  const store = findStore(stored.storeId)

  return {
    name: stored.location || store?.name || "",
    address: stored.storeAddress || store?.address || "",
    phone: stored.storePhone || store?.phone || "",
  }
}
