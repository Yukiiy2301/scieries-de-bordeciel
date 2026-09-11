import type { ReactNode } from "react";
import { PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RequestStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        <div className="deco-rule mt-3 max-w-xs" />
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-10 text-center">
      <PackageOpen className="h-8 w-8 text-muted-foreground/60" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

const STATUS_STYLES: Record<RequestStatus, { label: string; className: string }> = {
  pending: { label: "En attente", className: "bg-amber-500/15 text-amber-500 ring-amber-500/40" },
  validated: { label: "Validée", className: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/40" },
  rejected: { label: "Refusée", className: "bg-destructive/15 text-destructive ring-destructive/40" },
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <Badge variant="outline" className={cn("ring-1", s.className)}>
      {s.label}
    </Badge>
  );
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export const nativeSelectClass =
  "h-10 rounded-md border border-input bg-secondary px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50";
