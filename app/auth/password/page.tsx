import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PasswordReset from '@/components/form/PasswordReset'

export default async function SetPasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If no active session, redirect to error
  if (!user) {
    redirect(
      '/auth/error?message=' +
        encodeURIComponent(
          'Your session has expired. Please request a new invite link.'
        )
    )
  }

  return (
    <section className="flex flex-col items-center justify-center h-screen px-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-2 text-center">Create Your Password</h1>
        <p className="text-muted-foreground text-center mb-10">
          Set a secure password to complete your account setup
        </p>
        <PasswordReset />
      </div>
    </section>
  )
}
