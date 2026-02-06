'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  MailIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SearchIcon,
  Trash2Icon,
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { EditAccessModal } from '@/components/dashboard/EditAccessModal'
import { DeleteUserConfirmModal } from '@/components/dashboard/DeleteUserConfirmModal'
import { CreateUserModal } from '@/components/dashboard/CreateUserModal'
import { resendInviteOrResetPassword } from '@/lib/actions/users'
import type { ProfileRow } from '@/lib/data/users'
import { toast } from 'sonner'

type UsersTableProps = {
  data: ProfileRow[]
  currentUserId: string
}

function getInitials(name: string | null): string {
  if (!name?.trim()) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function UsersTable({ data, currentUserId }: UsersTableProps) {
  const router = useRouter()
  const [editingUser, setEditingUser] = useState<ProfileRow | null>(null)
  const [deletingUser, setDeletingUser] = useState<ProfileRow | null>(null)
  const [sendingInviteUserId, setSendingInviteUserId] = useState<string | null>(null)
  const [createUserOpen, setCreateUserOpen] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const columns = useMemo<ColumnDef<ProfileRow>[]>(
    () => [
      {
        id: 'sn',
        header: 'S/N',
        cell: ({ row }) => row.index + 1,
        size: 60,
        enableSorting: false,
      },
      {
        id: 'full_name',
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-2 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Name
            {column.getIsSorted() === 'asc' ? (
              <ArrowUpIcon className="ml-2 size-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDownIcon className="ml-2 size-4" />
            ) : (
              <ArrowUpDownIcon className="ml-2 size-4 opacity-50" />
            )}
          </Button>
        ),
        accessorFn: (row) => row.full_name ?? '—',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar className="size-9">
              <AvatarImage src={row.original.avatar_url ?? undefined} alt={row.original.full_name ?? ''} />
              <AvatarFallback className="text-xs">
                {getInitials(row.original.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-medium">{row.original.full_name || '—'}</span>
            </div>
          </div>
        ),
      },
      {
        id: 'roles',
        header: 'Roles',
        accessorFn: (row) => row.roles?.join(', ') ?? 'No roles',
        cell: ({ row }) => {
          const roles = row.original.roles ?? []
          if (roles.length === 0) {
            return <span className="text-muted-foreground">No roles</span>
          }
          return (
            <div className="flex flex-wrap gap-1">
              {roles.map((role) => (
                <span
                  key={role}
                  className="inline-flex items-center capitalize rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10"
                >
                  {role}
                </span>
              ))}
            </div>
          )
        },
      },
      {
        id: 'created_at',
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-2 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Date created
            {column.getIsSorted() === 'asc' ? (
              <ArrowUpIcon className="ml-2 size-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDownIcon className="ml-2 size-4" />
            ) : (
              <ArrowUpDownIcon className="ml-2 size-4 opacity-50" />
            )}
          </Button>
        ),
        accessorFn: (row) => row.created_at,
        sortingFn: (rowA, rowB) => {
          const a = new Date(rowA.original.created_at).getTime()
          const b = new Date(rowB.original.created_at).getTime()
          return a - b
        },
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {new Date(row.original.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontalIcon className="size-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setEditingUser(row.original)}
              >
                <PencilIcon className="mr-2 size-4" />
                Edit access
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeletingUser(row.original)}
              >
                <Trash2Icon className="mr-2 size-4" />
                Remove user
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        size: 80,
      },
    ],
    [sendingInviteUserId]
  )

  const handleEditAccessSuccess = () => {
    router.refresh()
  }

  const handleDeleteSuccess = () => {
    router.refresh()
  }

  const handleCreateUserSuccess = () => {
    router.refresh()
  }

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(String(e.target.value))}
            className="pl-9 outline-none! focus-within:ring-0! focus-within:ring-offset-0! focus-within:border-primary!"
          />
        </div>
        <Button onClick={() => setCreateUserOpen(true)}>
          Create User
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} style={{ width: header.getSize() }}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {editingUser && (
        <EditAccessModal
          user={editingUser}
          currentUserId={currentUserId}
          open={true}
          onOpenChange={(open) => {
            if (!open) setEditingUser(null)
          }}
          onSuccess={handleEditAccessSuccess}
        />
      )}

      <DeleteUserConfirmModal
        user={deletingUser}
        open={!!deletingUser}
        onOpenChange={(open) => {
          if (!open) setDeletingUser(null)
        }}
        onSuccess={handleDeleteSuccess}
      />

      <CreateUserModal
        open={createUserOpen}
        onOpenChange={setCreateUserOpen}
        onSuccess={handleCreateUserSuccess}
      />
    </div>
  )
}
