'use client'

import React, { useState } from 'react'
import { Button } from '@/components'
import { US_STATES } from '@/lib/constants'

interface CreatePropertyModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const CreatePropertyModal: React.FC<CreatePropertyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    address: '',
    city: '',
    state: '',
    zip_code: '',
    owner_name: '',
    water_utility: '',
    power_utility: '',
    gas_utility: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/properties/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.details || result.error || 'Failed to create property')
      }

      // Reset form
      setFormData({
        address: '',
        city: '',
        state: '',
        zip_code: '',
        owner_name: '',
        water_utility: '',
        power_utility: '',
        gas_utility: '',
      })

      onSuccess()
      onClose()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create property'
      setError(errorMessage)
      console.error('Error creating property:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Create New Property</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={loading}
            >
              <span className="text-2xl">&times;</span>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                placeholder="1120 East Grand Avenue"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  placeholder="Escondido"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                >
                  <option value="">Select State</option>
                  {US_STATES.map((state) => (
                    <option key={state.value} value={state.value}>
                      {state.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ZIP Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.zip_code}
                  onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  placeholder="92025"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Owner Name
              </label>
              <input
                type="text"
                value={formData.owner_name}
                onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                placeholder="Farshin"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Water Utility
                </label>
                <input
                  type="text"
                  value={formData.water_utility}
                  onChange={(e) => setFormData({ ...formData, water_utility: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  placeholder="Escondido Water"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Power Utility
                </label>
                <input
                  type="text"
                  value={formData.power_utility}
                  onChange={(e) => setFormData({ ...formData, power_utility: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  placeholder="SDG&E"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gas Utility
                </label>
                <input
                  type="text"
                  value={formData.gas_utility}
                  onChange={(e) => setFormData({ ...formData, gas_utility: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  placeholder="SDG&E"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Property'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
