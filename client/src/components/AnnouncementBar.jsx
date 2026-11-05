"use client"

import { useMemo } from "react"
import TranslatedText from "./TranslatedText"

/**
 * The scrolling promo strip that sits under the header.
 *
 * The track holds the messages twice and slides exactly one copy's width before
 * resetting, which is what makes the loop seamless -- animating a single copy would
 * snap back visibly at the end. `aria-hidden` on the duplicate keeps screen readers
 * from announcing everything twice.
 */
const MESSAGES = [
  "New season has landed — shop now",
  "Nationwide delivery across Pakistan",
  "Cash on delivery available",
  "Easy 7-day returns",
]

const AnnouncementBar = ({ messages = MESSAGES, speedSeconds = 40 }) => {
  const items = useMemo(() => messages.filter(Boolean), [messages])
  if (items.length === 0) return null

  const Copy = ({ hidden }) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((message, i) => (
        <li key={`${message}-${i}`} className="flex items-center whitespace-nowrap">
          <span className="px-8 text-[11px] font-medium uppercase tracking-[0.18em] lg:text-xs">
            <TranslatedText>{message}</TranslatedText>
          </span>
          <span aria-hidden="true" className="text-brand-400/70">
            &#9670;
          </span>
        </li>
      ))}
    </ul>
  )

  // Capped at the same 1360px as the header above and Layout's content container below.
  // Navbar renders outside that container, so without this the strip runs edge to edge
  // while everything around it stops short -- which is what made it read as a stray
  // black line on wide screens.
  return (
    <div className="relative mx-auto w-full max-w-[1360px] overflow-hidden border-b-2 border-brand-500 bg-footer-bg text-footer-text">
      <div
        className="marquee-track flex w-max"
        style={{ "--marquee-duration": `${speedSeconds}s` }}
      >
        <Copy />
        <Copy hidden />
      </div>

      <style>{`
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .marquee-track {
          animation: marquee-scroll var(--marquee-duration, 40s) linear infinite;
        }
        .marquee-track:hover { animation-play-state: paused; }
        [dir="rtl"] .marquee-track { animation-direction: reverse; }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track { animation: none; transform: none; }
        }
      `}</style>
    </div>
  )
}

export default AnnouncementBar
