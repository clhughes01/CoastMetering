'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Meter</DialogTitle>
          <DialogDescription>
            Add a new meter to Unit {unitNumber}. Each unit can have one meter per type (water, power, gas).
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="meter_number">
              Meter Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="meter_number"
              type="text"
              required
              value={formData.meter_number}
              onChange={(e) => setFormData({ ...formData, meter_number: e.target.value })}
              placeholder="12345"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Unique identifier from the submeter device
            </p>
          </div>

          <div>
            <Label htmlFor="meter_type">
              Meter Type <span className="text-destructive">*</span>
            </Label>
            <Select
              required
              value={formData.meter_type}
              onValueChange={(value) => setFormData({ ...formData, meter_type: value as 'water' | 'power' | 'gas' })}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METER_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="device_type">Device Type</Label>
            <Select
              value={formData.device_type || ''}
              onValueChange={(value) => setFormData({ ...formData, device_type: value as 'badger_orion' | 'chinese_device' | '' })}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Manual / Other" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Manual / Other</SelectItem>
                {DEVICE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type === 'badger_orion' ? 'Badger Orion' : 'Chinese Device'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Select if this meter is connected to an automated device
            </p>
          </div>

          {formData.device_type && (
            <div>
              <Label htmlFor="device_identifier">Device Identifier</Label>
              <Input
                id="device_identifier"
                type="text"
                value={formData.device_identifier}
                onChange={(e) => setFormData({ ...formData, device_identifier: e.target.value })}
                placeholder="Device serial number or ID"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Optional: Device-specific identifier for automated data ingestion
              </p>
            </div>
          )}

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
              {loading ? 'Creating...' : 'Add Meter'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
