'use client'

import React, { useState, useEffect } from 'react'
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
import { Calendar } from 'lucide-react'

interface EditTenantModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  tenant: {
    id: string
    name: string
    email: string | null
    phone: string | null
    move_in_date: string
    move_out_date: string | null
    account_number: string | null
  } | null
}

export const EditTenantModal = ({
  isOpen,
  onClose,
  onSuccess,
  tenant,
}: EditTenantModalProps) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    move_out_date: '',
  })

  useEffect(() => {
    if (tenant && isOpen) {
      setFormData({
        name: tenant.name || '',
        email: tenant.email || '',
        phone: tenant.phone || '',
        move_out_date: tenant.move_out_date || '',
      })
    }
  }, [tenant, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/tenants/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: tenant.id,
          name: formData.name.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          move_out_date: formData.move_out_date || null,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.details || result.error || 'Failed to update tenant')
      }

      onSuccess()
      onClose()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update tenant'
      setError(errorMessage)
      console.error('Error updating tenant:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!tenant) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Tenant</DialogTitle>
          <DialogDescription>
            Update tenant information or set move-out date to mark tenant as inactive.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="move_out_date">
              Move-Out Date
            </Label>
            <Input
              id="move_out_date"
              type="date"
              value={formData.move_out_date}
              onChange={(e) => setFormData({ ...formData, move_out_date: e.target.value })}
              disabled={loading}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Set a move-out date to mark this tenant as inactive. Leave empty if tenant is still active.
            </p>
          </div>

          <div className="bg-muted/30 p-3 rounded-lg">
            <p className="text-sm font-medium mb-1">Account Information</p>
            <p className="text-xs text-muted-foreground">
              Account Number: {tenant.account_number || 'N/A'}
            </p>
            <p className="text-xs text-muted-foreground">
              Move-In Date: {new Date(tenant.move_in_date).toLocaleDateString()}
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
              {loading ? 'Updating...' : 'Update Tenant'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
