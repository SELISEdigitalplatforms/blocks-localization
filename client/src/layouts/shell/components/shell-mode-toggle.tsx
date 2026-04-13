import { Button } from "@/platform/ui/components/button/button";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

function readDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function ShellModeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(readDark());
  }, []);

  const toggle = () => {
    const next = !readDark();
    document.documentElement.classList.toggle("dark", next);
    setDark(next);
  };

  return (
    <Button type="button" onClick={toggle} variant="ghost" size="icon" className="relative h-8 w-8">
      <Moon
        className={`aspect-square w-5 transition-all ${dark ? "rotate-90 scale-0" : "rotate-0 scale-100"}`}
      />
      <Sun
        className={`absolute aspect-square w-5 transition-all ${dark ? "rotate-0 scale-100" : "rotate-90 scale-0"}`}
      />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
