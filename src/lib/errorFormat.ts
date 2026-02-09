const CUSTOM_ERROR_MESSAGES: Record<string, string> = {
  InvalidAmount: "Amount must be greater than zero",
  NotValidator: "This validator is not registered",
  InsufficientStake: "Insufficient delegation balance",
  WithdrawalQueueEmpty: "No pending withdrawals to claim",
  NoClaimableWithdrawal: "No withdrawal is ready to claim yet",
  InvalidAddress: "Invalid address provided",
}

export function formatContractError(error: Error): string {
  const msg = error.message || ""

  // 1. User rejected
  if (msg.includes("User rejected") || msg.includes("user rejected")) {
    return "Transaction rejected"
  }

  // 2. Known custom error name (viem decoded)
  const customMatch = msg.match(/reverted with custom error '(\w+)\(/i)
  if (customMatch) {
    const name = customMatch[1]
    if (CUSTOM_ERROR_MESSAGES[name]) return CUSTOM_ERROR_MESSAGES[name]
    return name
  }

  // 2b. Signature-based custom error with name in message
  const nameMatch = msg.match(/error (\w+)\(\)/i)
  if (nameMatch) {
    const name = nameMatch[1]
    if (CUSTOM_ERROR_MESSAGES[name]) return CUSTOM_ERROR_MESSAGES[name]
    return name
  }

  // 3. Solidity revert reason string
  const reasonMatch = msg.match(/reverted with the following reason:\s*\n?\s*(.+)/i)
  if (reasonMatch) return reasonMatch[1].trim()

  // 4. Insufficient funds for gas
  if (
    msg.includes("insufficient funds") ||
    msg.includes("exceeds the balance") ||
    msg.includes("not enough funds")
  ) {
    return "Insufficient ETH for gas fees"
  }

  // 5. Network/RPC error
  if (
    msg.includes("network") ||
    msg.includes("disconnected") ||
    msg.includes("timeout") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("could not coalesce")
  ) {
    return "Network error — please try again"
  }

  // 6. Fallback — truncated message
  return msg.slice(0, 200)
}
