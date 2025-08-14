# KommuneFi Contracts - ERC20 Version

## Overview
KommuneFi is a liquid staking protocol on Kaia blockchain that allows users to deposit KAIA and receive kvKAIA tokens representing their staked position. The protocol automatically distributes staked KAIA across multiple Liquid Staking Token (LST) protocols based on configured APY rates.

## Architecture

### Separated Vault Architecture (V2)
The protocol uses a separated architecture to overcome contract size limitations:

- **ShareVault** (12.23 KB): ERC-4626 compliant contract managing shares (kvKAIA tokens)
- **VaultCore** (10.17 KB): Core logic for LST management and asset handling
- **SwapContract** (9.26 KB): Handles Balancer pool swaps for withdrawals (**FINALIZED - DO NOT MODIFY**)

### Previous Architecture (V1)
- **KommuneVault**: Original single contract implementation
- **KVaultV2**: Optimized version with helper contracts (reached size limit)

### Supported LST Protocols
1. **wKoKAIA** (Index 0): Wrapped KoKaia protocol tokens
2. **wGCKAIA** (Index 1): Wrapped GcKaia protocol tokens  
3. **wstKLAY** (Index 2): Wrapped stKLAY protocol tokens
4. **stKAIA** (Index 3): Native stKAIA tokens

## Deployment

### Prerequisites
```bash
npm install
cp .env.example .env
# Configure your private key in .env
```

### Deploy Separated Vault Architecture (V2)
```bash
# Deploy ShareVault and VaultCore (Kairos testnet)
npx hardhat run scripts/deploySeparatedVault.js --network kairos
# Creates: deployments-kairos.json

# Deploy to mainnet
npx hardhat run scripts/deploySeparatedVault.js --network kaia
# Creates: deployments-kaia.json

# Configure APY and parameters
npx hardhat run scripts/setupSeparatedVault.js --network kairos
```

### Upgrade Existing Deployment
```bash
npx hardhat run scripts/upgradeSeparatedVault.js --network kairos
```

### Deploy V1 (Legacy)
```bash
# V1 deployment (KommuneVault)
npx hardhat run scripts/deploy.js --network kairos
npx hardhat run scripts/upgrade.js --network kairos
```

## Current Deployment (Kairos Testnet)

### Separated Architecture (V2) - Latest
| Contract | Address | Size |
|----------|---------|------|
| ShareVault | 0xfd2853D33733fC841248838525824fC7828441cb | 12.23 KB |
| VaultCore | 0x42Ec587DEb0EDe5296b507591EbB84140D2280F2 | 10.17 KB |
| SwapContract | 0x829718DBf5e19AB36ab305ac7A7c6C9995bB5F15 | 9.26 KB |

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
- **Invest Ratio**: 90% (90% staked, 10% kept liquid)
- **Deposit Limit**: 100 WKAIA per user
- **Fees**: 0.1% (10 basis points)
- **Slippage**: 10% tolerance for testnet

## Testing

### Test Results Summary
All core features have been thoroughly tested and verified:

#### ✅ Completed Tests:
1. **Basic Deposits**
   - WKAIA deposits with share minting
   - Native KAIA deposits with automatic wrapping
   - APY-based distribution to all 4 LSTs
   - Automatic wrapping for wKoKAIA, wGCKAIA, wstKLAY

2. **Multi-Wallet Deposits** 
   - 3 wallets × 10 rounds × 2 types = 60/60 successful deposits
   - No concurrency issues between different wallets
   - Proper share distribution per wallet

3. **APY Dynamic Changes**
   - APY updates during operation work correctly
   - Immediate redistribution based on new APY values
   - Multiple APY changes handled smoothly

4. **Per-Block Security Limits**
   - Same wallet cannot deposit twice in same block ✅
   - Different wallets can deposit in same block ✅
   - Protection works for both WKAIA and native KAIA ✅

5. **LST Integration**
   - All 4 LSTs receive correct stake amounts
   - Proper use of `stake()` function instead of `deposit()`
   - Balance verification before operations

### Run Integration Tests
```bash
# Full integration test (comprehensive)
npx hardhat run scripts/tests/fullIntegrationTest.js --network kairos

# Individual feature tests
npx hardhat run scripts/tests/testMultiWalletDeposits.js --network kairos
npx hardhat run scripts/tests/testAPYChangeSimple.js --network kairos
npx hardhat run scripts/tests/testPerBlockLimit.js --network kairos
npx hardhat run scripts/tests/testNativeKAIADeposit.js --network kairos
```

## Key Features

### For Users
- **Deposit**: Native KAIA or WKAIA deposits
- **Withdraw**: Receive WKAIA by burning shares
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
├── deploy.js                    # V1 deployment (DO NOT MODIFY)
├── upgrade.js                   # V1 upgrade (DO NOT MODIFY)
├── deploySeparatedVault.js     # Deploy ShareVault + VaultCore
├── upgradeSeparatedVault.js    # Upgrade separated vault
├── setupSeparatedVault.js      # Configure vault parameters
├── testSeparatedVault.js       # Integration tests
├── deploySwapContract.js       # Deploy SwapContract
├── setAPY.js                    # Set APY values
└── tests/                       # All test and debug scripts
    ├── testSwapContractDirect.js  # Direct SwapContract testing
    └── old/                     # Deprecated scripts
```

## APY Management

### Set APY Values
```javascript
// Using setAPY.js script
npx hardhat run scripts/setAPY.js --network kairos

// Or programmatically
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
npx hardhat compile
```

### Check Contract Sizes
```bash
npx hardhat size-contracts
```

### Run Unit Tests
```bash
npx hardhat test
```

## Important Notes

⚠️ **SwapContract is FINALIZED**: The SwapContract has been thoroughly tested with all 4 LSTs and should NOT be modified. It successfully handles GIVEN_OUT swaps for precise WKAIA output amounts.

⚠️ **Use V2 Architecture**: The separated vault architecture (ShareVault + VaultCore) is the recommended deployment as it overcomes contract size limitations while maintaining all functionality.

## License
MIT