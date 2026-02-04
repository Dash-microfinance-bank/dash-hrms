'use client'

import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

const systemChangePasswordSchema = z
  .object({
    oldPassword: z
      .string()
      .min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(1, 'New password is required')
      .min(8, 'New password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must include at least one uppercase letter, one lowercase letter, and one number'
      ),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      })
    }
  })

type SystemChangePasswordFormValues = z.infer<typeof systemChangePasswordSchema>

const SystemChangePasswordForm = () => {
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setFocus,
    setError,
    reset,
  } = useForm<SystemChangePasswordFormValues>({
    resolver: zodResolver(systemChangePasswordSchema),
    defaultValues: {
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  useEffect(() => {
    setFocus('oldPassword')
  }, [setFocus])

  const onSubmit = async (values: SystemChangePasswordFormValues) => {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      toast.error('Session expired. Please sign in again.')
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: values.oldPassword,
    })

    if (signInError) {
      setError('oldPassword', {
        type: 'manual',
        message: 'Current password is incorrect',
      })
      
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: values.newPassword,
    })

    if (updateError) {
      toast.error(updateError.message, {
        className: '!bg-red-600 !text-white',
      })
      return
    }

    toast.success('Password updated successfully.', {
      className: '!bg-green-600 !text-white',
    })
    reset()
  }

  return (
    <form
      className="w-full max-w-md"
      onSubmit={handleSubmit(onSubmit)}
    >
      <div className="px-3 lg:px-0">
        <div className="flex flex-col gap-1 mb-5">
          <label
            htmlFor="old-password"
            className="ml-1 font-medium text-sm"
          >
            Current Password
          </label>
          <div className="relative">
            <input
              type={showOldPassword ? 'text' : 'password'}
              id="old-password"
              placeholder="Enter your current password"
              autoComplete="current-password"
              className="border-2 border-gray-300 rounded-md py-3 px-3 pr-12 w-full focus:outline-none focus:border-primary aria-invalid:border-red-500 placeholder:text-sm"
              aria-invalid={!!errors.oldPassword}
              aria-describedby={errors.oldPassword ? 'old-password-error' : undefined}
              {...register('oldPassword')}
            />
            <button
              type="button"
              onClick={() => setShowOldPassword((prev) => !prev)}
              className="absolute right-2 top-1/2 -translate-y-1/2 py-1 px-2 text-sm text-gray-600 hover:text-gray-900 focus:outline-none rounded"
              aria-label={showOldPassword ? 'Hide password' : 'Show password'}
              tabIndex={0}
            >
              {showOldPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {errors.oldPassword && (
            <p id="old-password-error" className="ml-1 text-sm text-red-600 mt-0.5">
              {errors.oldPassword.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1 mb-5">
          <label
            htmlFor="new-password"
            className="ml-1 font-medium text-sm"
          >
            New Password
          </label>
          <div className="relative">
            <input
              type={showNewPassword ? 'text' : 'password'}
              id="new-password"
              placeholder="Enter your new password"
              autoComplete="new-password"
              className="border-2 border-gray-300 rounded-md py-3 px-3 pr-12 w-full focus:outline-none focus:border-primary aria-invalid:border-red-500 placeholder:text-sm"
              aria-invalid={!!errors.newPassword}
              aria-describedby={errors.newPassword ? 'new-password-error' : undefined}
              {...register('newPassword')}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((prev) => !prev)}
              className="absolute right-2 top-1/2 -translate-y-1/2 py-1 px-2 text-sm text-gray-600 hover:text-gray-900 focus:outline-none rounded"
              aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              tabIndex={0}
            >
              {showNewPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {errors.newPassword && (
            <p id="new-password-error" className="ml-1 text-sm text-red-600 mt-0.5">
              {errors.newPassword.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1 mb-8">
          <label
            htmlFor="confirm-password"
            className="ml-1 font-medium text-sm"
          >
            Confirm Password
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              id="confirm-password"
              placeholder="Confirm your new password"
              autoComplete="new-password"
              className="border-2 border-gray-300 rounded-md py-3 px-3 pr-12 w-full focus:outline-none focus:border-primary aria-invalid:border-red-500 placeholder:text-sm"
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
              {...register('confirmPassword')}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute right-2 top-1/2 -translate-y-1/2 py-1 px-2 text-sm text-gray-600 hover:text-gray-900 focus:outline-none rounded"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              tabIndex={0}
            >
              {showConfirmPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {errors.confirmPassword && (
            <p id="confirm-password-error" className="ml-1 text-sm text-red-600 mt-0.5">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-primary text-white py-4 px-3 rounded-md hover:bg-primary/80 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 w-full"
        >
          {isSubmitting ? 'Updating...' : 'Update password'}
        </button>
      </div>
    </form>
  )
}

export default SystemChangePasswordForm
