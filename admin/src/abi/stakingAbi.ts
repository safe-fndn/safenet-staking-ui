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

  // Admin read functions
  "function owner() view returns (address)",
  "function pendingWithdrawDelayChange() view returns (uint128 value, uint128 executableAt)",
  "function pendingValidatorChangeHash() view returns (bytes32)",

  // Owner-only write functions
  "function proposeWithdrawDelay(uint128 newDelay)",
  "function proposeValidators(address[] validators, bool[] isRegistration)",
  "function recoverTokens(address token, address to)",

  // Public execute functions (after timelock)
  "function executeWithdrawDelayChange()",
  "function executeValidatorChanges(address[] validators, bool[] isRegistration, uint256 executableAt)",

  // User write functions
  "function stake(address validator, uint256 amount)",
  "function initiateWithdrawal(address validator, uint256 amount)",
  "function claimWithdrawal()",

  // Events
  "event StakeIncreased(address indexed staker, address indexed validator, uint256 amount)",
  "event WithdrawalInitiated(address indexed staker, address indexed validator, uint64 indexed withdrawalId, uint256 amount)",
  "event WithdrawalClaimed(address indexed staker, uint64 indexed withdrawalId, uint256 amount)",
  "event ValidatorUpdated(address indexed validator, bool isRegistered)",
  "event WithdrawDelayProposed(uint256 currentDelay, uint256 proposedDelay, uint256 executableAt)",
  "event ValidatorsProposed(bytes32 indexed validatorsHash, address[] validator, bool[] isRegistration, uint256 executableAt)",
  "event WithdrawDelayChanged(uint256 oldDelay, uint256 newDelay)",
  "event TokensRecovered(address indexed token, address indexed to, uint256 amount)",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",

  // Custom errors
  "error InvalidAmount()",
  "error InvalidAddress()",
  "error NotValidator()",
  "error InsufficientStake()",
  "error ProposalNotSet()",
  "error InvalidProposalHash()",
  "error ProposalNotExecutable()",
  "error NoProposalExists()",
  "error InsufficientRecoverableAmount()",
  "error WithdrawalQueueEmpty()",
  "error NoClaimableWithdrawal()",
  "error ArrayLengthMismatch()",
  "error InvalidParameter()",
  "error InvalidPreviousId()",
  "error InvalidOrdering()",
])
