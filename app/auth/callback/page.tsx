import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuthCallbackClient from './AuthCallbackClient'

type SearchParams = Promise<{
  error?: string
  error_description?: string
}>

/**
 * Auth Callback Handler
 * 
 * This page handles authentication flows using hash fragments:
 * 
 * - New User Invites: admin.generateLink({ type: 'invite' })
 * - Password Resets: admin.generateLink({ type: 'recovery' })
 * 
 * Both use URL hash fragments (#access_token=...&refresh_token=...) which are
 * only accessible in the browser, so we render a client component to handle them.
 */
export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const { error, error_description } = params

  console.log('[Auth Callback] Processing request:', {
    hasError: !!error,
    timestamp: new Date().toISOString()
  })

  // Handle error from Supabase (e.g., expired links)
  if (error) {
    console.error('[Auth Callback] ❌ Error from Supabase:', { error, error_description })
    const message = error_description || error
    redirect(`/auth/error?message=${encodeURIComponent(message)}`)
  }

  // Render client component to handle hash fragment tokens
  console.log('[Auth Callback] 📱 Loading client handler for hash fragments')
  return <AuthCallbackClient />
}
