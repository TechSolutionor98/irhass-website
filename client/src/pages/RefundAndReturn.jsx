"use client"

import LegalPage from "../components/LegalPage"
import { LEGAL_PAGES } from "../data/legalPages"

export default function RefundAndReturn() {
  return <LegalPage page={LEGAL_PAGES["refund-return"]} />
}
