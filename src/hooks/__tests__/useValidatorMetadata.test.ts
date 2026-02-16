import { describe, it, expect } from "vitest"
import { useValidatorMetadata } from "../useValidatorMetadata"
import { TEST_ACCOUNTS } from "@/__tests__/test-data"

describe("useValidatorMetadata", () => {
  it("returns metadata for a known validator (lowercase match)", () => {
    const result = useValidatorMetadata(TEST_ACCOUNTS.validator1)
    expect(result).toEqual({ label: "Gnosis", commission: 5, uptime: 99.9 })
  })

  it("returns metadata for uppercase address", () => {
    const upper = TEST_ACCOUNTS.validator1.toUpperCase()
    // validators.json keys are lowercase; hook lowercases input
    const result = useValidatorMetadata(upper)
    expect(result).toEqual({ label: "Gnosis", commission: 5, uptime: 99.9 })
  })

  it("returns null for unknown validator", () => {
    const result = useValidatorMetadata("0x0000000000000000000000000000000000000099")
    expect(result).toBeNull()
  })

  it("returns second validator metadata", () => {
    const result = useValidatorMetadata(TEST_ACCOUNTS.validator2)
    expect(result).toEqual({ label: "Greenfield", commission: 4, uptime: 99.7 })
  })
})
