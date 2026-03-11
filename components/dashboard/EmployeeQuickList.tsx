'use client'

import React, { useMemo, useState, useDeferredValue } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

export type EmployeeQuickInfo = {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  department: string
  jobTitle: string
  staffId: string
  reportLocation: string
  managerName: string
  startDate: string | null
  birthday: string | null
}

type Props = {
  employees: EmployeeQuickInfo[]
}

export function EmployeeQuickList({ employees }: Props) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [selected, setSelected] = useState<EmployeeQuickInfo | null>(null)

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    const base = q
      ? employees.filter((e) =>
          [e.name, e.email, e.department, e.jobTitle]
            .some((v) => v.toLowerCase().includes(q))
        )
      : employees
    return base.slice(0, 5)
  }, [employees, deferredQuery])

  const formatDate = (iso: string | null) =>
    !iso
      ? '—'
      : new Date(iso).toLocaleDateString('en-NG', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })

  const computeTimeInCompany = (startIso: string | null) => {
    if (!startIso) return '—'
    const start = new Date(startIso)
    if (Number.isNaN(start.getTime())) return '—'
    const now = new Date()
    let months =
      (now.getFullYear() - start.getFullYear()) * 12 +
      (now.getMonth() - start.getMonth())
    if (now.getDate() < start.getDate()) months -= 1
    if (months < 0) months = 0
    const years = Math.floor(months / 12)
    const remainingMonths = months % 12
    if (years === 0 && remainingMonths === 0) return 'Less than a month'
    if (years === 0)
      return `${remainingMonths} month${remainingMonths === 1 ? '' : 's'}`
    if (remainingMonths === 0)
      return `${years} year${years === 1 ? '' : 's'}`
    return `${years} year${years === 1 ? '' : 's'}, ${remainingMonths} month${
      remainingMonths === 1 ? '' : 's'
    }`
  }

  const getInitials = (name: string, email: string) => {
    const parts = name.trim().split(/\s+/)
    if (parts.length) {
      return (
        parts
          .slice(0, 2)
          .map((p) => p[0]?.toUpperCase() ?? '')
          .join('') || '?'
      )
    }
    return (email[0] ?? '?').toUpperCase()
  }

  return (
    <>
      <form action="" method="get">
        <Input
          type="text"
          placeholder="Search employees"
          className="w-full px-2 py-3 rounded-md border border-input focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary!"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>

      <div className="mt-4 pt-4 space-y-3 overflow-y-auto h-[340px]">
        {query !== deferredQuery ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-slate-200" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-32 rounded bg-slate-200" />
                <div className="h-3 w-24 rounded bg-slate-100" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            No employees found.
          </p>
        ) : (
          filtered.map((e) => {
            const initials = getInitials(e.name, e.email)
            return (
              <button
                key={e.id}
                type="button"
                className="flex w-full items-center gap-2 text-left"
                onClick={() => setSelected(e)}
              >
                <Avatar className="size-8">
                  {e.avatarUrl ? (
                    <AvatarImage src={e.avatarUrl} alt={e.name} className='object-cover rounded-full' />
                  ) : null}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col text-left space-y-0">
                  <CardTitle className="text-sm">{e.name}</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    {e.jobTitle}
                  </CardDescription>
                </div>
              </button>
            )
          })
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-sm px-4 py-6">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="size-14">
                    {selected.avatarUrl ? (
                      <AvatarImage src={selected.avatarUrl} alt={selected.name} className='object-cover rounded-full' />
                    ) : null}
                    <AvatarFallback>
                      {getInitials(selected.name, selected.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <DialogTitle className="truncate">{selected.name}</DialogTitle>
                    <p className="text-xs text-muted-foreground truncate">
                      {selected.jobTitle}
                    </p>
                  </div>
                </div>
              </DialogHeader>
              <div className="mt-3 space-y-2 text-xs">
                <div className='border-t pt-2'>
                  <p className='text-xs font-light'>Department</p>
                  <p className='text-base font-medium'>{selected.department}</p>
                </div>
                <div className='border-t pt-2'>
                  <p className='text-xs font-light'>Staff ID</p>
                  <p className='text-base font-medium'>{selected.staffId}</p>
                </div>
                <div className='border-t pt-2'>
                  <p className='text-xs font-light'>Report location</p>
                  <p className='text-base font-medium'>{selected.reportLocation}</p>
                </div>
                <div className='border-t pt-2'>
                  <p className='text-xs font-light'>Line manager / Supervisor</p>
                  <p className='text-base font-medium'>{selected.managerName}</p>
                </div>
                <div className='border-t pt-2'  >
                  <p className='text-xs font-light'>Work anniversary</p>
                  <p className='text-base font-medium'>{formatDate(selected.startDate)}</p>
                </div>
                <div className='border-t pt-2'>
                  <p className='text-xs font-light'>Time in company</p>
                  <p className='text-base font-medium'>{computeTimeInCompany(selected.startDate)}</p>
                  </div>
                  <div className='border-t pt-2'  >
                    <p className='text-xs font-light'>Birthday</p>
                    <p className='text-base font-medium'>{formatDate(selected.birthday)}</p>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </>
    )
  }
