"use client"

import AdminSidebar from "../../components/admin/AdminSidebar"
import ReferralTypesSection from "../../components/admin/ReferralTypesSection"
import { Gift } from "lucide-react"

const AdminReferralTypes = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar />

      <div className="ml-64 p-8 max-w-7xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-xl shadow-sm">
            <Gift className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Referral Types</h1>
            <p className="text-sm text-gray-500">
              Create tiers (e.g. Silver, Gold, Platinum) and assign them to users to customize their referral rewards
            </p>
          </div>
        </div>

        <ReferralTypesSection standalone={true} />
      </div>
    </div>
  )
}

export default AdminReferralTypes
