# Irhaas App Developer Handoff

## Objective
When a user registers from mobile app and places an app order, backend applies admin-managed App Discount automatically.

## Base URL
- Production API: `https://api.irhaas.com`
- All endpoints below are relative to that base URL.

## 1) Register User as App User
Endpoint:
- `POST /api/users/register`

Send this payload from app signup:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "StrongPassword123",
  "registrationSource": "app",
  "registrationPlatform": "android"
}
```

Notes:
- `registrationSource` must be `"app"`.
- `registrationPlatform` must be `"android"` or `"ios"`.
- If you miss these fields, user may be treated as web user and app discount might not apply.

## 2) Login
Endpoint:
- `POST /api/users/login`

Use returned `token` as Bearer token for authenticated calls.

## 3) Preview App Discount (Optional but Recommended)
Endpoint:
- `POST /api/app-discounts/preview`

Headers:
- `Authorization: Bearer <token>`

Body:
```json
{
  "orderItems": [
    {
      "product": "665f1b8f1b9d2449e5d8d111",
      "price": 1200,
      "quantity": 1
    }
  ]
}
```

Possible response (example):
```json
{
  "applied": true,
  "discountAmount": 120,
  "eligibleSubtotal": 1200,
  "discount": {
    "_id": "...",
    "name": "New App User Offer",
    "appliesTo": "all",
    "discountType": "percentage",
    "discountValue": 10
  }
}
```

## 4) Create Order (Discount Applied Server-Side)
Endpoint:
- `POST /api/orders`

Headers:
- `Authorization: Bearer <token>` (required for app discount eligibility)
- Optional fallback header: `X-Order-Source: app`

Body must include:
- `orderSource: "app"`
- `orderItems`
- `itemsPrice`
- `shippingPrice`
- `totalPrice`
- `deliveryType`
- `shippingAddress` (for home delivery) or `pickupDetails` (for pickup)

Example:
```json
{
  "orderSource": "app",
  "orderItems": [
    {
      "name": "Product Name",
      "product": "665f1b8f1b9d2449e5d8d111",
      "price": 1200,
      "quantity": 1,
      "image": "https://..."
    }
  ],
  "itemsPrice": 1200,
  "shippingPrice": 25,
  "totalPrice": 1225,
  "deliveryType": "home",
  "shippingAddress": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "0500000000",
    "address": "Street 1",
    "city": "Dubai",
    "state": "Dubai",
    "zipCode": "00000"
  },
  "paymentMethod": "cod",
  "actualPaymentMethod": "cod"
}
```

## 5) What Backend Does Automatically
On app order creation:
- Detects app source (`orderSource` or header fallback).
- Checks user is app-registered (`registrationSource = app`).
- Finds active admin-configured App Discount.
- Validates eligibility (new app user / selected products / date window / limits).
- Applies discount server-side.

Order response includes fields like:
- `discountAmount`
- `appDiscountApplied`
- `appDiscountId`
- `appDiscountName`
- `appDiscountType`
- `appDiscountValue`
- `appDiscountAmount`
- `totalPrice` (final server-calculated total)

## 6) Critical Integration Rules
1. Do not hardcode app discount logic on mobile app.
2. Always trust backend response totals.
3. Always send `registrationSource: "app"` at signup.
4. Always send `orderSource: "app"` at order creation.
5. Use authenticated user token for app orders.

## 7) Optional Public Endpoint for Display
Endpoint:
- `GET /api/app-discounts/active`

Use this if app wants to show current app-offer text to users.

## 8) Web Popup Links (for website team/env)
Website popup reads:
- `VITE_ANDROID_APP_URL`
- `VITE_IOS_APP_URL`

Set these in client environment so Play Store / App Store buttons are active.

## 9) Push Notifications (Firebase Cloud Messaging)

Admins write notifications in the Irhaas admin panel and the API sends them through
Firebase Cloud Messaging. The app must use the **same Firebase project** whose service
account key is configured on the API server (ask the Irhaas team for the
`google-services.json` / `GoogleService-Info.plist` of that project).

### Register the device token
Call this on every app launch, and again right after login (with the bearer token) so the
token is attached to the customer's account.

- `POST /api/notifications/devices`
- Header (optional): `Authorization: Bearer <token>`

```json
{
  "token": "<FCM registration token>",
  "platform": "android",
  "country": "AE",
  "language": "en",
  "appVersion": "1.4.0",
  "deviceName": "Samsung S24"
}
```

`platform` is `android` or `ios`. `country` is the store the app is set to (AE, SA, QA,
OM, BH, KW). `language` is `en` or `ar`; Arabic devices receive the Arabic copy when the
admin wrote one.

### Unregister on logout (or when the user turns notifications off)
- `DELETE /api/notifications/devices/<token>`

### Handle a tap
Every push carries this `data` payload (all values are strings):

```json
{
  "notificationId": "665f…",
  "screen": "product",
  "targetId": "hp-laptop-15-fd1134nia",
  "url": "",
  "imageUrl": "https://…"
}
```

`screen` is one of `none`, `home`, `product`, `category`, `offer`, `orders`, `cart`, `url`.
Open the matching screen; for `product` / `category` / `offer` use `targetId` (a slug or
id), for `url` open `url` in the in-app browser.

### Notification inbox screen
So customers can re-read notifications they dismissed:

- `GET /api/notifications/inbox?platform=android&country=AE&lang=en&page=1&limit=20`
- Header (optional): `Authorization: Bearer <token>` — adds notifications targeted at that customer.

Response: `{ notifications: [{ id, title, body, imageUrl, action: { screen, targetId, url }, sentAt }], page, limit, total, hasMore }`.

### Testing
Show the device's FCM token on a hidden debug screen. An admin pastes it into
Admin → Push Notifications → "Send a test to one phone".
