import { useState, useEffect } from "react"
import { isAddress, parseEther, type Address } from "viem"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useMintToken } from "@/hooks/useAdminWrites"
import { useToast } from "@/hooks/useToast"
import { formatContractError } from "@/lib/errorFormat"
import { Loader2 } from "lucide-react"

export function MintToken() {
  const [recipientAddress, setRecipientAddress] = useState("")
  const [amount, setAmount] = useState("")
  const { mintToken, isPending, isSuccess, error, reset, txHash } = useMintToken()
  const { toast } = useToast()

  useEffect(() => {
    if (isSuccess) {
      toast({ variant: "success", title: "Tokens minted", description: `Minted ${amount} SAFE to ${recipientAddress.slice(0, 10)}...`, txHash: txHash! })
      setRecipientAddress("")
      setAmount("")
      reset()
    }
  }, [isSuccess, reset, toast, amount, recipientAddress, txHash])

  useEffect(() => {
    if (error) {
      toast({ variant: "error", title: "Mint failed", description: formatContractError(error) })
    }
  }, [error, toast])

  const validRecipient = isAddress(recipientAddress)
  let parsedAmount = 0n
  try { if (amount) parsedAmount = parseEther(amount) } catch { /* invalid */ }
  const validAmount = parsedAmount > 0n
  const canSubmit = validRecipient && validAmount && !isPending

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mint SAFE Tokens</CardTitle>
        <CardDescription>
          Mint SAFE tokens to any address. Only available to token owner/minter.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Recipient Address</label>
          <Input
            placeholder="0x... recipient address"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            className={`font-mono ${recipientAddress && !validRecipient ? "border-destructive" : ""}`}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Amount (SAFE)</label>
          <Input
            placeholder="1000"
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <Button
          onClick={() => mintToken(recipientAddress as Address, parsedAmount)}
          disabled={!canSubmit}
        >
          {isPending ? (
            <>
              <Loader2 className="animate-spin" />
              Minting...
            </>
          ) : (
            "Mint Tokens"
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
