import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import React, { Suspense } from 'react'
import { EarningStructureAllowancesTable } from '@/components/dashboard/EarningStructureAllowancesTable'
import { EarningStructureAllowancesTableSkeleton } from '@/components/dashboard/EarningStructureAllowancesTableSkeleton'
import { getEarningStructureDetailsForCurrentOrg } from '@/lib/data/earning-structure-detail'

type Props = {
  params: Promise<{
    id: string
  }>
}

const page = async ({ params }: Props) => {
  const { id } = await params
  return (
    <section className="p-4">
      <div className="mb-10">
        <Link
          href="/dashboard/admin/payroll/earning-structure"
          className="text-sm text-muted-foreground hover:text-primary flex items-center"
        >
          <ArrowLeftIcon className="mr-2 size-4" />
          Back
        </Link>
      </div>

      <Suspense fallback={<EarningStructureDetailSkeleton />}>
        <EarningStructureDetailWithData structureId={id} />
      </Suspense>
    </section>
  )
}

async function EarningStructureDetailWithData({ structureId }: { structureId: string }) {
  const payload = await getEarningStructureDetailsForCurrentOrg(structureId)

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold mb-2">{payload?.structure_name ?? 'Structure details'}</h1>
        <p className="text-muted-foreground">
          Level: <span className="font-medium">{payload?.level_name ?? '—'}</span>
        </p>
      </div>

      <div className="mt-6">
        <EarningStructureAllowancesTable
          structureId={payload?.structure_id ?? structureId}
          rows={payload?.allowances ?? []}
          allowanceOptions={payload?.attachable_allowances ?? []}
        />
      </div>
    </>
  )
}

function EarningStructureDetailSkeleton() {
  return (
    <>
      <div className="space-y-2">
        <div className="h-8 w-64 rounded-md bg-muted" />
        <div className="h-5 w-40 rounded-md bg-muted" />
      </div>
      <div className="mt-6">
        <EarningStructureAllowancesTableSkeleton />
      </div>
    </>
  )
}

export default page