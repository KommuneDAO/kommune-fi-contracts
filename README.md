# KommuneFi Contracts - ERC20 Version

## Overview
KommuneFi is a liquid staking protocol on Kaia blockchain that allows users to deposit KAIA and receive kvKAIA tokens representing their staked position. The protocol supports multiple investment profiles (Stable, Balanced, Aggressive) and automatically distributes staked KAIA across multiple Liquid Staking Token (LST) protocols based on configured APY rates and investment strategies.

## Architecture

### Separated Vault Architecture (V2)
The protocol uses a separated architecture to overcome contract size limitations:

- **ShareVault** (12.23 KB): ERC-4626 compliant contract managing shares (kvKAIA tokens)
- **VaultCore** (10.17 KB): Core logic for LST management, investment strategies, and unstake/claim operations
- **SwapContract** (9.26 KB): Handles Balancer pool swaps for withdrawals (**FINALIZED - DO NOT MODIFY**)
- **ClaimManager**: Handles unstake/claim operations via delegatecall to reduce VaultCore size
- **SharedStorage**: Base storage contract ensuring identical layout for delegatecall safety

### Previous Architecture (V1)
- **KommuneVault**: Original single contract implementation (reference)
- **KommuneVaultV2**: Optimized version (reached 24KB limit, reference for swap logic)

### Supported LST Protocols
1. **wKoKAIA** (Index 0): Wrapped KoKaia protocol tokens
2. **wGCKAIA** (Index 1): Wrapped GcKaia protocol tokens  
3. **wstKLAY** (Index 2): Wrapped stKLAY protocol tokens
4. **stKAIA** (Index 3): Native stKAIA tokens

### Investment Strategies
1. **Stable Strategy**: Direct LST staking for staking rewards
2. **Balanced Strategy**: LST staking + Balancer pool liquidity for additional swap fees
3. **Aggressive Strategy**: Future implementation for higher risk/reward strategies

## Deployment

### Prerequisites
```bash
npm install
cp .env.example .env
# Configure in .env:
# - PRIVATE_KEY (main deployer wallet)
# - TESTER1_PRIV_KEY (test wallet 2)
# - TESTER2_PRIV_KEY (test wallet 3)
```

### Deploy Fresh Contracts

#### Option 1: Deploy with Investment Profile
```bash
# Deploy with specific investment profile (stable/balanced/aggressive)
INVESTMENT_PROFILE=stable npx hardhat run scripts/deployWithProfile.js --network kairos
INVESTMENT_PROFILE=balanced npx hardhat run scripts/deployWithProfile.js --network kairos
INVESTMENT_PROFILE=aggressive npx hardhat run scripts/deployWithProfile.js --network kairos
```

#### Option 2: Standard Deployment
```bash
# Testnet deployment
npx hardhat run scripts/deploySeparatedVault.js --network kairos
npx hardhat run scripts/deploySwapContract.js --network kairos
npx hardhat run scripts/setupSeparatedVault.js --network kairos

# Mainnet deployment
npx hardhat run scripts/deploySeparatedVault.js --network kaia
npx hardhat run scripts/deploySwapContract.js --network kaia
npx hardhat run scripts/setupSeparatedVault.js --network kaia
```

### Upgrade Existing Deployment
```bash
# Upgrade VaultCore (includes investment ratio support)
npx hardhat run scripts/upgradeSeparatedVault.js --network kairos

# Upgrade with investment ratio initialization
npx hardhat run scripts/temp/upgradeVaultCoreWithRatios.js --network kairos

# Deploy new ClaimManager if needed
npx hardhat run scripts/deployClaimManager.js --network kairos
```

### V1 Legacy Commands (DO NOT USE)
```bash
npm run deploy:v1:testnet       # V1 deployment (deprecated)
npm run upgrade:v1:testnet      # V1 upgrade (deprecated)
```

## Direct Deposit Pattern (Important Update - 2025-08-16)

### WKAIA Deposits
Due to state synchronization issues, WKAIA deposits now use a Direct Deposit pattern:

```javascript
// Step 1: Transfer WKAIA directly to VaultCore
await wkaia.transfer(vaultCore, amount);

// Step 2: Call deposit on ShareVault
await shareVault.deposit(amount, receiver);
```

**Note**: Native KAIA deposits continue to use `depositKAIA()` as before.

## Current Deployment (Kairos Testnet)

### Separated Architecture (V2) - Latest
| Contract | Address | Size |
|----------|---------|------|
| ShareVault | 0xB589753637000106c98FdaBb409144cE8aebC7Ed | 12.23 KB |
| VaultCore | 0x84591428Fc67cff1337b5Db1D62abE1378a20415 | 10.17 KB |
| SwapContract | 0xDd44CbA11903eB83e8d0f9e41b4d114fA45818d8 | 9.26 KB |
| ClaimManager | 0x4bECEABFfD764212Ed9F66F8cA671D01A430f540 | - |

### Previous Deployments
- **KVaultV2**: 0xfBF698074Cc9D6496c22faa117616E2038551424 (23.99 KB - at size limit)

## Configuration

### APY Settings
Default APY configuration (set via `setupSeparatedVault.js`):
- wKoKAIA: 5%
- wGCKAIA: 6%
- wstKLAY: 7%
- stKAIA: 8%

### Vault Parameters

#### Investment Profiles
- **Stable Profile**: 90% invested (100% to LST staking), 10% liquidity
- **Balanced Profile**: 90% invested (50% LST, 50% balanced strategies), 10% liquidity
- **Aggressive Profile**: 90% invested (40% LST, 30% balanced, 30% aggressive), 10% liquidity

#### Other Parameters
- **Deposit Limit**: Per-block limit for spam prevention
- **Fees**: 0.1% (10 basis points)
- **Slippage**: 10% tolerance for testnet

## Testing

### Run Integrated Test Suite
```bash
# Comprehensive integrated test (all features)
npm run test:testnet            # Test on Kairos testnet  
npm run test:mainnet            # Test on Kaia mainnet

# Or directly with hardhat
npx hardhat run scripts/testIntegrated.js --network kairos
npx hardhat run scripts/testIntegrated.js --network kaia
```

The integrated test includes:
- Fresh contract deployment with STABLE profile
- 3-wallet deposit/withdraw testing (STABLE)
- Unstake & claim testing
- Switch to BALANCED profile  
- 3-wallet deposit/withdraw testing (BALANCED)
- LP creation and fund recovery verification

### Comprehensive Test Coverage

The integrated test suite (`npm run test:testnet`) provides complete validation:

#### Phase 1: Fresh Deployment & STABLE Profile
1. **Fresh Contract Deployment**
   - Deploy with STABLE profile (90% LST staking)
   - Clean state without interference from previous tests
   
2. **3-Wallet STABLE Testing**
   - Wallet 1: Large deposit (3 KAIA) for liquidity buffer
   - Wallet 2: Medium deposit (0.1 KAIA) 
   - Wallet 3: Small deposit (0.05 KAIA)
   - LST distribution verification
   - Withdrawal testing (50% and 100%)
   
3. **Unstake & Claim Testing**
   - Full unstake/claim cycle with wKoKAIA
   - 10-minute waiting period
   - Protocol asset growth verification

#### Phase 2: BALANCED Profile Testing
4. **Profile Switch to BALANCED**
   - Dynamic ratio configuration (45% LST + 45% LP)
   - Maintain 90% total investment for maximum returns
   
5. **3-Wallet BALANCED Testing**
   - Same wallets make additional deposits
   - LP token creation and tracking
   - Balanced strategy verification
   - Withdrawal with LP positions
   
6. **LP Fund Recovery Verification**
   - Remove liquidity from LP positions (owner function)
   - Verify LST token recovery from LP
   - Confirm deposited funds not locked in LP pools
   - Test large withdrawals requiring LP liquidation

#### Key Features Validated
- ✅ Multiple investment strategies (Stable, Balanced)
- ✅ 3-wallet concurrent testing for real-world scenarios
- ✅ Native KAIA deposits and WKAIA withdrawals
- ✅ LST distribution across 4 protocols
- ✅ Unstake/claim operations for asset realization
- ✅ Balancer LP integration with fund recovery
- ✅ Dynamic profile switching without disruption

### Known Issues & Solutions

#### Withdrawal Threshold Issue
- **Problem**: Withdrawals may fail when total deposits are small
- **Root Cause**: 10% slippage buffer in swap logic creates mathematical impossibility with small LST balances
- **Solution**: 
  - Provide 3 KAIA initial liquidity buffer
  - Issue resolves naturally as more users join
- **Details**: See CLAUDE.md for complete mathematical analysis

## Key Features

### For Users
- **Deposit**: Native KAIA or WKAIA deposits
- **Withdraw**: Receive WKAIA by burning shares
- **Unstake/Claim**: Unstake LSTs and claim after 7 days for asset realization
- **Auto-distribution**: Deposits automatically distributed to highest APY protocols
- **ERC-4626 Compliant**: Standard vault interface

### Technical Features
- **UUPS Upgradeable**: Both contracts support upgrades
- **Separated Architecture**: Overcomes 24KB contract size limit
- **GIVEN_OUT Swaps**: Exact WKAIA output amounts for precise withdrawals
- **Gas Optimized**: Minimal storage operations
- **Multi-LST Support**: Automatic distribution across 4 LST protocols

## Scripts Directory Structure

```
scripts/
├── deployWithProfile.js        # Deploy with investment profile (recommended)
├── deploySeparatedVault.js     # Deploy ShareVault + VaultCore
├── deploySwapContract.js       # Deploy SwapContract
├── deployClaimManager.js       # Deploy ClaimManager
├── setupSeparatedVault.js      # Configure contracts after deployment
├── upgradeSeparatedVault.js    # Upgrade VaultCore
├── setAPY.js                   # Configure APY values
├── testIntegrated.js           # Comprehensive integrated test suite
├── deploy.js                   # V1 deployment (DO NOT MODIFY)
├── upgrade.js                  # V1 upgrade (DO NOT MODIFY)
├── tests/                      # Component test scripts
│   ├── testDepositWithdraw.js
│   └── testUnstakeClaim.js
└── temp/                       # Temporary and legacy test scripts
    ├── testIntegratedOld.js    # Legacy basic test
    ├── testIntegratedAllProfiles.js # Legacy profile test
    ├── testInvestmentRatios.js
    └── upgradeVaultCoreWithRatios.js
```

## Investment Profiles

### Overview
KommuneFi V2 supports flexible investment strategy allocation through configurable ratios:

| Profile | Total Investment | LST Staking | Balanced | Aggressive | Liquidity |
|---------|-----------------|-------------|----------|------------|-----------|
| Stable | 90% | 90% | 0% | 0% | 10% |
| Balanced | 90% | 45% | 45% | 0% | 10% |
| Aggressive | 90% | 36% | 27% | 27% | 10% |

### Setting Investment Ratios
```javascript
// Example: Set balanced profile
await vaultCore.setInvestRatio(9000);  // 90% total investment for maximum returns
await vaultCore.setInvestmentRatios(
    4500,  // 45% to stable (LST)
    4500,  // 45% to balanced
    0      // 0% to aggressive
);

// Query current ratios
const ratios = await vaultCore.getInvestmentRatios();
console.log(`Stable: ${ratios.stable / 100}%`);
console.log(`Balanced: ${ratios.balanced / 100}%`);
console.log(`Aggressive: ${ratios.aggressive / 100}%`);
```

## APY Management

### Set APY Values
```bash
# Using npm scripts
npm run setup:testnet           # Configure APY on Kairos
npm run setup:mainnet           # Configure APY on Kaia

# Or directly
npx hardhat run scripts/setAPY.js --network kairos
```

#### Programmatic APY Update
```javascript
const vaultCore = await ethers.getContractAt("VaultCore", vaultCoreAddress);
await vaultCore.setAPY(0, 5000); // 5% for wKoKAIA
await vaultCore.setAPY(1, 6000); // 6% for wGCKAIA
```

### APY Format
- Input: Basis points × 10 (5% = 5000)
- Range: 0 to 10000 (0% to 100%)

## Contract Addresses (Kairos Testnet)

### Core Infrastructure
```
WKAIA: 0x043c471bEe060e00A56CcD02c0Ca286808a5A436
Balancer Vault: 0x1c9074AA147648567015287B0d4185Cb4E04F86d
```

### LST Protocol Handlers
```
wKoKAIA Handler: 0xb15782EFbC2034E366670599F3997f94c7333FF9
wGCKAIA Handler: 0xe4c732f651B39169648A22F159b815d8499F996c
wstKLAY Handler: 0x28B13a88E72a2c8d6E93C28dD39125705d78E75F
stKAIA Handler: 0x4C0d434C7DD74491A52375163a7b724ED387d0b6
```

### Wrapped LST Tokens
```
wKoKAIA: 0x9a93e2fcDEBE43d0f8205D1cd255D709B7598317
wGCKAIA: 0x324353670B23b16DFacBDE169Cd8ebF8C8bf6601
wstKLAY: 0x474B49DF463E528223F244670e332fE82742e1aA
stKAIA: 0x45886b01276c45Fe337d3758b94DD8D7F3951d97
```

## Security Considerations

1. **Contract Size**: Both contracts are well under the 24KB limit
2. **Access Control**: Owner-only functions for configuration
3. **Reentrancy Protection**: NonReentrant guards on all entry points
4. **Slippage Protection**: 10% slippage tolerance on swaps
5. **Upgrade Safety**: UUPS pattern with owner-only upgrade authorization

## Development

### Compile Contracts
```bash
npm run compile
```

### Check Contract Sizes
```bash
npm run size
```

### Run Unit Tests
```bash
npm test
```

### Code Formatting
```bash
npm run prettier                # Format all Solidity files
```

## Important Notes

⚠️ **SwapContract is FINALIZED**: The SwapContract has been thoroughly tested with all 4 LSTs and should NOT be modified. It successfully handles GIVEN_OUT swaps for precise WKAIA output amounts.

⚠️ **Use V2 Architecture**: The separated vault architecture (ShareVault + VaultCore) is the recommended deployment as it overcomes contract size limitations while maintaining all functionality.

## License
MIT