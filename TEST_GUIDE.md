# KommuneFi Vault 테스트 가이드

이 가이드는 KommuneFi Vault 컨트랙트의 포괄적인 테스트 방법을 설명합니다.

## 📋 목차

1. [테스트 개요](#-테스트-개요)
2. [테스트 환경 설정](#-테스트-환경-설정)
3. [테스트 스위트 소개](#-테스트-스위트-소개)
4. [테스트 실행 방법](#-테스트-실행-방법)
5. [결과 해석](#-결과-해석)
6. [문제 해결](#-문제-해결)
7. [고급 사용법](#-고급-사용법)

## 🎯 테스트 개요

KommuneFi Vault는 다음과 같은 핵심 기능을 제공합니다:
- **WKAIA Deposit**: 사용자의 WKAIA를 vault에 예치하여 shares 발행
- **WKAIA Withdraw**: Shares를 사용하여 WKAIA 출금
- **LST Integration**: 여러 Liquid Staking Token (KoKAIA, GCKAIA, stKLAY, stKAIA) 활용
- **Smart Swap**: 출금 시 필요에 따라 LST를 WKAIA로 자동 변환

### 테스트 범위
- ✅ 기본 기능 (Deposit/Withdraw)
- ✅ LST 스왑 메커니즘
- ✅ 다양한 시나리오 및 금액
- ✅ Edge case 및 에러 처리
- ✅ 보안 검증
- ✅ 성능 및 가스 효율성

## 🔧 테스트 환경 설정

### 사전 요구사항

1. **Node.js 및 의존성 설치**
```bash
npm install
# 또는
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
    url: "https://public-en.kairos.node.kaia.io",
    accounts: [process.env.PRIVATE_KEY],
    chainId: 1001
  }
}
```

4. **환경 변수 설정** (`.env`)
```
PRIVATE_KEY=your_private_key_here
```

### 테스트 자금 준비

테스트를 위해 다음이 필요합니다:
- **WKAIA 토큰**: 최소 10 WKAIA (deposit/withdraw 테스트용)
- **Gas 비용**: 약 0.1 KAIA (트랜잭션 수수료용)

**Kairos 테스트넷에서 WKAIA 획득:**
1. [Kairos Faucet](https://faucet.kairos.network)에서 KAIA 받기
2. WKAIA 컨트랙트에서 wrap 실행

## 📊 테스트 스위트 소개

### 🎯 메인 테스트 스위트

#### 1. 기본 테스트 스위트 (`testSuite.js`)
**목적**: 핵심 기능이 올바르게 작동하는지 검증

**테스트 내용**:
- 컨트랙트 배포 상태 확인
- 사용자 잔액 및 LST 설정 검증
- 기본 deposit 기능 (0.1 WKAIA)
- 기본 withdraw 기능 (0.05 WKAIA)

**예상 실행 시간**: 2-3분

#### 2. 고급 테스트 스위트 (`advancedTestSuite.js`)
**목적**: 다양한 시나리오에서 LST swap 메커니즘 검증

**테스트 내용**:
- 다양한 금액별 withdraw (0.01 ~ 2.0 WKAIA)
- LST swap 로직 검증
- 가스 효율성 분석
- LST 임계값 준수 검증

**예상 실행 시간**: 5-10분

#### 3. Edge Case 테스트 스위트 (`edgeCaseTestSuite.js`)
**목적**: 경계 조건 및 에러 상황에서 안정성 검증

**테스트 내용**:
- 극소량 작업 (1 wei)
- 잔액 초과 시도
- 무효한 파라미터
- 보안 검증
- 계산 정확성

**예상 실행 시간**: 3-5분

#### 4. 성능 테스트 스위트 (`performanceTestSuite.js`)
**목적**: 가스 사용량 및 처리 성능 벤치마킹

**테스트 내용**:
- 금액별 가스 사용량 측정
- 직접 출금 vs LST swap 출금 비교
- 연속 작업 성능
- View 함수 호출 성능

**예상 실행 시간**: 5-8분

#### 5. 통합 테스트 실행기 (`runAllTests.js`) ⭐
**목적**: 모든 테스트 스위트를 순차적으로 실행하고 종합 리포트 생성

### 🔄 Balancer Pool & Swap 테스트

#### Balancer 전용 테스트 스위트 (`balancer-tests/`)
**목적**: Balancer 통합 및 LST swap 메커니즘 전문 테스트

**주요 스크립트**:
- `checkBalancerPools.js` - 풀 상태 및 설정 검증
- `testMultiLSTSwap.js` - 다중 LST swap 테스트  
- `analyzeSwapError.js` - swap 오류 원인 분석
- `debugSwap.js` - swap 과정 디버깅

**상세 정보**: [scripts/balancer-tests/README.md](./scripts/balancer-tests/README.md) 참조

**예상 실행 시간**: 스크립트별 2-5분

## 🚀 테스트 실행 방법

### 단일 테스트 스위트 실행

#### 1. 기본 테스트 (필수)
```bash
npx hardhat run scripts/testSuite.js --network kairos
```

#### 2. 고급 테스트
```bash
npx hardhat run scripts/advancedTestSuite.js --network kairos
```

#### 3. Edge Case 테스트
```bash
npx hardhat run scripts/edgeCaseTestSuite.js --network kairos
```

#### 4. 성능 테스트
```bash
npx hardhat run scripts/performanceTestSuite.js --network kairos
```

### 전체 테스트 실행 (권장)

```bash
npx hardhat run scripts/runAllTests.js --network kairos
```

이 명령어는 모든 테스트 스위트를 순차적으로 실행하고 종합 리포트를 생성합니다.

### Balancer Pool & Swap 테스트 (디버깅용)

Balancer 관련 문제 발생 시 전용 테스트 사용:
```bash
# 풀 상태 확인
npx hardhat run scripts/balancer-tests/checkBalancerPools.js --network kairos

# 다중 LST swap 테스트
npx hardhat run scripts/balancer-tests/testMultiLSTSwap.js --network kairos

# Swap 오류 분석
npx hardhat run scripts/balancer-tests/analyzeSwapError.js --network kairos

# Swap 과정 디버깅
npx hardhat run scripts/balancer-tests/debugSwap.js --network kairos
```

### 개별 기능 테스트 (레거시)

기본적인 개별 테스트:
```bash
# 간단한 Deposit/Withdraw 테스트
npx hardhat run scripts/testDepositWithdraw.js --network kairos
```

## 📈 결과 해석

### 성공적인 테스트 결과

```
🎉 모든 기본 테스트 통과! 고급 테스트를 실행하세요.
✅ 성공: 5/5 (100.0%)
```

**의미**: 모든 핵심 기능이 정상 작동합니다.

### 부분적 성공

```
⚠️ 일부 테스트 실패. 컨트랙트 상태를 확인하세요.
✅ 성공: 3/5 (60.0%)
```

**의미**: 일부 기능에 문제가 있습니다. 실패한 테스트를 확인해야 합니다.

### 주요 에러 메시지와 해석

#### 1. "Wrap failed: no tokens received"
```
❌ Deposit 실패: Wrap failed: no tokens received
🎯 SUCCESS: Our fix detected a wrap failure!
```

**의미**: LST wrap 검증 로직이 올바르게 작동하고 있습니다. 특정 LST 프로토콜에 제한사항이 있을 수 있습니다.

**대응**: 
- 해당 LST 프로토콜 문서 확인
- 프로토콜 팀에 컨트랙트 통합 지원 요청

#### 2. "arithmetic underflow or overflow"
```
❌ 실패: arithmetic underflow or overflow
💡 Arithmetic underflow 감지 - 계산 로직 수정 필요
```

**의미**: 수학적 계산에서 언더플로우 발생. 계산 로직 개선이 필요합니다.

**대응**:
- 계산 순서 검토
- SafeMath 라이브러리 사용 확인
- 경계 조건 처리 개선

#### 3. "insufficient liquidity"
```
❌ 실패: insufficient liquidity
💡 DEX 유동성 부족
```

**의미**: DEX의 유동성이 부족하여 swap이 실패했습니다.

**대응**:
- Balancer 풀 상태 확인: `scripts/balancer-tests/checkBalancerPools.js`
- 더 작은 금액으로 테스트
- 풀별 개별 테스트: `scripts/balancer-tests/testSingleLSTSwap.js`

### 성능 지표 해석

#### 가스 사용량
- **직접 출금**: 80,000 - 150,000 gas (정상)
- **Swap 출금**: 200,000 - 400,000 gas (정상)
- **Swap 오버헤드**: +50% ~ +200% (정상 범위)

#### 처리 시간 (Kairos 테스트넷)
- **일반 트랜잭션**: 1-3초 (정상)
- **복잡한 swap**: 3-10초 (정상)
- **10초 이상**: 네트워크 문제 또는 가스 부족

## 🔧 문제 해결

### 일반적인 문제들

#### 1. "insufficient funds for intrinsic transaction cost"
**원인**: 가스비용을 위한 KAIA 부족
**해결**: Faucet에서 KAIA 충전

#### 2. "nonce too low"
**원인**: 트랜잭션 nonce 문제
**해결**: 
```bash
# 메타마스크에서 계정 리셋 또는
npx hardhat clean
```

#### 3. "Contract not deployed"
**원인**: deployments 파일 없음
**해결**: 
```bash
npx hardhat run scripts/deploy.js --network kairos
```

#### 4. "WKAIA 잔액 부족"
**원인**: 테스트용 WKAIA 부족
**해결**: 
1. KAIA를 WKAIA로 wrap
2. 더 작은 금액으로 테스트

### 테스트 환경 초기화

문제가 계속될 경우 환경을 초기화하세요:

```bash
# Hardhat 캐시 정리
npx hardhat clean

# 노드 모듈 재설치
rm -rf node_modules
npm install

# 새로운 배포
npx hardhat run scripts/deploy.js --network kairos
```

## 🔬 고급 사용법

### 커스텀 테스트 작성

기존 테스트 스위트를 참고하여 특정 시나리오 테스트를 작성할 수 있습니다:

```javascript
// scripts/myCustomTest.js
const { ethers } = require("hardhat");
const fs = require("fs");

async function myCustomTest() {
  const deployments = JSON.parse(fs.readFileSync("deployments-kairos.json", 'utf8'));
  const vault = await ethers.getContractAt("KVaultV2", deployments.KVaultV2);
  
  // 사용자 정의 테스트 로직
  // ...
}

myCustomTest()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### 테스트 결과 모니터링

테스트 실행 시 생성되는 리포트 파일들:
- `test-report-[timestamp].json`: 전체 테스트 결과
- `performance-report-[timestamp].json`: 성능 벤치마크 결과

이 파일들을 사용하여 시간별 성능 변화를 추적할 수 있습니다.

### CI/CD 통합

GitHub Actions 등에서 자동화:

```yaml
- name: Run Tests
  run: |
    npx hardhat run scripts/runAllTests.js --network kairos
    if [ $? -ne 0 ]; then
      echo "Tests failed"
      exit 1
    fi
```

## 📞 지원 및 문의

테스트 실행 중 문제가 발생하면:

1. **로그 확인**: 자세한 에러 메시지 분석
2. **Issue 등록**: GitHub에서 문제 상황 리포트
3. **문서 확인**: 컨트랙트 및 프로토콜 문서 검토

## 📚 관련 문서

- **[scripts/README.md](./scripts/README.md)**: 전체 스크립트 구조 및 사용법
- **[scripts/balancer-tests/README.md](./scripts/balancer-tests/README.md)**: Balancer 전용 테스트 가이드
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)**: 컨트랙트 배포 가이드
- **[README.md](./README.md)**: 프로젝트 전체 개요
- **[Hardhat 문서](https://hardhat.org/docs)**: Hardhat 사용법
- **[Kaia 문서](https://docs.kaia.io)**: Kaia 네트워크 정보

## 🆕 스크립트 정리 안내

**2025-01-12 대규모 정리 완료**:
- 40개 이상의 중복/임시 스크립트 삭제
- Balancer 관련 스크립트를 `balancer-tests/` 폴더로 분리
- 메인 테스트 스위트 5개로 통합
- 각 테스트 목적별 명확한 구분

기존 개별 테스트 스크립트를 사용하던 경우, 새로운 통합 테스트 스위트 사용을 권장합니다.

---

**마지막 업데이트**: 2025-01-12  
**버전**: 2.0.0  
**테스트 스위트 버전**: 통합 검증 시스템