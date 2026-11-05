# Countries, Currencies & Payment Methods — API

How Irhaas handles multiple countries, multiple currencies, and which payment methods
appear at checkout — including how an admin turns a method on or off.

**Base URL:** `https://api.irhaas.com`
**Content type:** `application/json`

---

## Two rules to read first

Everything below makes sense once these two are clear.

### 1. All money is stored in AED. Always.

Product prices, order totals, invoices — every amount in the database and every amount
returned by the API is **AED**. Other currencies exist only at display time: take the AED
figure, multiply by the country's `effectiveRate`, and show the result.

```
displayed price = AED price × effectiveRate
```

**Never send a converted amount back to the server.** Orders are created in AED. An order
carries `currency` / `currencySymbol` fields, but those record what the customer was
*shown* — the numbers beside them are still AED.

### 2. An empty payment-method list means "everything is allowed"

This is the single most common misreading. For both countries and products, a missing or
empty `paymentMethods` array does **not** mean "no methods". It means the admin has never
restricted this one, so every supported method is offered.

That is why a brand-new country works immediately without configuration.

---

# Part 1 — Countries & currencies

## Supported methods and currencies

The platform ships with six GCC countries, seeded automatically on first run:

| Code | Country | Currency | Symbol (EN) | Symbol (AR) |
|---|---|---|---|---|
| `AE` | UAE | `AED` | AED | د.إ |
| `SA` | Saudi Arabia | `SAR` | SAR | ر.س |
| `QA` | Qatar | `QAR` | QAR | ر.ق |
| `OM` | Oman | `OMR` | OMR | ر.ع |
| `BH` | Bahrain | `BHD` | BHD | د.ب |
| `KW` | Kuwait | `KWD` | KWD | د.ك |

**UAE is the default country** (`isDefault: true`) and its rate is always exactly `1.0`,
because AED is the base.

---

## `GET /api/countries/public`

The country/currency switcher list. **Public — no authentication.**

Returns only active countries, sorted by `sortOrder` then `name`.

Cached: `Cache-Control: public, max-age=300, s-maxage=600` (5 min browser, 10 min CDN).

### Response `200`

```json
[
  {
    "id": "6713c2f91a4b8e0012ab34cd",
    "code": "AE",
    "name": "UAE",
    "nameAr": "الإمارات",
    "currencyCode": "AED",
    "currencySymbol": "AED",
    "currencySymbolAr": "د.إ",
    "flagSvg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 600 300\">...</svg>",
    "isDefault": true,
    "effectiveRate": 1,
    "sortOrder": 1
  },
  {
    "id": "6713c2f91a4b8e0012ab34ce",
    "code": "SA",
    "name": "Saudi Arabia",
    "nameAr": "السعودية",
    "currencyCode": "SAR",
    "currencySymbol": "SAR",
    "currencySymbolAr": "ر.س",
    "flagSvg": "<svg ...>...</svg>",
    "isDefault": false,
    "effectiveRate": 1.021,
    "sortOrder": 2
  }
]
```

### Schema

| Field | Type | Notes |
|---|---|---|
| `id` | string | Mongo ObjectId. |
| `code` | string | ISO-2, uppercase. The key you pass everywhere else. |
| `name` | string | English name. |
| `nameAr` | string | Arabic name. |
| `currencyCode` | string | ISO-4217, uppercase. |
| `currencySymbol` | string | For English display. |
| `currencySymbolAr` | string | For Arabic display. |
| `flagSvg` | string | **Raw inline SVG markup, not a URL.** Empty string if unset. |
| `isDefault` | boolean | True for exactly one country (UAE). Its rate is always `1.0`. |
| `effectiveRate` | number | **Multiply AED by this.** See below. |
| `sortOrder` | number | Display order, ascending. |

> `flagSvg` is an SVG document as a string. Render it inline (`dangerouslySetInnerHTML`,
> `SvgPicture.string()`, etc.) — do not put it in an `<img src>`. It may be an empty
> string, so keep a fallback.

### How `effectiveRate` is decided

It is a computed field, not stored. The server picks, in order:

1. Country is the default (UAE) → **`1.0`**, always.
2. `useManualRate` is on and `manualExchangeRate > 0` → **the manual rate**.
3. Otherwise → **`liveExchangeRate`**, or `1.0` if that is somehow 0.

Clients never see which branch ran — just use `effectiveRate`.

### Formatting prices

This is what the web storefront does; match it so web and app agree.

```js
const rate = country.effectiveRate > 0 ? country.effectiveRate : 1.0
const converted = aedAmount * rate

const formatted = new Intl.NumberFormat(isArabic ? "ar-AE" : "en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(converted)

// English: "AED 1,299.00"   — symbol first
// Arabic:  "١٬٢٩٩٫٠٠ د.إ"   — symbol last
return isArabic ? `${formatted} ${symbolAr}` : `${symbol} ${formatted}`
```

Always 2 decimal places. Note the symbol swaps sides between English and Arabic.

> **Rounding caution:** KWD, BHD and OMR have rates around `0.08`–`0.10`, so converted
> values are much smaller than the AED figure. Convert once from the AED source for
> display — never convert a converted number, and never round before converting.

---

## Live exchange rates

Rates refresh from a public FX API with AED as the base:

1. `https://open.er-api.com/v6/latest/AED`
2. falls back to `https://api.exchangerate-api.com/v4/latest/AED`
3. falls back to hardcoded defaults

A 5-second timeout on each. If everything fails the last known rates stay in place —
**rates never become 0 or null.** Each country stores `lastRateUpdated`.

A country set to `useManualRate` ignores all of this and uses `manualExchangeRate`.

---

## Admin: country management

All require `Authorization: Bearer <admin jwt>`.

### `GET /api/countries/admin`

Every country including inactive ones, with the full document — all the public fields
plus `isActive`, `useManualRate`, `manualExchangeRate`, `liveExchangeRate`,
`lastRateUpdated`, `paymentMethods`, `updatedBy`, `createdAt`, `updatedAt`.

### `PUT /api/countries/admin/:id`

Updates one country. Every field is optional; only what you send changes.

| Field | Type | Notes |
|---|---|---|
| `isActive` | boolean | `false` hides it from the public list entirely. |
| `useManualRate` | boolean | Switch between manual and live rate. |
| `manualExchangeRate` | number | Non-numeric becomes `0`. |
| `currencySymbol` | string | |
| `currencySymbolAr` | string | |
| `sortOrder` | number | |
| `flagSvg` | string | Raw SVG markup. |

Returns the full updated country. Logged to the activity trail.

> **Note:** this endpoint does **not** change `paymentMethods` — that has its own
> endpoint (Part 2). Sending `paymentMethods` here is ignored.

### `POST /api/countries/admin/refresh-rates`

Triggers an immediate live-rate refresh for every country.

### `POST /api/countries/admin`

Adds a new country.

---

# Part 2 — Payment methods

## The four methods

```
card    cod    tamara    tabby
```

That is the complete set (`ALL_PAYMENT_METHODS`). Order is canonical — the server always
returns them in this order regardless of the order they were saved in, so the UI and the
stored data never disagree.

> Payment **charges** support a wider list (`bank_transfer`, `paypal`) than payment
> **availability**. Those two extras can carry a fee but cannot be enabled at checkout.

## How availability is decided

Two independent layers, combined:

```
  product layer  ─┐
                  ├─►  intersection  ─►  what checkout offers
  country layer  ─┘
```

### Layer 1 — product

For each product, the first level with a non-empty list wins:

1. Product
2. Sub-category level 4
3. Sub-category level 3
4. Sub-category level 2
5. Category
6. Parent category
7. Brand
8. **Fallback: `["card", "cod"]`**

For a multi-item cart, the server takes the **intersection** across every item. One item
restricted to `card` means the whole cart is card-only.

### Layer 2 — country

The country's `paymentMethods`. Empty or missing → all four allowed.

### Combining them

A method must be allowed by **both**. One deliberate exception:

> **If the intersection is empty, the country list wins.**

Rather than show a checkout with no payment options, the server falls back to whatever
the country permits. So the response can legitimately include a method the product layer
excluded. Trust the returned list; do not re-derive it client-side.

---

## `GET /api/country-payment-methods/resolve`

Methods for a country, ignoring the cart. **Public.**

```
GET /api/country-payment-methods/resolve?countryCode=AE
```

`country` is accepted as an alias for `countryCode`.

### Response `200`

```json
{
  "countryCode": "AE",
  "paymentMethods": ["card", "cod", "tamara", "tabby"]
}
```

| Field | Type | Notes |
|---|---|---|
| `countryCode` | string | Echoes your input, trimmed and uppercased. Empty string if you sent nothing. |
| `paymentMethods` | string[] | Never empty. |

**Never errors on bad input.** An unknown country code, a missing code, or even a
database failure all return all four methods. It is designed to fail open so checkout
keeps working.

---

## `POST /api/product-payment-methods/resolve`

The one checkout should call — applies both layers. **Public.**

### Request

```json
{
  "productIds": ["6713c2f91a4b8e0012ab34cd", "6713bb0a1a4b8e0012ab3301"],
  "countryCode": "AE"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `productIds` | string[] | no | Omit or send `[]` for an empty cart. |
| `countryCode` | string | no | Omitted means no country restriction. |

### Response `200`

```json
{
  "paymentMethods": ["card", "cod"],
  "productMethods": ["card", "cod", "tabby"],
  "countryMethods": ["card", "cod"]
}
```

| Field | Type | Notes |
|---|---|---|
| `paymentMethods` | string[] | **The answer. Render exactly this.** |
| `productMethods` | string[] | Product-layer intersection. **Absent when `productIds` was empty.** |
| `countryMethods` | string[] | Country layer, for debugging. |

> `productMethods` is missing — not `null`, not `[]` — on an empty cart. Treat it as
> optional, and only ever display `paymentMethods`.

### Errors

| Status | When |
|---|---|
| `500` | `{ "message": "Failed to resolve payment methods", "error": "..." }` |

Call this again whenever the cart changes or the customer switches country.

---

## Admin: enabling and disabling payment methods

All require `Authorization: Bearer <admin jwt>`.

### `GET /api/country-payment-methods/config`

The admin matrix — every country and its current configuration.

```json
{
  "availableMethods": ["card", "cod", "tamara", "tabby"],
  "countries": [
    {
      "_id": "6713c2f91a4b8e0012ab34cd",
      "code": "AE",
      "name": "UAE",
      "nameAr": "الإمارات",
      "currencyCode": "AED",
      "currencySymbol": "AED",
      "flagSvg": "<svg ...>...</svg>",
      "isActive": true,
      "isDefault": true,
      "sortOrder": 1,
      "paymentMethods": ["card", "cod", "tamara", "tabby"],
      "isConfigured": false
    }
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `availableMethods` | string[] | The four, canonical order. Build checkboxes from this, don't hardcode. |
| `countries[].paymentMethods` | string[] | **What checkout will actually offer** — already expanded to all four when unconfigured. |
| `countries[].isConfigured` | boolean | `false` = never customised. |

> `paymentMethods` and `isConfigured` work together. When `isConfigured` is `false` the
> list shows all four, but nothing is *stored*. Show that difference in the UI —
> "all methods (default)" reads very differently from "all methods (explicitly set)".

### `PUT /api/country-payment-methods`

Saves one or many countries.

**Single:**
```json
{ "countryId": "6713c2f91a4b8e0012ab34cd", "paymentMethods": ["card", "cod"] }
```

**Batch:**
```json
{
  "updates": [
    { "countryId": "6713c2f91a4b8e0012ab34cd", "paymentMethods": ["card", "cod"] },
    { "countryId": "6713c2f91a4b8e0012ab34ce", "paymentMethods": ["card"] }
  ]
}
```

Unknown method names are silently dropped; duplicates removed; order normalised to
canonical. Sending `["TABBY", "card", "card", "nonsense"]` stores `["card", "tabby"]`.

#### Response `200`

```json
{
  "message": "Payment methods updated for UAE",
  "countries": [
    {
      "_id": "6713c2f91a4b8e0012ab34cd",
      "code": "AE",
      "name": "UAE",
      "paymentMethods": ["card", "cod"],
      "isConfigured": true
    }
  ]
}
```

#### Errors

| Status | Message |
|---|---|
| `400` | `No changes were supplied` |
| `400` | `A country is required for every change` |
| `400` | `Payment methods must be supplied as a list` |
| `400` | `At least one payment method must stay enabled. To stop selling in a country, deactivate it in Country Manager instead.` |
| `404` | `Country not found` |

> **You cannot save an empty list.** It would leave checkout unusable in that country.
> To stop selling somewhere, set `isActive: false` via `PUT /api/countries/admin/:id`.

> **A batch is not atomic.** Updates apply one at a time and the request stops at the
> first failure — earlier ones are already saved. On an error, re-fetch `/config` rather
> than assuming nothing changed.

### `POST /api/country-payment-methods/reset`

Clears the rule so all four are offered again, and sets `isConfigured` back to `false`.

```json
{ "countryIds": ["6713c2f91a4b8e0012ab34cd"] }
```

`countryId` (single) also accepted.

| Status | Message |
|---|---|
| `400` | `Select at least one country to reset` |
| `404` | `Country not found` |

### Product / category / brand level

Same shape, different scope:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/product-payment-methods/config` | All custom configurations |
| `POST` | `/api/product-payment-methods/save` | Save for one entity |
| `POST` | `/api/product-payment-methods/reset` | Clear one entity |
| `POST` | `/api/product-payment-methods/bulk-reset` | Clear many |

---

# Part 3 — Payment charges (fees)

Fees attached to a payment method — a COD handling fee, a card surcharge. Separate from
whether the method is *available*.

Methods that may carry a charge: `cod`, `card`, `tabby`, `tamara`, `bank_transfer`,
`paypal`.

## `GET /api/payment-charges/active`

Charges in force for a country. **Public.**

```
GET /api/payment-charges/active?countryCode=AE
```

### Response `200`

```json
[
  {
    "_id": "6713c2f91a4b8e0012ab34cd",
    "paymentMethod": "cod",
    "countryCode": "AE",
    "description": "Cash on delivery handling",
    "charges": [
      { "name": "COD Handling Fee", "amount": 10, "type": "fixed" },
      { "name": "COD Shipping Fee", "amount": 2.5, "type": "percentage" }
    ],
    "isActive": true
  }
]
```

| Field | Type | Notes |
|---|---|---|
| `paymentMethod` | enum | One of the six above. |
| `countryCode` | string | `""` = the global default rule. |
| `charges[].amount` | number | **AED** when `fixed`; a percentage when `percentage`. |
| `charges[].type` | enum | `fixed` \| `percentage` |

### How a country gets its rule

There is one configuration per method **per country**, plus a global default stored with
`countryCode: ""`.

The server fetches both scopes and, per method, **the country-specific rule overrides the
default**. You get at most one entry per payment method.

> `amount` on a `fixed` charge is AED, like every other figure. Convert it for display
> with the same `effectiveRate`.

## Admin

| Method | Path | Access |
|---|---|---|
| `GET` | `/api/payment-charges` | Public |
| `POST` | `/api/payment-charges` | Admin |
| `GET` | `/api/payment-charges/:id` | Admin |
| `PUT` | `/api/payment-charges/:id` | Admin |
| `DELETE` | `/api/payment-charges/:id` | Admin |

One configuration per `(paymentMethod, countryCode)` pair — enforced by a unique index,
so creating a duplicate fails.

---

# Errors

Every endpoint returns the same shape:

```json
{ "message": "Country not found", "stack": null }
```

`stack` is `null` in production. Display `message`; do not parse it.

| Status | Meaning |
|---|---|
| `400` | Bad request — see `message`. |
| `401` | Missing/invalid admin token on an admin route. |
| `404` | Not found. |
| `500` | Server error. Retry with backoff. |

---

# Integration checklist

**Storefront / app**

1. `GET /api/countries/public` on launch; cache it (server allows 5 min).
2. Let the customer pick a country; persist `code` locally. Default to `AE`.
3. Show every price as `aedPrice × effectiveRate`, 2 dp, symbol side by language.
4. `POST /api/product-payment-methods/resolve` with cart ids + country at checkout, and
   again whenever the cart or country changes.
5. Render exactly the returned `paymentMethods`.
6. `GET /api/payment-charges/active?countryCode=XX` for fees; convert `fixed` amounts.
7. Submit orders **in AED**.

**Admin**

1. `GET /api/country-payment-methods/config` for the matrix.
2. Build toggles from `availableMethods`, never a hardcoded list.
3. Distinguish `isConfigured: false` (default) from an explicit all-four save.
4. `PUT` to save; handle the "at least one must stay enabled" 400 as a validation message
   on the form, not a crash.
5. Re-fetch `/config` after any batch error.
6. To stop selling in a country, set `isActive: false` — don't try to empty its methods.
