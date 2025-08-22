# KommuneFi Contracts - External Audit Documentation

## Executive Summary

KommuneFi is a multi-LST yield optimization vault on KAIA blockchain that automatically distributes user deposits across multiple Liquid Staking Token (LST) protocols based on APY optimization. The protocol uses ERC-4626 standard for maximum compatibility and security.

## Audit Scope

### In-Scope Contracts

| Contract | Location | Size | Purpose |
|----------|----------|------|---------|
| ShareVault | `src/ShareVault.sol` | 10.2 KB | ERC-4626 vault shares management |
| VaultCore | `src/VaultCore.sol` | 19.4 KB | Core vault logic and LST management |
| SwapContract | `src/SwapContract.sol` | 7.3 KB | Balancer V2 swap integration |
| ClaimManager | `src/ClaimManager.sol` | 4.0 KB | Unstake/claim operations |
| SharedStorage | `src/SharedStorage.sol` | 1.0 KB | Storage layout for delegatecall |
| LPCalculations | `src/libraries/LPCalculations.sol` | 1.4 KB | LP token value calculations |
| Errors | `src/libraries/Errors.sol` | 0.5 KB | Custom error definitions |

### Out-of-Scope
- Test scripts in `scripts/` directory
- Interface definitions in `src/interfaces/`
- Legacy contracts (`KommuneVault.sol`, `KommuneVaultV2.sol`)

## Architecture Overview

```
User
  ↓
ShareVault (ERC-4626)
  ↓
VaultCore (Logic)
  ├→ LST Protocols (4 tokens)
  ├→ SwapContract (withdrawals)
  ├→ ClaimManager (delegatecall)
  └→ Balancer Pools (LP)
```

## Key Security Features

### 1. Standard ERC-4626 Implementation
- No custom deposit patterns
- Standard approve + transferFrom flow
- Prevents front-running vulnerabilities

### 2. Access Control
- Owner-only administrative functions
- Authorized caller pattern for SwapContract
- No use of tx.origin

### 3. Storage Safety
- SharedStorage base contract for delegatecall
- Identical storage layout across contracts
- UUPS upgradeable pattern

### 4. Reentrancy Protection
- ReentrancyGuard on all entry points
- Check-effects-interactions pattern

## Investment Strategies

### Stable (Default)
- 90% to LST staking
- 10% liquidity buffer
- Lowest risk profile

### Balanced
- 45% to LST staking
- 45% to Balancer LP
- Medium risk/reward

### Aggressive (Future)
- Reserved for future strategies
- Currently inactive

## Critical Functions to Review

### Deposit Flow
1. `ShareVault.depositKAIA()` - Native KAIA deposits
2. `ShareVault.deposit()` - WKAIA deposits (converts to KAIA internally)
3. `VaultCore.handleDepositKAIA()` - Processes deposits and distributes to LSTs

### Withdrawal Flow
1. `ShareVault.withdraw()` - User initiates withdrawal
2. `VaultCore.handleWithdraw()` - Processes withdrawal
3. `SwapContract.swapGivenOut()` - Swaps LSTs for exact WKAIA output

### Investment Management
1. `VaultCore._investToLSTs()` - Distributes funds based on APY
2. `VaultCore._addLSTsToPool1()` - Adds liquidity to Balancer pools
3. `VaultCore._removeLiquidityFromPool1()` - Removes liquidity when needed

### Admin Functions
1. `VaultCore.setAPY()` - Configure LST APY values
2. `VaultCore.setInvestmentRatios()` - Set investment strategy
3. `VaultCore.unstake()` - Owner-only LST unstaking
4. `VaultCore.claim()` - Owner-only reward claiming

## Known Design Decisions

### 1. Owner-Only Unstake/Claim
- **Decision**: Only protocol owner can unstake/claim
- **Rationale**: Prevents users from disrupting protocol operations
- **Impact**: Centralization trade-off for security

### 2. 10% Slippage Tolerance
- **Decision**: High slippage tolerance for swaps
- **Rationale**: Testnet liquidity conditions
- **Impact**: Should be reduced for mainnet

### 3. Single LP Token Tracking
- **Decision**: All LSTs share same Balancer pool
- **Rationale**: Simplifies tracking and reduces gas costs
- **Impact**: Less granular accounting

### 4. WKAIA State Sync Workaround
- **Decision**: Convert WKAIA to KAIA in ShareVault
- **Rationale**: WKAIA implementation has state sync issues
- **Impact**: Extra conversion step but more reliable

## Testing Coverage

### Unit Tests
- Run with: `npx hardhat test`
- Coverage: Core functionality

### Integration Tests
- Deposit/Withdraw: `scripts/tests/testDepositWithdraw.js`
- Unstake/Claim: `scripts/tests/testUnstakeClaim.js`
- Upgrades: `scripts/testUpgrades.js`

### Test Results
- ✅ All deposits (KAIA & WKAIA) working
- ✅ All withdrawals (partial & full) working
- ✅ LST distribution verified
- ✅ LP integration tested
- ✅ Upgrade safety confirmed

## Gas Optimization

### Implemented Optimizations
1. External library for LP calculations
2. Custom errors instead of strings
3. Aggressive compiler optimization (runs: 1)
4. Batch operations where possible

### Compiler Settings
```javascript
optimizer: {
  enabled: true,
  runs: 1,
  details: {
    yul: true,
    yulDetails: {
      stackAllocation: true,
      optimizerSteps: "dhfoDgvulfnTUtnIf[...]"
    }
  }
}
```

## Deployment Information

### Kairos Testnet (Current)
- ShareVault: `0xF43BdDA5bc0693d952a68ABc4E0D8262A874b74e`
- VaultCore: `0x09bE7a4bf8c0bB28725A9369484b0852cD70cBE8`
- SwapContract: `0x5D83C399c3bFf4fE86627eA8680431c5b8084320`
- ClaimManager: `0x72C44A898dfD0cf4689DF795D188e19049a2d996`

### External Dependencies
- WKAIA: `0x0339d5Eb6D195Ba90B13ed1BCeAa97EbD198b106`
- Balancer Vault: `0x1c9074AA147648567015287B0d4185Cb4E04F86d`

## Audit Checklist

### Access Control
- [ ] All admin functions have proper modifiers
- [ ] No unauthorized access to critical functions
- [ ] Proper use of onlyOwner pattern

### Reentrancy
- [ ] All external calls follow CEI pattern
- [ ] ReentrancyGuard properly implemented
- [ ] No cross-function reentrancy

### Math Operations
- [ ] No integer overflow/underflow
- [ ] Proper decimal handling
- [ ] Rounding in user's favor

### External Calls
- [ ] All external contracts validated
- [ ] Return values checked
- [ ] Gas limits considered

### Upgradeability
- [ ] Storage layout consistency
- [ ] Initializer protection
- [ ] Upgrade authorization

### Economic Security
- [ ] No flash loan vulnerabilities
- [ ] Slippage protection adequate
- [ ] Fee calculations correct

## Contact Information

For questions during the audit:
- Technical Lead: [Contact Information]
- GitHub: https://github.com/KommuneFi
- Documentation: See README.md and CLAUDE.md

## Additional Resources

- `README.md` - General project documentation
- `CLAUDE.md` - Detailed technical documentation
- `docs/INVESTMENT_PROFILES.md` - Investment strategy details
- `docs/BALANCED_STRATEGY.md` - Balancer integration details

---

**Audit Start Date**: [To be filled]
**Audit End Date**: [To be filled]
**Auditor**: [To be filled]