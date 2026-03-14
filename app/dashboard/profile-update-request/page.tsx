import Navbar from '@/components/Navbar/Employee'
import React from 'react'
import { getEmployeeProfileSchema } from '@/lib/data/employee-permissions'
import {
  getEmployeeCollectionsForEss,
  getCurrentEmployeeProfileForEss,
  getPendingFieldsForEmployee,
} from '@/lib/data/employee-profile'
import { ProfileUpdateRequestForm } from '../../../components/dashboard/ProfileUpdateRequestForm'

const ProfileUpdateRequestPage = async () => {
  const [schema, profileValues, pendingFields, collections] = await Promise.all([
    getEmployeeProfileSchema(),
    getCurrentEmployeeProfileForEss(),
    getPendingFieldsForEmployee(),
    getEmployeeCollectionsForEss(),
  ])

  return (
    <>
      <Navbar />

      <section className="mx-auto max-w-3xl px-4 py-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight">Profile Update Request</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Edit your details below. Changes will be submitted for HR review before taking effect.
          </p>
        </div>

        {/* Error states */}
        {!schema ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Profile permissions are not configured for your organization. Please contact HR.
          </div>
        ) : !profileValues || !collections ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Could not load your profile. Please ensure you are signed in as an employee.
          </div>
        ) : (
          <ProfileUpdateRequestForm
            schema={schema}
            initialValues={profileValues}
            pendingFields={pendingFields}
            collections={collections}
          />
        )}
      </section>

      <footer className="mx-12 mt-12">
        <div className="flex items-center justify-center py-5">
          <p className="text-sm text-muted-foreground">
            © 2026 Dash technologies LTD. All rights reserved.
          </p>
        </div>
      </footer>
    </>
  )
}

export default ProfileUpdateRequestPage
