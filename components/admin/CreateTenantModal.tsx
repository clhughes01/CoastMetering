'use client'

import React, { useState } from 'react'
import { Button } from '@/components'

interface CreateTenantModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  unitId: string
  unitNumber: string
}

export const CreateTenantModal = ({
  isOpen,
  onClose,
  onSuccess,
  unitId,
  unitNumber,
}: CreateTenantModalProps) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    move_in_date: '',
    account_number: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!formData.name.trim() || !formData.move_in_date) {
      setError('Name and move-in date are required')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/tenants/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          unit_id: unitId,
          name: formData.name.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          move_in_date: formData.move_in_date,
          account_number: formData.account_number.trim() || null,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.details || result.error || 'Failed to create tenant')
      }

      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        move_in_date: '',
        account_number: '',
      })

      onSuccess()
      onClose()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create tenant'
      setError(errorMessage)
      console.error('Error creating tenant:', err)
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
              <h2 className="text-2xl font-bold text-gray-900">Add Tenant</h2>
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
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                placeholder="Luis David Zacarias Simon"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                placeholder="tenant@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                placeholder="(555) 123-4567"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Move-In Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.move_in_date}
                onChange={(e) => setFormData({ ...formData, move_in_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Number
              </label>
              <input
                type="text"
                value={formData.account_number}
                onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                placeholder="1005"
              />
              <p className="mt-1 text-xs text-gray-500">
                Unique account identifier for billing purposes
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
                {loading ? 'Creating...' : 'Add Tenant'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
