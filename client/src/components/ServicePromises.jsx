"use client"

import { Banknote, Truck, RotateCcw, MessageCircle } from "lucide-react"
import TranslatedText from "./TranslatedText"

/**
 * The four things worth promising, as a dark band before the footer.
 *
 * Deliberately not the stock four-column template: no "Core Service Aspects"
 * heading, no centred icon stack. The promises are specific enough to be worth
 * reading on their own, so a heading introducing them would only be padding.
 *
 * Each promise is a claim the shop has to keep -- the copy matches the delivery
 * and returns terms, rather than saying "fast and convenient" about nothing.
 */
const PROMISES = [
  {
    Icon: Banknote,
    label: "Cash on delivery",
    copy: "Pay at your door. No card needed.",
  },
  {
    Icon: Truck,
    label: "Delivered nationwide",
    copy: "2–4 working days, free on every order.",
  },
  {
    Icon: RotateCcw,
    label: "7-day returns",
    copy: "Not right? Send it back within a week.",
  },
  {
    Icon: MessageCircle,
    label: "Talk to us",
    copy: "Message on WhatsApp — a person replies.",
  },
]

const ServicePromises = () => (
  <section
    aria-label="Our promises"
    className="relative left-1/2 w-screen -translate-x-1/2 bg-footer-bg text-white"
  >
    <div className="mx-auto max-w-[1360px] px-4 py-14 sm:px-6 lg:px-8 md:py-16">
      {/* Hairlines between columns rather than boxes around them: it holds the row
          together as one band instead of four floating cards. */}
      <ul className="grid grid-cols-1 gap-y-10 sm:grid-cols-2 md:grid-cols-4 md:gap-y-0 md:divide-x md:divide-white/15">
        {PROMISES.map(({ Icon, label, copy }) => (
          <li key={label} className="flex gap-4 md:px-7 md:first:pl-0 md:last:pr-0">
            <Icon
              className="mt-[2px] h-6 w-6 flex-shrink-0 text-brand-400"
              strokeWidth={1.25}
              aria-hidden="true"
            />
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em]">
                <TranslatedText>{label}</TranslatedText>
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                <TranslatedText>{copy}</TranslatedText>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  </section>
)

export default ServicePromises
