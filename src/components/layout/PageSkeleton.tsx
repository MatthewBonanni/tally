import { Card, CardContent, CardHeader } from "@/components/ui/card";

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className ?? ""}`} />;
}

export function PageSkeleton() {
  return (
    <>
      {/* Header skeleton */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Content skeleton */}
      <div className="flex-1 overflow-auto p-6">
        <Card className="mb-4">
          <CardContent className="py-3">
            <div className="flex gap-2">
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-32" />
            </div>
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
