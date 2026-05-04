import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import React from 'react'
import { EarningStructureAllowancesTableWithData } from '@/components/dashboard/EarningStructureAllowancesTableWithData'
import { getEarningStructureDetailsForCurrentOrg } from '@/lib/data/earning-structure-detail'

type Props = {
  params: Promise<{
    id: string
  }>
}

const page = async ({ params }: Props) => {
  const { id } = await params

  const payload = await getEarningStructureDetailsForCurrentOrg(id)

  return (
    <section className="p-4">
        <div className="mb-10">
            <Link href="/dashboard/admin/payroll/earning-structure" className="text-sm text-muted-foreground hover:text-primary flex items-center">
                <ArrowLeftIcon className="mr-2 size-4" />Back
            </Link>
        </div>

        <div className="">
            <h1 className="text-2xl font-semibold mb-2">{payload?.structure_name ?? 'Structure details'}</h1>
            <p className="text-muted-foreground">Level: <span className="font-medium">{payload?.level_name ?? '—'}</span></p>
        </div>
        
        <div className="mt-6">
            <EarningStructureAllowancesTableWithData structureId={id} />
        </div>
      
    </section>
  )
}

export default page