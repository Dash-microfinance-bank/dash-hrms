import Navbar from '@/components/Navbar/Employee'
import { getEmployeesForCurrentOrg } from '@/lib/data/employees'
import { OrganogramChart } from '@/components/dashboard/organogram/OrganogramChart'

export default async function OrganogramPage() {
  const employees = await getEmployeesForCurrentOrg()

  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      {/* Chart fills the remaining viewport height below the sticky navbar */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 lg:px-8 py-3 border-b border-slate-200 bg-white shrink-0">
          <div>
            <h1 className="text-base font-semibold text-slate-900">Organogram</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {employees.length} employee{employees.length !== 1 ? 's' : ''} · reporting structure
            </p>
          </div>
          <p className="text-xs text-muted-foreground hidden sm:block">
            Scroll to zoom · drag to pan · click Collapse / Expand on a node
          </p>
        </div>
        <div className="flex-1 min-h-0">
          <OrganogramChart employees={employees} />
        </div>
      </main>
    </div>
  )
}
