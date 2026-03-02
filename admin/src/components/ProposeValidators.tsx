import { useState, useEffect } from "react"
import { isAddress, type Address } from "viem"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useProposeValidators } from "@/hooks/useAdminWrites"
import { useToast } from "@/hooks/useToast"
import { formatContractError } from "@/lib/errorFormat"
import Loader2 from "lucide-react/dist/esm/icons/loader-2"
import Plus from "lucide-react/dist/esm/icons/plus"
import Trash2 from "lucide-react/dist/esm/icons/trash-2"

interface ValidatorRow {
  address: string
  register: boolean
}

export function ProposeValidators() {
  const [rows, setRows] = useState<ValidatorRow[]>([{ address: "", register: true }])
  const { proposeValidators, isPending, isSuccess, error, reset, txHash } = useProposeValidators()
  const { toast } = useToast()

  useEffect(() => {
    if (isSuccess) {
      toast({ variant: "success", title: "Validator proposal submitted", description: `Proposed ${rows.length} validator change(s)`, txHash: txHash! })
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form after successful tx
      setRows([{ address: "", register: true }])
      reset()
    }
  }, [isSuccess, reset, toast, rows.length, txHash])

  useEffect(() => {
    if (error) {
      toast({ variant: "error", title: "Proposal failed", description: formatContractError(error) })
    }
  }, [error, toast])

  const addRow = () => {
    setRows((prev) => [...prev, { address: "", register: true }])
  }

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  const updateRow = (index: number, field: keyof ValidatorRow, value: string | boolean) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  const allValid = rows.length > 0 && rows.every((row) => isAddress(row.address))
  const canSubmit = allValid && !isPending

  const handleSubmit = () => {
    const validators = rows.map((r) => r.address as Address)
    const isRegistration = rows.map((r) => r.register)
    proposeValidators(validators, isRegistration)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Propose Validators</CardTitle>
        <CardDescription>
          Propose validator registration or deregistration. Add multiple rows for batch changes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                placeholder="0x... validator address"
                value={row.address}
                onChange={(e) => updateRow(index, "address", e.target.value)}
                className={`flex-1 font-mono ${row.address && !isAddress(row.address) ? "border-destructive" : ""}`}
              />
              <select
                value={row.register ? "register" : "deregister"}
                onChange={(e) => updateRow(index, "register", e.target.value === "register")}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="register">Register</option>
                <option value="deregister">Deregister</option>
              </select>
              {rows.length > 1 && (
                <Button variant="ghost" size="icon" onClick={() => removeRow(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-4 w-4" />
          Add Validator
        </Button>

        <div>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Proposing...
              </>
            ) : (
              `Propose ${rows.length} Validator Change${rows.length > 1 ? "s" : ""}`
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
