import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"

export type StatusFilter = "all" | "active" | "inactive"
export type SortOption = "totalStake" | "commission" | "uptime"

interface ValidatorControlsProps {
  search: string
  onSearchChange: (value: string) => void
  statusFilter: StatusFilter
  onStatusFilterChange: (value: StatusFilter) => void
  sortBy: SortOption
  onSortChange: (value: SortOption) => void
}

const statusOptions: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
]

const sortOptions: { label: string; value: SortOption }[] = [
  { label: "Total Stake", value: "totalStake" },
  { label: "Commission", value: "commission" },
  { label: "Uptime", value: "uptime" },
]

export function ValidatorControls({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortChange,
}: ValidatorControlsProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or address..."
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
      <select
        className="h-8 rounded-md border bg-background px-3 text-sm"
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value as SortOption)}
      >
        {sortOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            Sort: {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
