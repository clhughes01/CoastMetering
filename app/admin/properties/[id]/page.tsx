'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useProperty } from '@/hooks'
import { PageContainer, Navbar, MainContent, LoadingSpinner, CreateUnitModal, CreateTenantModal, CreateMeterModal, Button } from '@/components'
import { ROUTES } from '@/lib/constants'

export default function PropertyDetails() {
  const params = useParams()
  const propertyId = params.id as string
  const { property, loading, error, refetch } = useProperty(propertyId)
  const [isCreateUnitModalOpen, setIsCreateUnitModalOpen] = useState(false)
  const [selectedUnitForTenant, setSelectedUnitForTenant] = useState<{ id: string; number: string } | null>(null)
  const [selectedUnitForMeter, setSelectedUnitForMeter] = useState<{ id: string; number: string } | null>(null)

  if (loading) {
    return (
      <PageContainer>
        <Navbar title="Coast Metering" />
        <div className="pt-16">
          <MainContent>
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <LoadingSpinner size="lg" />
                <p className="text-gray-500 mt-4">Loading property details...</p>
              </div>
            </div>
          </MainContent>
        </div>
      </PageContainer>
    )
  }

  if (error || !property) {
    return (
      <PageContainer>
        <Navbar title="Coast Metering" />
        <div className="pt-16">
          <MainContent>
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <p className="text-gray-500 mb-4">
                  {error ? `Error: ${error.message}` : 'Property not found'}
                </p>
                <Link
                  href={ROUTES.ADMIN.ROOT}
                  className="text-blue-600 hover:text-blue-900 font-medium"
                >
                  Back to Admin Dashboard
                </Link>
              </div>
            </div>
          </MainContent>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <Navbar title="Coast Metering" />
      <div className="pt-16">
        <MainContent>
          <div className="mb-6">
            <Link
              href={ROUTES.ADMIN.ROOT}
              className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4 font-medium"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Properties
            </Link>
          </div>
        {/* Property Information */}
        <div className="bg-white rounded-xl shadow-soft border border-gray-200 mb-6 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-gray-900">
              {property.address}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">City, State, ZIP</p>
              <p className="text-lg font-semibold text-gray-900">
                {property.city}, {property.state} {property.zip_code}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Owner</p>
              <p className="text-lg font-semibold text-gray-900">
                {property.owner_name || 'N/A'}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Water Utility</p>
              <p className="text-lg font-semibold text-gray-900">
                {property.water_utility || 'N/A'}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Power Utility</p>
              <p className="text-lg font-semibold text-gray-900">
                {property.power_utility || 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Units */}
        <div className="bg-white rounded-xl shadow-soft border border-gray-200">
          <div className="px-8 py-5 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-slate-50 to-gray-50">
            <h3 className="text-xl font-bold text-gray-900">
              Units <span className="text-blue-600">({property.units.length})</span>
            </h3>
            <Button onClick={() => setIsCreateUnitModalOpen(true)} size="sm">
              + Add Unit
            </Button>
          </div>
          <div className="p-8">
            {property.units.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No units found for this property</p>
                <p className="text-gray-400 text-sm mt-2">Add your first unit to get started</p>
              </div>
            ) : (
              <div className="space-y-6">
                {property.units.map((unit) => (
                  <div
                    key={unit.id}
                    className="border border-gray-200 rounded-xl p-6 hover:border-gray-300 hover:shadow-md transition-all duration-200 bg-white"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="text-lg font-semibold text-gray-900">
                        Unit {unit.unit_number}
                      </h4>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setSelectedUnitForTenant({ id: unit.id, number: unit.unit_number })}
                        >
                          + Add Tenant
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setSelectedUnitForMeter({ id: unit.id, number: unit.unit_number })}
                        >
                          + Add Meter
                        </Button>
                      </div>
                    </div>

                    {/* Current Tenant */}
                    {unit.tenants && unit.tenants.length > 0 ? (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          Current Tenant:
                        </p>
                        {unit.tenants
                          .filter((t: any) => !t.move_out_date)
                          .map((tenant: any) => (
                            <div
                              key={tenant.id}
                              className="bg-gray-50 rounded p-3 mb-2"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {tenant.name}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    Account: {tenant.account_number || 'N/A'} | Move
                                    In: {new Date(tenant.move_in_date).toLocaleDateString()}
                                  </p>
                                  {tenant.email && (
                                    <p className="text-xs text-gray-500">{tenant.email}</p>
                                  )}
                                  {tenant.phone && (
                                    <p className="text-xs text-gray-500">{tenant.phone}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        {unit.tenants.filter((t: any) => !t.move_out_date).length === 0 && (
                          <p className="text-sm text-gray-500">No current tenant</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 mb-4">No current tenant</p>
                    )}

                    {/* Past Tenants */}
                    {unit.tenants && unit.tenants.filter((t: any) => t.move_out_date).length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          Past Tenants:
                        </p>
                        {unit.tenants
                          .filter((t: any) => t.move_out_date)
                          .map((tenant: any) => (
                            <div
                              key={tenant.id}
                              className="bg-gray-100 rounded p-2 mb-1 text-xs"
                            >
                              <p className="text-gray-700">
                                {tenant.name} - Moved out: {new Date(tenant.move_out_date).toLocaleDateString()}
                              </p>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Meters */}
                    {unit.meters && unit.meters.length > 0 ? (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          Meters:
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {unit.meters.map((meter: any) => (
                            <div
                              key={meter.id}
                              className="bg-blue-50 rounded p-2 text-sm"
                            >
                              <p className="font-medium text-gray-900">
                                {meter.meter_type.toUpperCase()}
                              </p>
                              <p className="text-xs text-gray-600">
                                {meter.meter_number}
                              </p>
                              <p className="text-xs text-gray-500">
                                {meter.device_type || 'Manual'}
                                {meter.is_active ? '' : ' (Inactive)'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No meters configured</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <CreateUnitModal
          isOpen={isCreateUnitModalOpen}
          onClose={() => setIsCreateUnitModalOpen(false)}
          onSuccess={() => {
            refetch()
          }}
          propertyId={propertyId}
        />

        {selectedUnitForTenant && (
          <CreateTenantModal
            isOpen={!!selectedUnitForTenant}
            onClose={() => setSelectedUnitForTenant(null)}
            onSuccess={() => {
              refetch()
              setSelectedUnitForTenant(null)
            }}
            unitId={selectedUnitForTenant.id}
            unitNumber={selectedUnitForTenant.number}
          />
        )}

        {selectedUnitForMeter && (
          <CreateMeterModal
            isOpen={!!selectedUnitForMeter}
            onClose={() => setSelectedUnitForMeter(null)}
            onSuccess={() => {
              refetch()
              setSelectedUnitForMeter(null)
            }}
            unitId={selectedUnitForMeter.id}
            unitNumber={selectedUnitForMeter.number}
          />
        )}
        </MainContent>
      </div>
    </PageContainer>
  )
}
