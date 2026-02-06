import { Skeleton } from '@/components/ui/skeleton'
import { UsersTableSkeleton } from '@/components/dashboard/UsersTableSkeleton'

export default function SystemLoading() {
  return (
    <div className="p-4">
      <Skeleton className="mb-1 h-8 w-56" />
      <Skeleton className="mb-6 h-4 w-96" />
      <UsersTableSkeleton />
    </div>
  )
}
