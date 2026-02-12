import { Suspense } from 'react'
import { UsersTableSkeleton } from '@/components/dashboard/UsersTableSkeleton'
import { UsersTableWithData } from '../UsersTableWithData'

export default function UsersAndAccessPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold">Users and access</h1>
      <p className="text-muted-foreground mt-1">Manage users and role-based access for this organization.</p>
      <div className="mt-6">
        <Suspense fallback={<UsersTableSkeleton />}>
          <UsersTableWithData />
        </Suspense>
      </div>
    </div>
  )
}
