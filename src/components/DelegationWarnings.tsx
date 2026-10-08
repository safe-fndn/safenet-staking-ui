import { useMemo } from "react"
import { Link } from "react-router-dom"
import { useAccount } from "wagmi"
import type { Address } from "viem"
import { useValidators, type ValidatorInfo } from "@/hooks/useValidators"
import { useUserStakesOnValidators } from "@/hooks/useStakingReads"
import { getDelegationWarnings, INACTIVE_WARNING, LOW_PARTICIPATION_WARNING } from "@/lib/delegationWarnings"
import AlertTriangle from "lucide-react/dist/esm/icons/triangle-alert"

function WarningBanner({
  message,
  validators,
  showValidators,
}: {
  message: string
  validators: ValidatorInfo[]
  showValidators: boolean
}) {
  return (
    <div role="alert" className="flex gap-3 border border-warning/50 bg-warning/10 p-4 text-sm text-warning">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="space-y-1">
        <p>{message}</p>
        {showValidators && (
          <p>
            Affected:{" "}
            {validators.map((v, i) => (
              <span key={v.address}>
                {i > 0 && ", "}
                <Link to={`/validators/${v.address}`} className="font-medium underline hover:no-underline">
                  {v.label}
                </Link>
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  )
}

export function DelegationWarningBanners({
  inactive,
  lowParticipation,
  showValidators = false,
}: {
  inactive: ValidatorInfo[]
  lowParticipation: ValidatorInfo[]
  showValidators?: boolean
}) {
  if (inactive.length === 0 && lowParticipation.length === 0) return null

  return (
    <div className="space-y-3">
      {inactive.length > 0 && (
        <WarningBanner message={INACTIVE_WARNING} validators={inactive} showValidators={showValidators} />
      )}
      {lowParticipation.length > 0 && (
        <WarningBanner message={LOW_PARTICIPATION_WARNING} validators={lowParticipation} showValidators={showValidators} />
      )}
    </div>
  )
}

/** Banners for every validator the connected wallet has stake on that is inactive or has low participation. */
export function WalletDelegationWarnings() {
  const { isConnected } = useAccount()
  const { data: validators } = useValidators()
  const validatorAddresses = useMemo(
    () => (validators ?? []).map((v) => v.address),
    [validators],
  )
  const { data: stakes } = useUserStakesOnValidators(validatorAddresses)

  const warnings = useMemo(() => {
    const stakeMap = new Map<Address, bigint>()
    if (!validators || !stakes) return null
    for (let i = 0; i < validators.length; i++) {
      const result = stakes[i]
      if (result?.status === "success" && typeof result.result === "bigint") {
        stakeMap.set(validators[i].address, result.result)
      }
    }
    return getDelegationWarnings(validators, (a) => stakeMap.get(a))
  }, [validators, stakes])

  if (!isConnected || !warnings) return null

  return <DelegationWarningBanners {...warnings} showValidators />
}
