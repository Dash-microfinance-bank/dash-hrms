'use client'

import { useSearchParams } from 'next/navigation'
import ForgotPassword from '@/components/form/ForgotPassword'
import Login from '@/components/form/Login'

export default function LoginFormSwitcher() {
  const searchParams = useSearchParams()
  const showForgotPassword = searchParams.get('forgot') === 'password'

  return showForgotPassword ? <ForgotPassword /> : <Login />
}
