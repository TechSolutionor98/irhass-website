# GrabAtoZ parity — what Irha's Wardrobe has, what it was missing

Written for whoever maintains both codebases. This checks every feature from the
GrabAtoZ October 2026 changelog against this repository, says which were already
here, which were genuinely absent, and what was done about the gaps.

Checked on 2026-11-04. Where a feature was claimed to be missing, it was **tested
against the running app and live data**, not inferred from a file listing — two of
them turned out to be already working.

---

## Summary

| GrabAtoZ feature | Status here | Action |
|---|---|---|
| Email campaign system | Already built | — |
| WhatsApp Business (Cloud API) | Already built | — |
| Stock ledger | Already built | — |
| Inventory rebuild + barcode labels | Already built | — |
| Quotations (`documentType` discriminator) | Already built | — |
| Push notification sounds | Already built | — |
| Product search rewrite | **Not needed — tested, already correct** | — |
| Out-of-stock enforcement | **Missing, and worse here** | Fixed |
| Post-code / address validation bug | **Present here too** | Fixed |
| Email case-insensitivity | **Missing** | Fixed |
| Resubscribe from profile | **Missing** | Built |
| Admin view of the opt-out list | **Missing** | Built |
| Bulk-script pattern (dry run, backup, restore) | **Missing** | Built |
| SEO fields | Already built | — |
| Soft-404 fix | **Does not transfer** | See note |
| One discount at a time | Already built | — |
| Mouse-wheel on number inputs | Already built | — |
| Per-document VAT rate + bank-details toggle | Already built | — |

---

## Already here, verified

**Email campaign system.** A different implementation from GrabAtoZ's but the same
shape, and it independently reached the same three rules: one person gets one email,
the opt-out is re-checked immediately before each send, and sending is paced. Here
the first of those is enforced by a unique index on `(campaign, email)` rather than by
code remembering — see `models/emailCampaignRecipientModel.js`.

One deliberate divergence: GrabAtoZ built its editor on TipTap. This one does not,
because `components/TipTapEditor.css` is imported globally by the blog editor and
styles bare `.ProseMirror` with a 200px minimum height. Once any admin page loads it,
it lands on every editor in the bundle. The email editor here is plain
`contentEditable` with prefixed class names (`components/admin/email/RichText.jsx`).

**Product search.** GrabAtoZ had a bug where a product's exact full name returned
nothing. Tested here against live data before changing anything:

```
"Maison Rida Draped Shoulder Gown - Champagne"  -> 1 hit, correct product first
"Maison Rida Draped Shoulder Gown"              -> 2 hits, correct family
"IRH-0009"                                      -> 1 hit, correct product
```

`utils/productSearch.js` already weights relevance and already excludes descriptions
from the default match. No change made.

---

## Gaps that were fixed

### 1. Nothing stopped an out-of-stock order

Worse here than in GrabAtoZ: there was **no stock check on order creation at all**,
not merely a gap in the bundle. Any product, in any state, could be ordered through
the API.

- `server/utils/stockGuard.js` — the rule, one place.
- `server/routes/orderRoutes.js` — the guard, before the price is accepted.
- `client/src/utils/stockGuard.js` + `ProductDetails.jsx` — the bundle checkbox is
  disabled and labelled, the toggle refuses, and the cart payload filters again.

**The subtlety, which is the transferable part.** A naive `countInStock > 0` test
would refuse real sales. `countInStock` is `required: true, default: 0` on the product
and defaults to `0` on every colour and DOS variation, so a product added without a
stock figure reads as zero while sitting on the shelf. The rule is:

> The admin-set status decides. A product marked In Stock is in stock whatever the
> count says; one marked Out of Stock stays out whatever the count says. A variation's
> count speaks only when somebody actually set it — blank, `null` and `undefined` mean
> "nobody has said", not "none left".

Verified against a decision table of eight cases, including the two that would have
broken real sales, and end to end against the running app:

```
full address, product Out of Stock -> 400 "… is out of stock"
```

### 2. The post code was required, and the form said it was optional

The same bug GrabAtoZ hit, present here. The address modal labels Post Code
"(optional)"; both `validateHomeDelivery` on the client and the server required it.
The card path skips the client check, so the first a customer heard of it was a 400.

The error also did not name the field — "Missing shipping address details" sends
someone back to a form that looks filled in with nothing marked.

Both fixed. The server and client now share one required list — name, email, phone,
street address, city, province — and the message names what is missing:

```
"Your delivery address is missing: city, province."
```

Also replaced the leftover **"State / Emirate"** label with "Province".

### 3. Email addresses were case-sensitive

`Fahad@Gmail.com` and `fahad@gmail.com` were two different people: login missed the
record, and the unique index allowed both to register.

`models/plugins/normalizeEmail.js`, applied to `userModel`,
`newsletterSubscriberModel`, `requestCallbackModel`, `bulkPurchaseModel` and
`reviewModel`.

**Why a plugin and not `lowercase: true` on each field.** Mongoose's `lowercase` is a
setter. It runs on save and **not** on queries:

```js
User.find({ email: "Fahad@Gmail.com" }).getFilter()
// -> { email: "Fahad@Gmail.com" }   unchanged
```

So the field option fixes new writes while every `findOne({ email })` keeps missing —
and there are eleven of those across the routes. The plugin normalises writes *and*
query filters (including `$in`, `$eq`, `$ne` and upsert `$setOnInsert`), so it also
holds for lookups written later. `$regex` is left alone: a caller writing one has
chosen their own matching rules.

Verified against live data — mixed case and surrounding whitespace both resolve.

Existing rows are cleaned by `scripts/normalize-emails.mjs`. Current data was already
lowercase, so the dry run reports nothing to do.

### 4. No way to resubscribe

The opt-out is absolute by design, so nothing would ever put somebody back on the
list. Without a route back, anyone who unsubscribed during a busy week was gone for
good.

- `GET` / `PUT /api/unsubscribe/me` — the signed-in person's own setting.
- An **Email Preferences** tab in `pages/Profile.jsx`.

Round trip verified: subscribed → unsubscribed with a reason → resubscribed → clean.

### 5. The opt-out list was invisible to staff

`BulkMails` now has an **Opted out** tab showing the address, how they opted out
(email link, inbox one-click, or profile), the reason they gave, and when. Read-only —
an opt-out is never reversed by staff; the customer does it from their profile.

### 6. No bulk-script pattern

`scripts/lib/bulkWrite.mjs`. Every rule from the GrabAtoZ notes:

1. **Dry run by default.** Nothing without `--write`.
2. **Report before acting** — examined, to change, unchanged, with a preview.
3. **EJSON backup of whole documents, written before the first write.** EJSON, not
   JSON: plain JSON turns an ObjectId into a string, so a restore gives you documents
   that look right and no longer match anything by reference.
4. **`--restore` in the same script.** A backup whose restore has to be written
   afterwards, under pressure, is a file, not a backup.
5. **Prefer hiding to deleting**, for anything an invoice points at.

Tested on a throwaway collection: write → backup → restore. The original came back
exactly, including a field the script never touched, and restore accepts both the bare
filename the script prints and a pasted relative path.

---

## Does not transfer

**The soft-404 fix.** GrabAtoZ served product pages through a Vercel serverless
function (`client/api/product-page.js`) which returned HTTP 200 with an empty shell for
deleted products, and once cached Vercel's own login page and served it site-wide.

This project has no such function. `client/vercel.json` rewrites everything to
`/app.html` as a plain SPA, so there is nothing to validate and no self-fetch to
recurse. **The underlying problem still exists in a different form** — a URL for a
deleted product returns 200 with an empty shell, which Google treats as live and keeps
indexed. Fixing it here needs prerendering or a server-rendered 404 for unknown product
slugs, which is a separate piece of work and was not attempted.

---

## Still outstanding

Unrelated to parity, carried from earlier work:

- **No SMTP credentials.** No email sends at all, campaign or transactional.
- **DKIM missing.** Same problem GrabAtoZ had. Fix before the first campaign.
- **Tabby / Tamara still in the checkout payment flow**, despite being dropped from
  the product page. `services/tamaraService.js` is dead code with UAE URLs in it.
- **Invoice company and bank details are placeholders** — NTN/STRN, account title,
  IBAN.
- **Product photography is Pexels stock on fictional products.**
- **Admin login is `irhaas@gmail.com` with the password set to the same string.**
- **UAE leftovers** in `server.js` (a CORS origin), `paymentRoutes.js` (three
  `FRONTEND_URL` fallbacks), `AddDeliveryCharge.jsx` / `AdminDeliveryCharges.jsx`
  (country defaults), and seeded product `countryStock` rows keyed `AE`.
- **Nothing writes `damage` or supplier-`in` stock movements.** The ledger supports
  them; no screen exists.
