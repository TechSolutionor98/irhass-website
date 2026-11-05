"use client"

import LegalPage from "../components/LegalPage"
import { LEGAL_PAGES } from "../data/legalPages"

export default function VoucherTerms() {
  return <LegalPage page={LEGAL_PAGES["voucher-terms"]} />
}
