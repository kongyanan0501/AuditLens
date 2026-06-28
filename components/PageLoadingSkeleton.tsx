import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted",
        className,
      )}
      aria-hidden
    />
  );
}

export function DashboardLoadingSkeleton() {
  return (
    <section className="space-y-8" aria-busy="true" aria-label="加载中">
      <div className="space-y-2">
        <SkeletonBar className="h-8 w-48" />
        <SkeletonBar className="h-4 w-96 max-w-full" />
      </div>

      <Panel className="overflow-hidden p-0">
        <div className="border-b border-[var(--border-subtle)] px-5 py-4">
          <SkeletonBar className="h-5 w-24" />
          <SkeletonBar className="mt-2 h-3 w-56" />
        </div>
        <div className="space-y-0 divide-y divide-[var(--border-subtle)]">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonBar className="h-4 w-40" />
                <SkeletonBar className="h-3 w-28" />
              </div>
              <SkeletonBar className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Panel key={index} className="p-5">
            <SkeletonBar className="h-3 w-20" />
            <SkeletonBar className="mt-4 h-10 w-16" />
            <SkeletonBar className="mt-3 h-3 w-full" />
          </Panel>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel className="lg:col-span-2 p-5">
          <SkeletonBar className="h-5 w-24" />
          <SkeletonBar className="mt-8 h-40 w-full" />
        </Panel>
        <Panel className="lg:col-span-3 overflow-hidden">
          <div className="border-b border-[var(--border-subtle)] px-5 py-4">
            <SkeletonBar className="h-5 w-24" />
          </div>
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonBar key={index} className="h-12 w-full" />
            ))}
          </div>
        </Panel>
      </div>
    </section>
  );
}

export function UploadLoadingSkeleton() {
  return (
    <section
      className="mx-auto max-w-2xl space-y-8"
      aria-busy="true"
      aria-label="加载中"
    >
      <div className="space-y-2">
        <SkeletonBar className="h-8 w-40" />
        <SkeletonBar className="h-4 w-full max-w-md" />
      </div>
      <Panel className="border-2 border-dashed p-12">
        <div className="mx-auto flex flex-col items-center">
          <SkeletonBar className="size-12 rounded-full" />
          <SkeletonBar className="mt-4 h-6 w-32" />
          <SkeletonBar className="mt-2 h-4 w-48" />
        </div>
      </Panel>
    </section>
  );
}

export function ReportLoadingSkeleton() {
  return (
    <section className="space-y-8" aria-busy="true" aria-label="加载中">
      <div className="space-y-2">
        <SkeletonBar className="h-8 w-32" />
        <SkeletonBar className="h-4 w-64 max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Panel key={index} className="p-5">
            <SkeletonBar className="h-3 w-16" />
            <SkeletonBar className="mt-4 h-10 w-12" />
          </Panel>
        ))}
      </div>

      <Panel className="overflow-hidden">
        <div className="border-b border-[var(--border-subtle)] px-6 py-4">
          <SkeletonBar className="h-5 w-24" />
        </div>
        <div className="space-y-6 px-6 py-8">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2 border-l-2 border-muted pl-4">
              <SkeletonBar className="h-5 w-28" />
              <SkeletonBar className="h-16 w-full" />
            </div>
          ))}
        </div>
      </Panel>
    </section>
  );
}
