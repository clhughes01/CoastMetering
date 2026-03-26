'use client'

import React, { useState } from 'react'
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

export type ManagerOption = { id: string; name: string | null; email: string }
export type LandlordOption = { id: string; name: string | null; email: string }

interface CreatePropertyModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  /** When true, show required Property Manager dropdown (admin flow). When false/undefined, property is auto-assigned to current user (manager flow). */
  requireManagerAssignment?: boolean
  /** List of Property Managers for the dropdown. Required when requireManagerAssignment is true. */
  managers?: ManagerOption[]
  /** When true, show required Landlord dropdown (manager flow). */
  requireLandlordAssignment?: boolean
  /** List of Landlords for the dropdown. Required when requireLandlordAssignment is true. */
  landlords?: LandlordOption[]
}

export const CreatePropertyModal: React.FC<CreatePropertyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  requireManagerAssignment = false,
  managers = [],
  requireLandlordAssignment = false,
  landlords = [],
}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedManagerId, setSelectedManagerId] = useState<string>('')
  const [selectedLandlordId, setSelectedLandlordId] = useState<string>('')
  const [units, setUnits] = useState<string[]>([''])
  const [formData, setFormData] = useState({
    address: '',
    city: '',
    state: '',
    zip_code: '',
    owner_name: '',
    water_utility: '',
    power_utility: '',
    gas_utility: '',
    water_account_number: '',
    sdge_electric_account_number: '',
  })

  const addUnit = () => {
    setUnits([...units, ''])
  }

  const removeUnit = (index: number) => {
    setUnits(units.filter((_, i) => i !== index))
  }

  const updateUnit = (index: number, value: string) => {
    const newUnits = [...units]
    newUnits[index] = value
    setUnits(newUnits)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Filter out empty units
    const validUnits = units.filter(unit => unit.trim() !== '')

    if (validUnits.length === 0) {
      setError('Please add at least one unit to the property')
      setLoading(false)
      return
    }

    if (requireManagerAssignment && !selectedManagerId) {
      setError('Please select a Property Manager')
      setLoading(false)
      return
    }

    if (requireLandlordAssignment && !selectedLandlordId) {
      setError('Please select a Landlord')
      setLoading(false)
      return
    }

    try {
      const createBody: Record<string, unknown> = { ...formData }
      if (requireManagerAssignment && selectedManagerId) {
        createBody.manager_id = selectedManagerId
      }
      if (requireLandlordAssignment && selectedLandlordId) {
        createBody.landlord_id = selectedLandlordId
      }
      // First, create the property
      const propertyResponse = await fetch('/api/properties/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createBody),
      })

      const propertyResult = await propertyResponse.json()

      if (!propertyResponse.ok) {
        throw new Error(propertyResult.details || propertyResult.error || 'Failed to create property')
      }

      const propertyId = propertyResult.data.id

      // If Escondido water account number provided, link it so bill fetch can associate bills with this property
      if (formData.water_account_number?.trim()) {
        await fetch('/api/admin/property-utility-accounts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            property_id: propertyId,
            utility_key: 'escondido_water',
            account_number: formData.water_account_number.trim(),
          }),
        })
      }

      if (formData.sdge_electric_account_number?.trim()) {
        await fetch('/api/admin/property-utility-accounts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            property_id: propertyId,
            utility_key: 'sdge_electric',
            account_number: formData.sdge_electric_account_number.trim(),
          }),
        })
      }

      // Then, create all units
      const unitPromises = validUnits.map(unitNumber =>
        fetch('/api/units/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            property_id: propertyId,
            unit_number: unitNumber.trim(),
          }),
        })
      )

      const unitResults = await Promise.all(unitPromises)
      const unitErrors = await Promise.all(unitResults.map(r => r.json()))

      // Check if any units failed to create
      const failedUnits = unitErrors.filter((result, index) => !unitResults[index].ok)
      if (failedUnits.length > 0) {
        console.warn('Some units failed to create:', failedUnits)
        // Property was created, but some units failed - show warning but continue
        setError(`Property created, but some units failed: ${failedUnits.map(e => e.error || e.details).join(', ')}`)
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
        water_account_number: '',
        sdge_electric_account_number: '',
      })
      setUnits([''])
      setSelectedManagerId('')
      setSelectedLandlordId('')

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
            {requireManagerAssignment
              ? 'Add a new property and assign a Property Manager. All fields marked with * are required.'
              : 'Add a new property to the system. It will be assigned to you. All fields marked with * are required.'}
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

          {requireManagerAssignment && managers.length > 0 && (
            <div>
              <Label htmlFor="manager_id">
                Property Manager <span className="text-destructive">*</span>
              </Label>
              <select
                id="manager_id"
                required
                value={selectedManagerId}
                onChange={(e) => setSelectedManagerId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loading}
              >
                <option value="">Select Property Manager</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.email}
                    {m.email !== (m.name || '') ? ` (${m.email})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {requireLandlordAssignment && landlords.length > 0 && (
            <div>
              <Label htmlFor="landlord_id">
                Landlord <span className="text-destructive">*</span>
              </Label>
              <select
                id="landlord_id"
                required
                value={selectedLandlordId}
                onChange={(e) => setSelectedLandlordId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loading}
              >
                <option value="">Select Landlord</option>
                {landlords.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name || l.email}
                    {l.email !== (l.name || '') ? ` (${l.email})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
            <p className="text-sm font-medium">Automated bill fetch — account numbers</p>
            <p className="text-xs text-muted-foreground -mt-2">
              Optional. Links provider bills to this property. Utility <span className="font-medium">names</span> are in the row below.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="water_account_number">Water account # (Escondido)</Label>
                <Input
                  id="water_account_number"
                  type="text"
                  value={formData.water_account_number}
                  onChange={(e) => setFormData({ ...formData, water_account_number: e.target.value })}
                  placeholder="Water bill account number"
                  disabled={loading}
                />
              </div>
              <div>
                <Label htmlFor="sdge_electric_account_number">Electric account # (SDG&amp;E)</Label>
                <Input
                  id="sdge_electric_account_number"
                  type="text"
                  value={formData.sdge_electric_account_number}
                  onChange={(e) => setFormData({ ...formData, sdge_electric_account_number: e.target.value })}
                  placeholder="SDG&amp;E account or SAID (as on bill)"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="water_utility">Water utility (name)</Label>
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
              <Label htmlFor="power_utility">Electric utility (name)</Label>
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
              <Label htmlFor="gas_utility">Gas utility (name)</Label>
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

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <Label>
                Units <span className="text-destructive">*</span>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addUnit}
                disabled={loading}
                className="text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Unit
              </Button>
            </div>
            <div className="space-y-2">
              {units.map((unit, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={unit}
                    onChange={(e) => updateUnit(index, e.target.value)}
                    placeholder={`Unit ${index + 1} (e.g., 1118, A1, Unit 1)`}
                    disabled={loading}
                    className="text-gray-900 bg-white"
                  />
                  {units.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeUnit(index)}
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
              Add at least one unit to this property. You can add more units later.
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
              {loading ? 'Creating...' : 'Create Property'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
