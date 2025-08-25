# KommuneFi Contracts ERC20

Multi-LST yield optimization vault with automated staking strategies on KAIA blockchain.

## 🔒 Audit Status
**Ready for external audit** - All critical and high-risk issues resolved.

## Project Structure

```
src/
├── ShareVault.sol         # ERC-4626 compliant share management (10.2 KB)
├── VaultCore.sol          # Core vault logic with LST management (19.4 KB)
├── SwapContract.sol       # Balancer swap integration (7.3 KB) [FINALIZED]
├── ClaimManager.sol       # Unstake/claim operations (4.0 KB)
├── SharedStorage.sol      # Shared storage layout for delegatecall
├── interfaces/            # External protocol interfaces
│   ├── IBalancerVault.sol
│   ├── ITokenInfo.sol
│   └── [LST interfaces]
└── libraries/
    ├── LPCalculations.sol # LP token value calculations
    └── Errors.sol         # Custom error definitions

scripts/
├── deployFresh.js         # Fresh deployment script
├── upgradeAll.js          # Upgrade all contracts
├── setAPY.js              # Configure APY settings
├── recoverSwapAssets.js   # Recover stranded assets from SwapContract
└── tests/                 # Integration test suite

docs/
├── INVESTMENT_PROFILES.md # Investment strategy documentation
├── BALANCED_STRATEGY.md   # Balancer pool integration
└── archive/               # Historical documentation
```

## Features

### Core Functionality
- **Multi-LST Support**: Integrates 4 major LSTs (wKoKAIA, wGCKAIA, wstKLAY, stKAIA)
- **ERC-4626 Compliant**: Standard vault interface for maximum compatibility
- **Automated Yield Optimization**: Dynamic APY-based allocation across LSTs
- **Balancer Integration**: Efficient swaps via Balancer V2 pools
- **Investment Profiles**: Configurable risk profiles (Stable, Balanced, Aggressive)

### Security Features
- **Standard ERC-4626 Pattern**: No custom deposit patterns, prevents front-running
- **Owner-Only Operations**: Unstake/claim restricted to owner for security
- **Slippage Protection**: 10% slippage tolerance for testnet conditions
- **Delegatecall Safety**: SharedStorage pattern prevents storage collisions
- **Optimized Contract Size**: 19.4 KB (well below 24.576 KB limit)

## Deployment

### Prerequisites
- Node.js 16+
- Hardhat 2.19+
- KAIA testnet (Kairos) or mainnet account with KAIA
- Environment variables configured in `.env`

### Deploy
```bash
# Fresh deployment to Kairos testnet
npx hardhat run scripts/deployFresh.js --network kairos

# Fresh deployment to KAIA mainnet
npx hardhat run scripts/deployFresh.js --network kaia

# Deploy with specific profile
npx hardhat run scripts/deployWithProfile.js --network kairos
```

### Upgrade
```bash
# Upgrade all contracts
npx hardhat run scripts/upgradeAll.js --network kairos

# Upgrade specific contract
npx hardhat run scripts/upgradeVaultCore.js --network kairos
npx hardhat run scripts/upgradeShareVault.js --network kairos
npx hardhat run scripts/upgradeSwapContract.js --network kairos
```

## Testing

### Unit Tests
```bash
# Run all unit tests
npx hardhat test
```

### Integration Tests
```bash
# Integrated tests (separated by investment mode)
# Test STABLE mode (90% LST staking only)
npx hardhat run scripts/tests/testIntegratedStable.js --network kairos

# Test BALANCED mode (50% of LST → LP, 50% remains as LST)
npx hardhat run scripts/tests/testIntegratedBalanced.js --network kairos

# Feature-specific tests
# Test deposit and withdrawal flows
npx hardhat run scripts/tests/testDepositWithdraw.js --network kairos

# Test unstake/claim operations
npx hardhat run scripts/tests/testUnstakeClaim.js --network kairos

# Test contract upgrades
npx hardhat run scripts/testUpgrades.js --network kairos
```

## Current Deployment (Kairos Testnet)

| Contract | Address | Size |
|----------|---------|------|
| ShareVault | `0xF43BdDA5bc0693d952a68ABc4E0D8262A874b74e` | 10.2 KB |
| VaultCore | `0x09bE7a4bf8c0bB28725A9369484b0852cD70cBE8` | 19.4 KB |
| SwapContract | `0x5D83C399c3bFf4fE86627eA8680431c5b8084320` | 7.3 KB |
| ClaimManager | `0x72C44A898dfD0cf4689DF795D188e19049a2d996` | 4.0 KB |
| LPCalculations | `0xf955f2aA1673c46F617A446c3a45f72eA958443f` | 1.4 KB |

## Configuration

### Investment Profiles

| Profile | Stable (LST) | Balanced (LP) | Aggressive | Liquidity |
|---------|-------------|---------------|------------|-----------|
| Conservative | 30% | 0% | 0% | 70% |
| Stable | 90% | 0% | 0% | 10% |
| Balanced | 45%* | 45%* | 0% | 10% |
| Growth | 30% | 30% | 30% | 10% |

*Note: In Balanced profile, 90% is converted to LST first, then 50% of that LST goes to LP pools

### APY Distribution
Configurable across 4 LSTs based on current staking rewards:
- wKoKAIA: 25% default
- wGCKAIA: 25% default
- wstKLAY: 25% default
- stKAIA: 25% default

## Supported LSTs

### 1. wKoKAIA (Index 0)
- Handler: `0xb15782EFbC2034E366670599F3997f94c7333FF9`
- Wrapped Token: `0x9a93e2fcDEBE43d0f8205D1cd255D709B7598317`

### 2. wGCKAIA (Index 1)
- Handler: `0xe4c732f651B39169648A22F159b815d8499F996c`
- Wrapped Token: `0x324353670B23b16DFacBDE169Cd8ebF8C8bf6601`

### 3. wstKLAY (Index 2)
- Handler: `0x28B13a88E72a2c8d6E93C28dD39125705d78E75F`
- Wrapped Token: `0x474B49DF463E528223F244670e332fE82742e1aA`

### 4. stKAIA (Index 3)
- Handler: `0x4C0d434C7DD74491A52375163a7b724ED387d0b6`
- Token: `0x45886b01276c45Fe337d3758b94DD8D7F3951d97`

## Security Audit

### Resolved Issues
- ✅ **Critical**: Direct Deposit vulnerability - Fixed with Standard ERC-4626
- ✅ **High**: tx.origin usage - Replaced with address(this)
- ✅ **High**: Public unstake/claim - Made owner-only
- ✅ **Medium**: Contract size limit - Optimized to 19.4 KB
- ✅ **Medium**: Storage layout issues - SharedStorage pattern implemented

### Audit Readiness
- All critical and high-risk issues resolved
- Comprehensive test coverage
- Gas optimized with aggressive compiler settings
- External library for complex calculations
- Clean separation of concerns

## Maintenance & Operations

### Asset Recovery from SwapContract
SwapContract may occasionally have stranded assets due to swap failures or partial executions. Run the recovery script periodically:

```bash
# Check and recover stranded assets (Testnet)
npx hardhat run scripts/recoverSwapAssets.js --network kairos

# Mainnet
npx hardhat run scripts/recoverSwapAssets.js --network kaia
```

**Recommended Schedule**: Weekly or after any reported swap failures

The script will:
1. Check all token balances in SwapContract
2. Report any stranded assets found
3. Recover them to VaultCore (owner-only operation)
4. Verify successful recovery

## Important Notes

⚠️ **SwapContract is FINALIZED**: The SwapContract has been thoroughly tested with all 4 LSTs and should NOT be modified.

⚠️ **Asset Recovery**: SwapContract now includes `returnAssetsToVault()` function for recovering stranded tokens (requires upgrade).

⚠️ **Use V2 Architecture**: The separated vault architecture (ShareVault + VaultCore) is the recommended deployment.

⚠️ **WKAIA Deposit Pattern**: Due to WKAIA state sync issues, deposits now convert WKAIA to KAIA in ShareVault before sending to VaultCore.

## License

MIT