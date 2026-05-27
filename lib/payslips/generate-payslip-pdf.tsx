import { pdf } from '@react-pdf/renderer'
import { PayslipPdfDocument } from '@/lib/payslips/PayslipPdfDocument'
import type { PayslipViewModel } from '@/lib/payslips/types'

export async function renderPayslipPdfBuffer(data: PayslipViewModel): Promise<Buffer> {
  const blob = await pdf(<PayslipPdfDocument data={data} />).toBlob()
  const arrayBuffer = await blob.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
