import React from "react";
import { Label } from "@/components/ui-kits/label/label";
import {
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogDescription,
} from "@/components/ui-kits/dialog/dialog";
import { Button } from "@/components/ui-kits/button/button";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { Input } from "@/components/ui-kits/input/input";
import { Textarea } from "@/components/ui-kits/textarea/textarea";

interface EditKeyProps {
  data?: string[];
}

const EditKey: React.FC<EditKeyProps> = () => (
  <DialogContent className="rounded-md sm:max-w-[425px]">
    <DialogHeader>
      <DialogTitle className="text-left">Edit key</DialogTitle>
      <div className="!mt-4 grid gap-6">
        <div>
          <Label htmlFor="key" className="text-left font-medium text-high-emphasis">
            Key
          </Label>
          <Input
            id="key"
            placeholder="Enter key name"
            className="border-default col-span-3 mt-1 border shadow-none"
          />
        </div>
        <div>
          <Label htmlFor="module" className="text-left font-medium text-high-emphasis">
            Module
          </Label>
          <Input
            id="module"
            placeholder="Enter module name"
            className="border-default col-span-3 mt-1 border shadow-none"
          />
        </div>
        <div>
          <Label htmlFor="value" className="text-left font-medium text-high-emphasis">
            Value
          </Label>
          <Textarea
            id="value"
            className="border-default col-span-3 mt-1 min-h-[116px] border shadow-none"
            placeholder="Enter translation"
          />
          <h3 className="mt-2 text-medium-emphasis">Default language is english.</h3>
        </div>
      </div>
      <DialogDescription></DialogDescription>
    </DialogHeader>
    <DialogFooter className="flex flex-row gap-2">
      <DialogTrigger asChild>
        <Button variant="outline" size="default">
          Cancel
        </Button>
      </DialogTrigger>
      <DialogTrigger asChild>
        <Button size="default">Save</Button>
      </DialogTrigger>
    </DialogFooter>
  </DialogContent>
);

export default EditKey;
