"use client"

import LegalPage from "../components/LegalPage"
import { LEGAL_PAGES } from "../data/legalPages"

export default function CookiesAndPolicy() {
  return <LegalPage page={LEGAL_PAGES["cookies-policy"]} />
}
