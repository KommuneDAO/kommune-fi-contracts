# KommuneFi Vault Scripts 정리

이 폴더는 KommuneFi Vault 컨트랙트의 배포, 테스트, 관리를 위한 스크립트들을 포함합니다.

## 📁 폴더 구조

```
scripts/
├── balancer-tests/          # Balancer Pool & Swap 전용 테스트
├── 메인 테스트 스위트        # 종합적인 테스트 시스템
├── 배포 스크립트             # 컨트랙트 배포 및 업그레이드
├── 관리 스크립트             # 상태 확인 및 설정
└── 레거시 스크립트           # 유지 필요한 기존 스크립트
```

## 🎯 메인 테스트 스위트 (권장)

### `testSuite.js` 
**기본 테스트 스위트** - 핵심 기능 검증
```bash
npx hardhat run scripts/testSuite.js --network kairos
```

### `advancedTestSuite.js`
**고급 테스트 스위트** - 다양한 시나리오 및 LST swap 테스트
```bash
npx hardhat run scripts/advancedTestSuite.js --network kairos
```

### `edgeCaseTestSuite.js`
**Edge Case 테스트 스위트** - 경계 조건 및 에러 처리 검증
```bash
npx hardhat run scripts/edgeCaseTestSuite.js --network kairos
```

### `performanceTestSuite.js`
**성능 테스트 스위트** - 가스 효율성 및 처리 성능 벤치마킹
```bash
npx hardhat run scripts/performanceTestSuite.js --network kairos
```

### `runAllTests.js` ⭐
**통합 테스트 실행기** - 모든 테스트 스위트를 순차 실행
```bash
npx hardhat run scripts/runAllTests.js --network kairos
```

---

## 🔄 Balancer Pool & Swap 테스트

### `balancer-tests/` 폴더
Balancer 통합 및 LST swap 메커니즘 전용 테스트 스크립트 모음

**상세 정보**: [balancer-tests/README.md](./balancer-tests/README.md) 참조

**주요 스크립트**:
- `checkBalancerPools.js` - 풀 상태 확인
- `analyzeSwapError.js` - swap 오류 분석
- `testMultiLSTSwap.js` - 다중 LST swap 테스트
- `debugSwap.js` - swap 디버깅

---

## 🚀 배포 스크립트

### `deploy.js`
**기본 배포 스크립트** - 새로운 vault 배포
```bash
npx hardhat run scripts/deploy.js --network kairos
```

### `deployAll.js`
**전체 배포 스크립트** - 모든 컨트랙트 배포
```bash
npx hardhat run scripts/deployAll.js --network kairos
```

### `deployKVaultV2.js`
**KVaultV2 전용 배포** - V2 vault만 배포
```bash
npx hardhat run scripts/deployKVaultV2.js --network kairos
```

### `deploySwapContract.js`
**SwapContract 배포** - swap 컨트랙트만 배포
```bash
npx hardhat run scripts/deploySwapContract.js --network kairos
```

---

## ⚙️ 업그레이드 스크립트

### `upgrade.js`
**기본 업그레이드 스크립트** - proxy 컨트랙트 업그레이드
```bash
npx hardhat run scripts/upgrade.js --network kairos
```

### `upgradeKVaultV2.js`
**KVaultV2 업그레이드** - V2 vault 업그레이드
```bash
npx hardhat run scripts/upgradeKVaultV2.js --network kairos
```

### `upgradeSwapContract.js`
**SwapContract 업그레이드** - swap 컨트랙트 업그레이드
```bash
npx hardhat run scripts/upgradeSwapContract.js --network kairos
```

### `upgradeVaultWithFix.js`
**수정사항 포함 업그레이드** - 특정 버그 수정 포함
```bash
npx hardhat run scripts/upgradeVaultWithFix.js --network kairos
```

---

## 🔍 관리 스크립트

### 상태 확인
- `checkVaultBalance.js` - vault 잔액 확인
- `checkVaultState.js` - vault 전체 상태 확인
- `checkTokenInfo.js` - 토큰 정보 확인
- `getProxyInfo.js` - proxy 정보 조회

### APY 관리
- `checkAPY.js` - 현재 APY 확인
- `testAPY.js` - APY 계산 테스트
- `testAPYDistribution.js` - APY 분배 테스트
- `resetAPY.js` - APY 초기화

### 설정 관리
- `setSwapContract.js` - swap 컨트랙트 설정
- `updateSwapContract.js` - swap 컨트랙트 업데이트

---

## 🗂️ 레거시 스크립트 (유지)

### `testDepositWithdraw.js`
**개별 deposit/withdraw 테스트** - 단순한 기능 테스트용
```bash
npx hardhat run scripts/testDepositWithdraw.js --network kairos
```
*참고: 새로운 testSuite.js 사용 권장*

---

## 📖 사용 가이드

### 새 프로젝트 시작 시
1. **배포**: `npx hardhat run scripts/deployAll.js --network kairos`
2. **기본 테스트**: `npx hardhat run scripts/testSuite.js --network kairos`
3. **전체 검증**: `npx hardhat run scripts/runAllTests.js --network kairos`

### 개발 중 테스트
1. **빠른 검증**: `npx hardhat run scripts/testSuite.js --network kairos`
2. **Balancer 이슈**: `npx hardhat run scripts/balancer-tests/checkBalancerPools.js --network kairos`
3. **성능 확인**: `npx hardhat run scripts/performanceTestSuite.js --network kairos`

### 프로덕션 배포 전
1. **전체 테스트**: `npx hardhat run scripts/runAllTests.js --network kairos`
2. **성능 검증**: `npx hardhat run scripts/performanceTestSuite.js --network kairos`
3. **Edge case 확인**: `npx hardhat run scripts/edgeCaseTestSuite.js --network kairos`

### 문제 해결
1. **Balancer 관련**: `scripts/balancer-tests/` 폴더 스크립트 사용
2. **일반적 문제**: `npx hardhat run scripts/checkVaultState.js --network kairos`
3. **성능 문제**: `npx hardhat run scripts/performanceTestSuite.js --network kairos`

## 🚨 주의사항

### 삭제된 스크립트
다음 스크립트들은 중복 및 불필요로 인해 삭제되었습니다:
- 임시 디버깅 스크립트들 (debug*, analyze* 시리즈)
- 중복된 테스트 스크립트들 (test*Withdraw, test*LST 시리즈)
- 특정 문제 해결용 임시 스크립트들

### 마이그레이션 가이드
기존 스크립트를 사용하던 경우:
- **개별 withdraw 테스트** → `runAllTests.js` 또는 `advancedTestSuite.js` 사용
- **LST swap 테스트** → `balancer-tests/` 폴더 스크립트 사용  
- **디버깅** → `balancer-tests/debug*.js` 스크립트 사용

## 📁 파일 정리 결과

### 유지된 파일 (28개)
- 메인 테스트 스위트: 5개
- Balancer 테스트: 15개 (별도 폴더)
- 배포 스크립트: 4개
- 업그레이드 스크립트: 4개
- 관리 스크립트: 8개
- 레거시: 1개

### 삭제된 파일 (~40개)
- 중복 테스트 스크립트
- 임시 디버깅 스크립트  
- 특정 문제 해결용 스크립트
- 개별 토큰 테스트 스크립트

---

**마지막 업데이트**: 2025-01-12  
**버전**: 2.0.0 (대규모 정리 완료)