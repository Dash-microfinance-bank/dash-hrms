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
import { Input } from '@/components/ui/input'
import { createLocation } from '@/lib/actions/locations'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { NIGERIA_STATES, DEFAULT_COUNTRY } from '@/lib/constants/nigeria-states'
import { cn } from '@/lib/utils'

const createLocationSchema = z.object({
  country: z.string().min(1, 'Country is required').trim(),
  state: z.string().min(1, 'State is required').trim(),
  address: z.string().min(1, 'Address is required').max(1000, 'Address is too long').trim(),
})

type CreateLocationFormValues = z.infer<typeof createLocationSchema>

type CreateLocationModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function CreateLocationFormBody({
  onOpenChange,
  onSuccess,
}: Pick<CreateLocationModalProps, 'onOpenChange' | 'onSuccess'>) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateLocationFormValues>({
    resolver: zodResolver(createLocationSchema),
    defaultValues: {
      country: DEFAULT_COUNTRY,
      state: '',
      address: '',
    },
  })

  const onSubmit = async (values: CreateLocationFormValues) => {
    const result = await createLocation({
      country: values.country,
      state: values.state,
      address: values.address,
    })

    if (result.success) {
      toast.success('Office location created')
      onSuccess()
      onOpenChange(false)
    } else {
      toast.error(result.error)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add office location</DialogTitle>
        <DialogDescription>
          Add a new office location for your organization. Country defaults to Nigeria.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="loc-country" className="text-sm font-medium ml-2">
            Country
          </label>
          <select
            id="loc-country"
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
          <label htmlFor="loc-state" className="text-sm font-medium ml-2">
            State
          </label>
          <select
            id="loc-state"
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
          <label htmlFor="loc-address" className="text-sm font-medium ml-2">
            Address
          </label>
          <textarea
            id="loc-address"
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
            {isSubmitting ? 'Adding…' : 'Add location'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function CreateLocationModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateLocationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <CreateLocationFormBody
            key="create-location-form"
            onOpenChange={onOpenChange}
            onSuccess={onSuccess}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
