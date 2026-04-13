import { Button } from "@/platform/ui/components/button/button";
import { cn } from "@/platform/ui/lib/cn";
import { Bell } from "lucide-react";

type NotificationBellStubProps = {
  /** Stub count until a real notifications feed exists (matches main app badge affordance). */
  badgeCount?: number;
};

export function NotificationBellStub({ badgeCount = 7 }: NotificationBellStubProps) {
  const showBadge = badgeCount > 0;
  const label = showBadge ? `${badgeCount} notifications` : "Notifications";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="relative h-8 w-8"
      aria-label={label}
    >
      <Bell className="h-5 w-5" />
      {showBadge ? (
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full",
            "bg-[#2563eb] px-1 text-[10px] font-semibold leading-none text-white",
          )}
        >
          {badgeCount > 9 ? "9+" : badgeCount}
        </span>
      ) : null}
    </Button>
  );
}
