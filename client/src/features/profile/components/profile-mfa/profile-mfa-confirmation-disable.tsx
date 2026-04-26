
import { Button } from "@/platform/ui/components/button/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/platform/ui/components/dialog/dialog";
import { showErrorToast, showSuccessToast } from "@/platform/ui/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { useProfileDisableMfa } from "@/features/profile/hooks/use-profile-mfa";
import { profileMfaContext } from "@/features/profile/components/profile-mfa/profile-mfa";
import { useContext } from "react";

export function UserMFAConfirmationDisable() {
  const { projectKey, userId, isDisableModalOpen, setIsDisableModalOpen } = useContext(profileMfaContext);
  const { isPending, mutateAsync } = useProfileDisableMfa({ id: userId, projectKey });

  const onClickHandler = async () => {
    try {
      const res = await mutateAsync({ projectKey, userId });
      if (!res.isSuccess) return showErrorToast({ errors: res.errors });
      showSuccessToast({ description: "MFA disabled successfully" });
      setIsDisableModalOpen(false);
    } catch (error) {
      if (isErrorWithErrors(error)) showErrorToast({ errors: error.errors });
    }
  };

  return (
    <Dialog open={isDisableModalOpen} onOpenChange={setIsDisableModalOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disable MFA?</DialogTitle>
          <DialogDescription>
            Are you sure you want to disable Multi-Factor Authentication (MFA) for this account? Disabling MFA may
            reduce the security of this account.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 flex flex-row gap-2">
          <DialogClose asChild>
            <Button variant="outline" size="sm" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button size="sm" onClick={onClickHandler} disabled={isPending}>
            {isPending ? "Processing" : "Yes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
