'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { updateUserRoles } from '@/lib/actions/users'
import type { ProfileRow } from '@/lib/data/users'
import { toast } from 'sonner'

const ROLE_OPTIONS = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'hr', label: 'HR' },
  { value: 'finance', label: 'Finance' }
] as const

const SYSTEM_ROLES = ['super_admin', 'hr', 'finance'] as const
const PRESERVED_ROLES = ['employee', 'manager'] as const

const MIN_ROLES = 1
const MAX_ROLES = 4

type EditAccessModalProps = {
  user: ProfileRow
  currentUserId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function EditAccessFormBody({
  user,
  currentUserId,
  onOpenChange,
  onSuccess,
}: Omit<EditAccessModalProps, 'open'>) {
  const systemRolesFromUser = user.roles.filter((r) =>
    SYSTEM_ROLES.includes(r as (typeof SYSTEM_ROLES)[number])
  )
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    systemRolesFromUser.length > 0 ? systemRolesFromUser : ['super_admin']
  )
  const [saving, setSaving] = useState(false)

  const isEditingSelf = user.id === currentUserId
  const selfIsSuperAdmin = user.roles.includes('super_admin')
  const superAdminLocked = isEditingSelf && selfIsSuperAdmin

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) => {
      const hasHrOrFinance = prev.includes('hr') || prev.includes('finance')

      // super_admin is mutually exclusive with hr/finance.
      if (role === 'super_admin') {
        // If we're editing ourselves and our super_admin is locked, do nothing.
        if (superAdminLocked) return prev

        // If hr/finance is selected, super_admin cannot be toggled on.
        if (hasHrOrFinance) return prev

        // Selecting super_admin clears other roles.
        if (!prev.includes('super_admin')) return ['super_admin']

        // Prevent deselecting super_admin when it is the only role selected.
        return prev
      }

      // At this point, role is hr or finance.
      const exists = prev.includes(role)

      // Special case: editing self with locked super_admin.
      if (superAdminLocked && prev.includes('super_admin')) {
        if (exists) {
          const next = prev.filter((r) => r !== role)
          // Ensure at least super_admin remains.
          return next.length === 0 ? ['super_admin'] : next
        }
        // Add hr/finance alongside locked super_admin, respecting MAX_ROLES.
        if (prev.length >= MAX_ROLES) return prev
        return [...prev, role]
      }

      if (exists) {
        const next = prev.filter((r) => r !== role)
        // If removing the last non-super role leaves none, fall back to super_admin.
        if (next.length === 0) return ['super_admin']
        return next
      }

      // Selecting hr/finance removes super_admin if present (for non-locked users).
      const next = prev.filter((r) => r !== 'super_admin').concat(role)

      if (next.length > MAX_ROLES) return prev

      return next
    })
  }

  const canSave =
    selectedRoles.length >= MIN_ROLES &&
    selectedRoles.length <= MAX_ROLES &&
    (superAdminLocked ? selectedRoles.includes('super_admin') : true)

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    const preserved = user.roles.filter((r) =>
      PRESERVED_ROLES.includes(r as (typeof PRESERVED_ROLES)[number])
    )
    const rolesToSave = [...preserved, ...selectedRoles]
    const result = await updateUserRoles(user.id, rolesToSave)
    setSaving(false)
    if (result.success) {
      toast.success('Access updated successfully')
      onSuccess()
      onOpenChange(false)
    } else {
      toast.error(result.error)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit access</DialogTitle>
        <DialogDescription>
          Change roles for {user.full_name ?? 'this user'}. At least one role
          is required; at most {MAX_ROLES} roles can be selected.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 py-2">
        {ROLE_OPTIONS.map(({ value, label }) => {
          const checked = selectedRoles.includes(value)
          const hasHrOrFinance =
            selectedRoles.includes('hr') || selectedRoles.includes('finance')
          const disabled =
            value === 'super_admin' && (superAdminLocked || hasHrOrFinance)
          return (
            <div
              key={value}
              className="flex items-center space-x-2"
            >
              <input
                type="checkbox"
                id={`role-${value}`}
                checked={checked}
                disabled={disabled}
                onChange={() => toggleRole(value)}
                className="h-4 w-4 rounded border-input"
              />
              <label
                htmlFor={`role-${value}`}
                className={
                  disabled
                    ? 'cursor-not-allowed text-muted-foreground text-sm'
                    : 'cursor-pointer text-sm'
                }
              >
                {label}
                {disabled && ' (you cannot remove your own Super Admin role)'}
              </label>
            </div>
          )
        })}
      </div>
      {selectedRoles.length < MIN_ROLES && (
        <p className="text-sm text-destructive">
          At least {MIN_ROLES} role is required.
        </p>
      )}
      {selectedRoles.length > MAX_ROLES && (
        <p className="text-sm text-destructive">
          At most {MAX_ROLES} roles can be selected.
        </p>
      )}
      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!canSave || saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </>
  )
}

export function EditAccessModal({
  user,
  currentUserId,
  open,
  onOpenChange,
  onSuccess,
}: EditAccessModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <EditAccessFormBody
            key={user.id}
            user={user}
            currentUserId={currentUserId}
            onOpenChange={onOpenChange}
            onSuccess={onSuccess}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
