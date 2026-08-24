import { Loader2, WifiOff, Wifi, CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConnectionState = "offline-only" | "connecting" | "synced" | "syncing" | "disconnected";

const CONFIG: Record<ConnectionState, { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
  "offline-only": { label: "Working offline", icon: CloudOff, className: "text-muted-foreground" },
  connecting: { label: "Connecting…", icon: Loader2, className: "text-muted-foreground animate-pulse" },
  syncing: { label: "Syncing…", icon: Loader2, className: "text-amber-600" },
  synced: { label: "All changes saved", icon: Wifi, className: "text-emerald-600" },
  disconnected: { label: "Offline — changes saved locally", icon: WifiOff, className: "text-muted-foreground" },
};

export function ConnectionStatus({ state }: { state: ConnectionState }) {
  const { label, icon: Icon, className } = CONFIG[state];
  return (
    <div className={cn("flex items-center gap-1.5 text-xs font-medium", className)}>
      <Icon className={cn("size-3.5", state === "connecting" && "animate-spin")} />
      <span>{label}</span>
    </div>
  );
}
