// Predefined provinces / states / governorates for countries enabled in settings

export const COUNTRY_PROVINCES = {
  AE: [
    "Abu Dhabi",
    "Ajman",
    "Al Ain",
    "Dubai",
    "Fujairah",
    "Ras Al Khaimah",
    "Sharjah",
    "Umm Al Quwain",
  ],
  SA: [
    "Riyadh Region",
    "Makkah Region (Jeddah, Makkah)",
    "Madinah Region",
    "Eastern Province (Dammam, Khobar, Dhahran)",
    "Al Qassim Region",
    "Asir Region",
    "Tabuk Region",
    "Hail Region",
    "Northern Borders Region",
    "Jazan Region",
    "Najran Region",
    "Al Baha Region",
    "Al Jawf Region",
  ],
  QA: [
    "Doha",
    "Al Rayyan",
    "Al Wakrah",
    "Al Khor",
    "Al Daayen",
    "Umm Salal",
    "Al Shamal",
    "Shahaniya",
  ],
  OM: [
    "Muscat Governorate",
    "Dhofar Governorate",
    "Musandam Governorate",
    "Al Buraimi Governorate",
    "Ad Dakhiliyah Governorate",
    "Al Batinah North Governorate",
    "Al Batinah South Governorate",
    "Ash Sharqiyah North Governorate",
    "Ash Sharqiyah South Governorate",
    "Ad Dhahirah Governorate",
    "Al Wusta Governorate",
  ],
  KW: [
    "Al Asimah (Kuwait City)",
    "Hawalli Governorate",
    "Farwaniya Governorate",
    "Mubarak Al-Kabeer Governorate",
    "Ahmadi Governorate",
    "Jahra Governorate",
  ],
  BH: [
    "Capital Governorate (Manama)",
    "Muharraq Governorate",
    "Northern Governorate",
    "Southern Governorate",
  ],
  EG: [
    "Cairo",
    "Giza",
    "Alexandria",
    "Qalyubia",
    "Sharqia",
    "Gharbia",
    "Monufia",
    "Beheira",
    "Dakahlia",
    "Damietta",
    "Port Said",
    "Ismailia",
    "Suez",
    "Red Sea",
    "Fayoum",
    "Beni Suef",
    "Minya",
    "Asyut",
    "Sohag",
    "Qena",
    "Luxor",
    "Aswan",
    "Matrouh",
    "North Sinai",
    "South Sinai",
    "New Valley",
  ],
  JO: [
    "Amman",
    "Zarqa",
    "Irbid",
    "Aqaba",
    "Balqa",
    "Madaba",
    "Jerash",
    "Ajloun",
    "Mafraq",
    "Karak",
    "Tafilah",
    "Ma'an",
  ],
  TR: [
    "Istanbul",
    "Ankara",
    "Izmir",
    "Bursa",
    "Antalya",
    "Adana",
    "Konya",
    "Gaziantep",
    "Kocaeli",
    "Mersin",
    "Mugla",
    "Trabzon",
  ],
  GB: [
    "Greater London",
    "England",
    "Scotland",
    "Wales",
    "Northern Ireland",
  ],
  US: [
    "California",
    "Texas",
    "Florida",
    "New York",
    "Illinois",
    "Pennsylvania",
    "Ohio",
    "Georgia",
    "North Carolina",
    "Washington",
  ],
  IN: [
    "Maharashtra",
    "Delhi",
    "Karnataka",
    "Tamil Nadu",
    "Telangana",
    "Gujarat",
    "Uttar Pradesh",
    "West Bengal",
    "Punjab",
    "Kerala",
  ],
  PK: [
    "Punjab",
    "Sindh",
    "Khyber Pakhtunkhwa",
    "Balochistan",
    "Islamabad Capital Territory",
    "Azad Kashmir",
    "Gilgit-Baltistan",
  ],
}

/**
 * Normalizes country input (name or code) and returns matching array of provinces/states or null.
 * @param {string} countryNameOrCode 
 * @returns {Array<string>|null}
 */
export const getProvincesForCountry = (countryNameOrCode) => {
  if (!countryNameOrCode) return COUNTRY_PROVINCES.AE

  const clean = String(countryNameOrCode).trim().toUpperCase()

  // Match by code first
  if (COUNTRY_PROVINCES[clean]) {
    return COUNTRY_PROVINCES[clean]
  }

  // Name map
  if (clean.includes("EMIRATES") || clean.includes("UAE") || clean === "UNITED ARAB EMIRATES") return COUNTRY_PROVINCES.AE
  if (clean.includes("SAUDI") || clean.includes("KSA") || clean === "SAUDI ARABIA") return COUNTRY_PROVINCES.SA
  if (clean.includes("QATAR")) return COUNTRY_PROVINCES.QA
  if (clean.includes("OMAN")) return COUNTRY_PROVINCES.OM
  if (clean.includes("KUWAIT")) return COUNTRY_PROVINCES.KW
  if (clean.includes("BAHRAIN")) return COUNTRY_PROVINCES.BH
  if (clean.includes("EGYPT")) return COUNTRY_PROVINCES.EG
  if (clean.includes("JORDAN")) return COUNTRY_PROVINCES.JO
  if (clean.includes("TURKEY") || clean.includes("TÜRKIYE")) return COUNTRY_PROVINCES.TR
  if (clean.includes("KINGDOM") || clean.includes("UK") || clean === "UNITED KINGDOM") return COUNTRY_PROVINCES.GB
  if (clean.includes("STATES") || clean.includes("USA") || clean === "UNITED STATES") return COUNTRY_PROVINCES.US
  if (clean.includes("INDIA")) return COUNTRY_PROVINCES.IN
  if (clean.includes("PAKISTAN")) return COUNTRY_PROVINCES.PK

  return null
}
