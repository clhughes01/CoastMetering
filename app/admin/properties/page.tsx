'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useProperties } from '@/hooks'
import { PageContainer, Navbar, MainContent, LoadingSpinner, CreatePropertyModal, Button } from '@/components'
import { ROUTES } from '@/lib/constants'

export default function PropertiesPage() {
  const { properties, loading, error, refetch } = useProperties()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  return (
    <PageContainer>
      <Navbar title="Coast Metering" />
      <div className="pt-16">
        <MainContent>
          <div className="mb-6 flex justify-between items-center bg-white rounded-xl shadow-soft border border-gray-200 p-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">Properties</h1>
              <p className="text-gray-600 text-sm">Manage all properties, units, tenants, and meters</p>
            </div>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <span className="mr-2">+</span> Create Property
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
            <div className="bg-white rounded-xl shadow-soft border border-gray-200 p-12 text-center">
              <p className="text-gray-500 mb-4 text-lg">No properties found</p>
              <p className="text-sm text-gray-400 mb-6">
                Properties will appear here once added to the database
              </p>
              <Button onClick={() => setIsCreateModalOpen(true)}>
                Create Your First Property
              </Button>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-soft border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-slate-50 to-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Address
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      City
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Owner
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {properties.map((property) => (
                    <tr key={property.id} className="hover:bg-blue-50/50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">{property.address}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">{property.city}, {property.state} {property.zip_code}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">{property.owner_name || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          href={ROUTES.ADMIN.PROPERTY_DETAIL(property.id)}
                          className="text-blue-600 hover:text-blue-700 font-semibold transition-colors duration-200"
                        >
                          View Details →
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
      </div>
    </PageContainer>
  )
}
