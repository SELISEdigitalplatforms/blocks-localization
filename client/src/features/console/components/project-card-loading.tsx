import { Card } from "@/platform/ui/components/card/card";
import { Skeleton } from "@/platform/ui/components/skeleton/skeleton";

export function ProjectCardLoading() {
  return (
    <Card className="flex h-[160px] cursor-pointer flex-col justify-between rounded-sm p-4 shadow-none">
      <div>
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="mt-2 h-5" />
      </div>
      <div>
        <Skeleton className="h-8 w-1/2" />
      </div>
    </Card>
  );
}
