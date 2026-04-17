import { Skeleton } from '@/components/ui/skeleton'

export function DocumentsTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-9 w-full sm:w-64" />
      </div>
      <div className="rounded-md border">
        <div className="divide-y">
          {/* Header */}
          <div className="flex items-center gap-4 px-4 py-3 bg-muted/50">
            {[50, 180, 140, 130, 140, 120, 90].map((w, i) => (
              <Skeleton key={i} className="h-4 rounded" style={{ width: w }} />
            ))}
          </div>
          {/* Rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              {[50, 180, 140, 130, 140, 120, 90].map((w, j) => (
                <Skeleton key={j} className="h-4 rounded" style={{ width: w }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
