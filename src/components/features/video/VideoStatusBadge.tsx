import { Badge } from "@/components/ui/badge";

type StatusConfig = {
  label: string;
  className: string;
};

const statusConfig: Record<string, StatusConfig> = {
  pending: {
    label: "Pending",
    className:
      "bg-muted text-muted-foreground border-muted-foreground/30",
  },
  processing: {
    label: "Processing",
    className:
      "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  completed: {
    label: "Ready",
    className:
      "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400",
  },
};

export function VideoStatusBadge({ status }: { status: string | null }) {
  if (status === "failed") {
    return <Badge variant="destructive">Failed</Badge>;
  }

  const config = statusConfig[status ?? "pending"] ?? statusConfig.pending;

  return (
    <Badge variant="outline" className={config.className}>
      {status === "processing" && (
        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
      )}
      {config.label}
    </Badge>
  );
}
