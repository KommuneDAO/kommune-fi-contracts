# 🚀 KVaultV2 Deployment Guide

## 📋 Overview

KVaultV2 시스템은 두 개의 독립적인 upgradeable 컨트랙트로 구성됩니다:

1. **SwapContract**: Balancer DEX를 통한 토큰 스왑 로직
2. **KVaultV2**: 메인 ERC4626 Vault 컨트랙트

## 🏗️ Architecture

```
KVaultV2 (22.2 KiB)
    ↓ delegates to
SwapContract (4.2 KiB)
    ↓ interacts with
Balancer Vault
```

## 📦 Available Scripts

### Development (Kairos Testnet)

```bash
# 전체 배포 (권장)
yarn deploy-all:dev

# 개별 배포
yarn deploy-swap:dev      # SwapContract만 배포
yarn deploy-vault:dev     # KVaultV2만 배포 (SwapContract가 먼저 배포되어야 함)

# 업그레이드
yarn upgrade-swap:dev     # SwapContract 업그레이드
yarn upgrade-vault:dev    # KVaultV2 업그레이드
```

### Production (Kaia Mainnet)

```bash
# 전체 배포 (권장)
yarn deploy-all:prod

# 개별 배포
yarn deploy-swap:prod      # SwapContract만 배포
yarn deploy-vault:prod     # KVaultV2만 배포

# 업그레이드
yarn upgrade-swap:prod     # SwapContract 업그레이드
yarn upgrade-vault:prod    # KVaultV2 업그레이드
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
   yarn deploy-all:dev
   ```

2. **단계별 배포**:
   ```bash
   yarn deploy-swap:dev    # 먼저 SwapContract 배포
   yarn deploy-vault:dev   # 그 다음 KVaultV2 배포
   ```

### 업그레이드

```bash
# SwapContract만 업그레이드
yarn upgrade-swap:dev

# KVaultV2만 업그레이드
yarn upgrade-vault:dev
```

## ⚙️ Configuration

배포 설정은 다음 파일들에서 관리됩니다:

- `config/constants.js`: 컨트랙트 주소, 수수료, 비율 등
- `config/config.js`: RPC URL 등 네트워크 설정
- `.env`: Private Key 등 민감한 정보

## 🔍 Contract Sizes

- **KVaultV2**: 22.213 KiB (24.576 KiB 한도 내)
- **SwapContract**: 4.164 KiB
- **Total**: 26.377 KiB

## ✅ Deployment Verification

배포 후 다음을 확인하세요:

1. **컨트랙트 크기**: `yarn sizetest`
2. **배포 파일**: `deployments-{network}.json` 확인
3. **프록시 정보**: `yarn getProxyInfo:dev` (또는 `getProxyInfo`)

## 🚨 Important Notes

1. **업그레이드 호환성**: 업그레이드 시 스토리지 레이아웃 호환성 확인
2. **SwapContract 의존성**: KVaultV2는 SwapContract에 의존하므로 SwapContract가 먼저 배포되어야 함
3. **백업**: 업그레이드 전 현재 컨트랙트 상태 백업
4. **테스트**: 메인넷 배포 전 반드시 테스트넷에서 테스트

## 📱 Legacy Scripts

기존 스크립트들은 여전히 사용 가능하지만 deprecated 메시지와 함께 실행됩니다:

```bash
yarn deploy2:dev    # ⚠️ Deprecated - yarn deploy-all:dev 사용 권장
```

## 🛠️ Troubleshooting

### SwapContract 주소를 찾을 수 없음
```bash
Error: SwapContract address not found in deployments-kairos.json
```
**해결책**: 먼저 SwapContract를 배포하세요
```bash
yarn deploy-swap:dev
```

### 배포 파일이 없음
```bash
Error: Deployment file not found
```
**해결책**: 전체 배포를 실행하세요
```bash
yarn deploy-all:dev
```

## 📊 Gas Usage

| Operation | Gas Cost (Est.) |
|-----------|----------------|
| SwapContract Deploy | ~1.5M gas |
| KVaultV2 Deploy | ~3.0M gas |
| SwapContract Upgrade | ~0.5M gas |
| KVaultV2 Upgrade | ~1.0M gas |

---

*이 문서는 KVaultV2 v1.0.0 기준으로 작성되었습니다.*