# 📋 KommuneFi Vault Scripts 종합 가이드

이 폴더는 KommuneFi Vault 컨트랙트의 배포, 테스트, 관리를 위한 통합 스크립트 시스템입니다.

## 📁 폴더 구조

```
scripts/
├── 🧪 테스트 스위트 (5개)       # 메인 테스트 시스템
├── 🚀 배포 스크립트 (4개)       # 컨트랙트 배포
├── ⚙️ 업그레이드 스크립트 (4개)  # 컨트랙트 업그레이드
├── 🔍 관리 스크립트 (3개)       # 상태 확인 및 설정
├── ⚙️ 설정/관리 (4개)          # APY 및 설정 관리
└── balancer-tests/ (16개)      # Balancer 전용 테스트
```

---

## 🎯 핵심 테스트 스위트 (권장 사용)

### `advancedTestSuite.js` ⭐
**메인 테스트 스위트** - 가장 완성도 높은 종합 테스트
```bash
npx hardhat run scripts/advancedTestSuite.js --network kairos
```
- Deposit/Withdraw 기능 검증
- LST swap 메커니즘 테스트
- 에러 처리 및 복구 테스트
- 성능 및 가스 효율성 확인

### `finalSuccessfulTest.js`
**검증된 성공 테스트** - 핵심 기능 정상 동작 확인
```bash
npx hardhat run scripts/finalSuccessfulTest.js --network kairos
```
- 성공적인 Deposit 테스트
- Direct Withdraw 테스트
- Preview 함수 검증
- EstimateSwap 기능 확인

### `edgeCaseTestSuite.js`
**Edge Case 테스트** - 경계 조건 및 에러 처리 검증
```bash
npx hardhat run scripts/edgeCaseTestSuite.js --network kairos
```

### `performanceTestSuite.js`
**성능 테스트** - 가스 효율성 및 처리 성능 벤치마킹
```bash
npx hardhat run scripts/performanceTestSuite.js --network kairos
```

### `runAllTests.js` 🚀
**통합 테스트 실행기** - 모든 테스트 스위트를 순차 실행
```bash
npx hardhat run scripts/runAllTests.js --network kairos
```

---

## 🚀 배포 스크립트

### `deployAll.js` ⭐
**통합 배포 스크립트** - 모든 컨트랙트 한번에 배포
```bash
npx hardhat run scripts/deployAll.js --network kairos
```

### `deploy.js`
**기본 배포 스크립트** - 새로운 vault 배포
```bash
npx hardhat run scripts/deploy.js --network kairos
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

### `upgrade.js`
**기본 업그레이드 스크립트** - proxy 컨트랙트 업그레이드
```bash
npx hardhat run scripts/upgrade.js --network kairos
```

### `upgradeVaultWithFix.js`
**수정사항 포함 업그레이드** - 특정 버그 수정 포함
```bash
npx hardhat run scripts/upgradeVaultWithFix.js --network kairos
```

---

## 🔍 관리 스크립트

### 상태 확인

#### `checkVaultState.js` ⭐
**통합 Vault 상태 확인** - 모든 주요 정보 한눈에 확인
```bash
npx hardhat run scripts/checkVaultState.js --network kairos
```
- Vault 잔액 및 총 자산
- 사용자 예치 정보
- APY 설정 상태
- 토큰 정보

#### `checkLSTStaking.js`
**LST 스테이킹 상태 확인** - LST 관련 상세 정보
```bash
npx hardhat run scripts/checkLSTStaking.js --network kairos
```
- LST 토큰 잔액
- 스테이킹 상태
- APY 분배 현황

#### `getProxyInfo.js`
**프록시 정보 조회** - 프록시 구조 및 소유권 확인
```bash
npx hardhat run scripts/getProxyInfo.js --network kairos
```

**기능**:
- 프록시 주소, 관리자, 구현체 주소 확인
- 소유권 체인 추적
- 컬러 코딩된 출력으로 명확한 계층 구조 표시
- 에러 복구 및 재시도 로직

**출력 예시**:
```
🔍 KVaultV2
   📍 Proxy: 0x7e50...746b
   👤 Admin: 0x2085...065F
   🔧 Implementation: 0x307C...E7d
   👑 Admin Owner: 0xdc92...5d36

📊 Summary
🔑 Unified Control:
   All proxy admins controlled by: 0xdc926e34e73292cd7c48c6fd7375af7d93435d36
```

---

## ⚙️ 설정 및 관리

### APY 관리
- `testAPY.js` - APY 계산 테스트
- `testAPYDistribution.js` - APY 분배 테스트
- `resetAPY.js` - APY 초기화

### 기타 설정
- `prepareTestFunds.js` - 테스트 자금 준비
- `setSwapContract.js` - swap 컨트랙트 설정
- `updateSwapContract.js` - swap 컨트랙트 업데이트

---

## 🔄 Balancer Pool & Swap 전용 테스트

### `balancer-tests/` 폴더 (16개 스크립트)
Balancer 통합 및 LST swap 메커니즘 전용 테스트 스크립트 모음

#### 🔍 풀 상태 확인 (4개)
- `checkBalancerPools.js` ⭐ - 풀 설정 및 상태 검증
- `checkPoolConfig.js` - 풀 설정 구성 검증
- `checkAssetOrder.js` - 풀 내 자산 순서 확인
- `checkCurrentLSTSwapStatus.js` - 현재 LST swap 상태 점검

#### 🧪 Swap 기능 테스트 (7개)
- `testLSTSwap.js` - 기본 LST swap 기능 테스트
- `testSingleLSTSwap.js` - 개별 LST 상세 swap 테스트
- `testMultiLSTSwap.js` - 다중 LST 대량 swap 테스트
- `testGCKAIASwap.js` - GCKAIA 전용 swap 테스트
- `testSmallSwap.js` - 소액 swap 테스트
- `simpleSwapTest.js` - 간단한 swap 기능 검증

#### 🐛 디버깅 스크립트 (5개)
- `debugSwap.js` - Swap 실행 과정 상세 디버깅
- `debugSwapDirectly.js` - Balancer Vault 직접 호출 테스트
- `debugEstimateSwap.js` - Swap 예상 결과 계산 디버깅
- `debugLSTswap.js` - LST별 swap 과정 심층 분석
- `analyzeSwapError.js` - Swap 오류 원인 분석

#### 권장 실행 순서:
```bash
# 1. 풀 상태 확인
npx hardhat run scripts/balancer-tests/checkBalancerPools.js --network kairos

# 2. 기본 기능 테스트
npx hardhat run scripts/balancer-tests/simpleSwapTest.js --network kairos

# 3. 문제 발생시 디버깅
npx hardhat run scripts/balancer-tests/analyzeSwapError.js --network kairos
```

---

## 📖 사용 가이드

### 🚀 새 프로젝트 시작 시
```bash
# 1. 전체 배포
npx hardhat run scripts/deployAll.js --network kairos

# 2. 기본 검증
npx hardhat run scripts/finalSuccessfulTest.js --network kairos

# 3. 전체 테스트
npx hardhat run scripts/runAllTests.js --network kairos
```

### 🔧 개발 중 테스트
```bash
# 빠른 기능 검증
npx hardhat run scripts/advancedTestSuite.js --network kairos

# Balancer 관련 이슈
npx hardhat run scripts/balancer-tests/checkBalancerPools.js --network kairos

# 성능 확인
npx hardhat run scripts/performanceTestSuite.js --network kairos
```

### 🎯 프로덕션 배포 전
```bash
# 1. 전체 테스트 스위트 실행
npx hardhat run scripts/runAllTests.js --network kairos

# 2. 성능 검증
npx hardhat run scripts/performanceTestSuite.js --network kairos

# 3. Edge case 확인
npx hardhat run scripts/edgeCaseTestSuite.js --network kairos

# 4. 최종 성공 테스트
npx hardhat run scripts/finalSuccessfulTest.js --network kairos
```

### 🔍 문제 해결
```bash
# 일반적 상태 확인
npx hardhat run scripts/checkVaultState.js --network kairos

# Balancer 관련 문제
npx hardhat run scripts/balancer-tests/analyzeSwapError.js --network kairos

# 프록시 구조 확인
npx hardhat run scripts/getProxyInfo.js --network kairos
```

---

## 🔧 일반적인 문제 해결

### 1. "Panic(17)" 오류 (arithmetic underflow/overflow)
**원인**: Balancer 풀의 영 잔액, 잘못된 풀 설정
**해결**: 
```bash
npx hardhat run scripts/balancer-tests/checkBalancerPools.js --network kairos
npx hardhat run scripts/balancer-tests/analyzeSwapError.js --network kairos
```

### 2. "BAL#401/BAL#507" 오류
**원인**: Balancer 내부 오류 (주로 풀 설정 문제)
**해결**: 
```bash
npx hardhat run scripts/balancer-tests/checkPoolConfig.js --network kairos
npx hardhat run scripts/balancer-tests/debugSwapDirectly.js --network kairos
```

### 3. Deposit/Withdraw 실패
**원인**: Allowance 문제, 잔액 부족
**해결**: 
```bash
npx hardhat run scripts/finalSuccessfulTest.js --network kairos
npx hardhat run scripts/checkVaultState.js --network kairos
```

---

## ✅ 스크립트 정리 결과

### 최종 스크립트 개수
- **정리 전**: 30개 스크립트
- **정리 후**: 22개 스크립트 
- **삭제**: 9개 중복/임시 스크립트

### 삭제된 중복 스크립트들
- ~~`testDepositWithdraw.js`~~ → `advancedTestSuite.js`로 대체
- ~~`testOptimizedContract.js`~~ → `advancedTestSuite.js`로 대체
- ~~`testSuite.js`~~ → `advancedTestSuite.js`로 대체
- ~~`basicDepositWithdrawTest.js`~~ → 중복 기능
- ~~`debugDepositWithdraw.js`~~ → 임시 디버깅 스크립트
- ~~`successfulWithdrawTest.js`~~ → `finalSuccessfulTest.js`로 대체
- ~~`retryDepositTest.js`~~ → 특정 이슈 해결용 임시 스크립트
- ~~`checkAPY.js`~~ → `checkVaultState.js`에 포함
- ~~`checkVaultBalance.js`~~ → `checkVaultState.js`에 포함
- ~~`checkTokenInfo.js`~~ → `checkVaultState.js`에 포함

### 권장 워크플로우
1. **개발**: `advancedTestSuite.js` + `checkVaultState.js`
2. **검증**: `finalSuccessfulTest.js` + `getProxyInfo.js`
3. **배포**: `deployAll.js` + `runAllTests.js`
4. **문제해결**: `balancer-tests/analyzeSwapError.js`

---

## 🚨 보안 고려사항

### 프록시 소유권 구조
- **프록시 컨트랙트** → **프록시 관리자** → **EOA (외부 계정)**
- EOA가 모든 프록시 관리자를 소유하므로 궁극적인 제어권을 가짐
- 이 계정의 개인키 보안이 필수적

### 권장 보안 체크리스트
1. `getProxyInfo.js`로 소유권 구조 확인
2. `advancedTestSuite.js`로 보안 기능 검증
3. `checkVaultState.js`로 상태 이상 확인
4. Balancer 풀 상태 정기 모니터링

---

**마지막 업데이트**: 2025-01-13  
**버전**: 3.0.0 (통합 문서 및 스크립트 정리 완료)