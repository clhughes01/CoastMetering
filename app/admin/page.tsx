'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useProperties } from '@/hooks'
import { PageContainer, Navbar, MainContent, LoadingSpinner, CreatePropertyModal, Button } from '@/components'
import { ROUTES } from '@/lib/constants'

export default function AdminDashboard() {
  const { properties, loading, error, refetch } = useProperties()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  return (
    <PageContainer>
      <Navbar title="Coast Metering - Admin Dashboard" />
      <MainContent>
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Properties</h2>
            <p className="text-gray-600">Manage all properties and units</p>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            + Create Property
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <LoadingSpinner size="lg" />
            <p className="text-gray-500 mt-4">Loading properties...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">Error loading properties: {error.message}</p>
          </div>
        ) : properties.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">No properties found</p>
            <p className="text-sm text-gray-400">
              Properties will appear here once added to the database
            </p>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    City
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Owner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {properties.map((property) => (
                  <tr key={property.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {property.address}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {property.city}, {property.state} {property.zip_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {property.owner_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link
                        href={ROUTES.ADMIN.PROPERTY_DETAIL(property.id)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <CreatePropertyModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            refetch()
          }}
        />
      </MainContent>
    </PageContainer>
  )
}
