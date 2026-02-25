import React from 'react'
import { SingleUploadWithData } from '@/components/dashboard/SingleUploadWithData'

export default function SingleUploadPage() {
  return (
    <section className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Add Employee
        </h1>
        <p className="mt-1 text-muted-foreground">
          Add one employee at a time. Fill in the form below; you can optionally
          send an invite to the employee.
        </p>
      </div>
      <SingleUploadWithData />
    </section>
  )
}