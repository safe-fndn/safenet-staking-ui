import { parseAbi } from "viem"

export const stakingAbi = parseAbi([
  // Read functions
  "function SAFE_TOKEN() view returns (address)",
  "function CONFIG_TIME_DELAY() view returns (uint256)",
  "function totalStakedAmount() view returns (uint256)",
  "function totalPendingWithdrawals() view returns (uint256)",
  "function withdrawDelay() view returns (uint128)",
  "function nextWithdrawalId() view returns (uint64)",
  "function isValidator(address validator) view returns (bool)",
  "function totalValidatorStakes(address validator) view returns (uint256)",
  "function stakes(address staker, address validator) view returns (uint256)",
  "function totalStakerStakes(address staker) view returns (uint256)",
  "function withdrawalQueues(address staker) view returns (uint64 head, uint64 tail)",
  "function getPendingWithdrawals(address staker) view returns ((uint256 amount, uint256 claimableAt)[])",
  "function getNextClaimableWithdrawal(address staker) view returns (uint256 amount, uint256 claimableAt)",

  // Write functions
  "function stake(address validator, uint256 amount)",
  "function initiateWithdrawal(address validator, uint256 amount)",
  "function claimWithdrawal()",

  // Events
  "event StakeIncreased(address indexed staker, address indexed validator, uint256 amount)",
  "event WithdrawalInitiated(address indexed staker, address indexed validator, uint64 indexed withdrawalId, uint256 amount)",
  "event WithdrawalClaimed(address indexed staker, uint64 indexed withdrawalId, uint256 amount)",
  "event ValidatorUpdated(address indexed validator, bool isRegistered)",

  // Custom errors
  "error InvalidAmount()",
  "error NotValidator()",
  "error InsufficientStake()",
  "error WithdrawalQueueEmpty()",
  "error NoClaimableWithdrawal()",
  "error InvalidAddress()",
])
