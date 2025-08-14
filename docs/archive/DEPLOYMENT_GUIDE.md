# 🚀 KVaultV2 Deployment Guide

## 📋 Overview

KVaultV2 시스템은 두 개의 독립적인 upgradeable 컨트랙트로 구성됩니다:

1. **SwapContract**: Balancer DEX를 통한 토큰 스왑 로직
2. **KVaultV2**: 메인 ERC4626 Vault 컨트랙트

## 🏗️ Architecture

```
KVaultV2 (23.7 KiB with optimizer runs=200)
    ↓ delegates to
SwapContract (4.2 KiB)
    ↓ interacts with
Balancer Vault
```

## 📦 배포 스크립트

### Development (Kairos Testnet)

```bash
# 전체 배포 (권장)
yarn deploy-all:dev
# 또는
npx hardhat run scripts/deployAll.js --network kairos

# 개별 배포
yarn deploy-swap:dev      # SwapContract만 배포
yarn deploy-vault:dev     # KVaultV2만 배포

# 업그레이드
yarn upgrade-swap:dev     # SwapContract 업그레이드
yarn upgrade-vault:dev    # KVaultV2 업그레이드
```

### Production (Kaia Mainnet)

```bash
# 전체 배포 (권장)
yarn deploy-all:prod
# 또는
npx hardhat run scripts/deployAll.js --network kaia

# 개별 배포
yarn deploy-swap:prod     # SwapContract만 배포
yarn deploy-vault:prod    # KVaultV2만 배포

# 업그레이드
yarn upgrade-swap:prod    # SwapContract 업그레이드
yarn upgrade-vault:prod   # KVaultV2 업그레이드
```


## 📄 Deployment File Structure

배포 정보는 `deployments-{network}.json` 파일에 저장됩니다:

```json
{
  "SwapContract": "0x...",
  "TokenizedVault": "0x...",
  "KVaultV2": "0x...",
  "deploymentInfo": {
    "network": "kairos",
    "chainId": 1001,
    "deployer": "0x...",
    "timestamp": "2025-08-12T01:25:59.466Z",
    "parameters": {
      "asset": "0x...",
      "vault": "0x...",
      "treasury": "0x...",
      "basisPointsFees": 1000,
      "investRatio": 10000
    }
  },
  "upgradeHistory": {
    "SwapContract": [...],
    "KVaultV2": [...]
  }
}
```

## 🔄 Deployment Workflow

### 초기 배포

1. **전체 배포 (권장)**:
   ```bash
   npx hardhat run scripts/deployAll.js --network kairos
   ```

2. **단계별 배포**:
   ```bash
   npx hardhat run scripts/deploySwapContract.js --network kairos  # 먼저 SwapContract 배포
   npx hardhat run scripts/deployKVaultV2.js --network kairos      # 그 다음 KVaultV2 배포
   ```

### 업그레이드

```bash
# SwapContract만 업그레이드
npx hardhat run scripts/upgradeSwapContract.js --network kairos

# KVaultV2만 업그레이드  
npx hardhat run scripts/upgradeKVaultV2.js --network kairos
```

## ⚙️ Configuration

배포 설정은 다음 파일들에서 관리됩니다:

- `config/constants.js`: 컨트랙트 주소, 수수료, 비율 등
- `config/config.js`: RPC URL 등 네트워크 설정
- `hardhat.config.js`: QuickNode RPC 사용 (Kairos: https://responsive-green-emerald.kaia-kairos.quiknode.pro)
- `.env`: Private Key 등 민감한 정보

## 🔍 Contract Sizes

- **KVaultV2**: 23.703 KiB (24.576 KiB 한도 내) - optimizer runs=200
- **SwapContract**: 4.164 KiB - optimizer runs=200
- **Total**: 27.867 KiB

## ✅ Deployment Verification

배포 후 다음을 확인하세요:

1. **컨트랙트 크기**: `yarn sizetest`
2. **배포 파일**: `deployments-{network}.json` 확인
3. **프록시 정보**: `npx hardhat run scripts/getProxyInfo.js --network kairos`

## 🚨 Important Notes

1. **업그레이드 호환성**: 업그레이드 시 스토리지 레이아웃 호환성 확인
2. **SwapContract 의존성**: KVaultV2는 SwapContract에 의존하므로 SwapContract가 먼저 배포되어야 함
3. **백업**: 업그레이드 전 현재 컨트랙트 상태 백업
4. **테스트**: 메인넷 배포 전 반드시 테스트넷에서 테스트


## 🛠️ Troubleshooting

### SwapContract 주소를 찾을 수 없음
```bash
Error: SwapContract address not found in deployments-kairos.json
```
**해결책**: 먼저 SwapContract를 배포하세요
```bash
npx hardhat run scripts/deploySwapContract.js --network kairos
```

### 배포 파일이 없음
```bash
Error: Deployment file not found
```
**해결책**: 전체 배포를 실행하세요
```bash
npx hardhat run scripts/deployAll.js --network kairos
```

## 📊 Gas Usage

| Operation | Gas Cost (Est.) |
|-----------|----------------|
| SwapContract Deploy | ~1.5M gas |
| KVaultV2 Deploy | ~3.0M gas |
| SwapContract Upgrade | ~0.5M gas |
| KVaultV2 Upgrade | ~1.0M gas |
| APY Update (single) | ~50K gas |
| APY Update (batch) | ~150K gas |

## 📊 APY Management

### APY 형식 및 설정

```javascript
// APY 형식: 소수점 2자리 퍼센트 (5.25% = 525)
const vault = await ethers.getContractAt("KVaultV2", vaultAddress);

// 개별 APY 설정
await vault.setAPY(0, 575); // KoKAIA에 5.75% 설정

// 일괄 APY 설정
await vault.setMultipleAPY([500, 475, 525, 450]); // 모든 프로토콜 APY 설정

// APY 조회
const apys = await vault.getAllAPY();
console.log(`Current APYs: ${apys.map(apy => (Number(apy)/100).toFixed(2))}%`);
```

### 지원되는 프로토콜

| Index | Protocol | Description                                |
|-------|----------|--------------------------------------------|
| 0 | KoKAIA | KommuneDAO &nbsp;&nbsp; https://kommunedao.xyz         |
| 1 | GCKAIA | Swapscanner &nbsp;&nbsp;&nbsp;&nbsp; https://swapscanner.io    |
| 2 | stKLAY | Kracker Labs &nbsp;&nbsp;&nbsp;&nbsp; https://stake.ly         |
| 3 | stKAIA | Lair Finance &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; https://app.lair.fi/stake |

### APY 테스트 및 관리

```bash
# APY 기능 테스트
yarn test-apy:dev
# 또는
npx hardhat run scripts/testAPY.js --network kairos

# APY 값 재설정 (필요시)
npx hardhat run scripts/resetAPY.js --network kairos
```

### 투자 로직

1. **자산 배분**: 높은 APY 프로토콜에 더 많은 투자
2. **출금 우선순위**: 낮은 APY 프로토콜부터 출금
3. **자동 리밸런싱**: APY 변경 시 새로운 투자 분배 적용

## 🧪 배포 후 테스트

배포 완료 후 시스템 검증을 위해 테스트 실행:

```bash
# 기본 기능 테스트
npx hardhat run scripts/testSuite.js --network kairos

# 전체 통합 테스트
npx hardhat run scripts/runAllTests.js --network kairos

# 통합 테스트
yarn test:integration
```

## 📚 관련 문서

- **[scripts/README.md](./scripts/README.md)**: 전체 스크립트 구조 및 사용법
- **[TEST_GUIDE.md](./TEST_GUIDE.md)**: 종합 테스트 실행 가이드

---

**마지막 업데이트**: 2025-08-13  
**버전**: 2.1.0  
**문서 기준**: 정리된 프로젝트 구조 (optimizer runs=200)