# API Documentation: Cash on Delivery (COD) Fees

This document outlines the API changes and expected logic for handling Cash on Delivery (COD) fees. Please follow these guidelines when integrating COD orders from the mobile app.

## 1. New Database Fields

Two new fields have been added to the **Order schema (`orderModel.js`)** to track COD-related charges. When fetching order details (e.g., `GET /api/orders`), these fields will be included in the response payload.

*   `codFee` (Number): The non-refundable COD handling fee (Fixed at **5 AED**).
*   `codShippingFee` (Number): The shipping fee specifically applied to COD orders (Fixed at **10 AED**).

## 2. API Implementation Rules for the App Developer

When submitting a new order via the API (e.g., `POST /api/orders` or checkout endpoint), or when displaying the checkout summary to the user, the app must follow these rules:

### A. When Payment Method is NOT COD
*   The `codFee` should be `0`.
*   The `codShippingFee` should be `0`.
*   Standard shipping logic (`deliveryCharge` or `shipping` amount) applies as normal.
*   In the UI: Show the standard "Shipping" row (e.g., Free or the specific amount).

### B. When Payment Method IS COD (`paymentMethod: "Cash on Delivery"` or `"cod"`)
*   The `codFee` must be set to **5 AED**.
*   The `codShippingFee` must be set to **10 AED**.
*   **Important UI Logic:** The standard "Shipping" row and "Free Shipping" banners **must be hidden** from the user's receipt and checkout summary.
*   Instead of standard shipping, explicitly show the two new COD fee rows:
    *   `💰 COD Handling Fee (Non-Refundable): AED 5.00`
    *   `🚚 COD Shipping Fee: AED 10.00`

## 3. Total Calculation Formula

When calculating the final order `totalAmount` before sending it to the backend (or when rendering the total on the app), ensure the formula includes the COD fees:

```javascript
const finalTotal = 
  subtotal + 
  tax (VAT) + 
  standardDeliveryCharge + 
  codFee +          // 5 if COD, else 0
  codShippingFee -  // 10 if COD, else 0
  discountAmount;
```

## 4. Example JSON Payload Structure

When fetching or submitting an order with COD, the JSON structure will look like this:

```json
{
  "orderId": "64a7c9f8...",
  "customerName": "John Doe",
  "paymentMethod": "Cash on Delivery",
  "isPaid": false,
  
  // Pricing Breakdown
  "totalPrice": 85.99,
  "taxPrice": 3.30,
  "shippingPrice": 0,      // Standard shipping (Hidden in UI)
  "discountAmount": 14.00,
  
  // --- NEW COD FIELDS ---
  "codFee": 5,             // 5 AED Handling
  "codShippingFee": 10     // 10 AED Shipping
}
```

## Summary for the App UI

To match the website and admin dashboard exactly, the App UI must replicate this behavior:
If a user toggles to the COD payment method, instantly hide the `Shipping: AED 0.00` text, hide any "Free Shipping" celebratory banners, and insert the `COD Handling Fee` and `COD Shipping Fee` rows above the Grand Total.
