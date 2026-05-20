import React from 'react'

type PayslipProps = {
    employeeName: string
    employeeId: string
    employeeDepartment: string
    employeePosition: string
    employeeContract: string
    employeePayDay: string
    employeeSalary: number
}

const Payslip = ({}) => {
  return (
    <div className="w-3xl h-full px-4 pt-4 pb-10 payslip-template bg-white relative">
        <div className='template-heading pt-10'>
            <div className='flex items-center justify-between'>
                <div className=''>
                    <img src="https://dash-mfb.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fdash.5f00dc32.png&w=1080&q=75" alt="logo" width={100} height={100} />
                </div>
                <div className='flex flex-col justify-center items-center'>
                    <p className='text-xs text-black/50'>Payslip for the month</p>
                    <h3 className='text-lg font-bold'>May, 2026</h3>
                </div>
            </div>
            <div className='mt-8 space-y-2'>
                <h3 className='text-base font-semibold'>Dash Microfinace Bank Limited</h3>
                <p className='text-sm text-black/60'>5B Adewunmi Adu Street, Off Sanni Balogun, Abule-Egba</p>
                <p className='text-sm text-black/60'>Lagos, Nigeria.</p>
            </div>
        </div>
        <div className='template-body mt-16'>
            <div className='space-y-10'>
                <div className='template-body-left-header'>
                    <h3 className='text-base font-semibold mb-1'>Employee Details</h3>
                    <hr />
                    <div className='flex justify-between gap-x-28 w-full mt-5'>
                        <table className='w-full'>
                            <tbody className=''>
                                <tr className=''>
                                    <td className='text-sm text-black/60 pb-3'>Employee ID</td>
                                    <td className='text-sm text-black pb-3'>: EMP001</td>
                                </tr>
                                <tr>
                                    <td className='text-sm text-black/60 pb-3'>Employee Name</td>
                                    <td className='text-sm text-black pb-3'>: Emmanuel Ufot</td>
                                </tr>
                                <tr>
                                    <td className='text-sm text-black/60 pb-3'>Employee Department</td>
                                    <td className='text-sm text-black pb-3'>: Information Technology</td>
                                </tr>
                            </tbody>
                        </table>
                        <table className='w-full'>
                            <tbody>
                                <tr>
                                    <td className='text-sm text-black/60 pb-3'>Position</td>
                                    <td className='text-sm text-black pb-3'>: Software Engineer</td>
                                </tr>
                                <tr>
                                    <td className='text-sm text-black/60 pb-3'>Contract</td>
                                    <td className='text-sm text-black pb-3'>: Full time</td>
                                </tr>
                                <tr>
                                    <td className='text-sm text-black/60 pb-3'>Pay day</td>
                                    <td className='text-sm text-black pb-3'>: May 2026</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className=''>
                    <h3 className='text-base font-semibold mb-1'>Salary Breakdown</h3>
                    {/* <hr /> */}
                    <div className='flex justify-between items-start gap-x-28 w-full mt-3 border border-black/30 p-3 rounded-[16px]'>
                        <table className='w-full Allowances'>
                            <thead className='table-header'>
                                <tr className='border-b border-dashed border-black/30'>
                                    <th className='text-sm text-black/60 pb-3 text-left'>Allowances</th>
                                    <th className='text-sm text-black/60 pb-3 text-left'>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className=''>
                                    <td className='text-sm text-black/60 pt-3'>Basic Salary</td>
                                    <td className='text-sm text-black pt-3'>₦100,000</td>
                                </tr>
                            </tbody>
                            <tfoot className='table-footer'>
                                <tr className=''>
                                    <td className='text-sm text-black/60 pt-3 font-semibold'>Total Allowances</td>
                                    <td className='text-sm text-black pt-3 font-semibold'>₦100,000</td>
                                </tr>
                            </tfoot>
                        </table>
                        <table className='w-full Deductions'>
                            <thead className='table-header'>
                                <tr className='border-b border-dashed border-black/30'>
                                    <th className='text-sm text-black/60 pb-3 text-left'>Deductions</th>
                                    <th className='text-sm text-black/60 pb-3 text-left'>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className=''>
                                    <td className='text-sm text-black/60 pt-3'>Pension</td>
                                    <td className='text-sm text-black pt-3'>₦20,000</td>
                                </tr>
                                <tr className=''>
                                    <td className='text-sm text-black/60 pt-3'>Tax</td>
                                    <td className='text-sm text-black pt-3'>₦40,000</td>
                                </tr>
                            </tbody>
                            <tfoot className='table-footer'>
                                <tr className=''>
                                    <td className='text-sm text-black/60 pt-3 font-semibold'>Total Deductions</td>
                                    <td className='text-sm text-black pt-3 font-semibold'>₦100,000</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
            <div>
                <div className='mt-5 border border-black/30 px-3 py-5 rounded-[16px]'>
                    {/* <hr /> */}
                    <div className='flex justify-between items-center w-full pr-16'>
                        <h3 className='text-base font-semibold'>Net Salary</h3>
                        <h3 className='text-base font-semibold'>₦100,000</h3>
                    </div>
                </div>
            </div>
        </div>
        <div className='template-footer mt-16'>
            <div className='absolute bottom-4 left-1/2 -translate-x-1/2 w-full'>
                <p className='text-xs text-black/60 text-center mb-2'>This is a computer generated payslip. No signature is required.</p>
                <p className='text-xs text-black/60 text-center'>Powered by <span className='font-semibold'>DashMFB</span></p>
            </div>
        </div>
    </div>
  )
}

export default Payslip