import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const STEP_COUNT = 3

function StepCardSkeleton({ isLast }: { isLast: boolean }) {
  return (
    <div className="relative flex items-stretch gap-0">
      <div className="flex flex-col items-center w-10 shrink-0">
        <Skeleton className="size-7 shrink-0 rounded-full" />
        {!isLast && <Skeleton className="w-px flex-1 min-h-8 mt-1" />}
      </div>
      <div className="flex-1 mb-10 ml-3">
        <Card className="overflow-hidden rounded-sm shadow">
          <CardContent className="py-3 px-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-x-3 px-3 py-1.5 w-full">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="space-y-2 flex-1 min-w-0">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="size-7 shrink-0 rounded" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function ApprovalWorkflowDetailSkeleton() {
  return (
    <section className="p-4 sm:p-6 w-full space-y-8">
      <Skeleton className="h-4 w-36" />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-20">
        <div className="space-y-2 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-56 max-w-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      <div className="relative w-full sm:w-[30%] mx-auto">
        {Array.from({ length: STEP_COUNT }).map((_, idx) => (
          <StepCardSkeleton key={idx} isLast={idx === STEP_COUNT - 1} />
        ))}
        <div className="flex items-center gap-3 ml-0 mt-1">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
    </section>
  )
}
