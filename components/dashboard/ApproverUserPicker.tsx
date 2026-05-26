'use client'

import React, { useMemo, useState } from 'react'
import { ChevronDownIcon, SearchIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { OrgUserForApproverPicker } from '@/lib/data/approval-workflows'
import type { ApproverRoleSlug } from '@/lib/approval-workflow-roles'

type ApproverUserPickerProps = {
  users: OrgUserForApproverPicker[]
  selectedUserId: string | null
  roleSlug: ApproverRoleSlug | null
  onSelect: (userId: string | null) => void
  disabled?: boolean
}

function displayName(user: OrgUserForApproverPicker): string {
  return user.full_name?.trim() || 'Unknown user'
}

export function ApproverUserPicker({
  users,
  selectedUserId,
  roleSlug,
  onSelect,
  disabled,
}: ApproverUserPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filteredUsers = useMemo(() => {
    const byRole = roleSlug ? users.filter((u) => u.roles.includes(roleSlug)) : []
    const q = search.trim().toLowerCase()
    if (!q) return byRole
    return byRole.filter((u) => displayName(u).toLowerCase().includes(q))
  }, [users, roleSlug, search])

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) ?? null,
    [users, selectedUserId]
  )

  const placeholder = roleSlug ? 'Select approver' : 'Select a role first'

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setSearch('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || !roleSlug}
          className={cn('w-full justify-between font-normal', !selectedUser && 'text-muted-foreground')}
        >
          <span className="truncate">
            {selectedUser ? displayName(selectedUser) : placeholder}
          </span>
          <ChevronDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <div className="border-b p-2">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              className="h-8 pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="max-h-64 overflow-auto p-1">
          {filteredUsers.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {roleSlug ? 'No users with this role found.' : 'Select a role first.'}
            </p>
          ) : (
            filteredUsers.map((user) => {
              const name = displayName(user)
              const initials = name
                .split(/\s+/)
                .map((s) => s[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)
              return (
                <button
                  key={user.id}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-accent',
                    selectedUserId === user.id && 'bg-accent'
                  )}
                  onClick={() => {
                    onSelect(user.id)
                    setOpen(false)
                    setSearch('')
                  }}
                >
                  <Avatar className="size-8 shrink-0">
                    {user.avatar_url && (
                      <AvatarImage src={user.avatar_url} alt={name} />
                    )}
                    <AvatarFallback>{initials || '?'}</AvatarFallback>
                  </Avatar>
                  <p className="truncate font-medium">{name}</p>
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
