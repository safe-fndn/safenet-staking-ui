import { useAccount } from "wagmi"
import { OwnerGuard } from "@/components/OwnerGuard"
import { ContractStatus } from "@/components/ContractStatus"
import { ProposeDelay } from "@/components/ProposeDelay"
import { ExecuteDelay } from "@/components/ExecuteDelay"
import { ProposeValidators } from "@/components/ProposeValidators"
import { ExecuteValidators } from "@/components/ExecuteValidators"
import { RecoverTokens } from "@/components/RecoverTokens"
import { MintToken } from "@/components/MintToken"
import { EventLog } from "@/components/EventLog"
import { ConnectButton } from "@/components/wallet/ConnectButton"

export function AdminPage() {
  const { isConnected } = useAccount()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <p className="text-muted-foreground">Manage the SAFE staking contract</p>
      </div>

      {!isConnected ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-12 text-center">
          <p className="text-lg font-medium">Connect your wallet to continue</p>
          <p className="text-sm text-muted-foreground">
            You need to connect with the contract owner wallet to use admin functions.
          </p>
          <ConnectButton />
        </div>
      ) : (
        <>
          <OwnerGuard />

          <ContractStatus />

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Withdraw Delay</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              <ProposeDelay />
              <ExecuteDelay />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Validator Management</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              <ProposeValidators />
              <ExecuteValidators />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Token Operations</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              <MintToken />
              <RecoverTokens />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Event Log</h2>
            <EventLog />
          </section>
        </>
      )}
    </div>
  )
}
