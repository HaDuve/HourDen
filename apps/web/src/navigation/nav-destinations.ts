import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import BarChart3 from "lucide-react/icons/bar-chart-3";
import Ellipsis from "lucide-react/icons/ellipsis";
import FileText from "lucide-react/icons/file-text";
import FolderKanban from "lucide-react/icons/folder-kanban";
import LayoutDashboard from "lucide-react/icons/layout-dashboard";
import Timer from "lucide-react/icons/timer";
import Upload from "lucide-react/icons/upload";
import User from "lucide-react/icons/user";

export type NavDestinationIcon = ComponentType<LucideProps>;

export const primaryNavDestinations = [
  { to: "dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "invoices", labelKey: "nav.invoices", icon: FileText },
] as const;

export const secondaryNavDestinations = [
  { to: "clients", labelKey: "nav.clients", icon: User },
  { to: "projects", labelKey: "nav.projects", icon: FolderKanban },
  { to: "report", labelKey: "nav.report", icon: BarChart3 },
  { to: "import", labelKey: "nav.import", icon: Upload },
] as const;

export const trackerNavIcon = Timer;
export const moreNavIcon = Ellipsis;

export const NAV_ICON_SIZE = 16;
export const NAV_ICON_STROKE_WIDTH = 1.75;
