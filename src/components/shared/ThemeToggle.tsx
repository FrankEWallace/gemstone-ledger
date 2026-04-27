import { useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [spinning, setSpinning] = useState(false);

  const Icon = theme === "system"
    ? Monitor
    : resolvedTheme === "dark" ? Moon : Sun;

  function handleSetTheme(t: "light" | "dark" | "system") {
    setSpinning(true);
    setTheme(t);
    setTimeout(() => setSpinning(false), 500);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" title="Toggle theme">
          <Icon className={cn("h-4 w-4 transition-transform duration-500", spinning && "rotate-[180deg]")} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleSetTheme("light")} className="gap-2">
          <Sun className="h-4 w-4" />
          Light
          {theme === "light" && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSetTheme("dark")} className="gap-2">
          <Moon className="h-4 w-4" />
          Dark
          {theme === "dark" && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSetTheme("system")} className="gap-2">
          <Monitor className="h-4 w-4" />
          System
          {theme === "system" && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
