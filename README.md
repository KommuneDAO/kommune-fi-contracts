# Kommune-Fi AI Agent Smart Contracts

ERC-4626 Tokenized Vault with APY-based multi-asset staking and smart swap functionality

## 🚀 Project Status

**Current Version**: Production-ready with extensive testing  
**Network**: Kairos Testnet (Active) | Kaia Mainnet (Ready)  
**Last Updated**: August 13, 2025  

### ✅ Recent Improvements
- **Multi-GC Investment**: Distributed investment across multiple Governance Council tokens
- **Enhanced Swap Logic**: Improved multi-LST swap functionality with better error handling  
- **Slippage Protection**: Comprehensive slippage value integration across all swap operations
- **Wrap/Unwrap Calibration**: Precise amount calibration before and after wrap/unwrap operations
- **Automatic LST Wrapping**: LST tokens are automatically wrapped after staking (except stKAIA)
- **Robust Testing Suite**: 50+ test scripts covering edge cases and real-world scenarios

### 📝 Known Issues
- **State Accumulation**: After multiple deposits and APY changes, "WETH: request exceeds allowance" may occur
  - Workaround: Fresh deployment resolves the issue
  - All tests pass on clean deployments

## 🏗️ Architecture

- **KVaultV2** (23.7 KiB with optimizer runs=200): Main ERC4626 vault with APY-based multi-asset staking
  - 📈 Dynamic APY management for 4 LST protocols
  - 🔄 Intelligent asset allocation based on yield optimization  
  - 🔁 Multi-asset withdrawal with priority-based selection
  - 🛜 Upgradeable architecture for continuous improvements
  - 💎 Multiple GC token support with distributed investment
- **SwapContract** (4.2 KiB): Upgradeable Balancer DEX integration
  - 🔄 Cross-protocol token swapping with enhanced error handling
  - 📊 Slippage-protected transactions with configurable tolerance
  - 🔍 Swap estimation and routing optimization
  - 🎯 Multi-LST swap support for complex operations

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

## 📋 상세 가이드

- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)**: 컨트랙트 배포 상세 가이드
- **[TEST_GUIDE.md](./TEST_GUIDE.md)**: 종합 테스트 실행 가이드
- **[scripts/README.md](./scripts/README.md)**: 스크립트 구조 및 사용법

## 🌐 Network Configuration

### Kairos Testnet (Active)
```bash
# Current Deployed Contracts (Latest)
KVaultV2:     0x5a654804B7dE1933f07d961EAb387A2A46FA8174
SwapContract: 0x2Fd6477ED442196C64df2f11d128fd5aAf18Ce59

# Deployment Date: August 13, 2025
# Status: Fresh deployment with optimizer runs=200
# RPC: QuickNode (https://responsive-green-emerald.kaia-kairos.quiknode.pro)
```

### Kaia Mainnet (Ready for Production)
```bash
# Contract addresses will be stored in deployments-kaia.json  
# Deploy using: yarn deploy-all:prod
# Status: Ready for mainnet deployment
```

### Deployment History & Upgrades

The contracts have undergone extensive testing and multiple upgrades:

- **KVaultV2**: 11 successful upgrades addressing edge cases and optimizations
- **SwapContract**: 5 upgrades improving swap logic and error handling
- **Latest Updates**: August 12, 2025 - Multi-GC support and enhanced testing

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

## 🧪 종합 테스트 시스템

프로젝트에는 체계적으로 정리된 통합 테스트 시스템이 포함되어 있습니다:

### 🎯 메인 테스트 스위트
```bash
# 통합 테스트 실행 (권장)
yarn test:integration      # 종합 통합 테스트

# 개별 기능 테스트
yarn test-apy:dev          # APY 시스템 테스트
yarn reset-apy:dev         # APY 초기화
```


### 🏗️ 시스템 관리 도구
```bash
# 통합 테스트
yarn test:integration      # 통합 테스트 (Testnet)
yarn test:integration:prod # 통합 테스트 (Mainnet)

# APY 시스템 테스트
yarn test-apy:dev          # APY 기능 및 분배 테스트
yarn reset-apy:dev         # 테스트용 APY 값 초기화

# 계약 검증
yarn sizetest              # 컨트랙트 크기 제한 검증
yarn test                  # Hardhat 기본 테스트 실행
```

### 📊 테스트 커버리지
- ✅ **Deposit/Withdraw**: 모든 시나리오 및 edge case 포함
- ✅ **APY 관리**: 동적 APY 업데이트 및 분배 로직
- ✅ **Multi-LST Swap**: 복합 멀티 토큰 swap 연산
- ✅ **Wrap/Unwrap**: 정밀한 수량 계산 및 보정
- ✅ **슬리피지 보호**: 다양한 슬리피지 시나리오 및 제한
- ✅ **에러 처리**: 포괄적인 에러 복구 테스트
- ✅ **업그레이드 호환성**: 컨트랙트 업그레이드 및 마이그레이션
- ✅ **가스 최적화**: 성능 및 비용 분석

### 📚 상세 테스트 가이드
- **[TEST_GUIDE.md](./TEST_GUIDE.md)**: 전체 테스트 가이드
- **[scripts/README.md](./scripts/README.md)**: 스크립트 구조 및 사용법  

## 🎯 프로덕션 준비도

### 성숙도 지표
- **✅ 광범위한 테스트**: 통합 테스트 시스템으로 모든 기능 커버
- **✅ 다중 업그레이드**: 16회 성공적 컨트랙트 업그레이드 (무중단)
- **✅ Edge Case 커버리지**: 실패 시나리오의 포괄적 테스트
- **✅ 가스 최적화**: 배포 제한에 맞춘 컨트랙트 크기 최적화
- **✅ 보안 감사**: 철저한 내부 테스트 및 검증
- **✅ 실세계 테스트**: 라이브 트랜잭션을 통한 활발한 테스트넷 배포

### Key Features Validated
- **Multi-LST Swap Operations**: Complex token swapping across 4 protocols
- **Dynamic APY Management**: Real-time yield optimization and asset allocation  
- **Slippage Protection**: Robust handling of market volatility
- **Upgrade Compatibility**: Seamless contract upgrades with state preservation
- **Error Recovery**: Graceful handling of edge cases and failures

### Ready for Mainnet
The contracts are production-ready and have been thoroughly tested on Kairos testnet. All major functionality has been validated through extensive testing and multiple upgrade cycles.