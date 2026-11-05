"use client"

import LegalPage from "../components/LegalPage"
import { LEGAL_PAGES } from "../data/legalPages"

export default function DeliveryTerms() {
  return <LegalPage page={LEGAL_PAGES["delivery-terms"]} />
}
