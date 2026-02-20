import type { HTMLAttributes } from "react"
import { FileTextIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type DocumentCardProps = HTMLAttributes<HTMLButtonElement> & {
  title: string
  active?: boolean
  onSelect?: () => void
}

export function DocumentCard({
  title,
  active,
  onSelect,
  className,
  ...props
}: DocumentCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full max-w-xs items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
        "hover:bg-accent/50",
        active ? "border-primary/50 bg-accent" : "border-border bg-card",
        className,
      )}
      {...props}
    >
      <FileTextIcon className="size-5 shrink-0 text-muted-foreground" />
      <span className="truncate font-medium">{title}</span>
    </button>
  )
}
