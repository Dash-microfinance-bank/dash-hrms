'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
})

type LoginFormValues = z.infer<typeof loginSchema>

const Login = () => {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setFocus,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  useEffect(() => {
    setFocus('email')
  }, [setFocus])

  const onSubmit = async (values: LoginFormValues) => {
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })

    if (error) {
      const message =
        error.message.toLowerCase().includes('invalid') ||
        error.message.toLowerCase().includes('email') ||
        error.message.toLowerCase().includes('password')
          ? 'Invalid email or password'
          : error.message

      toast.error(message, {
        className: '!bg-red-600 !text-white',
      })
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <>
      <h1 className="text-3xl font-bold text-center mb-6">Log in</h1>
      <form className="w-full px-3" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <div className="flex flex-col gap-1 mb-4">
            <label htmlFor="email" className="text-sm font-medium ml-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="Enter your email address"
              className="w-full p-2 border-2 border-gray-300 rounded-sm focus:outline-none focus:border-primary placeholder:text-sm aria-invalid:border-red-500"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...register('email')}
            />
            {errors.email && (
              <p id="email-error" className="ml-1 text-sm text-red-600 mt-0.5">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1 mb-6">
            <label htmlFor="password" className="text-sm font-medium ml-1">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                className="w-full p-2 border-2 border-gray-300 rounded-sm focus:outline-none focus:border-primary placeholder:text-sm pr-12 aria-invalid:border-red-500"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 py-1 px-2 text-sm text-gray-600 hover:text-gray-900 focus:outline-none rounded"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={0}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" className="ml-1 text-sm text-red-600 mt-0.5">
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary text-white p-3 rounded-sm hover:bg-primary/80 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 mb-3 cursor-pointer"
          >
            {isSubmitting ? 'Logging in...' : 'Login'}
          </button>

          <Link
            href="/auth/login?forgot=password"
            className="text-sm text-primary hover:text-primary/80 transition-all duration-300 ml-2"
          >
            Forgot Password?
          </Link>
        </div>
      </form>
    </>
  )
}

export default Login
