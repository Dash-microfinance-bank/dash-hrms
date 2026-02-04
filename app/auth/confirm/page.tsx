import { redirect } from 'next/navigation'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

type SearchParams = Promise<{ token_hash?: string; type?: string; next?: string }>

const VALID_OTP_TYPES: EmailOtpType[] = [
  'invite',
  'signup',
  'email',
  'recovery',
  'email_change',
  'magiclink',
]

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const { token_hash, type, next: nextUrl } = params

  if (!token_hash || !type) {
    redirect(
      '/auth/error?message=' +
        encodeURIComponent('Invalid or missing confirmation link.')
    )
  }

  if (!VALID_OTP_TYPES.includes(type as EmailOtpType)) {
    redirect(
      '/auth/error?message=' +
        encodeURIComponent('Invalid confirmation type.')
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type: type as EmailOtpType,
  })

  if (error) {
    redirect(
      '/auth/error?message=' + encodeURIComponent(error.message)
    )
  }

  // Admin invite: send to set password; otherwise use next or home
  const redirectTo =
    type === 'invite'
      ? '/auth/password'
      : nextUrl && nextUrl.startsWith('/')
        ? nextUrl
        : '/'

  redirect(redirectTo)
}
