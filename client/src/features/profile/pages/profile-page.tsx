import { useIamCurrentUser } from "@/features/auth/hooks/use-iam-current-user";
import { ProfileConsoleView } from "@/features/profile/components/profile-console-view";
import { ProtectedRoute } from "@/routing/guards/protected-route";
import { PageMeta } from "@/seo/page-meta";

function ProfilePageInner() {
  const { isPending, isLoading, data } = useIamCurrentUser();
  if (isPending || isLoading) return null;
  const id = data?.data.itemId ?? "";
  if (!id) return null;

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <PageMeta title="Profile" />
      <main className="thin-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <ProfileConsoleView userId={id} />
      </main>
    </div>
  );
}

export function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfilePageInner />
    </ProtectedRoute>
  );
}
