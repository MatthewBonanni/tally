import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Upload,
  Target,
  Flag,
  BarChart3,
  Tags,
  Repeat,
  TrendingUp,
  Wand2,
  Settings,
  ChevronLeft,
  ChevronRight,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppStore } from "@/stores/useAppStore";

const iconMap = {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Upload,
  Target,
  Flag,
  BarChart3,
  Tags,
  Repeat,
  TrendingUp,
  Wand2,
  Settings,
} as const;

const navItems = [
  { path: "/", label: "Dashboard", icon: "LayoutDashboard" },
  { path: "/accounts", label: "Accounts", icon: "Wallet" },
  { path: "/transactions", label: "Transactions", icon: "ArrowLeftRight" },
  { path: "/import", label: "Import", icon: "Upload" },
  { path: "/budgets", label: "Budgets", icon: "Target" },
  { path: "/goals", label: "Goals", icon: "Flag" },
  { path: "/reports", label: "Reports", icon: "BarChart3" },
] as const;

const secondaryNavItems = [
  { path: "/categories", label: "Categories", icon: "Tags" },
  { path: "/recurring", label: "Recurring", icon: "Repeat" },
  { path: "/investments", label: "Investments", icon: "TrendingUp" },
  { path: "/rules", label: "Rules", icon: "Wand2" },
  { path: "/settings", label: "Settings", icon: "Settings" },
] as const;

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-card transition-all duration-300",
        sidebarCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <DollarSign className="h-5 w-5" />
          </div>
          {!sidebarCollapsed && (
            <span className="text-lg font-semibold">Tally</span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-2">
        <nav className="flex flex-col gap-1 px-2">
          {navItems.map((item) => {
            const Icon = iconMap[item.icon as keyof typeof iconMap];
            return (
              <NavItem
                key={item.path}
                path={item.path}
                label={item.label}
                icon={<Icon className="h-5 w-5" />}
                collapsed={sidebarCollapsed}
              />
            );
          })}

          <Separator className="my-2" />

          {secondaryNavItems.map((item) => {
            const Icon = iconMap[item.icon as keyof typeof iconMap];
            return (
              <NavItem
                key={item.path}
                path={item.path}
                label={item.label}
                icon={<Icon className="h-5 w-5" />}
                collapsed={sidebarCollapsed}
              />
            );
          })}
        </nav>
      </ScrollArea>

      {/* Collapse Toggle */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center"
          onClick={toggleSidebar}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Collapse
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}

interface NavItemProps {
  path: string;
  label: string;
  icon: React.ReactNode;
  collapsed: boolean;
}

function NavItem({ path, label, icon, collapsed }: NavItemProps) {
  const link = (
    <NavLink
      to={path}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          isActive
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground",
          collapsed && "justify-center px-2"
        )
      }
    >
      {icon}
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return link;
}
