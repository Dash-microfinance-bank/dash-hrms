import React from 'react'
import { formatPayslipCurrency } from '@/lib/payslips/format'
import type { PayslipViewModel } from '@/lib/payslips/types'

type PayslipProps = {
  data: PayslipViewModel
}

const Payslip = ({ data }: PayslipProps) => {
  return (
    <div className="w-3xl h-full px-4 pt-4 pb-10 payslip-template bg-white relative">
      <div className="template-heading pt-10">
        <div className="flex items-center justify-between">
          <div>
            <img src={data.logoUrl} alt="logo" width={100} height={100} />
          </div>
          <div className="flex flex-col justify-center items-center">
            <p className="text-xs text-black/50">Payslip for the month</p>
            <h3 className="text-lg font-bold">{data.periodLabel}</h3>
          </div>
        </div>
        <div className="mt-8 space-y-2">
          <h3 className="text-base font-semibold">{data.organizationName}</h3>
          {data.organizationAddressLines.map((line) => (
            <p key={line} className="text-sm text-black/60">
              {line}
            </p>
          ))}
        </div>
      </div>
      <div className="template-body mt-16">
        <div className="space-y-10">
          <div className="template-body-left-header">
            <h3 className="text-base font-semibold mb-1">Employee Details</h3>
            <hr />
            <div className="flex justify-between gap-x-28 w-full mt-5">
              <table className="w-full">
                <tbody>
                  <tr>
                    <td className="text-sm text-black/60 pb-3">Employee ID</td>
                    <td className="text-sm text-black pb-3">: {data.employeeStaffId}</td>
                  </tr>
                  <tr>
                    <td className="text-sm text-black/60 pb-3">Employee Name</td>
                    <td className="text-sm text-black pb-3">: {data.employeeName}</td>
                  </tr>
                  <tr>
                    <td className="text-sm text-black/60 pb-3">Employee Department</td>
                    <td className="text-sm text-black pb-3">: {data.department}</td>
                  </tr>
                </tbody>
              </table>
              <table className="w-full">
                <tbody>
                  <tr>
                    <td className="text-sm text-black/60 pb-3">Position</td>
                    <td className="text-sm text-black pb-3">: {data.position}</td>
                  </tr>
                  <tr>
                    <td className="text-sm text-black/60 pb-3">Contract</td>
                    <td className="text-sm text-black pb-3">: {data.contractLabel}</td>
                  </tr>
                  <tr>
                    <td className="text-sm text-black/60 pb-3">Pay day</td>
                    <td className="text-sm text-black pb-3">: {data.payDayLabel}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h3 className="text-base font-semibold mb-1">Salary Breakdown</h3>
            <div className="flex justify-between items-start gap-x-28 w-full mt-3 border border-black/30 p-3 rounded-[16px]">
              <table className="w-full Allowances">
                <thead className="table-header">
                  <tr className="border-b border-dashed border-black/30">
                    <th className="text-sm text-black/60 pb-3 text-left">Allowances</th>
                    <th className="text-sm text-black/60 pb-3 text-left">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.allowances.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="text-sm text-black/60 pt-3">
                        No allowances
                      </td>
                    </tr>
                  ) : (
                    data.allowances.map((line) => (
                      <tr key={`${line.name}-${line.amount}`}>
                        <td className="text-sm text-black/60 pt-3">{line.name}</td>
                        <td className="text-sm text-black pt-3">
                          {formatPayslipCurrency(line.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="table-footer">
                  <tr>
                    <td className="text-sm text-black/60 pt-3 font-semibold">Total Allowances</td>
                    <td className="text-sm text-black pt-3 font-semibold">
                      {formatPayslipCurrency(data.totalAllowances)}
                    </td>
                  </tr>
                </tfoot>
              </table>
              <table className="w-full Deductions">
                <thead className="table-header">
                  <tr className="border-b border-dashed border-black/30">
                    <th className="text-sm text-black/60 pb-3 text-left">Deductions</th>
                    <th className="text-sm text-black/60 pb-3 text-left">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.deductions.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="text-sm text-black/60 pt-3">
                        No deductions
                      </td>
                    </tr>
                  ) : (
                    data.deductions.map((line) => (
                      <tr key={`${line.name}-${line.amount}`}>
                        <td className="text-sm text-black/60 pt-3">{line.name}</td>
                        <td className="text-sm text-black pt-3">
                          {formatPayslipCurrency(line.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="table-footer">
                  <tr>
                    <td className="text-sm text-black/60 pt-3 font-semibold">Total Deductions</td>
                    <td className="text-sm text-black pt-3 font-semibold">
                      {formatPayslipCurrency(data.totalDeductions)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
        <div>
          <div className="mt-5 border border-black/30 px-3 py-5 rounded-[16px]">
            <div className="flex justify-between items-center w-full pr-16">
              <h3 className="text-base font-semibold">Net Salary</h3>
              <h3 className="text-base font-semibold">{formatPayslipCurrency(data.netSalary)}</h3>
            </div>
          </div>
        </div>
      </div>
      <div className="template-footer mt-16">
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full">
          <p className="text-xs text-black/60 text-center mb-2">
            This is a computer generated payslip. No signature is required.
          </p>
          <p className="text-xs text-black/60 text-center">
            Powered by <span className="font-semibold">DashMFB</span>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Payslip
