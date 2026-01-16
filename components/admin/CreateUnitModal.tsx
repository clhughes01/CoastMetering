'use client'

import React, { useState } from 'react'
import { Button } from '@/components'

interface CreateUnitModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  propertyId: string
}

export const CreateUnitModal: React.FC<CreateUnitModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  propertyId,
}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unitNumber, setUnitNumber] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!unitNumber.trim()) {
      setError('Unit number is required')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/units/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          property_id: propertyId,
          unit_number: unitNumber.trim(),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.details || result.error || 'Failed to create unit')
      }

      // Reset form
      setUnitNumber('')
      onSuccess()
      onClose()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create unit'
      setError(errorMessage)
      console.error('Error creating unit:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Add New Unit</h2>
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
                Unit Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={unitNumber}
                onChange={(e) => setUnitNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                placeholder="1118"
              />
              <p className="mt-1 text-xs text-gray-500">
                Enter the unit number or identifier (e.g., 1118, A1, Unit 1)
              </p>
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
                {loading ? 'Creating...' : 'Create Unit'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
