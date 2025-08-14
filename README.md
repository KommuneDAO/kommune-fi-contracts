# KommuneFi Contracts - ERC20 Version

## Overview
KommuneFi is a liquid staking protocol on Kaia blockchain that allows users to deposit KAIA and receive kvKAIA tokens representing their staked position. The protocol automatically distributes staked KAIA across multiple Liquid Staking Token (LST) protocols based on configured APY rates.

## Architecture

### Separated Vault Architecture (V2)
The protocol uses a separated architecture to overcome contract size limitations:

- **ShareVault** (12.23 KB): ERC-4626 compliant contract managing shares (kvKAIA tokens)
- **VaultCore** (10.17 KB): Core logic for LST management, asset handling, and unstake/claim operations
- **SwapContract** (9.26 KB): Handles Balancer pool swaps for withdrawals (**FINALIZED - DO NOT MODIFY**)
- **ClaimManager**: Handles unstake/claim operations via delegatecall to reduce VaultCore size

### Previous Architecture (V1)
- **KommuneVault**: Original single contract implementation (reference)
- **KommuneVaultV2**: Optimized version (reached 24KB limit, reference for swap logic)

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
# Configure in .env:
# - PRIVATE_KEY (main deployer wallet)
# - TESTER1_PRIV_KEY (test wallet 2)
# - TESTER2_PRIV_KEY (test wallet 3)
```

### Deploy Fresh Contracts
```bash
# Testnet deployment
npm run deploy:testnet          # Deploy all V2 contracts to Kairos
npm run setup:testnet           # Configure APY values
npm run test:testnet            # Run integrated tests

# Mainnet deployment
npm run deploy:mainnet          # Deploy all V2 contracts to Kaia
npm run setup:mainnet           # Configure APY values
npm run test:mainnet            # Run integrated tests
```

### Upgrade Existing Deployment
```bash
# Testnet upgrades
npm run upgrade:testnet         # Upgrade VaultCore (default)
npm run upgrade:testnet:core    # Upgrade VaultCore only
npm run upgrade:testnet:share   # Upgrade ShareVault only
npm run upgrade:testnet:swap    # Deploy new SwapContract
npm run deploy:testnet:claim    # Deploy ClaimManager (first time)
npm run upgrade:testnet:claim   # Upgrade ClaimManager

# Mainnet upgrades
npm run upgrade:mainnet         # Upgrade VaultCore (default)
npm run upgrade:mainnet:core    # Upgrade VaultCore only
npm run upgrade:mainnet:share   # Upgrade ShareVault only
npm run upgrade:mainnet:swap    # Deploy new SwapContract
npm run deploy:mainnet:claim    # Deploy ClaimManager (first time)
npm run upgrade:mainnet:claim   # Upgrade ClaimManager

# Direct script execution (for custom options)
npx hardhat run scripts/upgradeContracts.js --network kairos -- --all
```

### V1 Legacy Commands (DO NOT USE)
```bash
npm run deploy:v1:testnet       # V1 deployment (deprecated)
npm run upgrade:v1:testnet      # V1 upgrade (deprecated)
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

### Run Integrated Test Suite
```bash
# Complete test suite including deposits, withdrawals, and concurrent operations
npm run test:testnet            # Test on Kairos testnet
npm run test:mainnet            # Test on Kaia mainnet

# Or directly with hardhat
npx hardhat run scripts/testIntegrated.js --network kairos
```

### Test Coverage
The integrated test suite covers:

1. **Deposit Tests**
   - Large deposit for liquidity buffer (3 KAIA)
   - Small user deposits (0.1 KAIA)
   - Native KAIA and WKAIA deposits
   - Share minting verification

2. **Withdrawal Tests**
   - 100% withdrawal (most common user action)
   - GIVEN_OUT swap execution
   - Gas usage optimization

3. **Concurrent Operations**
   - Multiple simultaneous deposits
   - Concurrent withdrawals
   - Race condition handling

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
├── deployFresh.js              # Complete fresh deployment (V2)
├── upgradeVaultCore.js         # Upgrade VaultCore individually
├── upgradeShareVault.js        # Upgrade ShareVault individually  
├── upgradeSwapContract.js      # Deploy new SwapContract
├── deployClaimManager.js       # Deploy ClaimManager (first time)
├── upgradeClaimManager.js      # Upgrade ClaimManager
├── upgradeContracts.js         # Combined upgrade script with options
├── upgradeAll.js               # Upgrade all contracts
├── setAPY.js                   # Configure APY values
├── testIntegrated.js           # Integrated test suite
├── deploySeparatedVault.js    # Legacy V2 deployment
├── deploy.js                   # V1 deployment (DO NOT MODIFY)
├── upgrade.js                  # V1 upgrade (DO NOT MODIFY)
└── temp/                       # Temporary test scripts
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