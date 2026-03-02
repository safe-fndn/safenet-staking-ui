import { useState, useEffect, useRef } from "react"
import { isHex, type Hex } from "viem"
import { useReadContract } from "wagmi"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useSetMerkleRoot } from "@/hooks/useAdminWrites"
import { useToast } from "@/hooks/useToast"
import { formatContractError } from "@/lib/errorFormat"
import { merkleDropAbi } from "@/abi/merkleDropAbi"
import { getContractAddresses } from "@/config/contracts"
import { activeChain } from "@/config/chains"
import { Loader2 } from "lucide-react"

const { merkleDrop } = getContractAddresses(activeChain.id)

function isBytes32(value: string): value is Hex {
  return isHex(value) && value.length === 66
}

export function SetMerkleRoot() {
  const [root, setRoot] = useState("")
  const submittedRoot = useRef("")
  const { setMerkleRoot, isPending, isSuccess, error, reset, txHash } = useSetMerkleRoot()
  const { toast } = useToast()

  const { data: currentRoot } = useReadContract({
    address: merkleDrop,
    abi: merkleDropAbi,
    functionName: "merkleRoot",
    query: { enabled: !!merkleDrop },
  })

  useEffect(() => {
    if (isSuccess) {
      const r = submittedRoot.current
      toast({
        variant: "success",
        title: "Merkle root updated",
        description: `Root set to ${r.slice(0, 10)}...${r.slice(-6)}`,
        txHash: txHash!,
      })
      reset()
    }
  }, [isSuccess, reset, toast, txHash])

  useEffect(() => {
    if (error) {
      toast({ variant: "error", title: "Set root failed", description: formatContractError(error) })
    }
  }, [error, toast])

  const validRoot = isBytes32(root)
  const canSubmit = validRoot && !isPending

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set Merkle Root</CardTitle>
        <CardDescription>
          Update the Merkle root on the MerkleDrop contract for reward distribution.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentRoot && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Current Root</label>
            <p className="break-all font-mono text-xs text-muted-foreground">
              {currentRoot}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">New Merkle Root</label>
          <Input
            placeholder="0x... (bytes32)"
            value={root}
            onChange={(e) => setRoot(e.target.value)}
            className={`font-mono ${root && !validRoot ? "border-destructive" : ""}`}
          />
          {root && !validRoot && (
            <p className="text-xs text-destructive">
              Must be a valid bytes32 hex string (66 characters starting with 0x)
            </p>
          )}
        </div>

        <Button
          onClick={() => {
            submittedRoot.current = root
            setRoot("")
            setMerkleRoot(root as Hex)
          }}
          disabled={!canSubmit}
        >
          {isPending ? (
            <>
              <Loader2 className="animate-spin" />
              Setting Root...
            </>
          ) : (
            "Set Merkle Root"
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
