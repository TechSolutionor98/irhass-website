/**
 * Content for the policy and information pages.
 *
 * Kept as data rather than nine hand-built pages so wording, ordering and contact
 * details stay consistent -- the previous versions each carried their own copy of the
 * company name and address, which is how several of them ended up still naming a UAE
 * trading company after the rebrand.
 *
 * TO FILL IN before launch: `CONTACT.phone` and `CONTACT.address` are placeholders.
 * They are deliberately obvious rather than invented, because a policy page that
 * publishes a wrong registered address is worse than one that admits it is pending.
 */

export const BRAND = "Irha's Wardrobe"
export const COUNTRY = "Pakistan"
export const RETURN_DAYS = 7

export const CONTACT = {
  website: "irhaas.com",
  email: "info@irhaas.com",
  phone: "+92 321 498 0835",
  address: "[add your registered business address]",
  hours: "Monday to Saturday, 10:00 AM to 7:00 PM (PKT)",
}

const contactFooter = {
  title: "Contact us",
  rows: [
    ["Website", CONTACT.website],
    ["Email", CONTACT.email],
    ["Phone", CONTACT.phone],
    ["Address", CONTACT.address],
    ["Hours", CONTACT.hours],
  ],
}

export const LEGAL_PAGES = {
  "privacy-policy": {
    slug: "privacy-policy",
    title: "Privacy Policy",
    intro: `How ${BRAND} collects, uses and protects your personal information when you shop with us.`,
    updated: "October 2026",
    sections: [
      {
        title: "Who we are",
        body: [
          `${BRAND} operates the online store at ${CONTACT.website}, selling womenswear and accessories to customers in ${COUNTRY}. In this policy, "we", "us" and "our" mean ${BRAND}.`,
          `This policy covers the website, your customer account, and any order you place with us. If you have a question about it, write to ${CONTACT.email}.`,
        ],
      },
      {
        title: "What we collect",
        points: [
          "Details you give us directly: your name, email address, phone number and delivery address when you create an account or place an order.",
          "Order information: what you bought, what you paid, and the delivery address it went to.",
          "Technical information: your device, browser and approximate location, collected automatically so the site works and so we can spot fraud.",
          "Messages you send us through the contact form, email or WhatsApp.",
        ],
      },
      {
        title: "How we use it",
        points: [
          "To process and deliver your order, and to contact you about it.",
          "To create and maintain your customer account, including the account we create for you automatically when you check out as a guest.",
          "To answer your questions and handle returns or refunds.",
          "To improve the shop: which pages are visited, which products are viewed, which searches return nothing useful.",
          "To send you marketing only if you have asked for it. You can stop at any time using the link in any marketing email.",
        ],
      },
      {
        title: "Who we share it with",
        body: [
          "We do not sell your personal information. We share it only with the parties that help us run the shop, and only with what they need:",
        ],
        points: [
          "Courier companies, so your order can be delivered.",
          "Payment providers, to take payment securely. We never see or store your full card number.",
          "Analytics and hosting providers, who process technical data on our behalf.",
          "Government authorities, where the law requires it.",
        ],
      },
      {
        title: "How long we keep it",
        points: [
          "Account information is kept for as long as your account is open.",
          "Order and payment records are kept as long as the tax and commercial laws of Pakistan require, even after an account is closed.",
          `You can ask us to delete your account and personal data at any time by writing to ${CONTACT.email}.`,
          "We will delete or anonymise your data within 30 days of such a request, except where we are legally required to keep it.",
        ],
      },
      {
        title: "Your rights",
        points: [
          "You can ask for a copy of the personal data we hold about you.",
          "You can ask us to correct anything that is wrong.",
          "You can ask us to delete your data, subject to the records we must keep by law.",
          "You can withdraw your consent to marketing at any time.",
        ],
      },
      {
        title: "Cookies",
        body: [
          "We use cookies to keep you signed in, remember your cart and understand how the shop is used. You can block them in your browser, but parts of the site — the cart in particular — will stop working. Our Cookies Policy explains this in more detail.",
        ],
      },
      {
        title: "Security",
        body: [
          "We take reasonable technical and organisational measures to protect your information. No transmission over the internet is completely secure, so we cannot guarantee absolute security, but we do treat any breach seriously and will tell you if one affects you.",
        ],
      },
      {
        title: "Changes to this policy",
        body: [
          "We may update this policy. When we do, the date at the top of this page changes. Significant changes will be announced on the site.",
        ],
      },
    ],
    footer: contactFooter,
  },

  "terms-conditions": {
    slug: "terms-conditions",
    title: "Terms & Conditions",
    intro: `The terms on which ${BRAND} sells to you. By placing an order you accept them.`,
    updated: "October 2026",
    sections: [
      {
        title: "About these terms",
        body: [
          `These terms apply to every order placed on ${CONTACT.website}. Please read them before you buy. If you do not accept them, please do not place an order.`,
        ],
      },
      {
        title: "Placing an order",
        points: [
          "Adding an item to your bag is not an order. Your order is placed when you complete checkout.",
          "We will confirm your order by email. That confirmation is our acceptance of it.",
          "We may decline an order — for example if the item is out of stock, if the price was listed incorrectly, or if we cannot deliver to your address. If we do, you pay nothing.",
          "You must be able to form a binding contract to order from us.",
        ],
      },
      {
        title: "Prices and payment",
        points: [
          "All prices are shown in Pakistani Rupees (Rs) and are the price you pay.",
          "Prices can change, but a change never affects an order we have already confirmed.",
          "We accept cash on delivery and the card and bank options shown at checkout.",
          "If a price is obviously wrong, we will contact you before dispatching and you may cancel.",
        ],
      },
      {
        title: "Products",
        points: [
          "We describe every item as accurately as we can. Colours can look different between screens, and fabric and fit can vary slightly between pieces.",
          "Images are a guide. Minor differences in shade or finish are not a fault.",
          "Stock shown on the site is our best estimate and is not a guarantee of availability.",
        ],
      },
      {
        title: "Delivery",
        body: [
          `We deliver across ${COUNTRY}. Delivery times and charges are set out in our Delivery Terms. Risk in the goods passes to you on delivery.`,
        ],
      },
      {
        title: "Returns",
        body: [
          `You may return an item within ${RETURN_DAYS} days of receiving it, on the conditions set out in our Refund & Return Policy.`,
        ],
      },
      {
        title: "Your account",
        points: [
          "You are responsible for keeping your password confidential.",
          "If we create an account for you after a guest order, the password we email you should be changed on your first sign-in.",
          "Tell us immediately if you believe someone else has used your account.",
        ],
      },
      {
        title: "Our liability",
        body: [
          "We are responsible for loss you suffer that is a foreseeable result of us breaking these terms. We are not responsible for loss that was not foreseeable, or for business losses. Nothing in these terms limits any liability that cannot lawfully be limited.",
        ],
      },
      {
        title: "Governing law",
        body: [
          `These terms are governed by the laws of ${COUNTRY}, and the courts of ${COUNTRY} have jurisdiction over any dispute.`,
        ],
      },
    ],
    footer: contactFooter,
  },

  "refund-return": {
    slug: "refund-return",
    title: "Refund & Return Policy",
    intro: `You have ${RETURN_DAYS} days from delivery to request a return.`,
    updated: "October 2026",
    sections: [
      {
        title: "The return window",
        body: [
          `You may request a return within ${RETURN_DAYS} days of the date you receive your order. Requests made after that window cannot be accepted.`,
        ],
      },
      {
        title: "What can be returned",
        points: [
          "Items that are unworn and unwashed, with all tags still attached.",
          "Items in their original packaging.",
          "Items that arrived damaged, faulty, or different from what was described.",
        ],
      },
      {
        title: "What cannot be returned",
        points: [
          "Items that have been worn, washed, altered or perfumed.",
          "Items with tags removed.",
          "Pierced jewellery and hair accessories, for hygiene reasons.",
          "Items marked as final sale at the time of purchase.",
        ],
      },
      {
        title: "How to return something",
        points: [
          `Email ${CONTACT.email} with your order number and tell us which items you want to return and why.`,
          "We will reply with instructions and arrange collection or give you a return address.",
          "Pack the items securely in their original packaging.",
          "Keep your proof of postage or collection receipt until the refund reaches you.",
        ],
      },
      {
        title: "Refunds",
        points: [
          "Once we receive and inspect the return, we will tell you whether it is approved.",
          "Approved refunds are issued to your original payment method within 7 to 10 working days.",
          "Cash on delivery orders are refunded by bank transfer. We will ask for your account details.",
          "Delivery charges are refunded only where the item was faulty or wrong.",
        ],
      },
      {
        title: "Exchanges",
        body: [
          "We exchange for a different size or colour subject to availability. If the piece you want is unavailable we will refund you instead.",
        ],
      },
      {
        title: "Damaged or wrong items",
        body: [
          `If your order arrives damaged or is not what you ordered, email ${CONTACT.email} within 48 hours of delivery with photographs. We will arrange a replacement or a full refund, including delivery, at no cost to you.`,
        ],
      },
    ],
    footer: contactFooter,
  },

  "delivery-terms": {
    slug: "delivery-terms",
    title: "Delivery Terms",
    intro: `How and when ${BRAND} delivers across ${COUNTRY}.`,
    updated: "October 2026",
    sections: [
      {
        title: "Where we deliver",
        body: [
          `We deliver to addresses across ${COUNTRY}. We do not currently ship internationally.`,
        ],
      },
      {
        title: "Timing",
        points: [
          "Orders are dispatched within 1 to 2 working days of being confirmed.",
          "Standard delivery takes 2 to 4 working days after dispatch.",
          "Remote areas may take an additional 1 to 2 working days.",
          "Orders placed on a Sunday or a public holiday are processed on the next working day.",
        ],
      },
      {
        title: "Charges",
        points: [
          "Standard delivery is currently free on every order, nationwide.",
          "Any charge that does apply is shown at checkout before you pay. You will never be asked for more on delivery than the total you agreed.",
        ],
      },
      {
        title: "Cash on delivery",
        points: [
          "Cash on delivery is available nationwide.",
          "Please have the exact amount ready; couriers may not carry change.",
          "The courier will attempt delivery during working hours. Please make sure someone is available to receive and pay for the order.",
        ],
      },
      {
        title: "Tracking your order",
        body: [
          "We email you when your order is dispatched. You can follow its progress at any time on our Track Order page using your email address and order number.",
        ],
      },
      {
        title: "Failed deliveries",
        points: [
          "Couriers normally attempt delivery up to three times.",
          "If all attempts fail, the parcel returns to us and we will contact you to arrange redelivery.",
          "Repeated refusal of a cash on delivery order may mean we ask for prepayment on future orders.",
        ],
      },
      {
        title: "Checking your parcel",
        body: [
          `Please check your order on arrival. If anything is damaged or missing, tell us within 48 hours at ${CONTACT.email} and we will put it right.`,
        ],
      },
    ],
    footer: contactFooter,
  },

  "cookies-policy": {
    slug: "cookies-policy",
    title: "Cookies Policy",
    intro: "What cookies we use, what they do, and how to turn them off.",
    updated: "October 2026",
    sections: [
      {
        title: "What a cookie is",
        body: [
          "A cookie is a small text file a website stores on your device. It lets the site remember things between pages and between visits — that you are signed in, or what is in your bag.",
        ],
      },
      {
        title: "Essential cookies",
        points: [
          "Keeping you signed in as you move around the site.",
          "Remembering the contents of your shopping bag.",
          "Keeping checkout secure and preventing fraudulent orders.",
          "These cannot be switched off without breaking the shop.",
        ],
      },
      {
        title: "Preference cookies",
        points: [
          "Remembering the last filters or sort order you chose.",
          "Remembering a note you started writing in the cart.",
        ],
      },
      {
        title: "Analytics cookies",
        points: [
          "Counting visits and understanding which pages and products get attention.",
          "Telling us where people give up, so we can fix it.",
          "This data is aggregated. We do not use it to identify you personally.",
        ],
      },
      {
        title: "Marketing cookies",
        body: [
          "If you have agreed to them, these let us show you our products on other sites and measure whether our advertising works. They are set by our advertising partners.",
        ],
      },
      {
        title: "Turning cookies off",
        body: [
          "Every major browser lets you block or delete cookies in its settings. If you block essential cookies, you will not be able to sign in or complete an order.",
        ],
      },
    ],
    footer: contactFooter,
  },

  "disclaimer-policy": {
    slug: "disclaimer-policy",
    title: "Disclaimer",
    intro: "The limits of what the information on this site promises.",
    updated: "October 2026",
    sections: [
      {
        title: "General information",
        body: [
          `The content on ${CONTACT.website} is provided for general information about our products. We work to keep it accurate and current, but we make no warranty that it is complete or error-free.`,
        ],
      },
      {
        title: "Product images and descriptions",
        points: [
          "Colours vary between screens. The shade you see may differ from the fabric in person.",
          "Measurements are approximate and can vary slightly between individual pieces.",
          "Styling items shown in a photograph are not included unless the description says so.",
        ],
      },
      {
        title: "Pricing and availability",
        body: [
          "Prices and availability can change without notice. Where an item is listed at an obviously incorrect price, we reserve the right to cancel the order and refund you in full rather than fulfil it.",
        ],
      },
      {
        title: "External links",
        body: [
          "This site may link to other websites. We do not control them and are not responsible for their content or their privacy practices.",
        ],
      },
      {
        title: "Limitation of liability",
        body: [
          "To the extent permitted by law, we are not liable for any loss arising from your use of this website or your reliance on information published on it. This does not affect your statutory rights as a consumer.",
        ],
      },
    ],
    footer: contactFooter,
  },

  "voucher-terms": {
    slug: "voucher-terms",
    title: "Voucher Terms",
    intro: "The rules that apply to discount codes and gift vouchers.",
    updated: "October 2026",
    sections: [
      {
        title: "Using a code",
        points: [
          "Enter the code at checkout. It must be applied before you pay — we cannot add it afterwards.",
          "One code per order, unless we say otherwise.",
          "A code cannot be exchanged for cash.",
        ],
      },
      {
        title: "Eligibility",
        points: [
          "Each code has its own conditions, such as a minimum order value or specific categories.",
          "Codes may exclude items already reduced.",
          "Codes are valid until the expiry date shown. Expired codes cannot be reinstated.",
        ],
      },
      {
        title: "Returns on discounted orders",
        points: [
          "If you return part of an order bought with a code, we refund what you actually paid for those items, not the full price.",
          "If a return takes the order below the code's minimum value, the discount may be adjusted accordingly.",
          "A used code is not reissued after a return.",
        ],
      },
      {
        title: "Misuse",
        body: [
          "We may cancel a code, or an order placed with one, where we have reason to believe it has been obtained or used improperly, including through automated means or by sharing a code issued to a specific customer.",
        ],
      },
    ],
    footer: contactFooter,
  },
}

export default LEGAL_PAGES
