'use client'

import React, { useEffect, useMemo } from 'react'
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
import { createApprovalWorkflow } from '@/lib/actions/approval-workflows'
import {
  APPROVAL_WORKFLOW_TYPE_OPTIONS,
  type ApprovalWorkflowType,
} from '@/lib/approval-workflow-types'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const schema = z.object({
  name: z.string().min(1, 'Workflow name is required').max(120, 'Name is too long').trim(),
  requestType: z.enum(['PAYROLL', 'LEAVE'], { message: 'Workflow type is required' }),
})

type FormValues = z.infer<typeof schema>

type CreateApprovalWorkflowModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  existingRequestTypes: string[]
}

export function CreateApprovalWorkflowModal({
  open,
  onOpenChange,
  onSuccess,
  existingRequestTypes,
}: CreateApprovalWorkflowModalProps) {
  const availableOptions = useMemo(
    () =>
      APPROVAL_WORKFLOW_TYPE_OPTIONS.filter(
        (option) => !existingRequestTypes.includes(option.value)
      ),
    [existingRequestTypes]
  )

  const allTypesConfigured = availableOptions.length === 0

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      requestType: availableOptions[0]?.value ?? 'PAYROLL',
    },
  })

  const requestType = watch('requestType')

  useEffect(() => {
    if (!open) return
    const first = availableOptions[0]?.value
    reset({
      name: '',
      requestType: first ?? 'PAYROLL',
    })
  }, [open, availableOptions, reset])

  const onSubmit = async (values: FormValues) => {
    if (allTypesConfigured) return

    const result = await createApprovalWorkflow({
      name: values.name,
      requestType: values.requestType,
    })

    if (result.success) {
      toast.success('Workflow created')
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
          <DialogTitle>Create approval workflow</DialogTitle>
          <DialogDescription>
            Define a workflow name and type for your organization.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="create-workflow-name" className="ml-2 text-sm font-medium">
              Workflow Name
            </label>
            <Input
              id="create-workflow-name"
              placeholder="e.g. Payroll approvals"
              {...register('name')}
              className={
                errors.name
                  ? 'border-destructive outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'
                  : 'outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'
              }
            />
            {errors.name ? (
              <p className="ml-2 text-xs text-destructive">{errors.name.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="create-workflow-type" className="ml-2 text-sm font-medium">
              Workflow Type
            </label>
            <select
              id="create-workflow-type"
              value={requestType}
              disabled={allTypesConfigured}
              onChange={(e) =>
                setValue('requestType', e.target.value as ApprovalWorkflowType, {
                  shouldValidate: true,
                })
              }
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {availableOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {allTypesConfigured ? (
              <p className="ml-2 text-xs text-muted-foreground">
                All workflow types are already configured.
              </p>
            ) : errors.requestType ? (
              <p className="ml-2 text-xs text-destructive">{errors.requestType.message}</p>
            ) : null}
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
            <Button type="submit" disabled={isSubmitting || allTypesConfigured}>
              {isSubmitting ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
