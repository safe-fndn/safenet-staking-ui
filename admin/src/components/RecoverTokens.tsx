import { useState, useEffect } from "react"
import { isAddress, type Address } from "viem"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useRecoverTokens } from "@/hooks/useAdminWrites"
import { useToast } from "@/hooks/useToast"
import { formatContractError } from "@/lib/errorFormat"
import { Loader2 } from "lucide-react"

export function RecoverTokens() {
  const [tokenAddress, setTokenAddress] = useState("")
  const [recipientAddress, setRecipientAddress] = useState("")
  const { recoverTokens, isPending, isSuccess, error, reset, txHash } = useRecoverTokens()
  const { toast } = useToast()

  useEffect(() => {
    if (isSuccess) {
      toast({ variant: "success", title: "Tokens recovered", description: `Tokens sent to ${recipientAddress.slice(0, 10)}...`, txHash: txHash! })
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form after successful tx
      setTokenAddress("")
      setRecipientAddress("")
      reset()
    }
  }, [isSuccess, reset, toast, recipientAddress, txHash])

  useEffect(() => {
    if (error) {
      toast({ variant: "error", title: "Recovery failed", description: formatContractError(error) })
    }
  }, [error, toast])

  const validToken = isAddress(tokenAddress)
  const validRecipient = isAddress(recipientAddress)
  const canSubmit = validToken && validRecipient && !isPending

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recover Tokens</CardTitle>
        <CardDescription>
          Recover tokens accidentally sent to the staking contract. This sends the full balance of the specified token to the recipient.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Token Address</label>
          <Input
            placeholder="0x... ERC-20 token address"
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            className={`font-mono ${tokenAddress && !validToken ? "border-destructive" : ""}`}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Recipient Address</label>
          <Input
            placeholder="0x... recipient address"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            className={`font-mono ${recipientAddress && !validRecipient ? "border-destructive" : ""}`}
          />
        </div>

        <Button
          onClick={() => recoverTokens(tokenAddress as Address, recipientAddress as Address)}
          disabled={!canSubmit}
          variant="destructive"
        >
          {isPending ? (
            <>
              <Loader2 className="animate-spin" />
              Recovering...
            </>
          ) : (
            "Recover Tokens"
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
