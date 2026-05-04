'use client'

import React from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
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
import { Label } from '@/components/ui/label'
import { createStructureAllowanceAssignment } from '@/lib/actions/earning-structure-components'

const schema = z.object({
  salary_component_id: z.string().min(1, 'Please select an allowance'),
  value: z.number().min(0, 'Value cannot be negative'),
})

type FormValues = z.infer<typeof schema>

type AllowanceOption = {
  id: string
  name: string
  calculation_type: 'FIXED' | 'PERCENTAGE' | 'FORMULA' | null
  calculation_base: 'NONE' | 'BASIC' | 'GROSS' | 'TAXABLE' | 'CUSTOM' | null
}

type CreateStructureAllowanceModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  structureId: string
  allowanceOptions: AllowanceOption[]
}

export function CreateStructureAllowanceModal({
  open,
  onOpenChange,
  onSuccess,
  structureId,
  allowanceOptions,
}: CreateStructureAllowanceModalProps) {
  const {
    register,
    watch,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      salary_component_id: '',
      value: 0,
    },
  })

  const selectedAllowanceId = watch('salary_component_id')
  const selectedAllowance = allowanceOptions.find((item) => item.id === selectedAllowanceId) ?? null

  const onSubmit = async (values: FormValues) => {
    const result = await createStructureAllowanceAssignment({
      structure_id: structureId,
      salary_component_id: values.salary_component_id,
      value: values.value,
    })

    if (result.success) {
      toast.success('Allowance attached to structure')
      reset()
      onSuccess()
      onOpenChange(false)
      return
    }

    toast.error(result.error)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add allowance to structure</DialogTitle>
          <DialogDescription>
            Select an existing allowance and set a value for this earning structure.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-structure-allowance">Allowance</Label>
            <select
              id="create-structure-allowance"
              {...register('salary_component_id')}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!"
            >
              <option value="">Select allowance</option>
              {allowanceOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            {errors.salary_component_id ? (
              <p className="text-xs text-destructive">{errors.salary_component_id.message}</p>
            ) : null}
          </div>

          {selectedAllowance ? (
            <p className="text-xs text-muted-foreground">
              Calculation: {selectedAllowance.calculation_type ?? '—'} | Based on:{' '}
              {selectedAllowance.calculation_base ?? '—'}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="create-structure-allowance-value">Value</Label>
            <Input
              id="create-structure-allowance-value"
              type="number"
              step="0.01"
              min={0}
              {...register('value', { valueAsNumber: true })}
              className={
                errors.value
                  ? 'border-destructive focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
                  : 'focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary! outline-none! focus:border-primary!'
              }
            />
            {errors.value ? <p className="text-xs text-destructive">{errors.value.message}</p> : null}
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
            <Button type="submit" disabled={isSubmitting || allowanceOptions.length === 0}>
              {isSubmitting ? 'Adding…' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
