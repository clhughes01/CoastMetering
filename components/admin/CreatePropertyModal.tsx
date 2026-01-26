'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { US_STATES } from '@/lib/constants'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Property</DialogTitle>
          <DialogDescription>
            Add a new property to the system. All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="address">
              Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="address"
              type="text"
              required
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="1120 East Grand Avenue"
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="city">
                City <span className="text-destructive">*</span>
              </Label>
              <Input
                id="city"
                type="text"
                required
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Escondido"
                disabled={loading}
              />
            </div>
            <div>
              <Label htmlFor="state">
                State <span className="text-destructive">*</span>
              </Label>
              <select
                id="state"
                required
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loading}
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
              <Label htmlFor="zip_code">
                ZIP Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="zip_code"
                type="text"
                required
                value={formData.zip_code}
                onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                placeholder="92025"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="owner_name">Owner Name</Label>
            <Input
              id="owner_name"
              type="text"
              value={formData.owner_name}
              onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
              placeholder="Farshin"
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="water_utility">Water Utility</Label>
              <Input
                id="water_utility"
                type="text"
                value={formData.water_utility}
                onChange={(e) => setFormData({ ...formData, water_utility: e.target.value })}
                placeholder="Escondido Water"
                disabled={loading}
              />
            </div>
            <div>
              <Label htmlFor="power_utility">Power Utility</Label>
              <Input
                id="power_utility"
                type="text"
                value={formData.power_utility}
                onChange={(e) => setFormData({ ...formData, power_utility: e.target.value })}
                placeholder="SDG&E"
                disabled={loading}
              />
            </div>
            <div>
              <Label htmlFor="gas_utility">Gas Utility</Label>
              <Input
                id="gas_utility"
                type="text"
                value={formData.gas_utility}
                onChange={(e) => setFormData({ ...formData, gas_utility: e.target.value })}
                placeholder="SDG&E"
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
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
      </DialogContent>
    </Dialog>
  )
}
