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

export interface ChangeTenantModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  /** Unit to assign the new tenant to (required) */
  unitId: string
  /** Display label e.g. "Unit 214" */
  unitNumber: string
  /** Current tenant id – if set, we move them out first */
  currentTenantId?: string | null
  /** Current tenant name (for display) */
  currentTenantName?: string | null
}

export function ChangeTenantModal({
  isOpen,
  onClose,
  onSuccess,
  unitId,
  unitNumber,
  currentTenantId,
  currentTenantName,
}: ChangeTenantModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    move_in_date: new Date().toISOString().slice(0, 10),
    account_number: '',
  })

  const hasCurrentTenant = Boolean(currentTenantId && currentTenantName)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!formData.name.trim() || !formData.move_in_date) {
      setError('Name and move-in date are required for the new tenant.')
      setLoading(false)
      return
    }

    try {
      if (hasCurrentTenant) {
        const deleteRes = await fetch('/api/tenants/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenant_id: currentTenantId }),
        })
        const deleteResult = await deleteRes.json()
        if (!deleteRes.ok) {
          throw new Error(deleteResult.details || deleteResult.error || 'Failed to remove previous tenant')
        }
      }

      const createRes = await fetch('/api/tenants/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_id: unitId,
          name: formData.name.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          move_in_date: formData.move_in_date,
          account_number: formData.account_number.trim() || null,
        }),
      })
      const createResult = await createRes.json()
      if (!createRes.ok) {
        throw new Error(createResult.details || createResult.error || 'Failed to add new tenant')
      }

      setFormData({
        name: '',
        email: '',
        phone: '',
        move_in_date: new Date().toISOString().slice(0, 10),
        account_number: '',
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Change tenant</DialogTitle>
          <DialogDescription>
            {hasCurrentTenant
              ? `Remove the current tenant from the database and add a new tenant to ${unitNumber}.`
              : `Add a new tenant to ${unitNumber}.`}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {hasCurrentTenant && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-sm font-medium text-foreground">
                Current tenant <span className="text-muted-foreground">(will be removed from database)</span>: {currentTenantName}
              </p>
            </div>
          )}

          <p className="text-sm font-medium text-foreground">New tenant</p>

          <div>
            <Label htmlFor="name">Full name *</Label>
            <Input
              id="name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="New tenant name"
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
            <Label htmlFor="phone">Phone</Label>
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
            <Label htmlFor="move_in_date">Move-in date *</Label>
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
            <Label htmlFor="account_number">Account number</Label>
            <Input
              id="account_number"
              type="text"
              value={formData.account_number}
              onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
              placeholder="e.g. 1005"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Unique identifier for billing
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : hasCurrentTenant ? 'Remove old tenant & add new' : 'Add tenant'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
