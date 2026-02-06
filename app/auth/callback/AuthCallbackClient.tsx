'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Client-side callback handler for hash fragments
 * 
 * Supabase invite and recovery links use URL hash fragments (#access_token=...) 
 * which are ONLY accessible in the browser, not on the server.
 * 
 * This component:
 * 1. Extracts tokens from URL hash
 * 2. Calls setSession() to establish authentication
 * 3. Redirects to /auth/password for password setup
 */
export default function AuthCallbackClient() {
  const router = useRouter()
  const [status, setStatus] = useState<'processing' | 'error' | 'success'>('processing')
  const [message, setMessage] = useState<string>('Processing authentication...')

  useEffect(() => {
    const handleCallback = async () => {
      const startTime = Date.now()
      
      try {
        console.log('[Auth Callback Client] 🚀 Starting hash fragment processing')
        
        const supabase = createClient()
        const hashFragment = window.location.hash.substring(1) // Remove leading #
        const hashParams = new URLSearchParams(hashFragment)

        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const type = hashParams.get('type')
        const errorParam = hashParams.get('error')
        const errorDescription = hashParams.get('error_description')

        console.log('[Auth Callback Client] 📋 Hash fragment analysis:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          type,
          hasError: !!errorParam,
          fragmentLength: hashFragment.length
        })

        // Handle error in hash fragment
        if (errorParam) {
          const errorMsg = errorDescription || errorParam
          console.error('[Auth Callback Client] ❌ Error in hash fragment:', errorMsg)
          throw new Error(errorMsg)
        }

        // Check if we have tokens
        if (!accessToken || !refreshToken) {
          console.warn('[Auth Callback Client] ⚠️ No tokens in hash, checking existing session')
          
          // Maybe user already has a session
          const { data: { session } } = await supabase.auth.getSession()
          
          if (session) {
            console.log('[Auth Callback Client] ✅ Existing session found, redirecting')
            setStatus('success')
            setMessage('Session found! Redirecting...')
            router.push('/auth/password')
            return
          }
          
          throw new Error('Invalid or expired authentication link. No tokens found.')
        }

        // Set the session using the tokens
        console.log('[Auth Callback Client] 🔑 Setting session with extracted tokens')
        
        const { data, error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (setSessionError) {
          console.error('[Auth Callback Client] ❌ setSession failed:', setSessionError)
          throw new Error(setSessionError.message)
        }

        if (!data.session) {
          console.error('[Auth Callback Client] ❌ No session returned from setSession')
          throw new Error('Failed to establish authentication session.')
        }

        const elapsed = Date.now() - startTime
        console.log('[Auth Callback Client] ✅ Authentication successful', {
          userId: data.user?.id,
          email: data.user?.email,
          type,
          elapsedMs: elapsed
        })

        setStatus('success')
        setMessage('Authentication successful! Redirecting...')

        // Clean URL by removing hash fragment
        window.history.replaceState(null, '', window.location.pathname)
        
        // Redirect to password page
        router.push('/auth/password')

      } catch (err) {
        const elapsed = Date.now() - startTime
        console.error('[Auth Callback Client] ❌ Authentication failed', {
          error: err,
          elapsedMs: elapsed
        })
        
        setStatus('error')
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
        setMessage(errorMessage)
        
        // Redirect to error page after a brief delay
        setTimeout(() => {
          router.push(`/auth/error?message=${encodeURIComponent(errorMessage)}`)
        }, 2000)
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md text-center">
        {status === 'processing' && (
          <>
            <div className="mb-4">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Processing Authentication</h1>
            <p className="text-muted-foreground">{message}</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="mb-4 text-green-600">
              <svg className="inline-block h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2 text-green-600">Success!</h1>
            <p className="text-muted-foreground">{message}</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="mb-4 text-red-600">
              <svg className="inline-block h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2 text-red-600">Authentication Failed</h1>
            <p className="text-muted-foreground">{message}</p>
            <p className="text-sm text-muted-foreground mt-2">Redirecting to error page...</p>
          </>
        )}
      </div>
    </div>
  )
}
