
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/platform/ui/components/dialog/dialog";
import { Button } from "@/platform/ui/components/button/button";
import { Input } from "@/platform/ui/components/input/input";
import { Label } from "@/platform/ui/components/label/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/platform/ui/components/select/select";
import type { IGeneratePATPayload, IPATResponse } from "@/features/profile/model/profile-user.types";
import { useProfileGeneratePats } from "@/features/profile/hooks/use-profile-activity";
import { getPatClientIdForAppUrl } from "@/features/profile/lib/pat-client-id";
import { showErrorToast } from "@/platform/ui/hooks/use-toast";

interface GenerateTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  id: string;
  onSuccess?: (data: IPATResponse) => void;
}

export function ProfileGeneratePatModal({ isOpen, onClose, onSuccess, id: _userId }: GenerateTokenModalProps) {
  const [note, setNote] = useState("");
  const [expiration, setExpiration] = useState("30");

  const { mutate: generateToken, isPending, isError } = useProfileGeneratePats();

  const getExpirationDate = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getExpirationLabel = (days: string): string => {
    const daysNum = parseInt(days, 10);
    return `${days} days (${getExpirationDate(daysNum)})`;
  };

  const handleGenerate = () => {
    if (!note.trim()) {
      showErrorToast({ errors: "Name is required" });
      return;
    }

    const expirationDays = parseInt(expiration, 10);
    const clientIdEnvWise = getPatClientIdForAppUrl();

    const payload: IGeneratePATPayload = {
      clientId: clientIdEnvWise,
      note: note || undefined,
      codeTtlInMinute: expirationDays * 24 * 60,
    };

    generateToken(payload, {
      onSuccess: (data) => {
        setNote("");
        setExpiration("30");
        onSuccess?.(data);
        onClose();
      },
    });
  };

  const handleCancel = () => {
    onClose();
    setNote("");
    setExpiration("30");
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) handleCancel();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Generate Token</DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Create a secure access token for authentication and API use.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isError ? (
            <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              <p className="text-sm">Failed to generate token. Please try again.</p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="note" className="text-sm font-medium">
              PAT Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="note"
              placeholder="Write here ..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full"
              disabled={isPending}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiration" className="text-sm font-medium">
              Expiration
            </Label>
            <Select value={expiration} onValueChange={setExpiration} disabled={isPending}>
              <SelectTrigger className="w-full" id="expiration">
                <SelectValue placeholder={getExpirationLabel(expiration)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 days ({getExpirationDate(30)})</SelectItem>
                <SelectItem value="15">15 days ({getExpirationDate(15)})</SelectItem>
                <SelectItem value="7">7 days ({getExpirationDate(7)})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex gap-3 sm:gap-3">
          <Button variant="outline" onClick={handleCancel} className="flex-1 sm:flex-none" disabled={isPending} type="button">
            Cancel
          </Button>
          <Button onClick={handleGenerate} className="flex-1 sm:flex-none" disabled={isPending || !note.trim()} type="button">
            {isPending ? "Generating..." : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
