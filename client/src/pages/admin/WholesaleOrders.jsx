// Orders raised from a quotation on the Create Order/Quotation screen.
//
// The same screen as Orders, asked for the other half of the list: the server keeps
// retail and wholesale apart, so neither page ever shows the other's rows. Sharing the
// component means the tabs, search, status changes and invoice all behave identically
// and cannot drift apart.
import Orders from "./Orders"

export default function WholesaleOrders() {
  return <Orders wholesale />
}
