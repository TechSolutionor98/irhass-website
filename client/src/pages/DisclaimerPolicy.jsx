"use client"

import LegalPage from "../components/LegalPage"
import { LEGAL_PAGES } from "../data/legalPages"

export default function DisclaimerPolicy() {
  return <LegalPage page={LEGAL_PAGES["disclaimer-policy"]} />
}
