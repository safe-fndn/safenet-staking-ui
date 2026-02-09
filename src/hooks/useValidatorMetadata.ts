import validatorData from "@/data/validators.json"

interface ValidatorMetadata {
  label: string
  commission: number
  uptime: number
}

const metadata = validatorData as Record<string, ValidatorMetadata>

export function useValidatorMetadata(address: string): ValidatorMetadata | null {
  return metadata[address.toLowerCase()] ?? null
}
