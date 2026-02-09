import { useAccount } from "wagmi"
import { useOwner } from "@/hooks/useAdminReads"
import { truncateAddress } from "@/lib/format"

export function OwnerGuard() {
  const { address, isConnected } = useAccount()
  const { data: owner } = useOwner()

  if (!isConnected) {
    return (
      <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 text-sm text-yellow-700 dark:text-yellow-400">
        Connect your wallet to use admin functions.
      </div>
    )
  }

  if (owner && address && address.toLowerCase() !== (owner as string).toLowerCase()) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Connected wallet ({truncateAddress(address)}) is not the contract owner ({truncateAddress(owner as string)}).
        Admin transactions will revert.
      </div>
    )
  }

  return null
}
