import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Default dashboard entry: redirects logged-in users to the area that matches their role.
 * - super_admin → /dashboard/system
 * - hr or finance → /dashboard/admin
 * - others (employee, manager, etc.) → stay here (Employee self service)
 */
export default async function DashboardPage() {
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

  if (!error && roles?.length) {
    const roleList = roles.map((r) => r.role as string)
    if (roleList.includes('super_admin')) {
      redirect('/dashboard/system')
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold">Employee self service</h1>
      <p className="text-muted-foreground mt-1">
        Your dashboard and self-service options.
      </p>
    </div>
  )
}
