import { createRoot } from "react-dom/client"
import { Mail, MailX, ArrowRight } from "lucide-react"

// Nothing reaches a customer's inbox unless an admin says so. The server treats
// every notification as opt-in, and this is the single question the admin is
// asked before one goes out -- one wording, one look, on every screen that can
// trigger a mail.
//
// It is called from plain async handlers rather than from a hook, so the dialog
// is mounted imperatively into its own root and resolves a promise. One root is
// created on first use and reused, instead of one per question.

const refOf = (order = {}) => {
  const ref = order?.trackingId || order?._id || ""
  return ref ? `#${String(ref).slice(-6)}` : "This order"
}

const recipientOf = (order = {}) =>
  order?.shippingAddress?.email || order?.user?.email || order?.pickupDetails?.email || ""

let container = null
let root = null

const getRoot = () => {
  if (!root) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  }
  return root
}

const EmailPrompt = ({ heading, subject, recipient, onAnswer }) => (
  <div
    className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="customer-email-prompt-title"
  >
    <button
      type="button"
      aria-label="Cancel"
      onClick={() => onAnswer(false)}
      className="absolute inset-0 cursor-default bg-gray-900/50 backdrop-blur-sm"
    />

    <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
      <div className="px-6 pt-6 pb-5">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lime-100 text-lime-700">
            <Mail size={20} />
          </span>
          <div className="min-w-0">
            <h2 id="customer-email-prompt-title" className="text-lg font-semibold text-gray-900">
              {heading}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              The change is saved either way. This only decides whether the customer hears about it.
            </p>
          </div>
        </div>

        {/* What is changing, and who would be told. Shown rather than described,
            so the admin can check both at a glance before committing. */}
        <dl className="mt-5 space-y-3 rounded-xl bg-gray-50 p-4 ring-1 ring-gray-200/70">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Change</dt>
            <dd className="min-w-0 text-right text-sm font-medium text-gray-900">{subject}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Recipient</dt>
            <dd className="min-w-0 break-all text-right text-sm font-medium text-gray-900">{recipient}</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50/70 px-6 py-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => onAnswer(false)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1"
        >
          <MailX size={16} />
          Save quietly
        </button>
        <button
          type="button"
          autoFocus
          onClick={() => onAnswer(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-lime-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-lime-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2"
        >
          Save &amp; send email
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  </div>
)

const ask = ({ heading, subject, recipient }) =>
  new Promise((resolve) => {
    const finish = (answer) => {
      document.removeEventListener("keydown", onKeyDown)
      getRoot().render(null)
      resolve(answer)
    }

    // Escape declines rather than cancelling the whole action, because the
    // change itself is not in question here -- only the email is.
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault()
        finish(false)
      }
    }
    document.addEventListener("keydown", onKeyDown)

    getRoot().render(<EmailPrompt heading={heading} subject={subject} recipient={recipient} onAnswer={finish} />)
  })

/**
 * Ask whether to email the customer about a change that is about to be saved.
 *
 * @param {string} change  What is changing, in the admin's words -- "Delivered",
 *                         "Tracking number added", "Moved to Orders"
 * @param {Object} order   The order or quotation being changed
 * @returns {Promise<boolean>} true when the admin wants the email sent
 */
export const askToEmailCustomer = (change, order) => {
  const recipient = recipientOf(order)

  // No address on file means there is nothing to send and nothing to decide, so
  // don't interrupt the admin with a dialog that cannot do anything.
  if (!recipient) return Promise.resolve(false)

  return ask({
    heading: "Email the customer?",
    subject: `${refOf(order)} → ${change}`,
    recipient,
  })
}

/**
 * The same question for a bulk status change, asked once for the batch.
 *
 * Asking per order would mean fifty dialogs for a fifty-order update, so the
 * admin answers once and the answer applies to all of them. Orders in the batch
 * with no email on file are simply skipped by the server.
 *
 * @param {string} change  The status every selected order is moving to
 * @param {number} count   How many orders are in the batch
 * @returns {Promise<boolean>} true when the admin wants the emails sent
 */
export const askToEmailCustomerBulk = (change, count) => {
  const orders = Number(count) || 0
  if (orders < 1) return Promise.resolve(false)

  return ask({
    heading: orders === 1 ? "Email the customer?" : `Email ${orders} customers?`,
    subject: `${orders} ${orders === 1 ? "order" : "orders"} → ${change}`,
    recipient: orders === 1 ? "The customer on this order" : `Every customer in the ${orders} selected orders`,
  })
}
