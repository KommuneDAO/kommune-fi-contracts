# Kommune-Fi AI Agent Smart Contracts

ERC-4626 Tokenized Vault with APY-based multi-asset staking and smart swap functionality

## 🏗️ Architecture

- **KVaultV2** (22.8 KiB): Main ERC4626 vault with APY-based multi-asset staking
  - 📈 Dynamic APY management for 4 LST protocols
  - 🔄 Intelligent asset allocation based on yield optimization
  - 🔁 Multi-asset withdrawal with priority-based selection
  - 🛜 Upgradeable architecture for continuous improvements
- **SwapContract** (4.2 KiB): Upgradeable Balancer DEX integration
  - 🔄 Cross-protocol token swapping
  - 📊 Slippage-protected transactions
  - 🔍 Swap estimation and routing

## 🚀 Quick Start

```bash
# Install dependencies
yarn install

# Compile contracts
yarn compile

# Check contract sizes
yarn sizetest

# Deploy to testnet (Kairos)
yarn deploy-all:dev

# Deploy to mainnet (Kaia)
yarn deploy-all:prod
```

## 📦 Available Commands

### Deployment
```bash
# Full deployment (recommended)
yarn deploy-all:dev      # Testnet
yarn deploy-all:prod     # Mainnet

# Individual deployment
yarn deploy-swap:dev     # SwapContract only
yarn deploy-vault:dev    # KVaultV2 only
```

### Upgrades
```bash
yarn upgrade-swap:dev    # Upgrade SwapContract
yarn upgrade-vault:dev   # Upgrade KVaultV2
```

### APY Management
```bash
yarn test-apy:dev        # Test APY functions (Testnet)
yarn test-apy:prod       # Test APY functions (Mainnet)
```

### Legacy (Deprecated)
```bash
yarn deploy:dev          # Old KommuneVault
yarn upgrade:dev         # Old upgrade script
```

## 📈 APY Management System

KVaultV2 implements a sophisticated APY-based asset allocation system across 4 LST protocols:

### 🎨 Supported Protocols
- **Index 0**: KoKAIA (KommuneDAO) - Liquid Staking Token
- **Index 1**: GCKAIA (Swapscanner) - Governance Council Staking
- **Index 2**: stKLAY (Kracker Labs) - Klaytn Staking
- **Index 3**: stKAIA (Lair Finance) - Kaia Staking

### ⚙️ APY Functions

```solidity
// Set individual APY (only operators)
setAPY(uint256 index, uint256 apy)        // 5.25% = 525

// Set multiple APYs at once
setMultipleAPY(uint256[4] apyValues)       // [500, 475, 525, 450]

// Query APY values
getAPY(uint256 index)                     // Returns: 525 (for 5.25%)
getAllAPY()                               // Returns: [500, 475, 525, 450]
getAPYInBasisPoints(uint256 index)        // Returns: 5250 (internal format)
```

### 📀 APY Format
- **Input**: Percentage with 2 decimal places (5.25% = 525)
- **Storage**: Basis points (525 × 10 = 5250 for internal calculations)
- **Range**: 0.00% to 100.00% (0 to 10000)

### 🔄 Investment Logic
1. **Asset Allocation**: Higher APY protocols receive more investment
2. **Withdrawal Priority**: Lower APY protocols are withdrawn first
3. **Automatic Rebalancing**: Based on real-time APY values

### 🎆 Events
```solidity
event APYUpdated(uint256 indexed index, uint256 oldAPY, uint256 newAPY);
```

### 📊 Usage Examples

```javascript
// Connect to deployed contract
const vault = await ethers.getContractAt("KVaultV2", vaultAddress);

// Set APY for KoKAIA to 5.75%
await vault.setAPY(0, 575);

// Set all APYs at once
await vault.setMultipleAPY([625, 550, 475, 500]); // 6.25%, 5.50%, 4.75%, 5.00%

// Check current APY values
const apys = await vault.getAllAPY();
console.log(`KoKAIA APY: ${apys[0]/100}%`); // 6.25%

// Check individual APY
const kokaiaAPY = await vault.getAPY(0);
console.log(`KoKAIA: ${kokaiaAPY/100}%`); // 6.25%
```

### 🔑 Access Control
- **APY Updates**: Only `operators` can modify APY values
- **Owner Functions**: Add/remove operators
- **Public Queries**: Anyone can read APY values

## 📋 For detailed deployment instructions, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

## 🌐 Network Configuration

### Kairos Testnet
```bash
# Contract addresses stored in deployments-kairos.json
# Generated after running: yarn deploy-all:dev
```

### Kaia Mainnet
```bash
# Contract addresses stored in deployments-kaia.json  
# Generated after running: yarn deploy-all:prod
```

### Protocol Addresses (Testnet)
```solidity
// LST Protocols
KoKAIA:  0xb15782EFbC2034E366670599F3997f94c7333FF9
GCKAIA:  0x4EC04F4D46D7e34EBf0C3932B65068168FDcE7f6
stKLAY:  0x524dCFf07BFF606225A4FA76AFA55D705B052004
stKAIA:  0x45886b01276c45Fe337d3758b94DD8D7F3951d97

// DEX Integration
Balancer Vault: 0x1c9074AA147648567015287B0d4185Cb4E04F86d
WKAIA: 0x0339d5Eb6D195Ba90B13ed1BCeAa97EbD198b106
```

## 🧪 Testing

```bash
# Run APY function tests
yarn test-apy:dev

# Check contract sizes
yarn sizetest

# Run full test suite
yarn test
```