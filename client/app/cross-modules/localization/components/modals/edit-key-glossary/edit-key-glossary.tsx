import { useCallback, useState } from "react";
import { Button } from "@/components/ui-kits/button/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui-kits/command/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui-kits/popover/popover";
import { Badge } from "@/components/ui-kits/badge/badge";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatErrorMessage } from "@/lib/error";
import { IBlocksLanguageKey, IGlossary } from "@blocks-localization/models/language";
import {
  useSaveBlocksLanguageKey,
  useSearchGlossaries,
} from "@blocks-localization/hooks/use-language-manager";

interface EditKeyGlossaryProps {
  keyDetails: IBlocksLanguageKey;
  resolvedGlossaries: IGlossary[];
  onClose: () => void;
}

function EditKeyGlossary({
  keyDetails,
  resolvedGlossaries,
  onClose,
}: Readonly<EditKeyGlossaryProps>) {
  const { isPending, mutateAsync } = useSaveBlocksLanguageKey();

  const [selectedIds, setSelectedIds] = useState<string[]>(keyDetails.glossaryIds ?? []);
  const [selectedGlossaries, setSelectedGlossaries] = useState<IGlossary[]>(resolvedGlossaries);
  const [searchText, setSearchText] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);

  const { data: searchResults } = useSearchGlossaries(searchText, popoverOpen);

  const handleSelect = useCallback(
    (glossary: IGlossary) => {
      const alreadySelected = selectedIds.includes(glossary.itemId);
      if (alreadySelected) {
        setSelectedIds((prev) => prev.filter((id) => id !== glossary.itemId));
        setSelectedGlossaries((prev) => prev.filter((g) => g.itemId !== glossary.itemId));
      } else {
        setSelectedIds((prev) => [...prev, glossary.itemId]);
        setSelectedGlossaries((prev) => [...prev, glossary]);
      }
    },
    [selectedIds],
  );

  const handleRemove = useCallback((glossaryId: string) => {
    setSelectedIds((prev) => prev.filter((id) => id !== glossaryId));
    setSelectedGlossaries((prev) => prev.filter((g) => g.itemId !== glossaryId));
  }, []);

  async function handleSave() {
    try {
      const payload = {
        itemId: keyDetails.itemId,
        keyName: keyDetails.keyName,
        moduleId: keyDetails.moduleId,
        resources:
          keyDetails?.resources?.length && keyDetails?.resources?.length > 0
            ? keyDetails.resources
            : [],
        routes: keyDetails.routes ?? [],
        glossaryIds: selectedIds,
        isPartiallyTranslated: keyDetails.isPartiallyTranslated,
        context: keyDetails.context,
      };

      const res = await mutateAsync(payload);
      if (res?.success) {
        toast({
          variant: "success",
          title: "Success",
          description: "Glossary updated successfully",
        });
        onClose();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: formatErrorMessage(res?.errorMessage),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: formatErrorMessage(error),
      });
    }
  }

  const availableGlossaries = searchResults?.items ?? [];

  return (
    <DialogContent className="rounded-lg sm:max-w-[520px]">
      <DialogHeader className="space-y-3">
        <DialogTitle className="text-left text-xl">Tag Glossary</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        {selectedGlossaries.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedGlossaries.map((glossary) => (
              <Badge key={glossary.itemId} variant="secondary" className="gap-1 pr-1">
                {glossary.name}
                <button
                  type="button"
                  onClick={() => handleRemove(glossary.itemId)}
                  disabled={isPending}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={popoverOpen}
              className="w-full justify-between font-normal"
              disabled={isPending}
            >
              Search glossary...
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[470px] p-0" align="start" portalled={false}>
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search glossary..."
                value={searchText}
                onValueChange={setSearchText}
              />
              <CommandList>
                <CommandEmpty>No glossary found.</CommandEmpty>
                <CommandGroup>
                  {availableGlossaries.map((glossary) => (
                    <CommandItem
                      key={glossary.itemId}
                      value={glossary.itemId}
                      onSelect={() => handleSelect(glossary)}
                    >
                      <div className="flex flex-1 items-center gap-2">
                        <span>{glossary.name}</span>
                        {glossary.type && (
                          <span className="text-xs text-muted-foreground">({glossary.type})</span>
                        )}
                      </div>
                      {selectedIds.includes(glossary.itemId) && (
                        <Check className="ml-auto h-4 w-4" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <DialogFooter className="gap-2 sm:gap-2">
        <DialogTrigger asChild>
          <Button variant="outline" size="default" className="flex-1 sm:flex-1">
            Cancel
          </Button>
        </DialogTrigger>
        <Button
          size="default"
          onClick={handleSave}
          disabled={isPending}
          className="flex-1 sm:flex-1"
        >
          {isPending ? "Updating..." : "Update"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default EditKeyGlossary;
