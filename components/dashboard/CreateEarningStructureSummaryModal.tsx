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
import type { EarningStructureLevelOption } from '@/lib/data/earning-structure-summary'
import { createEarningStructureSummary } from '@/lib/actions/earning-structure-summary'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(120, 'Name is too long').trim(),
  level_id: z.string(),
})

type FormValues = z.infer<typeof schema>

type Props = {
  levels: EarningStructureLevelOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateEarningStructureSummaryModal({
  levels,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      level_id: levels[0]?.id ?? 'default',
    },
  })

  const onSubmit = async (values: FormValues) => {
    const result = await createEarningStructureSummary({
      name: values.name,
      level_id: values.level_id === 'default' ? null : values.level_id,
    })

    if (result.success) {
      toast.success('Structure created')
      reset()
      onSuccess()
      onOpenChange(false)
    } else {
      toast.error(result.error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create structure</DialogTitle>
          <DialogDescription>Create a new allowance structure for a level.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="create-structure-name" className="ml-2 text-sm font-medium">
              Structure name
            </label>
            <Input
              id="create-structure-name"
              {...register('name')}
              className={
                errors.name
                  ? 'border-destructive outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'
                  : 'outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'
              }
              placeholder='Enter structure name'
            />
            {errors.name ? <p className="ml-2 text-xs text-destructive">{errors.name.message}</p> : null}
          </div>
          <div className="space-y-2">
            <label htmlFor="create-structure-level" className="ml-2 text-sm font-medium">
              Level
            </label>
            <select
              id="create-structure-level"
              {...register('level_id')}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary"
            >
              {levels.map((l) => (
                <option key={l.id ?? 'default'} value={l.id ?? 'default'}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || levels.length === 0}>
              {isSubmitting ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
