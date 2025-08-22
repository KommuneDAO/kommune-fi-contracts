# 📋 KommuneFi Vault Scripts 가이드

이 폴더는 KommuneFi Vault 컨트랙트의 배포, 테스트, 관리를 위한 스크립트들을 포함합니다.

## 📁 폴더 구조

```
scripts/
├── 🚀 배포 스크립트 (4개)       # 컨트랙트 배포
├── ⚙️ 업그레이드 스크립트 (3개)  # 컨트랙트 업그레이드
├── 🧪 테스트 스크립트 (1개)      # 기능 테스트
├── 📊 설정 스크립트 (1개)        # APY 설정
└── 📂 tests/                   # 디버그 및 개발 테스트 스크립트
```

---

## 🚀 배포 스크립트

### `deployAll.js` ⭐
**통합 배포 스크립트** - SwapContract와 KVaultV2를 한번에 배포
```bash
yarn deploy-all:dev   # Testnet
yarn deploy-all:prod  # Mainnet
```
- 모든 컨트랙트를 순서대로 배포
- 배포 정보를 `deployments-{network}.json`에 저장
- 네트워크별 설정 자동 적용

### `deploySwapContract.js`
**SwapContract 단독 배포**
```bash
yarn deploy-swap:dev   # Testnet
yarn deploy-swap:prod  # Mainnet
```

### `deployKVaultV2.js`
**KVaultV2 단독 배포** (SwapContract가 먼저 배포되어야 함)
```bash
yarn deploy-vault:dev   # Testnet
yarn deploy-vault:prod  # Mainnet
```

### `deployV1.js`
레거시 배포 스크립트 (deprecated)

---

## ⚙️ 업그레이드 스크립트

### `upgradeSwapContract.js`
**SwapContract 업그레이드**
```bash
yarn upgrade-swap:dev   # Testnet
yarn upgrade-swap:prod  # Mainnet
```

### `upgradeKVaultV2.js`
**KVaultV2 업그레이드**
```bash
yarn upgrade-vault:dev   # Testnet
yarn upgrade-vault:prod  # Mainnet
```

### `upgradeV1.js`
레거시 업그레이드 스크립트 (deprecated)

---

## 🧪 테스트 스크립트

### `integrationTest.js` ⭐
**통합 테스트** - 전체 시스템 테스트
```bash
npx hardhat run scripts/integrationTest.js --network kairos
```
테스트 항목:
- Test 1: 초기 상태 확인
- Test 2: WKAIA Deposit
- Test 3: LST 잔액 확인
- Test 4: Withdrawal
- Test 5: APY 기반 분배
- Test 6: Multi-LST 지원

---

## 📊 설정 스크립트

### `setAPY.js`
**APY 값 설정**
```bash
npx hardhat run scripts/setAPY.js --network kairos
```
- 각 LST 프로토콜의 APY 값 설정
- koKAIA, gcKAIA, stKLAY, stKAIA

---

## 💾 현재 배포 정보

### Kairos Testnet (2025-08-13)
```json
{
  "SwapContract": "0x7C755d984352cdEcCcae5137483ab1bd1Cd618DA",
  "KVaultV2": "0x77270A884A3Cb595Af3F57Dc795bAC3E14Ab23e8"
}
```

---

## 🔧 환경 설정

### 필수 환경 변수 (`.env`)
```bash
KAIROS_PRIVATE_KEY=your_testnet_private_key
KAIA_PRIVATE_KEY=your_mainnet_private_key
```

---

## 📝 사용 예시

### 새로운 배포 (전체)
```bash
# 1. 기존 배포 정보 삭제
rm deployments-kairos.json

# 2. 컴파일
yarn compile

# 3. 배포
yarn deploy-all:dev

# 4. 테스트
npx hardhat run scripts/integrationTest.js --network kairos
```

### APY 설정
```bash
npx hardhat run scripts/setAPY.js --network kairos
```

---

## ⚠️ 주의사항

1. **배포 순서**: SwapContract를 먼저 배포한 후 KVaultV2를 배포해야 함
2. **Wrapping**: koKAIA, gcKAIA, stKLAY는 자동으로 wrapped 버전으로 변환됨
3. **APY 형식**: 내부적으로 value * 10으로 저장 (예: 755 = 7.55%)
4. **Contract Size**: optimizer runs=1로 설정하여 24KB 제한 준수

---

## 📂 tests/ 폴더

디버그 및 개발 테스트를 위한 스크립트들이 보존되어 있습니다:
- 개별 기능 테스트
- 디버그 스크립트
- Wrapping/Unwrapping 테스트
- APY 분배 테스트

---

**마지막 업데이트**: 2025-08-13  
**버전**: 2.1.0  
**최적화**: optimizer runs=1 (size optimization)