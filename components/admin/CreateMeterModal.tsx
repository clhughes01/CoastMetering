'use client'

import React, { useState } from 'react'
import { Button } from '@/components'
import { METER_TYPES, DEVICE_TYPES } from '@/lib/constants'

interface CreateMeterModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  unitId: string
  unitNumber: string
}

export const CreateMeterModal = ({
  isOpen,
  onClose,
  onSuccess,
  unitId,
  unitNumber,
}: CreateMeterModalProps) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    meter_number: '',
    meter_type: 'water' as 'water' | 'power' | 'gas',
    device_type: '' as 'badger_orion' | 'chinese_device' | '',
    device_identifier: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!formData.meter_number.trim()) {
      setError('Meter number is required')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/meters/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          unit_id: unitId,
          meter_number: formData.meter_number.trim(),
          meter_type: formData.meter_type,
          device_type: formData.device_type || null,
          device_identifier: formData.device_identifier.trim() || null,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.details || result.error || 'Failed to create meter')
      }

      // Reset form
      setFormData({
        meter_number: '',
        meter_type: 'water',
        device_type: '',
        device_identifier: '',
      })

      onSuccess()
      onClose()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create meter'
      setError(errorMessage)
      console.error('Error creating meter:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Add Meter</h2>
              <p className="text-sm text-gray-500 mt-1">Unit {unitNumber}</p>
            </div>
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
                Meter Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.meter_number}
                onChange={(e) => setFormData({ ...formData, meter_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                placeholder="12345"
              />
              <p className="mt-1 text-xs text-gray-500">
                Unique identifier from the submeter device
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meter Type <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.meter_type}
                onChange={(e) => setFormData({ ...formData, meter_type: e.target.value as 'water' | 'power' | 'gas' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              >
                {METER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Device Type
              </label>
              <select
                value={formData.device_type}
                onChange={(e) => setFormData({ ...formData, device_type: e.target.value as 'badger_orion' | 'chinese_device' | '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              >
                <option value="">Manual / Other</option>
                {DEVICE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type === 'badger_orion' ? 'Badger Orion' : 'Chinese Device'}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Select if this meter is connected to an automated device
              </p>
            </div>

            {formData.device_type && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Device Identifier
                </label>
                <input
                  type="text"
                  value={formData.device_identifier}
                  onChange={(e) => setFormData({ ...formData, device_identifier: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  placeholder="Device serial number or ID"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Optional: Device-specific identifier for automated data ingestion
                </p>
              </div>
            )}

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
                {loading ? 'Creating...' : 'Add Meter'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
