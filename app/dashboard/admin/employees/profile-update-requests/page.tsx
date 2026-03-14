import React from 'react'
import { getProfileUpdateRequestsForCurrentOrg } from '@/lib/data/profile-update-requests'
import { ProfileUpdateRequestsTable } from '@/components/dashboard/ProfileUpdateRequestsTable'

export default async function ProfileUpdateRequestsPage() {
  const requests = await getProfileUpdateRequestsForCurrentOrg()

  return (
    <section className="p-4">
      <h1 className="text-2xl font-semibold mb-2">
        Employee Profile Update Requests
      </h1>
      <p className="text-muted-foreground">
        View and manage employee profile update requests.
      </p>
      <div className="mt-12">
        <ProfileUpdateRequestsTable requests={requests} />
      </div>
    </section>
  )
}
