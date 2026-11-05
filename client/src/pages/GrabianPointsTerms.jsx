import { useEffect, useRef, useState } from "react"
import { FileText, ListOrdered } from "lucide-react"
import TranslatedText from "../components/TranslatedText"
import GrabCoin from "../components/GrabCoin"

// The clause list drives both the jump links and the scroll-spy highlight, so the
// sidebar can never fall out of step with the document.
const SECTIONS = [
  { number: "1", title: "Overview" },
  { number: "2", title: "Programme Eligibility" },
  { number: "3", title: "Earning Grabian Points" },
  { number: "4", title: "When Grabian Points Are Credited" },
  { number: "5", title: "Returns, Refunds and Cancellations" },
  { number: "6", title: "Using Grabian Points" },
  { number: "7", title: "No Expiry of Grabian Points" },
  { number: "8", title: "Points Balance" },
  { number: "9", title: "Grabian Points Have No Cash Value" },
  { number: "10", title: "Promotional and Bonus Points" },
  { number: "11", title: "Programme Abuse and Fraud" },
  { number: "12", title: "Incorrectly Awarded Points" },
  { number: "13", title: "Account Closure" },
  { number: "14", title: "Changes to the Grabian Points Programme" },
  { number: "15", title: "Programme Suspension or Termination" },
  { number: "16", title: "No Guarantee of Points" },
  { number: "17", title: "Technical Issues and System Errors" },
  { number: "18", title: "General Terms" },
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

/** A sub-clause heading such as "2.1 Eligible Customers". */
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

export default function GrabianPointsTerms() {
  const activeId = useActiveClause()

  // Scrolling is done here rather than letting the browser follow the anchor, so the
  // address bar stays clean instead of collecting a "#clause-2" on every click.
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

  const links = SECTIONS.map((section) => (
    <a
      key={section.id}
      href={`#${section.id}`}
      onClick={(event) => handleJump(event, section.id)}
      className={navLink(section)}
    >
      <span className="mr-1.5 tabular-nums text-gray-400">{section.number}.</span>
      {section.title}
    </a>
  ))

  return (
    <div className="min-h-screen bg-white">
      {/* Title band */}
      <div>
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <div className="flex items-start gap-3">
            <span className="mt-1 shrink-0">
              <GrabCoin size={28} />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                <TranslatedText>Grabian Points Programme – Terms &amp; Conditions</TranslatedText>
              </h1>
              <p className="mt-1 text-sm font-medium text-gray-500">Effective Date: [Insert Date]</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 lg:flex lg:items-start lg:gap-10">
        {/* Jump links. Sticky on desktop so the list stays in view while the document
            scrolls past it; collapsed on mobile so it does not bury the content. */}
        <aside className="mb-6 lg:mb-0 lg:w-72 lg:shrink-0 lg:sticky lg:top-[150px] lg:max-h-[calc(100vh-170px)] lg:overflow-y-auto">
          <details className="rounded-lg border border-gray-200 lg:hidden">
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold text-gray-900">
              <ListOrdered className="h-4 w-4 text-lime-600" />
              Jump to section
            </summary>
            <nav className="px-2 pb-3">{links}</nav>
          </details>

          <nav className="hidden lg:block">
            <p className="flex items-center gap-2 px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <ListOrdered className="h-3.5 w-3.5" />
              Contents
            </p>
            {links}
          </nav>
        </aside>

        {/* Document */}
        <main className="min-w-0 flex-1 space-y-10">
          <Clause number="1" title="Overview">
            <p>
              The Grabian Points Programme (“Grabian Points” or “Programme”) is a customer loyalty and rewards
              programme offered by Irhaas.
            </p>
            <p>
              The Programme allows eligible Irhaas customers (“Members”) to earn Grabian Points through eligible
              purchases and other activities specified by Irhaas. Accumulated points can be used to purchase
              products or receive discounts on purchases from Irhaas, subject to these Terms &amp; Conditions.
            </p>
            <p>Irha's Wardrobe is an online store operating in Pakistan.</p>
            <p>
              By participating in the Grabian Points Programme, earning or using Grabian Points, you acknowledge that
              you have read, understood, and agreed to these Terms &amp; Conditions.
            </p>
          </Clause>

          <Clause number="2" title="Programme Eligibility">
            <SubClause number="2.1" title="Eligible Customers">
              <p>
                The Grabian Points Programme is available to eligible customers with a valid Irhaas account.
              </p>
              <p>
                Customers must provide accurate and up-to-date account information to participate in the Programme.
              </p>
            </SubClause>

            <SubClause number="2.2" title="One Account Per Customer">
              <p>
                Each customer may maintain only one Irhaas account for the purpose of earning and using Grabian
                Points.
              </p>
              <p>Creating or using multiple accounts to obtain additional points or benefits is not permitted.</p>
            </SubClause>
          </Clause>

          <Clause number="3" title="Earning Grabian Points">
            <p>Members earn Grabian Points based on the value of their qualifying purchases from Irhaas.</p>
            <p>Unless otherwise stated by Irhaas:</p>
            <p className="font-semibold text-gray-900">100 Grabian Points = Rs 1</p>
            <p>The applicable points will be calculated based on the qualifying value of the order.</p>
            <p>
              Grabian Points may be earned when purchasing any product available for purchase through Irhaas,
              unless a specific promotion or programme rule states otherwise.
            </p>
          </Clause>

          <Clause number="4" title="When Grabian Points Are Credited">
            <p>
              Grabian Points will be credited to the Member's Irhaas account once the qualifying order has been
              successfully delivered.
            </p>
            <p>
              Points will not be credited for orders that are cancelled, returned, refunded, or otherwise not
              successfully completed.
            </p>
            <p>
              Once an eligible order has been successfully delivered and the applicable points have been credited,
              the points will become available for use according to these Terms &amp; Conditions.
            </p>
          </Clause>

          <Clause number="5" title="Returns, Refunds and Cancellations">
            <p>If an order for which Grabian Points have been awarded is subsequently:</p>
            <Bullets
              items={[
                "Cancelled;",
                "Returned;",
                "Fully or partially refunded;",
                "Reversed; or",
                "Otherwise invalidated,",
              ]}
            />
            <p>
              Irhaas reserves the right to remove or reverse the Grabian Points awarded for that transaction.
            </p>
            <p>For partially refunded orders, the points may be adjusted according to the final qualifying order value.</p>
            <p>
              If points earned from a transaction have already been used before the transaction is returned or
              refunded, Irhaas may deduct the corresponding points from the Member's account.
            </p>
          </Clause>

          <Clause number="6" title="Using Grabian Points">
            <p>Members may use their available Grabian Points to purchase products available on Irhaas.</p>
            <p>The value of the points is:</p>
            <p className="font-semibold text-gray-900">100 Grabian Points = Rs 1</p>
            <p>
              A Member may use Grabian Points toward a purchase when they have sufficient points to cover the
              applicable product or purchase value.
            </p>

            <SubClause number="6.1" title="Full Payment Using Grabian Points">
              <p>
                Where the Member has enough Grabian Points to cover the applicable purchase amount, the Member may
                use their points to pay for the purchase.
              </p>
              <p>For example:</p>
              <p>
                If a product costs Rs 500, The Member must have at least 50,000 Grabian Points to cover Rs 500
                value full purchase using Grabian Points.
              </p>
            </SubClause>

            <SubClause number="6.2" title="Partial Payment Using Grabian Points">
              <p>
                Where permitted by the Irhaas checkout system, Members may also use available Grabian Points toward
                part of a purchase and pay the remaining amount using an available payment method.
              </p>
              <p>The availability of partial payment may depend on the checkout options provided by Irhaas.</p>
            </SubClause>

            <SubClause number="6.3" title="Product Eligibility">
              <p>
                Grabian Points may be used to purchase any product available on Irhaas, unless Irhaas
                specifically states that a particular product, category, promotion, or transaction is excluded from
                points redemption.
              </p>
            </SubClause>
          </Clause>

          <Clause number="7" title="No Expiry of Grabian Points">
            <p>Grabian Points do not expire.</p>
            <p>
              Once earned and credited to a Member's account, points will remain available for the Member to use for
              as long as the Grabian Points Programme remains active and the Member's account remains eligible.
            </p>
            <p>Members may use their accumulated points whenever they choose, subject to the applicable Programme rules.</p>
            <p>Grabian Points do not expire simply because they have remained unused for a certain period.</p>
          </Clause>

          <Clause number="8" title="Points Balance">
            <p>
              Members can view their available Grabian Points through their Irhaas account, where the points
              balance functionality is available.
            </p>
            <p>
              The points balance displayed in the Member's Irhaas account will be considered the official points
              balance, subject to correction of technical errors, system errors, refunds, returns, or other
              legitimate account adjustments.
            </p>
            <p>Members should contact Irhaas if they believe their points balance is incorrect.</p>
          </Clause>

          <Clause number="9" title="Grabian Points Have No Cash Value">
            <p>
              Grabian Points are loyalty rewards provided by Irhaas and are not cash or a cash-equivalent balance.
            </p>
            <p>Unless expressly stated otherwise:</p>
            <Bullets
              items={[
                "Grabian Points cannot be withdrawn as cash.",
                "Grabian Points cannot be transferred to a bank account.",
                "Grabian Points cannot be exchanged for cash.",
                "Grabian Points cannot be sold.",
                "Grabian Points cannot be transferred to another customer's account.",
                "Grabian Points can only be used through the redemption methods provided by Irhaas.",
              ]}
            />
          </Clause>

          <Clause number="10" title="Promotional and Bonus Points">
            <p>
              Irhaas may occasionally offer additional or bonus Grabian Points through special promotions,
              campaigns, or customer activities.
            </p>
            <p>Promotional points may be subject to additional terms, including:</p>
            <Bullets
              items={[
                "Specific promotional periods.",
                "Specific products or categories.",
                "Minimum purchase requirements.",
                "Maximum points limits.",
                "Customer eligibility requirements.",
                "Other conditions communicated with the promotion.",
              ]}
            />
            <p>Where promotional terms apply, those terms will govern the relevant promotional points.</p>
          </Clause>

          <Clause number="11" title="Programme Abuse and Fraud">
            <p>
              Irhaas reserves the right to investigate activity that appears fraudulent, abusive, misleading,
              manipulated, or inconsistent with the purpose of the Grabian Points Programme.
            </p>
            <p>Prohibited activities may include:</p>
            <Bullets
              items={[
                "Creating multiple accounts to obtain additional points.",
                "Providing false or misleading information.",
                "Manipulating orders or transactions to obtain points.",
                "Exploiting technical or system errors.",
                "Using bots, scripts, automated systems, or unauthorized methods.",
                "Repeatedly placing and cancelling orders for the purpose of obtaining points.",
                "Selling or transferring points without authorization.",
                "Any other activity that Irhaas reasonably determines to be fraudulent or abusive.",
              ]}
            />
            <p>Where abuse or fraudulent activity is identified or reasonably suspected, Irhaas may:</p>
            <Bullets
              items={[
                "Cancel pending points.",
                "Remove previously awarded points.",
                "Reverse points used in an invalid transaction.",
                "Restrict or suspend Programme participation.",
                "Suspend or restrict the relevant customer account.",
                "Take any other appropriate action permitted under applicable law.",
              ]}
            />
          </Clause>

          <Clause number="12" title="Incorrectly Awarded Points">
            <p>Irhaas reserves the right to correct or remove points that were incorrectly credited due to:</p>
            <Bullets
              items={[
                "Technical errors.",
                "System errors.",
                "Duplicate transactions.",
                "Incorrect calculations.",
                "Promotional errors.",
                "Refunds or cancellations.",
                "Fraudulent or abusive activity.",
                "Other circumstances resulting in an incorrect points balance.",
              ]}
            />
            <p>If points were incorrectly awarded, Irhaas may adjust the Member's points balance accordingly.</p>
          </Clause>

          <Clause number="13" title="Account Closure">
            <p>
              If a Member voluntarily closes their Irhaas account, any unused Grabian Points associated with that
              account may become unavailable.
            </p>
            <p>
              If Irhaas suspends or terminates an account due to fraud, abuse, violation of these Terms &amp;
              Conditions, or violation of other applicable Irhaas terms, Irhaas may cancel any unused Grabian
              Points associated with that account.
            </p>
          </Clause>

          <Clause number="14" title="Changes to the Grabian Points Programme">
            <p>
              Irhaas reserves the right to modify, suspend, or terminate the Grabian Points Programme at any time,
              subject to applicable law.
            </p>
            <p>Changes may include:</p>
            <Bullets
              items={[
                "The number of points earned per purchase.",
                "The points-to-rupee redemption value.",
                "Eligible products.",
                "Redemption conditions.",
                "Programme eligibility requirements.",
                "Promotional points.",
                "Other Programme rules.",
              ]}
            />
            <p>
              Any changes may be communicated through the Irhaas website, app, customer account, promotional
              materials, email, or other official communication channels.
            </p>
            <p>
              Unless otherwise required by law, changes will apply prospectively from the effective date communicated
              by Irhaas.
            </p>
          </Clause>

          <Clause number="15" title="Programme Suspension or Termination">
            <p>
              Irhaas may temporarily suspend or permanently terminate the Grabian Points Programme where reasonably
              necessary, including for:
            </p>
            <Bullets
              items={[
                "Technical reasons.",
                "Security reasons.",
                "Fraud prevention.",
                "Operational reasons.",
                "Business reasons.",
                "Changes to the Irhaas loyalty programme.",
                "Legal or regulatory requirements.",
              ]}
            />
            <p>
              Where reasonably practicable, Irhaas may provide notice of significant changes or termination through
              its official communication channels.
            </p>
          </Clause>

          <Clause number="16" title="No Guarantee of Points">
            <p>
              Participation in the Grabian Points Programme does not guarantee that a Member will receive a
              particular number of points.
            </p>
            <p>
              Points are awarded only in accordance with the applicable Programme rules and qualifying transaction
              requirements.
            </p>
            <p>
              Irhaas may also limit or exclude points for specific transactions where expressly communicated to
              customers.
            </p>
          </Clause>

          <Clause number="17" title="Technical Issues and System Errors">
            <p>
              Irhaas is not responsible for delays or errors in points crediting caused by technical issues, system
              failures, incorrect information, third-party services, or circumstances beyond Irhaas's reasonable
              control.
            </p>
            <p>
              Where a technical or system error results in an incorrect points balance, Irhaas reserves the right
              to correct the balance.
            </p>
          </Clause>

          <Clause number="18" title="General Terms">
            <p>
              Participation in the Grabian Points Programme is subject to these Terms &amp; Conditions, the
              applicable Irhaas website and account terms, and any additional terms communicated in connection with
              specific promotions or rewards.
            </p>
            <p>
              If there is a conflict between these Terms &amp; Conditions and specific promotional terms, the
              specific promotional terms may apply to the extent expressly stated.
            </p>
            <p>
              By participating in the Grabian Points Programme, you acknowledge that you have read, understood, and
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
