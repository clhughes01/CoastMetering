'use client'

import { useState, useEffect } from 'react'
import { createSupabaseClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function TenantPortal() {
  const [tenant, setTenant] = useState<any>(null)
  const [readings, setReadings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createSupabaseClient()

  useEffect(() => {
    // TODO: Get tenant from authenticated user
    // For now, this is a placeholder
    loadTenantData()
  }, [])

  const loadTenantData = async () => {
    try {
      // TODO: Replace with actual tenant lookup based on authenticated user
      // This is a placeholder that will need authentication
      setLoading(false)
    } catch (error) {
      console.error('Error loading tenant data:', error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Coast Metering - Tenant Portal
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="text-gray-600 hover:text-gray-900"
              >
                Home
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading your account...</p>
          </div>
        ) : tenant ? (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Welcome, {tenant.name}
              </h2>
              <p className="text-gray-600">
                View your utility usage and bills
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Account Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Account Number</p>
                  <p className="text-base font-medium text-gray-900">
                    {tenant.account_number || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Move In Date</p>
                  <p className="text-base font-medium text-gray-900">
                    {new Date(tenant.move_in_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  Utility Usage
                </h3>
              </div>
              <div className="p-6">
                {readings.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No usage data available yet
                  </p>
                ) : (
                  <div className="space-y-4">
                    {/* Usage data will be displayed here */}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">
              Please log in to view your account
            </p>
            <p className="text-sm text-gray-400">
              Authentication will be implemented in the next phase
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
