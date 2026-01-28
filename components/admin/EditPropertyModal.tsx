'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { US_STATES } from '@/lib/constants'
import { Plus, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface EditPropertyModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  property: {
    id: string
    address: string
    city: string
    state: string
    zip_code: string
    owner_name: string | null
    water_utility: string | null
    power_utility: string | null
    gas_utility: string | null
  } | null
}

interface Unit {
  id: string
  unit_number: string
}

export const EditPropertyModal: React.FC<EditPropertyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  property,
}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [units, setUnits] = useState<Unit[]>([])
  const [loadingUnits, setLoadingUnits] = useState(false)
  const [newUnits, setNewUnits] = useState<string[]>([''])
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

  useEffect(() => {
    if (property && isOpen) {
      setFormData({
        address: property.address || '',
        city: property.city || '',
        state: property.state || '',
        zip_code: property.zip_code || '',
        owner_name: property.owner_name || '',
        water_utility: property.water_utility || '',
        power_utility: property.power_utility || '',
        gas_utility: property.gas_utility || '',
      })
      loadUnits()
      setNewUnits([''])
    }
  }, [property, isOpen])

  const loadUnits = async () => {
    if (!property) return
    try {
      setLoadingUnits(true)
      const response = await fetch(`/api/units/list?property_id=${property.id}`)
      const result = await response.json()
      
      if (result.success) {
        setUnits(result.data || [])
      }
    } catch (err) {
      console.error('Error loading units:', err)
    } finally {
      setLoadingUnits(false)
    }
  }

  const addNewUnit = () => {
    setNewUnits([...newUnits, ''])
  }

  const removeNewUnit = (index: number) => {
    setNewUnits(newUnits.filter((_, i) => i !== index))
  }

  const updateNewUnit = (index: number, value: string) => {
    const updated = [...newUnits]
    updated[index] = value
    setNewUnits(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!property) return

    setLoading(true)
    setError(null)

    try {
      // Update property
      const propertyResponse = await fetch('/api/properties/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          property_id: property.id,
          ...formData,
        }),
      })

      const propertyResult = await propertyResponse.json()

      if (!propertyResponse.ok) {
        throw new Error(propertyResult.details || propertyResult.error || 'Failed to update property')
      }

      // Add new units if any
      const validNewUnits = newUnits.filter(unit => unit.trim() !== '')
      if (validNewUnits.length > 0) {
        const unitPromises = validNewUnits.map(unitNumber =>
          fetch('/api/units/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              property_id: property.id,
              unit_number: unitNumber.trim(),
            }),
          })
        )

        const unitResults = await Promise.all(unitPromises)
        const unitErrors = await Promise.all(unitResults.map(r => r.json()))

        const failedUnits = unitErrors.filter((result, index) => !unitResults[index].ok)
        if (failedUnits.length > 0) {
          console.warn('Some units failed to create:', failedUnits)
          setError(`Property updated, but some units failed: ${failedUnits.map(e => e.error || e.details).join(', ')}`)
        }
      }

      onSuccess()
      onClose()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update property'
      setError(errorMessage)
      console.error('Error updating property:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!property) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Property</DialogTitle>
          <DialogDescription>
            Update property information and add new units.
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
                disabled={loading}
              />
            </div>
          </div>

          {/* Existing Units */}
          <div className="border-t pt-4">
            <Label className="mb-3 block">Existing Units</Label>
            {loadingUnits ? (
              <p className="text-sm text-muted-foreground">Loading units...</p>
            ) : units.length === 0 ? (
              <p className="text-sm text-muted-foreground">No units found for this property.</p>
            ) : (
              <div className="space-y-2">
                {units.map((unit) => (
                  <div key={unit.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                    <span className="text-sm font-medium">Unit {unit.unit_number}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Units */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <Label>Add New Units</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addNewUnit}
                disabled={loading}
                className="text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Unit
              </Button>
            </div>
            <div className="space-y-2">
              {newUnits.map((unit, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={unit}
                    onChange={(e) => updateNewUnit(index, e.target.value)}
                    placeholder={`Unit ${index + 1} (e.g., 1118, A1, Unit 1)`}
                    disabled={loading}
                    className="text-gray-900 bg-white"
                  />
                  {newUnits.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeNewUnit(index)}
                      disabled={loading}
                      className="h-10 w-10 shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Add new units to this property. Leave empty if you don't want to add any.
            </p>
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
              {loading ? 'Updating...' : 'Update Property'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
