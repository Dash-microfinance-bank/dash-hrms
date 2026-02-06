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
  { value: 'employee', label: 'Employee' },
  { value: 'manager', label: 'Manager' },
  { value: 'hr', label: 'HR' },
  { value: 'finance', label: 'Finance' },
  { value: 'super_admin', label: 'Super Admin' },
] as const

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
  const [selectedRoles, setSelectedRoles] = useState<string[]>(user.roles)
  const [saving, setSaving] = useState(false)

  const isEditingSelf = user.id === currentUserId
  const selfIsSuperAdmin = user.roles.includes('super_admin')
  const superAdminLocked = isEditingSelf && selfIsSuperAdmin

  const toggleRole = (role: string) => {
    if (role === 'super_admin' && superAdminLocked) return
    setSelectedRoles((prev) => {
      const next = prev.includes(role)
        ? prev.filter((r) => r !== role)
        : [...prev, role]
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
    const result = await updateUserRoles(user.id, selectedRoles)
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
          const disabled =
            value === 'super_admin' && superAdminLocked
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
