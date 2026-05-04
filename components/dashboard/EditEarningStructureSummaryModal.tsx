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
import type { EarningStructureLevelOption, EarningStructureSummaryRow } from '@/lib/data/earning-structure-summary'
import { updateEarningStructureSummary } from '@/lib/actions/earning-structure-summary'
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
  row: EarningStructureSummaryRow
  selectableLevels: EarningStructureLevelOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function EditForm({ row, selectableLevels, onOpenChange, onSuccess }: Omit<Props, 'open'>) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: row.structure_name,
      level_id: row.level_id ?? 'default',
    },
  })

  const onSubmit = async (values: FormValues) => {
    const result = await updateEarningStructureSummary(row.mapping_id, {
      name: values.name,
      level_id: values.level_id === 'default' ? null : values.level_id,
    })
    if (result.success) {
      toast.success('Structure updated')
      onSuccess()
      onOpenChange(false)
    } else {
      toast.error(result.error)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit structure</DialogTitle>
        <DialogDescription>Update structure name and assigned level.</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="edit-structure-name" className="ml-2 text-sm font-medium">
            Structure name
          </label>
          <Input
            id="edit-structure-name"
            {...register('name')}
            className={
              errors.name
                ? 'border-destructive outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'
                : 'outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'
            }
          />
          {errors.name ? <p className="ml-2 text-xs text-destructive">{errors.name.message}</p> : null}
        </div>
        <div className="space-y-2">
          <label htmlFor="edit-structure-level" className="ml-2 text-sm font-medium">
            Level
          </label>
          <select
            id="edit-structure-level"
            {...register('level_id')}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary"
          >
            <option value="default">Default</option>
            {selectableLevels
              .filter((l) => l.id !== null)
              .map((l) => (
                <option key={l.id!} value={l.id!}>
                  {l.name}
                </option>
              ))}
          </select>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
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

export function EditEarningStructureSummaryModal({
  row,
  selectableLevels,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <EditForm
            key={row.mapping_id}
            row={row}
            selectableLevels={selectableLevels}
            onOpenChange={onOpenChange}
            onSuccess={onSuccess}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
