import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";

export const ProjectCardLoading = () => {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Top section with icon - skeleton */}
        <div className="flex h-24 items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
          <Skeleton className="h-14 w-14 rounded-full" />
        </div>

        {/* Content section - skeleton */}
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>

          <div className="mb-4 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>

          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
};
