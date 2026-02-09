export function formatContractError(error: Error): string {
  const msg = error.message || ""

  // Extract custom error name from viem error format
  const signatureMatch = msg.match(/reverted with the following signature:\s*0x[a-f0-9]+/i)
  if (signatureMatch) {
    // Check for known error names in the message
    const nameMatch = msg.match(/error (\w+)\(\)/i)
    if (nameMatch) return nameMatch[1]
  }

  // Viem decoded custom error
  const customMatch = msg.match(/reverted with custom error '(\w+)\(\)'/i)
  if (customMatch) return customMatch[1]

  // Solidity revert reason string
  const reasonMatch = msg.match(/reverted with the following reason:\s*\n?\s*(.+)/i)
  if (reasonMatch) return reasonMatch[1].trim()

  // User rejected
  if (msg.includes("User rejected") || msg.includes("user rejected")) {
    return "Transaction rejected by user"
  }

  // Truncate raw message
  return msg.slice(0, 150)
}
