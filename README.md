# Kommune-Fi AI Agent Smart Contracts

ERC-4626 Tokenized Vault with APY-based multi-asset staking and smart swap functionality

## 🏗️ Architecture

- **KVaultV2** (22.2 KiB): Main ERC4626 vault with multi-asset withdrawal and APY-based staking
- **SwapContract** (4.2 KiB): Upgradeable Balancer DEX integration for token swaps

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

### Legacy (Deprecated)
```bash
yarn deploy:dev          # Old KommuneVault
yarn upgrade:dev         # Old upgrade script
```

## 📋 For detailed deployment instructions, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

Kommune Swap for Testnet
```
address constant TOKEN_A = 0x9a93e2fcDEBE43d0f8205D1cd255D709B7598317; // wKoKAIA
address constant TOKEN_B = 0x985acD34f36D91768aD4b0cB295Aa919A7ABDb27; // 5LST
address constant TOKEN_C = 0x0339d5Eb6D195Ba90B13ed1BCeAa97EbD198b106; // WKAIA
bytes32 constant POOL1 = 0x8193fe745f2784b1f55e51f71145d2b8b0739b8100020000000000000000000e; // LST Pool
bytes32 constant POOL2 = 0x0c5da2fa11fc2d7eee16c06740072e3c5e1bb4a7000200000000000000000001; // WKAIA-5LST Pool
```

Kommune Swap for Mainnet
```
address constant TOKEN_A = 0xdEC2Cc84f0a37Ef917f63212FE8ba7494b0E4B15; // wKoKAIA
address constant TOKEN_B = 0xA006e8dF6A3CBc66D4D707C97A9FDAf026096487; // 5LST
address constant TOKEN_C = 0x19Aac5f612f524B754CA7e7c41cbFa2E981A4432; // WKAIA
bytes32 constant POOL1 = 0xa006e8df6a3cbc66d4d707c97a9fdaf026096487000000000000000000000000; // LST Pool
bytes32 constant POOL2 = 0x17f3eda2bf1aa1e7983906e675ac9a2ab6bc57de000000000000000000000001; // WKAIA-5LST Pool
```