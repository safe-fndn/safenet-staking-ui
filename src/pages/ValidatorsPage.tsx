import { useSearchParams } from "react-router-dom"
import { isAddress } from "viem"
import { ValidatorList } from "@/components/validators/ValidatorList"
import { PageHero } from "@/components/PageHero"
import heroSquare from "@/assets/hero-square.svg"

export function ValidatorsPage() {
  const [searchParams] = useSearchParams()
  const rawDelegate = searchParams.get("delegate")
  const delegateParam = rawDelegate && isAddress(rawDelegate) ? rawDelegate : undefined

  return (
    <div className="space-y-8">
      <PageHero
        illustration={heroSquare}
        illustrationAlt="Safe validator square"
        title="Safenet Validators"
        subtitle="Select a validator to stake your SAFE tokens"
        serialLabel="// 001"
        specLabel={'[ 3.5" SAFE SHIELD ]'}
      />
      <ValidatorList autoOpenDelegate={delegateParam} />
    </div>
  )
}
