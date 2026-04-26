import { useIamCurrentUser } from "@/features/auth/hooks/use-iam-current-user";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { useConsoleProjectStore } from "@/features/console/state/console-project-store";
import { Button } from "@/platform/ui/components/button/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/platform/ui/components/dropdown-menu/dropdown-menu";
import { cn } from "@/platform/ui/lib/cn";
import { Link } from "react-router-dom";

export function ShellUserMenu() {
  const user = useAuthStore((s) => s.user);
  const resetAuth = useAuthStore((s) => s.reset);
  const resetConsole = useConsoleProjectStore((s) => s.reset);
  const { data: iamRes, isLoading } = useIamCurrentUser();
  const profileUrl = iamRes?.data?.profileImageUrl?.trim();
  const showPhoto = Boolean(profileUrl && !isLoading);

  const initials =
    typeof user?.email === "string"
      ? (String(user.email).split("@")[0]?.slice(0, 2).toUpperCase() ?? "ME")
      : typeof user?.firstName === "string" && user.firstName
        ? `${String(user.firstName).slice(0, 1)}${typeof user?.lastName === "string" ? String(user.lastName).slice(0, 1) : ""}`.toUpperCase()
        : typeof iamRes?.data?.firstName === "string"
          ? `${String(iamRes.data.firstName).slice(0, 1)}${iamRes.data.lastName ? String(iamRes.data.lastName).slice(0, 1) : ""}`.toUpperCase()
          : "ME";

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "relative h-9 w-9 shrink-0 overflow-hidden rounded-full border-border p-0",
            "bg-muted/80 hover:bg-muted",
          )}
          aria-label="Account menu"
        >
          {showPhoto ? (
            <img src={profileUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <span className="text-xs font-semibold">{initials}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to="/profile">My profile</Link>
          </DropdownMenuItem>
          <DropdownMenuItem disabled className="text-muted-foreground">
            Privacy
          </DropdownMenuItem>
          <DropdownMenuItem disabled className="text-muted-foreground">
            Support
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:text-destructive"
            onClick={() => {
              resetConsole();
              resetAuth();
            }}
          >
            Logout
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
