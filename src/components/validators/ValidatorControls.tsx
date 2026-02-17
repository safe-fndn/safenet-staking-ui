import { Input } from "@/components/ui/input"
import Search from "lucide-react/dist/esm/icons/search"

interface ValidatorControlsProps {
  search: string
  onSearchChange: (value: string) => void
}

export function ValidatorControls({
  search,
  onSearchChange,
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
    </div>
  )
}
