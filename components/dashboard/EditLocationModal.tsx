'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { LocationRow } from '@/lib/data/locations'
import { updateLocation } from '@/lib/actions/locations'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { NIGERIA_STATES, DEFAULT_COUNTRY } from '@/lib/constants/nigeria-states'
import { cn } from '@/lib/utils'

const editLocationSchema = z.object({
  country: z.string().min(1, 'Country is required').trim(),
  state: z.string().min(1, 'State is required').trim(),
  address: z.string().min(1, 'Address is required').max(1000, 'Address is too long').trim(),
})

type EditLocationFormValues = z.infer<typeof editLocationSchema>

type EditLocationModalProps = {
  location: LocationRow
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function EditLocationFormBody({
  location,
  onOpenChange,
  onSuccess,
}: Omit<EditLocationModalProps, 'open'>) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditLocationFormValues>({
    resolver: zodResolver(editLocationSchema),
    defaultValues: {
      country: location.country || DEFAULT_COUNTRY,
      state: location.state || '',
      address: location.address || '',
    },
  })

  const onSubmit = async (values: EditLocationFormValues) => {
    const result = await updateLocation(location.id, {
      country: values.country,
      state: values.state,
      address: values.address,
    })

    if (result.success) {
      toast.success('Location updated')
      onSuccess()
      onOpenChange(false)
    } else {
      toast.error(result.error)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit location</DialogTitle>
        <DialogDescription>
          Update the office location details. Changes apply only within this organization.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="edit-loc-country" className="text-sm font-medium ml-2">
            Country
          </label>
          <select
            id="edit-loc-country"
            {...register('country')}
            className={cn(
              'flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary md:text-sm',
              errors.country ? 'border-destructive' : 'border-input'
            )}
          >
            <option value={DEFAULT_COUNTRY}>{DEFAULT_COUNTRY}</option>
          </select>
          {errors.country && (
            <p className="text-xs text-destructive ml-2">{errors.country.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="edit-loc-state" className="text-sm font-medium ml-2">
            State
          </label>
          <select
            id="edit-loc-state"
            {...register('state')}
            className={cn(
              'flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary md:text-sm',
              errors.state ? 'border-destructive' : 'border-input'
            )}
          >
            <option value="">Select state</option>
            {NIGERIA_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {errors.state && (
            <p className="text-xs text-destructive ml-2">{errors.state.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="edit-loc-address" className="text-sm font-medium ml-2">
            Address
          </label>
          <textarea
            id="edit-loc-address"
            rows={3}
            placeholder="Full address of the office"
            className={cn(
              'flex w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary md:text-sm',
              errors.address ? 'border-destructive' : 'border-input'
            )}
            {...register('address')}
          />
          {errors.address && (
            <p className="text-xs text-destructive ml-2">{errors.address.message}</p>
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
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function EditLocationModal({
  location,
  open,
  onOpenChange,
  onSuccess,
}: EditLocationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <EditLocationFormBody
            key={location.id}
            location={location}
            onOpenChange={onOpenChange}
            onSuccess={onSuccess}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
