import React from 'react'
import Payslip from '@/components/templates/Payslip'
import { SAMPLE_PAYSLIP_VIEW_MODEL } from '@/lib/payslips/sample'

const PayslipPage = () => {
  return (
    <section className="p-4 w-full h-full flex justify-center items-center">
      <Payslip data={SAMPLE_PAYSLIP_VIEW_MODEL} />
    </section>
  )
}

export default PayslipPage
