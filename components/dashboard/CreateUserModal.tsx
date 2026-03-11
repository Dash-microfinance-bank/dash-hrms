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
import { Input } from '@/components/ui/input'
import { createUserAndInvite } from '@/lib/actions/users'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const ROLE_OPTIONS = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'hr', label: 'HR' },
  { value: 'finance', label: 'Finance' },
] as const

const MIN_ROLES = 1
const MAX_ROLES = 4

const createUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required').trim(),
  lastName: z.string().min(1, 'Last name is required').trim(),
  email: z.string().min(1, 'Email is required').email('Enter a valid email').trim(),
})

type CreateUserFormValues = z.infer<typeof createUserSchema>

type CreateUserModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function CreateUserFormBody({
  onOpenChange,
  onSuccess,
}: Pick<CreateUserModalProps, 'onOpenChange' | 'onSuccess'>) {
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['super_admin'])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
    },
  })

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) => {
      const hasHrOrFinance = prev.includes('hr') || prev.includes('finance')

      // super_admin is mutually exclusive with hr/finance.
      if (role === 'super_admin') {
        // If hr/finance is selected, the UI disables super_admin; keep state unchanged.
        if (hasHrOrFinance) return prev

        // Selecting super_admin clears other roles.
        if (!prev.includes('super_admin')) return ['super_admin']

        // Deselecting super_admin would leave zero roles; keep it selected.
        return prev
      }

      // role is hr or finance:
      const exists = prev.includes(role)

      if (exists) {
        const next = prev.filter((r) => r !== role)
        // If removing the last non-super role, fall back to default super_admin.
        if (next.length === 0) return ['super_admin']
        return next
      }

      // Selecting hr/finance removes super_admin if present.
      const next = prev.filter((r) => r !== 'super_admin').concat(role)

      if (next.length > MAX_ROLES) return prev

      return next
    })
  }

  const canSubmit =
    selectedRoles.length >= MIN_ROLES &&
    selectedRoles.length <= MAX_ROLES

  const onSubmit = async (values: CreateUserFormValues) => {
    if (!canSubmit) return
    const result = await createUserAndInvite(
      values.firstName,
      values.lastName,
      values.email,
      selectedRoles
    )
    if (result.success) {
      toast.success('User created and invite sent')
      onSuccess()
      onOpenChange(false)
    } else {
      toast.error(result.error)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create user</DialogTitle>
        <DialogDescription>
          Add a new user and send them an invite. They will receive an email to set their password.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="create-firstName" className="text-sm font-medium ml-2">
                First name
              </label>
              <Input
                id="create-firstName"
                {...register('firstName')}
                placeholder="First name"
                className={errors.firstName ? 'border-destructive outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary' : 'outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'}
              />
              {errors.firstName && (
                <p className="text-xs text-destructive ml-2">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="create-lastName" className="text-sm font-medium ml-2">
                Last name
              </label>
              <Input
                id="create-lastName"
                {...register('lastName')}
                placeholder="Last name"
                className={errors.lastName ? 'border-destructive outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary' : 'outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'}
              />
              {errors.lastName && (
                <p className="text-xs text-destructive ml-2">{errors.lastName.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="create-email" className="text-sm font-medium ml-2">
              Email
            </label>
            <Input
              id="create-email"
              type="email"
              {...register('email')}
              placeholder="email@example.com"
              className={errors.email ? 'border-destructive outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary' : 'outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'}
            />
            {errors.email && (
              <p className="text-xs text-destructive ml-2">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <span className="text-sm font-medium mb-2">Roles</span>
            {/* <p className="text-xs text-muted-foreground">
              At least {MIN_ROLES}, at most {MAX_ROLES} roles.
            </p> */}
            <div className="grid gap-2 pt-1">
              {ROLE_OPTIONS.map(({ value, label }) => {
                const hasHrOrFinance =
                  selectedRoles.includes('hr') || selectedRoles.includes('finance')
                const isDisabled = value === 'super_admin' && hasHrOrFinance

                return (
                  <div key={value} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`create-role-${value}`}
                      checked={selectedRoles.includes(value)}
                      onChange={() => toggleRole(value)}
                      disabled={isDisabled}
                      className="h-4 w-4 rounded border-input disabled:cursor-not-allowed"
                    />
                    <label
                      htmlFor={`create-role-${value}`}
                      className={`text-sm ${
                        isDisabled ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer'
                      }`}
                    >
                      {label}
                    </label>
                  </div>
                )
              })}
            </div>
            {selectedRoles.length < MIN_ROLES && (
              <p className="text-xs text-destructive">
                Select at least {MIN_ROLES} role.
              </p>
            )}
            {selectedRoles.length > MAX_ROLES && (
              <p className="text-xs text-destructive">
                Select at most {MAX_ROLES} roles.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create user & send invite'}
            </Button>
          </DialogFooter>
        </form>
    </>
  )
}

export function CreateUserModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateUserModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <CreateUserFormBody key="create-user-form" onOpenChange={onOpenChange} onSuccess={onSuccess} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
