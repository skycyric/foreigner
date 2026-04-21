import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} strokeWidth={2.25} />;
}

export function LoadingOverlay({
  open,
  message,
}: {
  open: boolean;
  message?: string;
}) {
  if (!open) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background/70 backdrop-blur-sm"
    >
      <Loader2
        className="h-12 w-12 animate-spin text-primary"
        strokeWidth={2}
      />
      {message && (
        <p className="px-6 text-center text-sm font-medium text-foreground">
          {message}
        </p>
      )}
    </div>
  );
}
