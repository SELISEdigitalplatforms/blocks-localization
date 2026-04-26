import { CheckIcon, PlusCircledIcon } from "@radix-ui/react-icons";
import { cn } from "@/platform/ui/lib/cn";
import { usePopoverWidth } from "@/layouts/shell/hooks/use-popover-width";

import { useIsMobile } from "@/layouts/shell/hooks/use-is-mobile";
import { Popover, PopoverContent, PopoverTrigger } from "@/platform/ui/components/popover/popover";
import { Button } from "@/platform/ui/components/button/button";
import { Separator } from "@/platform/ui/components/separator/separator";
import { Badge } from "@/platform/ui/components/badge/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/platform/ui/components/command/command";
import { useEffect, useState } from "react";

interface MultiSelectProps {
  title?: string;
  options: {
    label: string;
    value: string;
  }[];
  selected: string[];
  onSelectChange: (value: unknown) => void;
}

export function MultiSelect({ title, options, onSelectChange, selected }: MultiSelectProps) {
  const [selectedValues, setSelectedValues] = useState<string[]>(selected);
  const [buttonRef, popoverWidth] = usePopoverWidth();

  useEffect(() => {
    //
  }, [selectedValues]);

  const onSelectHandler = (value: string) => {
    if (selectedValues.includes(value)) selectedValues.splice(selectedValues.indexOf(value), 1);
    else selectedValues.push(value);
    onSelectChange(selectedValues);
    setSelectedValues([...selectedValues]);
  };
  const onResetHandler = () => {
    onSelectChange([]);
    setSelectedValues([]);
  };
  const isMobile = useIsMobile();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button ref={buttonRef} variant="outline" size="sm" className="h-8 border-dashed">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center">
              <PlusCircledIcon className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">{title}</span>
              <span className="sm:hidden">{title?.split(" ")[0]}</span>
            </div>
            {selectedValues?.length > 0 && (
              <>
                <Separator orientation="vertical" className="hidden h-4 sm:mx-2 sm:block" />

                <div className="flex space-x-1">
                  {selectedValues.length > 2 ? (
                    <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                      {selectedValues.length} selected
                    </Badge>
                  ) : (
                    options
                      .filter((option) => selectedValues.includes(option.value))
                      .map((option) => (
                        <Badge
                          variant="secondary"
                          key={option.value}
                          className="rounded-sm px-1 font-normal"
                        >
                          {option.label}
                        </Badge>
                      ))
                  )}
                </div>
              </>
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 sm:w-full"
        align="start"
        style={isMobile ? { width: popoverWidth ? `${popoverWidth}px` : "auto" } : undefined}
      >
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <CommandItem key={option.value} onSelect={() => onSelectHandler(option.value)}>
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible",
                      )}
                    >
                      <CheckIcon className={cn("h-4 w-4")} />
                    </div>
                    <span>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selectedValues.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onResetHandler()}
                    className="justify-center text-center"
                  >
                    Clear
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
