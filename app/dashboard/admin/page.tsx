import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: roles, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)

  if (error) {
    redirect('/dashboard')
  }

  const roleList = (roles ?? []).map((r) => r.role as string)

  if (
    !(
      roleList.includes('hr') ||
      roleList.includes('finance') ||
      roleList.includes('super_admin')
    )
  ) {
    redirect('/dashboard')
  }

  return (
    <section className="p-4">
      <h1 className="text-2xl font-semibold mb-2">Admin panel</h1>
      <p className="text-muted-foreground">
        HR and Finance administration area. (System admins also have access.)
      </p>
    </section>
  )
}