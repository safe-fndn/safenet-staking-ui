import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import Search from "lucide-react/dist/esm/icons/search"

export type StatusFilter = "all" | "active" | "inactive"

interface ValidatorControlsProps {
  search: string
  onSearchChange: (value: string) => void
  statusFilter: StatusFilter
  onStatusFilterChange: (value: StatusFilter) => void
}

const statusOptions: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
]

export function ValidatorControls({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: ValidatorControlsProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          placeholder="Search by name or address…"
          name="validator-search"
          autoComplete="off"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex gap-2">
        {statusOptions.map((opt) => (
          <Button
            key={opt.value}
            variant={statusFilter === opt.value ? "default" : "outline"}
            size="sm"
            onClick={() => onStatusFilterChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
