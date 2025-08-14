# KommuneFi Vault 테스트 가이드

이 가이드는 KommuneFi Vault 컨트랙트의 포괄적인 테스트 방법을 설명합니다.

## 📋 목차

1. [테스트 개요](#-테스트-개요)
2. [테스트 환경 설정](#-테스트-환경-설정)
3. [테스트 실행](#-테스트-실행)
4. [결과 해석](#-결과-해석)
5. [문제 해결](#-문제-해결)

## 🎯 테스트 개요

KommuneFi Vault는 다음과 같은 핵심 기능을 제공합니다:
- **WKAIA Deposit**: 사용자의 WKAIA를 vault에 예치하여 shares 발행
- **WKAIA Withdraw**: Shares를 사용하여 WKAIA 출금
- **LST Integration**: 여러 Liquid Staking Token (KoKAIA, GCKAIA, stKLAY, stKAIA) 활용
- **APY Management**: 동적 APY 기반 자산 할당

### 테스트 범위
- ✅ 기본 기능 (Deposit/Withdraw)
- ✅ APY 관리 시스템
- ✅ LST 스왑 메커니즘
- ✅ 컨트랙트 크기 최적화
- ✅ 가스 효율성

## 🔧 테스트 환경 설정

### 사전 요구사항

1. **Node.js 및 의존성 설치**
```bash
yarn install
```

2. **Hardhat 설정 확인**
```bash
npx hardhat --version
```

3. **네트워크 설정** (`hardhat.config.js`)
```javascript
networks: {
  kairos: {
    url: "https://responsive-green-emerald.kaia-kairos.quiknode.pro",
    accounts: [process.env.KAIROS_PRIVATE_KEY],
    chainId: 1001
  },
  kaia: {
    url: "https://klaytn-en.kommunedao.xyz:8651",
    accounts: [process.env.KAIA_PRIVATE_KEY],
    chainId: 8217
  }
}
```

4. **환경 변수 설정** (`.env`)
```
KAIROS_PRIVATE_KEY=your_testnet_private_key
KAIA_PRIVATE_KEY=your_mainnet_private_key
PRIVATE_KEY=your_testnet_private_key  # 레거시 호환성
```

### 테스트 자금 준비

테스트를 위해 다음이 필요합니다:
- **WKAIA 토큰**: 최소 10 WKAIA (deposit/withdraw 테스트용)
- **Gas 비용**: 약 0.1 KAIA (트랜잭션 수수료용)

**Kairos 테스트넷에서 WKAIA 획득:**
1. [Kairos Faucet](https://faucet.kairos.network)에서 KAIA 받기
2. WKAIA 컨트랙트에서 wrap 실행

## 🚀 테스트 실행

### 1. 통합 테스트 (권장)

전체 시스템의 통합 테스트를 실행합니다:

```bash
# Testnet (Kairos)
yarn test:integration

# Mainnet (Kaia)
yarn test:integration:prod
```

**테스트 내용**:
- 컨트랙트 배포 상태 확인
- Deposit/Withdraw 기능 검증
- APY 시스템 테스트
- 가스 효율성 분석

### 2. APY 시스템 테스트

APY 관리 시스템을 테스트합니다:

```bash
# APY 기능 테스트
yarn test-apy:dev

# APY 값 초기화
yarn reset-apy:dev
```

**테스트 내용**:
- APY 설정 및 조회
- 자산 분배 로직
- 출금 우선순위

### 3. 컨트랙트 크기 테스트

컨트랙트 크기가 24.576 KiB 제한 내에 있는지 확인합니다:

```bash
yarn sizetest
```

**현재 크기 (optimizer runs=200)**:
- KVaultV2: 23.703 KiB ✅
- SwapContract: 4.164 KiB ✅

### 4. Hardhat 기본 테스트

기본 유닛 테스트를 실행합니다:

```bash
yarn test
```

## 📊 결과 해석

### 성공 케이스 예시
```
✅ Vault Configuration Test
  - Deployed contracts verified
  - APY values correctly set
  
✅ Deposit Test
  - Deposited: 1.0 WKAIA
  - Shares received: 0.995
  - Gas used: 150,234
  
✅ Withdraw Test  
  - Shares burned: 0.5
  - WKAIA received: 0.498
  - Gas used: 245,567
```

### 실패 케이스 처리
```
❌ Error: Insufficient balance
  → 해결: 테스트 계정에 충분한 WKAIA 확보
  
❌ Error: Slippage too high
  → 해결: Slippage 임계값 조정 또는 유동성 확인
```

## 🛠️ 문제 해결

### 일반적인 문제들

#### 1. RPC 연결 실패
```
Error: the method web3_clientVersion does not exist
```
**해결책**: QuickNode RPC URL 사용 확인
```javascript
url: "https://responsive-green-emerald.kaia-kairos.quiknode.pro"
```

#### 2. 잔액 부족
```
Error: Insufficient WKAIA balance
```
**해결책**: 
- Faucet에서 KAIA 획득
- KAIA를 WKAIA로 wrap

#### 3. 컨트랙트 크기 초과
```
Error: Contract size exceeds 24.576 KiB limit
```
**해결책**: 
- Optimizer runs 조정
- 불필요한 코드 제거

### 디버깅 팁

1. **상세 로그 활성화**
```javascript
const DEBUG = true;
```

2. **특정 테스트만 실행**
```bash
npx hardhat run scripts/integrationTest.js --network kairos
```

3. **가스 사용량 모니터링**
```javascript
const receipt = await tx.wait();
console.log("Gas used:", receipt.gasUsed.toString());
```

## 📈 최적화 권장사항

### 가스 최적화
- Batch 작업 활용
- 불필요한 storage 읽기/쓰기 최소화
- Event 로그 최적화

### 테스트 효율성
- 병렬 테스트 실행 피하기 (nonce 충돌)
- 테스트 간 충분한 대기 시간
- 재사용 가능한 테스트 데이터 준비

## 🔄 지속적 통합

### GitHub Actions 설정 예시
```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: yarn install
      - run: yarn compile
      - run: yarn sizetest
      - run: yarn test
```

## 📚 관련 문서

- **[README.md](./README.md)**: 프로젝트 개요
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)**: 배포 가이드
- **[scripts/README.md](./scripts/README.md)**: 스크립트 사용법

---

**마지막 업데이트**: 2025-08-13  
**버전**: 2.1.0  
**테스트 환경**: Kairos Testnet with QuickNode RPC