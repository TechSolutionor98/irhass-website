# In-App Notifications — Mobile API

Everything the Irhaas mobile app needs to register for push notifications and render
the in-app notification inbox.

**Base URL:** `https://api.irhaas.com`
**Content type:** `application/json` on every request and response.

There are three endpoints for the app. Everything else under `/api/notifications/` is
the admin panel and is not callable with a customer token.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/notifications/devices` | Register or refresh this install's push token |
| `DELETE` | `/api/notifications/devices/:token` | Stop pushes to this install |
| `GET` | `/api/notifications/inbox` | List notifications for the inbox screen |

---

## Authentication

All three endpoints work **with or without** a logged-in user. Send the bearer token
when you have one:

```
Authorization: Bearer <jwt>
```

The token is the same JWT returned by `POST /api/users/login`.

What changes when it is present:

- **`/devices`** — the device row is attached to that customer account, so campaigns
  aimed at specific customers can reach it.
- **`/inbox`** — the response also includes notifications sent to signed-in users and
  notifications aimed at that specific customer.

An invalid or expired token is **not** an error on these endpoints. It is ignored and
the request is treated as a guest. Do not rely on a 401 to detect a stale session here.

---

## 1. Register a device token

```
POST /api/notifications/devices
```

Call this:

- on every app launch, once you have the FCM token
- again immediately after login (so the token gets attached to the account)
- whenever Firebase hands you a rotated token

Repeat calls are safe. The row is upserted on `token`, so calling it every launch is the
intended usage, not a leak.

### Request body

| Field | Type | Required | Notes |
|---|---|---|---|
| `token` | string | **yes** | FCM registration token. Must be at least 20 characters. |
| `platform` | string | no | `android` \| `ios` \| `web`. Anything else is stored as `unknown`. |
| `country` | string | no | 2-letter code. Uppercased and truncated to 2 chars server-side. |
| `language` | string | no | `en` or `ar`. **Anything that is not `ar` becomes `en`.** |
| `appVersion` | string | no | Truncated to 40 chars. |
| `deviceName` | string | no | Truncated to 80 chars. |

```json
{
  "token": "fcm_dGhpcyBpcyBhIHNhbXBsZSB0b2tlbg...",
  "platform": "android",
  "country": "AE",
  "language": "en",
  "appVersion": "2.4.1",
  "deviceName": "Pixel 8"
}
```

### Response `200`

```json
{
  "ok": true,
  "id": "6713c2f91a4b8e0012ab34cd",
  "user": "68f1a0c3de77aa0011223344"
}
```

| Field | Type | Notes |
|---|---|---|
| `ok` | boolean | Always `true` on success. |
| `id` | string | The device row id. Useful in support tickets; the app does not need to store it. |
| `user` | string \| null | The account the token is now attached to, or `null` for a guest. |

### Errors

| Status | When |
|---|---|
| `400` | `token` missing, or shorter than 20 characters. |

```json
{ "message": "A push token is required", "stack": null }
```

### Language matters

`language` decides which copy the device receives. A campaign written with Arabic text
goes out in Arabic **only** to devices registered as `language: "ar"`. If the customer
changes the app language, re-register the token or they will keep getting the other
language until the next launch.

---

## 2. Deregister a device token

```
DELETE /api/notifications/devices/:token
```

Call on logout, or when the customer turns notifications off in app settings.

No request body. No authentication required.

### Response `200`

```json
{ "ok": true }
```

Returns `200` even when the token was not found — it is safe to call blind, and a
missing token is treated as already deregistered.

**What it does:** marks the row inactive and detaches it from the user. It does not
delete the row. If the same install registers again later it is reactivated.

---

## 3. Inbox

```
GET /api/notifications/inbox
```

The list for the app's notification screen. Returns only notifications that have
actually been **sent** — drafts, scheduled and failed campaigns never appear. Newest
first, by send time.

### Query parameters

| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | int | `1` | 1-based. Values below 1 are clamped to 1. |
| `limit` | int | `20` | **Maximum 50.** Higher values are clamped, not rejected. |
| `platform` | string | — | `android` \| `ios`. Include it or platform-targeted notifications are missing from the list. |
| `country` | string | — | 2-letter code. Include it or country-targeted notifications are missing. |
| `lang` | string | `en` | `en` or `ar`. Picks which copy is returned. |

```
GET /api/notifications/inbox?page=1&limit=20&platform=android&country=AE&lang=en
Authorization: Bearer <jwt>
```

> **Send `platform` and `country`.** They are not inferred from the registered device
> token — the inbox does not know which install is asking. Leave them out and the
> customer silently misses every campaign that was targeted by platform or country,
> even though their device received the push.

### Response `200`

```json
{
  "notifications": [
    {
      "id": "6713c2f91a4b8e0012ab34cd",
      "title": "20% off all laptops this weekend",
      "body": "Ends Sunday midnight. Tap to browse the sale.",
      "imageUrl": "https://res.cloudinary.com/.../banner.webp",
      "action": {
        "screen": "category",
        "targetId": "laptops",
        "url": ""
      },
      "sentAt": "2026-10-08T11:20:04.512Z"
    },
    {
      "id": "6713bb0a1a4b8e0012ab3301",
      "title": "Your order has shipped",
      "body": "Order #76472f is on the way.",
      "imageUrl": "",
      "action": { "screen": "orders", "targetId": "76472f", "url": "" },
      "sentAt": "2026-10-07T09:02:51.004Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 37,
  "hasMore": true
}
```

### Response schema

#### Top level

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `notifications` | array of Notification | no | Empty array when there is nothing — never `null`. |
| `page` | int | no | Echoes the page served, after clamping. |
| `limit` | int | no | Echoes the limit served, after clamping to ≤ 50. |
| `total` | int | no | Total matching this customer across all pages. |
| `hasMore` | boolean | no | `page * limit < total`. Use this to drive infinite scroll. |

#### Notification object

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | string | no | Mongo ObjectId as a string. Matches `notificationId` in the FCM data payload. |
| `title` | string | no | Max 120 chars. Already language-resolved — see below. |
| `body` | string | no | Max 500 chars. Already language-resolved. |
| `imageUrl` | string | no | **Empty string when there is no image, never `null`.** |
| `action` | Action | no | Always present. |
| `sentAt` | string (ISO 8601) | no | UTC. Sort key for the list. |

#### Action object

| Field | Type | Notes |
|---|---|---|
| `screen` | enum | `home` \| `product` \| `category` \| `offer` \| `orders` \| `cart` \| `url` \| `none` |
| `targetId` | string | The id/slug the screen needs. Empty string when not applicable. |
| `url` | string | Web fallback. Empty string when not applicable. |

**No field in a notification object is ever `null`.** Absent values are empty strings.
Model them as non-optional strings and check for `""`.

### Language resolution

The server resolves the language for you. With `lang=ar`, `title` and `body` come back
as the Arabic copy **only if the admin wrote one** — otherwise they fall back to English.
The app never receives both languages and should not try to pick between them.

### What a customer sees

The inbox returns, merged and sorted:

- every notification sent to **all** users
- notifications sent to their **platform**, if you passed `platform`
- notifications sent to their **country**, if you passed `country`
- **signed in:** notifications for signed-in users, plus any aimed at them specifically
- **guest:** notifications aimed at guests

Expired notifications are filtered out automatically.

### Read state

**There is no read/unread state on the server.** The API has no "mark as read" endpoint
and no `read` field. If the app shows an unread badge, track it locally — for example,
store the `sentAt` of the newest notification the customer has seen and count anything
newer.

---

## Handling the push itself

Separate from the inbox: this is what FCM delivers to the device.

### Data payload

Every push carries this `data` block. All values are **strings** — FCM does not allow
anything else.

| Key | Notes |
|---|---|
| `notificationId` | Matches `id` in the inbox response. |
| `screen` | Same enum as `action.screen`. |
| `targetId` | Empty string when not applicable. |
| `url` | Empty string when not applicable. |
| `imageUrl` | Empty string when there is no image. |

```json
{
  "notificationId": "6713c2f91a4b8e0012ab34cd",
  "screen": "product",
  "targetId": "90NB14Q2-M003W0",
  "url": "",
  "imageUrl": "https://res.cloudinary.com/.../thumb.webp"
}
```

A `notification` block (title, body, image) is sent alongside it, so the OS draws the
banner without the app running.

### Deep linking

Route on `screen`, using `targetId`:

| `screen` | Open |
|---|---|
| `home` | Home |
| `product` | Product details for `targetId` |
| `category` | Category listing for `targetId` |
| `offer` | Offers / sale screen |
| `orders` | Order list, or the order `targetId` if set |
| `cart` | Cart |
| `url` | `url` — in-app browser or external |
| `none` | Just open the app. No navigation. |

Treat an unrecognised `screen` as `none`. The enum may gain values; the app should not
crash on one it does not know.

### Sounds — app-side work required

The server only sends a **sound name**. The audio file must ship inside the app or the
device falls back to the default tone.

| id | Android channel | iOS file |
|---|---|---|
| `default` | `default` | `default` |
| `chime` | `sound_chime` | `chime.caf` |
| `ding` | `sound_ding` | `ding.caf` |
| `cash` | `sound_cash` | `cash.caf` |
| `alert` | `sound_alert` | `alert.caf` |
| `silent` | `sound_silent` | *(none)* |

- **Android** — put `<id>.mp3` in `android/app/src/main/res/raw/`. Android 8+ takes the
  tone from the notification **channel**, so the app must create one channel per row
  above using the `channelId`. Without the channel, a modern device plays the default
  tone no matter what the server sends.
- **iOS** — bundle the file, 30 seconds or less.

Missing files are harmless: the device just plays the default tone.

### Token lifecycle

When Firebase reports a token as unregistered or invalid, the server marks that device
inactive and stops sending to it. The app does not need to do anything — but it should
re-register on every launch so a rotated token is picked up.

---

## Errors

Every error from the API has the same shape:

```json
{
  "message": "A push token is required",
  "stack": null
}
```

`stack` is `null` in production. Show `message` or map it to your own copy; do not parse
it.

| Status | Meaning |
|---|---|
| `400` | Bad request — see `message`. |
| `404` | Unknown route. |
| `500` | Server error. Retry with backoff. |

The three app endpoints never return `401`: a bad bearer token degrades to guest rather
than failing.

---

## Integration checklist

1. Request notification permission, get the FCM token.
2. `POST /api/notifications/devices` with `token`, `platform`, `country`, `language`.
3. Re-post after login **with** the bearer token, so the device attaches to the account.
4. Re-post on token refresh.
5. `DELETE /api/notifications/devices/:token` on logout.
6. Create one Android notification channel per sound id; bundle the audio files.
7. Inbox screen: `GET /api/notifications/inbox` with `platform`, `country` and `lang`,
   paging on `hasMore`.
8. Handle taps — foreground, background and cold start — by routing on `data.screen`.
9. Track unread locally; the server does not store it.
