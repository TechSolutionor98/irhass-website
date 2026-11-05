// The physical stores a customer can collect from. Shared rather than declared
// per page: the storefront checkout and the admin Create Order/Quotation screen
// both offer collection, and a store added in one place has to appear in the
// other.
//
// `visible: false` keeps a store on file (so older orders still resolve its name
// and address) while hiding it from the pickers.
// No collection points yet. The list is empty rather than carrying the previous
// owner's four Dubai branches, which were still being offered to Pakistani customers
// as places to collect an order from.
//
// To add one: give it a storeId, name, address, phone and coordinates, and the
// checkout's "Pickup From Store" option starts working on its own.
export const STORES = []

export const visibleStores = () => STORES.filter((store) => store.visible !== false)

export const findStore = (storeId) => STORES.find((store) => store.storeId === storeId) || null

export default STORES
