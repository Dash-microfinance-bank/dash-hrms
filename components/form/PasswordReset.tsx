'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { setInvitedUserPassword } from '@/lib/actions/users'
import { toast } from 'sonner'

const passwordSchema = z
  .object({
    newPassword: z
      .string()
      .min(1, 'Password is required')
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must include at least one uppercase letter, one lowercase letter, and one number'
      ),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
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

type PasswordFormValues = z.infer<typeof passwordSchema>

const PasswordReset = () => {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof PasswordFormValues, string>>>({})
  const newPasswordRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    newPasswordRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    // Validate
    const result = passwordSchema.safeParse({ newPassword, confirmPassword })
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof PasswordFormValues, string>> = {}
      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as keyof PasswordFormValues
        if (path && !fieldErrors[path]) fieldErrors[path] = issue.message
      })
      setErrors(fieldErrors)
      return
    }
    setErrors({})

    // Submit to server
    setIsSubmitting(true)
    try {
      const response = await setInvitedUserPassword(newPassword)
      if (response.success) {
        toast.success('Password created successfully! Redirecting...')
        // Redirect to dashboard after a brief delay
        setTimeout(() => {
          router.push('/dashboard')
          router.refresh()
        }, 1000)
      } else {
        toast.error(response.error)
        setIsSubmitting(false)
      }
    } catch (error) {
      toast.error('An unexpected error occurred. Please try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <form className="w-full max-w-md" onSubmit={handleSubmit}>
      <div className="px-3">
        <div className="flex flex-col gap-1 mb-5">
          <label htmlFor="new-password" className="ml-1 font-medium text-sm">
            New Password
          </label>
          <div className="relative">
            <input
              ref={newPasswordRef}
              type={showNewPassword ? 'text' : 'password'}
              id="new-password"
              name="newPassword"
              placeholder="Enter your new password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value)
                if (errors.newPassword)
                  setErrors((prev) => ({ ...prev, newPassword: undefined }))
              }}
              disabled={isSubmitting}
              className="border-2 border-gray-300 rounded-md py-3 px-3 pr-12 w-full focus:outline-none focus:border-primary aria-invalid:border-red-500 placeholder:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              aria-invalid={!!errors.newPassword}
              aria-describedby={errors.newPassword ? 'new-password-error' : undefined}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((prev) => !prev)}
              disabled={isSubmitting}
              className="absolute right-2 top-1/2 -translate-y-1/2 py-1 px-2 text-sm text-gray-600 hover:text-gray-900 focus:outline-none rounded disabled:opacity-50"
              aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              tabIndex={0}
            >
              {showNewPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {errors.newPassword && (
            <p id="new-password-error" className="ml-1 text-sm text-red-600 mt-0.5">
              {errors.newPassword}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1 mb-8">
          <label htmlFor="confirm-password" className="ml-1 font-medium text-sm">
            Confirm Password
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              id="confirm-password"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                if (errors.confirmPassword)
                  setErrors((prev) => ({ ...prev, confirmPassword: undefined }))
              }}
              disabled={isSubmitting}
              className="border-2 border-gray-300 rounded-md py-3 px-3 pr-12 w-full focus:outline-none focus:border-primary aria-invalid:border-red-500 placeholder:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
              autoComplete="new-password"
              placeholder="Confirm your new password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              disabled={isSubmitting}
              className="absolute right-2 top-1/2 -translate-y-1/2 py-1 px-2 text-sm text-gray-600 hover:text-gray-900 focus:outline-none rounded disabled:opacity-50"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              tabIndex={0}
            >
              {showConfirmPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {errors.confirmPassword && (
            <p id="confirm-password-error" className="ml-1 text-sm text-red-600 mt-0.5">
              {errors.confirmPassword}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-primary text-white py-4 px-3 rounded-md hover:bg-primary/80 transition-all duration-300 w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Setting Password...' : 'Create Password & Continue'}
        </button>
      </div>
    </form>
  )
}

export default PasswordReset
