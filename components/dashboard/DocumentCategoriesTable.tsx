'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
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
import { Button } from '@/components/ui/button'
import type { DocumentCategoryRow } from '@/lib/data/document-categories'
import { CreateDocumentCategoryModal } from '@/components/dashboard/CreateDocumentCategoryModal'
import { EditDocumentCategoryModal } from '@/components/dashboard/EditDocumentCategoryModal'
import { DeleteDocumentCategoryConfirmModal } from '@/components/dashboard/DeleteDocumentCategoryConfirmModal'

type DocumentCategoriesTableProps = {
  /** System defaults (org_id null) + current org's categories; from getDocumentCategoriesForCurrentOrg. */
  data: DocumentCategoryRow[]
}

/** Org-owned, non–system-default rows only; system defaults are read-only. */
function canEditOrDelete(row: DocumentCategoryRow): boolean {
  return row.organization_id != null && !row.system_default
}

export function DocumentCategoriesTable({ data }: DocumentCategoriesTableProps) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<DocumentCategoryRow | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<DocumentCategoryRow | null>(null)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }])
  const [globalFilter, setGlobalFilter] = useState('')

  const columns: ColumnDef<DocumentCategoryRow>[] = useMemo(
    () => [
      {
        id: 'sn',
        header: 'S/N',
        cell: ({ row, table }) => {
          const { pageIndex, pageSize } = table.getState().pagination
          const position = table.getRowModel().rows.findIndex((r) => r.id === row.id)
          return pageIndex * pageSize + position + 1
        },
        size: 60,
        enableSorting: false,
      },
      {
        id: 'name',
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
        accessorFn: (row) => row.name,
        cell: ({ row }) => {
          const r = row.original
          return (
            <span className="font-medium">
              {r.name}
              {r.system_default || r.organization_id == null ? (
                <span className="ml-2 text-xs text-muted-foreground">(System)</span>
              ) : null}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: 'Action',
        enableSorting: false,
        size: 120,
        cell: ({ row }) => {
          const r = row.original
          const editable = canEditOrDelete(r)
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={!editable}
                onClick={() => editable && setEditingCategory(r)}
                title={editable ? 'Edit' : 'System categories cannot be edited'}
              >
                <PencilIcon className="size-4" />
                <span className="sr-only">Edit</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-destructive hover:text-destructive"
                disabled={!editable}
                onClick={() => editable && setDeletingCategory(r)}
                title={editable ? 'Delete' : 'System categories cannot be deleted'}
              >
                <Trash2Icon className="size-4" />
                <span className="sr-only">Delete</span>
              </Button>
            </div>
          )
        },
      },
    ],
    []
  )

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
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  const rows = table.getRowModel().rows
  const isEmpty = data.length === 0

  const handleSuccess = () => {
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-64">
          <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search categories..."
            className="pl-8 focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:border-primary!"
            value={globalFilter ?? ''}
            onChange={(e) => table.setGlobalFilter(e.target.value)}
          />
        </div>
        <Button onClick={() => setCreateOpen(true)}>Create</Button>
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
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-32 text-center align-middle">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      {isEmpty
                        ? 'No document categories yet. Create one to get started.'
                        : 'No categories match your search.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {rows.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {table.getRowModel().rows.length} of {data.length} categories
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <CreateDocumentCategoryModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={handleSuccess}
      />
      <EditDocumentCategoryModal
        category={editingCategory}
        open={!!editingCategory}
        onOpenChange={(o) => !o && setEditingCategory(null)}
        onSuccess={handleSuccess}
      />
      <DeleteDocumentCategoryConfirmModal
        category={deletingCategory}
        open={!!deletingCategory}
        onOpenChange={(o) => !o && setDeletingCategory(null)}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
