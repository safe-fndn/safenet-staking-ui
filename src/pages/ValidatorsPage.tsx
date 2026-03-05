import { useSearchParams } from "react-router-dom"
import { isAddress } from "viem"
import { ValidatorList } from "@/components/validators/ValidatorList"

export function ValidatorsPage() {
  const [searchParams] = useSearchParams()
  const rawDelegate = searchParams.get("delegate")
  const delegateParam = rawDelegate && isAddress(rawDelegate) ? rawDelegate : undefined

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Safenet Validators</h1>
        <p className="text-muted-foreground">Select a validator to stake your SAFE tokens</p>
      </div>
      <ValidatorList autoOpenDelegate={delegateParam} />
    </div>
  )
}
