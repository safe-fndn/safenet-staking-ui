import { useSearchParams } from "react-router-dom"
import { ValidatorList } from "@/components/validators/ValidatorList"

export function ValidatorsPage() {
  const [searchParams] = useSearchParams()
  const delegateParam = searchParams.get("delegate") ?? undefined

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Validators</h1>
        <p className="text-muted-foreground">Browse validators and delegate your SAFE tokens</p>
      </div>
      <ValidatorList autoOpenDelegate={delegateParam} />
    </div>
  )
}
