import React, { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { EmployeePermissionsSettings } from '@/components/dashboard/EmployeePermissionsSettings'
import { Skeleton } from '@/components/ui/skeleton'

async function getOrganizationId() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  return profile?.organization_id ?? null
}

async function getInitialSchema(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_employee_profile_schema', {
    org_id: orgId,
  })

  if (error) {
    console.error('Failed to fetch schema:', error)
    return null
  }

  return data
}

async function EmployeePermissionsSettingsWithData() {
  const orgId = await getOrganizationId()
  
  if (!orgId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Organization not found. Please ensure you are logged in.
      </div>
    )
  }

  const initialSchema = await getInitialSchema(orgId)

  return <EmployeePermissionsSettings initialSchema={initialSchema} organizationId={orgId} />
}

const EmployeesSettingsPage = () => {
  return (
    <section className="p-4">
      <h1 className="text-2xl font-semibold mb-2">Employee Self Service Settings</h1>
      <p className="text-muted-foreground">
        Manage your organization&apos;s employee self service settings and preferences.
      </p>
      <div className="mt-12">
        <Suspense
          fallback={
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-6 w-48" />
                  <div className="space-y-2 pl-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              ))}
            </div>
          }
        >
          <EmployeePermissionsSettingsWithData />
        </Suspense>
      </div>
    </section>
  )
}

export default EmployeesSettingsPage