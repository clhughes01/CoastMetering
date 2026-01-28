'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface CreateTenantModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  unitId?: string
  unitNumber?: string
}

interface Property {
  id: string
  address: string
  city: string
  state: string
  zip_code: string
}

interface Unit {
  id: string
  unit_number: string
  property_id: string
  property?: Property
}

export const CreateTenantModal = ({
  isOpen,
  onClose,
  onSuccess,
  unitId: initialUnitId,
  unitNumber: initialUnitNumber,
}: CreateTenantModalProps) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loadingProperties, setLoadingProperties] = useState(false)
  const [loadingUnits, setLoadingUnits] = useState(false)
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(initialUnitId ? '' : '')
  const [selectedUnitId, setSelectedUnitId] = useState<string>(initialUnitId || '')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    move_in_date: '',
    account_number: '',
  })

  // Load properties when modal opens
  useEffect(() => {
    if (isOpen) {
      loadProperties()
      if (initialUnitId) {
        // If unit is pre-selected, find its property and load units
        loadUnitAndProperty(initialUnitId)
      } else {
        // Reset selections when modal opens without pre-selected unit
        setSelectedPropertyId('')
        setSelectedUnitId('')
        setUnits([])
      }
    }
  }, [isOpen, initialUnitId])

  const loadUnitAndProperty = async (unitId: string) => {
    try {
      setLoadingUnits(true)
      const response = await fetch(`/api/units/list`)
      const result = await response.json()
      
      if (result.success) {
        const unit = result.data.find((u: Unit) => u.id === unitId)
        if (unit) {
          setSelectedPropertyId(unit.property_id)
          setSelectedUnitId(unitId)
          // Load all units for this property
          await loadUnits(unit.property_id)
        }
      }
    } catch (err) {
      console.error('Error loading unit:', err)
    } finally {
      setLoadingUnits(false)
    }
  }

  // Load units when property is selected
  useEffect(() => {
    if (selectedPropertyId) {
      loadUnits(selectedPropertyId)
      setSelectedUnitId('') // Reset unit selection when property changes
    }
  }, [selectedPropertyId])

  const loadProperties = async () => {
    try {
      setLoadingProperties(true)
      const response = await fetch('/api/properties/list')
      const result = await response.json()
      
      if (result.success) {
        setProperties(result.data || [])
      }
    } catch (err) {
      console.error('Error loading properties:', err)
    } finally {
      setLoadingProperties(false)
    }
  }

  const loadUnits = async (propertyId: string) => {
    try {
      setLoadingUnits(true)
      const response = await fetch(`/api/units/list?property_id=${propertyId}`)
      const result = await response.json()
      
      if (result.success) {
        setUnits(result.data || [])
      }
    } catch (err) {
      console.error('Error loading units:', err)
      setUnits([])
    } finally {
      setLoadingUnits(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!formData.name.trim() || !formData.move_in_date) {
      setError('Name and move-in date are required')
      setLoading(false)
      return
    }

    if (!selectedUnitId) {
      setError('Please select a property and unit')
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
          unit_id: selectedUnitId,
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
      setSelectedPropertyId('')
      setSelectedUnitId('')
      setUnits([])

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Tenant</DialogTitle>
          <DialogDescription>
            {initialUnitNumber 
              ? `Add a new tenant to Unit ${initialUnitNumber}. All fields marked with * are required.`
              : 'Add a new tenant. Select a property and unit, then fill in the tenant details. All fields marked with * are required.'
            }
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!initialUnitId && (
            <>
              <div>
                <Label htmlFor="property">
                  Property <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedPropertyId}
                  onValueChange={setSelectedPropertyId}
                  disabled={loading || loadingProperties}
                >
                  <SelectTrigger className="text-gray-900 bg-white">
                    <SelectValue placeholder="Select a property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.address}, {property.city}, {property.state} {property.zip_code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="unit">
                  Unit <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedUnitId}
                  onValueChange={setSelectedUnitId}
                  disabled={loading || loadingUnits || !selectedPropertyId}
                >
                  <SelectTrigger className="text-gray-900 bg-white">
                    <SelectValue placeholder={selectedPropertyId ? "Select a unit" : "Select a property first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        Unit {unit.unit_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!selectedPropertyId && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Please select a property first
                  </p>
                )}
              </div>
            </>
          )}

          <div>
            <Label htmlFor="name">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Luis David Zacarias Simon"
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="tenant@example.com"
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="(555) 123-4567"
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="move_in_date">
              Move-In Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="move_in_date"
              type="date"
              required
              value={formData.move_in_date}
              onChange={(e) => setFormData({ ...formData, move_in_date: e.target.value })}
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="account_number">Account Number</Label>
            <Input
              id="account_number"
              type="text"
              value={formData.account_number}
              onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
              placeholder="1005"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Unique account identifier for billing purposes
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
              {loading ? 'Creating...' : 'Add Tenant'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
