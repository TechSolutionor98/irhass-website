import { useEffect, useRef, useState } from "react"
import { Gift, FileText, ListOrdered } from "lucide-react"
import TranslatedText from "../components/TranslatedText"

// The clause list drives both the jump links and the scroll-spy highlight, so the
// sidebar can never fall out of step with the document.
const SECTIONS = [
  { number: "1", title: "Overview" },
  { number: "2", title: "Eligibility and How the Programme Works" },
  { number: "3", title: "Referral Tiers and Rewards" },
  { number: "4", title: "Minimum Purchase Requirement" },
  { number: "5", title: "Referral Reward Conditions" },
  { number: "6", title: "Multiple Referrals" },
  { number: "7", title: "Referred Customer Benefits" },
  { number: "8", title: "Referral Programme Restrictions" },
  { number: "9", title: "Reward Verification and Account Review" },
  { number: "10", title: "Reward Issuance and Usage" },
  { number: "11", title: "Reward Expiry" },
  { number: "12", title: "Returns, Refunds and Cancellations" },
  { number: "13", title: "Referral Tier Adjustments" },
  { number: "14", title: "Programme Abuse and Fraud" },
  { number: "15", title: "Changes to the Referral Programme" },
  { number: "16", title: "No Guarantee of Rewards" },
  { number: "17", title: "General Terms" },
].map((section) => ({ ...section, id: `clause-${section.number}` }))

/**
 * A numbered clause. scroll-mt keeps the heading clear of the fixed site header
 * when a jump link lands on it.
 */
function Clause({ number, title, children }) {
  return (
    <section id={`clause-${number}`} className="scroll-mt-[150px] space-y-3">
      <h2 className="text-xl font-semibold text-gray-900">
        {number}. {title}
      </h2>
      <div className="space-y-3 text-gray-700 leading-relaxed">{children}</div>
    </section>
  )
}

/** A sub-clause heading such as "2.1 Referring a Friend". */
function SubClause({ number, title, children }) {
  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold text-gray-900">
        {number} {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Bullets({ items }) {
  return (
    <ul className="list-disc pl-6 space-y-1.5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  )
}

/** Highlights whichever clause is currently in view. */
function useActiveClause() {
  const [activeId, setActiveId] = useState(SECTIONS[0].id)
  const visible = useRef(new Set())

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.current.add(entry.target.id)
          else visible.current.delete(entry.target.id)
        }
        // Several clauses can be on screen at once; the first one in document
        // order is the one the reader is actually in.
        const current = SECTIONS.find((section) => visible.current.has(section.id))
        if (current) setActiveId(current.id)
      },
      // Only count a clause once it is under the header and above the fold.
      { rootMargin: "-140px 0px -55% 0px" },
    )

    for (const section of SECTIONS) {
      const node = document.getElementById(section.id)
      if (node) observer.observe(node)
    }
    return () => observer.disconnect()
  }, [])

  return activeId
}

export default function ReferralProgramTerms() {
  const activeId = useActiveClause()

  // Scrolling is done here rather than letting the browser follow the anchor, so the
  // address bar stays clean instead of collecting a "#clause-2" on every click. The
  // href is kept so the links still right-click/middle-click and read as links.
  const handleJump = (event, id) => {
    event.preventDefault()
    const node = document.getElementById(id)
    if (node) node.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const navLink = (section) =>
    `block rounded-md px-3 py-1.5 text-sm transition ${
      activeId === section.id
        ? "bg-lime-50 font-semibold text-lime-700"
        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    }`

  return (
    <div className="min-h-screen bg-white">
      {/* Title band */}
      <div>
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <div className="flex items-start gap-3">
            <Gift className="mt-1 h-7 w-7 shrink-0 text-lime-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                <TranslatedText>Irhaas Referral Programme – Terms &amp; Conditions</TranslatedText>
              </h1>
              <p className="mt-1 text-sm font-medium text-gray-500">Effective Date: 1st OCT 2026</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 lg:flex lg:items-start lg:gap-10">
        {/* Jump links. A list this long needs navigation; on desktop it follows
            the reader, on mobile it collapses so it does not bury the content. */}
        <aside className="mb-6 lg:mb-0 lg:w-72 lg:shrink-0 lg:sticky lg:top-[150px] lg:max-h-[calc(100vh-170px)] lg:overflow-y-auto">
          {/* Mobile: collapsed by default so it does not bury the document. */}
          <details className="rounded-lg border border-gray-200 lg:hidden">
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold text-gray-900">
              <ListOrdered className="h-4 w-4 text-lime-600" />
              Jump to section
            </summary>
            <nav className="px-2 pb-3">
              {SECTIONS.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  onClick={(event) => handleJump(event, section.id)}
                  className={navLink(section)}
                >
                  <span className="mr-1.5 tabular-nums text-gray-400">{section.number}.</span>
                  {section.title}
                </a>
              ))}
            </nav>
          </details>

          {/* Desktop: pinned below the fixed header so it stays in view while the
              document scrolls past it. It only scrolls internally if the list is taller
              than the viewport, which keeps clause 17 reachable on short screens.
              Rendered separately from the mobile disclosure so it can never inherit a
              collapsed state from it. */}
          <nav className="hidden lg:block">
            <p className="flex items-center gap-2 px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <ListOrdered className="h-3.5 w-3.5" />
              Contents
            </p>
            {SECTIONS.map((section) => (
              <a
                  key={section.id}
                  href={`#${section.id}`}
                  onClick={(event) => handleJump(event, section.id)}
                  className={navLink(section)}
                >
                <span className="mr-1.5 tabular-nums text-gray-400">{section.number}.</span>
                {section.title}
              </a>
            ))}
          </nav>
        </aside>

        {/* Document */}
        <main className="min-w-0 flex-1 space-y-10">
            <Clause number="1" title="Overview">
              <p>
                The Irhaas Referral Programme (“Referral Programme”) allows eligible Irhaas customers
                (“Referrers”) to earn rewards by referring new customers to Irhaas.
              </p>
              <p>
                By participating in the Referral Programme, including by sharing, receiving, or using a referral
                code, you acknowledge that you have read, understood, and agreed to these Terms &amp; Conditions.
              </p>
              <p>Irha's Wardrobe is an online store operating in Pakistan.</p>
            </Clause>

            <Clause number="2" title="Eligibility and How the Programme Works">
              <SubClause number="2.1" title="Referring a Friend">
                <p>
                  Eligible Irhaas customers may share their unique referral code with friends, family members, or
                  other eligible individuals.
                </p>
                <p>The referral code must be used in accordance with these Terms &amp; Conditions.</p>
              </SubClause>

              <SubClause number="2.2" title="Referred Customer">
                <p>For a referral to qualify as a successful referral:</p>
                <Bullets
                  items={[
                    "The referred customer must be a new Irhaas customer who has not previously placed an order with Irhaas.",
                    "The referred customer must register or create a Irhaas account using the Referrer's valid referral code.",
                    "The referred customer must place a qualifying order with a minimum purchase value of Rs 500.",
                    "The qualifying order must be successfully completed and delivered.",
                    "The order must not be cancelled, returned, refunded, partially or fully reversed, or otherwise invalidated.",
                    "The referral must successfully pass Irhaas's verification process.",
                  ]}
                />
              </SubClause>

              <SubClause number="2.3" title="Successful Referral">
                <p>
                  For the purposes of this Referral Programme, a “Successful Referral” means a referred customer who
                  has satisfied all applicable eligibility requirements and whose qualifying order has been
                  successfully delivered and remains valid.
                </p>
                <p>
                  A referral will not be counted toward the Referrer's referral total until all applicable qualifying
                  conditions have been satisfied.
                </p>
              </SubClause>
            </Clause>

            <Clause number="3" title="Referral Tiers and Rewards">
              <p>
                Irhaas offers three referral tiers. The referral reward applicable to a Referrer depends on the
                number of Successful Referrals completed by that Referrer.
              </p>

              <SubClause number="3.1" title="Regular Tier">
                <p>
                  A customer is eligible for the Regular Referral Tier from their first Successful Referral up to and
                  including their 50th Successful Referral.
                </p>
                <p>The Regular Tier referral reward is:</p>
                <p className="font-semibold text-gray-900">Rs [XX] per Successful Referral</p>
              </SubClause>

              <SubClause number="3.2" title="VIP Tier">
                <p>
                  Once a customer completes more than 50 Successful Referrals, they qualify for the VIP Referral Tier.
                </p>
                <p>The VIP Tier referral reward is:</p>
                <p className="font-semibold text-gray-900">Rs [XX] per Successful Referral</p>
                <p>
                  The VIP Tier applies from the 51st Successful Referral until the customer reaches 100 Successful
                  Referrals.
                </p>
              </SubClause>

              <SubClause number="3.3" title="PRO Tier">
                <p>
                  Once a customer completes 100 or more Successful Referrals, they qualify for the PRO Referral Tier.
                </p>
                <p>The PRO Tier referral reward is:</p>
                <p className="font-semibold text-gray-900">Rs [XX] per Successful Referral</p>
                <p>The PRO Tier provides the highest referral reward available under the Referral Programme.</p>
              </SubClause>

              <SubClause number="3.4" title="Tier Progression">
                <p>
                  Referral tiers are determined based on the total number of Successful Referrals recorded and
                  verified by Irhaas.
                </p>
                <p>The tier structure is:</p>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300 text-sm">
                    <thead>
                      <tr className="bg-lime-50">
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Referral Tier</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">
                          Successful Referrals
                        </th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold">
                          Reward per Successful Referral
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Regular", "1–50", "Rs [XX]"],
                        ["VIP", "51–99", "Rs [XX]"],
                        ["PRO", "100+", "Rs [XX]"],
                      ].map(([tier, count, reward]) => (
                        <tr key={tier}>
                          <td className="border border-gray-300 px-3 py-2">{tier}</td>
                          <td className="border border-gray-300 px-3 py-2">{count}</td>
                          <td className="border border-gray-300 px-3 py-2">{reward}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p>
                  Once a customer qualifies for a higher tier, the applicable higher-tier reward will apply to future
                  Successful Referrals, unless otherwise stated by Irhaas.
                </p>
                <p>
                  Previously completed referrals will not be retrospectively recalculated at the higher tier rate
                  unless Irhaas expressly states otherwise.
                </p>
                <p>
                  Irhaas may communicate the applicable reward amounts through its website, app, referral page,
                  account dashboard, promotional materials, or other official communication channels.
                </p>
              </SubClause>
            </Clause>

            <Clause number="4" title="Minimum Purchase Requirement">
              <p>The minimum qualifying purchase value for the Referral Programme is Rs 500.</p>
              <p>
                Only orders with a qualifying purchase value of Rs 500 or more will be considered for referral
                purposes.
              </p>
              <p>
                Shipping charges, taxes, discounts, vouchers, promotional credits, gift cards, or other charges may be
                excluded from the qualifying purchase value where applicable.
              </p>
              <p>
                Irhaas may determine which components of an order are included when calculating the qualifying
                purchase value.
              </p>
            </Clause>

            <Clause number="5" title="Referral Reward Conditions">
              <p>Referral rewards are subject to successful verification by Irhaas.</p>
              <p>A referral reward will only become eligible for issuance after:</p>
              <Bullets
                items={[
                  "The referred customer qualifies as a new customer.",
                  "The referral code has been correctly associated with the referred customer's account.",
                  "The referred customer completes a qualifying purchase of at least Rs 500.",
                  "The qualifying order has been successfully delivered.",
                  "The qualifying order has not been cancelled, returned, refunded, or otherwise invalidated.",
                  "The referral has passed Irhaas's verification process.",
                ]}
              />
              <p>
                Irhaas reserves the right to delay, withhold, reject, or reverse a referral reward while a referral,
                account, or order is being reviewed.
              </p>
            </Clause>

            <Clause number="6" title="Multiple Referrals">
              <p>
                There is no fixed limit on the number of eligible customers a Referrer may refer, unless otherwise
                stated by Irhaas.
              </p>
              <p>
                A Referrer may earn rewards for multiple Successful Referrals, provided that each referral
                independently satisfies all applicable requirements.
              </p>
              <p>
                The more Successful Referrals you complete, the higher your referral tier can become and the greater
                your reward per future Successful Referral may be.
              </p>
              <p>
                Referral rewards are calculated based on the applicable tier at the time the relevant Successful
                Referral qualifies for a reward.
              </p>
            </Clause>

            <Clause number="7" title="Referred Customer Benefits">
              <p>
                Where applicable, a referred customer may receive a promotional discount or other benefit for using a
                valid referral code.
              </p>
              <p>Any such benefit:</p>
              <Bullets
                items={[
                  "May be subject to minimum purchase requirements.",
                  "May be subject to promotional terms and expiry dates.",
                  "May only be available to new Irhaas customers.",
                  "May not be combined with certain other promotions or discount codes.",
                  "Will be communicated through the Irhaas website, app, referral page, or promotional materials.",
                ]}
              />
              <p>The availability and amount of any referred-customer benefit may vary from time to time.</p>
            </Clause>

            <Clause number="8" title="Referral Programme Restrictions">
              <p>The following activities may result in a referral being rejected and/or rewards being cancelled:</p>
              <Bullets
                items={[
                  "Referring an existing Irhaas customer.",
                  "Creating multiple accounts to obtain referral rewards or customer discounts.",
                  "Using your own referral code on your own account or order.",
                  "Referring yourself through another account or identity.",
                  "Using fake, duplicate, misleading, or inaccurate customer information.",
                  "Manipulating or attempting to manipulate the Referral Programme.",
                  "Generating referrals through fraudulent, abusive, deceptive, or unlawful methods.",
                  "Using automated systems, bots, scripts, or other unauthorized methods to generate referrals.",
                  "Any activity that violates Irhaas's website terms, account terms, or applicable laws.",
                ]}
              />
              <p>
                Irhaas reserves the right to determine whether a referral or account activity violates these Terms
                &amp; Conditions based on the information reasonably available to Irhaas.
              </p>
            </Clause>

            <Clause number="9" title="Reward Verification and Account Review">
              <p>Irhaas may verify referrals before issuing rewards.</p>
              <p>Verification may include reviewing:</p>
              <Bullets
                items={[
                  "Customer account information.",
                  "Referral code usage.",
                  "Order information.",
                  "Payment information.",
                  "Delivery status.",
                  "Cancellation, return, or refund activity.",
                  "Multiple or related accounts.",
                  "Other information reasonably necessary to confirm that the referral is genuine and eligible.",
                ]}
              />
              <p>A referral reward may be placed on hold while verification is in progress.</p>
              <p>
                If Irhaas determines that a referral does not meet the applicable requirements, the referral may be
                rejected and no reward will be issued.
              </p>
            </Clause>

            <Clause number="10" title="Reward Issuance and Usage">
              <p>
                Referral rewards will be credited to the eligible customer's Irhaas account or provided through
                another method specified by Irhaas.
              </p>
              <p>Unless otherwise stated:</p>
              <Bullets
                items={[
                  "Referral rewards are not transferable.",
                  "Referral rewards cannot be exchanged for cash.",
                  "Referral rewards cannot be transferred to another customer.",
                  "Referral rewards cannot be sold or assigned to another person.",
                  "Rewards may be subject to minimum purchase requirements when redeemed.",
                  "Additional conditions applicable to the use of rewards may be communicated by Irhaas.",
                ]}
              />
              <p>
                Irhaas may establish additional conditions regarding the redemption or use of referral rewards.
              </p>
            </Clause>

            <Clause number="11" title="Reward Expiry">
              <p>
                Any expiry period applicable to referral rewards will be clearly communicated to the customer when the
                reward is issued.
              </p>
              <p>
                Where an expiry period is specified, unused rewards will automatically expire after the stated expiry
                date.
              </p>
              <p>Expired rewards will not be reinstated unless Irhaas expressly agrees otherwise.</p>
            </Clause>

            <Clause number="12" title="Returns, Refunds and Cancellations">
              <p>If a referred customer's qualifying order is:</p>
              <Bullets
                items={[
                  "Cancelled;",
                  "Returned;",
                  "Fully or partially refunded;",
                  "Reversed;",
                  "Unsuccessfully delivered; or",
                  "Otherwise determined not to be a valid completed qualifying order,",
                ]}
              />
              <p>Irhaas may cancel or reverse the referral reward associated with that order.</p>
              <p>
                If a reward has already been issued and the underlying referral later becomes invalid, Irhaas may
                deduct, reverse, or otherwise recover the corresponding reward in accordance with applicable law and
                Irhaas's account terms.
              </p>
              <p>
                If the reversal of a referral causes the Referrer's Successful Referral count to fall below a tier
                threshold, Irhaas may adjust the Referrer's referral tier accordingly.
              </p>
            </Clause>

            <Clause number="13" title="Referral Tier Adjustments">
              <p>Referral tiers are based on verified Successful Referrals.</p>
              <p>
                If one or more referrals are subsequently determined to be invalid due to cancellation, return,
                refund, fraud, abuse, or any other disqualifying circumstance, Irhaas may remove those referrals
                from the Referrer's Successful Referral count.
              </p>
              <p>
                As a result, the Referrer's tier may be adjusted if the revised Successful Referral count no longer
                meets the requirements for that tier.
              </p>
              <p>Any resulting reward adjustment will apply in accordance with the applicable programme rules.</p>
            </Clause>

            <Clause number="14" title="Programme Abuse and Fraud">
              <p>
                Irhaas reserves the right to investigate referral activity that appears fraudulent, abusive,
                misleading, manipulated, or inconsistent with the intended purpose of the Referral Programme.
              </p>
              <p>
                Where abuse or fraudulent activity is identified or reasonably suspected, Irhaas may, subject to
                applicable law:
              </p>
              <Bullets
                items={[
                  "Cancel pending referral rewards.",
                  "Reverse previously issued rewards.",
                  "Remove invalid referrals from a customer's referral count.",
                  "Adjust or downgrade a customer's referral tier.",
                  "Restrict or suspend participation in the Referral Programme.",
                  "Suspend or restrict the relevant customer account.",
                  "Take any other appropriate action permitted under applicable terms and law.",
                ]}
              />
              <p>
                Irhaas may take action against accounts involved in referral abuse even if the relevant reward has
                already been issued.
              </p>
            </Clause>

            <Clause number="15" title="Changes to the Referral Programme">
              <p>
                Irhaas reserves the right to modify, suspend, or terminate the Referral Programme at any time,
                subject to applicable law.
              </p>
              <p>Changes may include, but are not limited to:</p>
              <Bullets
                items={[
                  "Referral reward amounts.",
                  "Referral tier thresholds.",
                  "Minimum purchase requirements.",
                  "Eligibility requirements.",
                  "Reward expiry periods.",
                  "Redemption conditions.",
                  "Referral Programme duration.",
                ]}
              />
              <p>
                Changes may be communicated through the Irhaas website, app, referral page, account dashboard, or
                other official communication channels.
              </p>
              <p>
                Unless otherwise stated, changes will apply prospectively from the effective date communicated by
                Irhaas.
              </p>
              <p>
                Referrals that have already satisfied all applicable qualifying conditions before a change may be
                honoured according to the terms applicable at the time they became Successful Referrals.
              </p>
            </Clause>

            <Clause number="16" title="No Guarantee of Rewards">
              <p>
                Participation in the Referral Programme does not guarantee that a customer will receive a referral
                reward.
              </p>
              <p>
                Rewards are only earned when all applicable requirements under these Terms &amp; Conditions have been
                satisfied and the referral has been successfully verified by Irhaas.
              </p>
            </Clause>

            <Clause number="17" title="General Terms">
              <p>
                Participation in the Irhaas Referral Programme is subject to these Terms &amp; Conditions,
                Irhaas's applicable website and account terms, and any other terms communicated by Irhaas in
                connection with the Referral Programme.
              </p>
              <p>
                If there is any conflict between these Terms &amp; Conditions and a specific promotional offer, the
                terms of that specific promotional offer may apply to the extent expressly stated.
              </p>
              <p>
                By participating in the Referral Programme, you acknowledge that you have read, understood, and
                agreed to these Terms &amp; Conditions.
              </p>
            </Clause>

            <div className="border-t border-gray-200 pt-6 text-center space-y-1">
              <p className="flex items-center justify-center gap-2 font-semibold text-gray-900">
                <FileText className="h-4 w-4 text-lime-600" />
                Irhaas
              </p>
              <p className="text-sm text-gray-600">Irha's Wardrobe</p>
            </div>
        </main>
      </div>
    </div>
  )
}
