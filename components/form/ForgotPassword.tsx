'use client'

import Link from 'next/link'
import React, { useEffect, useRef, useState } from 'react'
import { z } from 'zod'

const forgotPasswordSchema = z.object({
    email: z
    .string()
    .min(1, 'Email is required')
    .email('Enter a valid email address'),
})

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>

const ForgotPassword = () => {
    const [email, setEmail] = useState('')
    const [errors, setErrors] = useState<Partial<Record<keyof ForgotPasswordFormValues, string>>>({})
    const emailRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        emailRef.current?.focus()
    }, [])

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const result = forgotPasswordSchema.safeParse({ email })
        if (!result.success) {
            const fieldErrors: Partial<Record<keyof ForgotPasswordFormValues, string>> = {}
            result.error.issues.forEach((issue) => {
                const path = issue.path[0] as keyof ForgotPasswordFormValues
                if (path && !fieldErrors[path]) fieldErrors[path] = issue.message
            })
            setErrors(fieldErrors)
            return
        }
        setErrors({})
        // TODO: Supabase sendPasswordResetEmail({ email })
        console.log(email)
    }

    return (
        <>
            <h1 className='text-3xl font-bold text-center mb-6'>Forgot Password</h1>
            <form className="w-full px-3" onSubmit={handleSubmit}>
                <div>
                    <div className="flex flex-col gap-1 mb-5">
                        <label htmlFor="email" className="text-sm font-medium ml-1">
                        Email Address
                        </label>
                        <input
                        ref={emailRef}
                        type="email"
                        id="email"
                        name="email"
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value)
                            if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }))
                        }}
                        className="w-full p-2 border-2 border-gray-300 rounded-sm focus:outline-none focus:border-primary placeholder:text-sm aria-invalid:border-red-500"
                        placeholder="Enter your email address"
                        autoComplete="email"
                        aria-invalid={!!errors.email}
                        aria-describedby={errors.email ? 'email-error' : undefined}
                        />
                        {errors.email && (
                        <p id="email-error" className="ml-1 text-sm text-red-600 mt-0.5">
                            {errors.email}
                        </p>
                        )}
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-primary text-white p-3 rounded-sm hover:bg-primary/80 transition-all duration-300 mb-4 cursor-pointer"
                    >Send Reset Link</button>
                    <Link href="/auth/login" className="text-sm text-primary hover:text-primary/80 transition-all duration-300 ml-2 cursor-pointer text-start block">Back to Login</Link>
                </div>
            </form>
        </>
    )
}

export default ForgotPassword