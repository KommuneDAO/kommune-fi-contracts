# Balancer Pool & Swap 테스트 스크립트

이 폴더는 KommuneFi Vault의 Balancer 통합 및 LST swap 메커니즘을 테스트하기 위한 스크립트들을 포함합니다.

## 📋 스크립트 분류

### 🔍 풀 상태 확인 스크립트

#### `checkBalancerPools.js`
**목적**: Balancer 풀 설정 및 상태 검증  
**기능**:
- Balancer Vault 컨트랙트 존재 확인
- 각 LST의 pool1, pool2 설정 검증
- 풀 토큰 및 잔액 조회
- 영 잔액 풀 감지 (division by zero 원인)
- 풀 공유 분석

**사용법**:
```bash
npx hardhat run scripts/balancer-tests/checkBalancerPools.js --network kairos
```

#### `checkPoolConfig.js`
**목적**: 풀 설정 구성 검증  
**기능**:
- LST별 풀 ID 확인
- 토큰 페어 매칭 검증
- 풀 설정 일관성 검사

**사용법**:
```bash
npx hardhat run scripts/balancer-tests/checkPoolConfig.js --network kairos
```

#### `checkAssetOrder.js`
**목적**: Balancer 풀 내 자산 순서 확인  
**기능**:
- 풀 내 토큰 순서 검증
- swap 경로 유효성 확인
- 토큰 주소 매칭 검사

**사용법**:
```bash
npx hardhat run scripts/balancer-tests/checkAssetOrder.js --network kairos
```

#### `checkCurrentLSTSwapStatus.js`
**목적**: 현재 LST swap 상태 점검  
**기능**:
- 각 LST의 swap 가능 여부 확인
- 실시간 풀 유동성 상태
- swap 실행 가능성 평가

**사용법**:
```bash
npx hardhat run scripts/balancer-tests/checkCurrentLSTSwapStatus.js --network kairos
```

---

### 🧪 Swap 기능 테스트 스크립트

#### `testLSTSwap.js`
**목적**: 기본 LST swap 기능 테스트  
**기능**:
- 단일 LST swap 실행
- swap 결과 검증
- 기본 오류 처리 테스트

**사용법**:
```bash
npx hardhat run scripts/balancer-tests/testLSTSwap.js --network kairos
```

#### `testSingleLSTSwap.js`
**목적**: 개별 LST에 대한 상세 swap 테스트  
**기능**:
- 특정 LST 단독 테스트
- 상세한 로깅 및 분석
- 단계별 swap 과정 추적

**사용법**:
```bash
npx hardhat run scripts/balancer-tests/testSingleLSTSwap.js --network kairos
```

#### `testMultiLSTSwap.js`
**목적**: 다중 LST를 활용한 대량 swap 테스트  
**기능**:
- 여러 LST 동시 활용
- 대량 출금 시나리오 테스트
- LST 우선순위 알고리즘 검증

**사용법**:
```bash
npx hardhat run scripts/balancer-tests/testMultiLSTSwap.js --network kairos
```

#### `testGCKAIASwap.js`
**목적**: GCKAIA 전용 swap 테스트  
**기능**:
- GCKAIA 특화 테스트
- GCKAIA wrap/unwrap 검증
- GCKAIA 풀 상태 확인

**사용법**:
```bash
npx hardhat run scripts/balancer-tests/testGCKAIASwap.js --network kairos
```

#### `testSmallSwap.js`
**목적**: 소액 swap 테스트  
**기능**:
- 최소 단위 swap 테스트
- 정밀도 검증
- 라운딩 오류 체크

**사용법**:
```bash
npx hardhat run scripts/balancer-tests/testSmallSwap.js --network kairos
```

#### `simpleSwapTest.js`
**목적**: 간단한 swap 기능 검증  
**기능**:
- 기본적인 swap 실행
- 성공/실패 여부 확인
- 빠른 검증용

**사용법**:
```bash
npx hardhat run scripts/balancer-tests/simpleSwapTest.js --network kairos
```

---

### 🐛 디버깅 스크립트

#### `debugSwap.js`
**목적**: Swap 실행 과정 상세 디버깅  
**기능**:
- 단계별 실행 로그
- 중간값 추적
- 오류 지점 식별

**사용법**:
```bash
npx hardhat run scripts/balancer-tests/debugSwap.js --network kairos
```

#### `debugSwapDirectly.js`
**목적**: Balancer Vault 직접 호출 테스트  
**기능**:
- SwapContract 우회 테스트
- 직접 batchSwap 호출
- 원시 Balancer 기능 검증

**사용법**:
```bash
npx hardhat run scripts/balancer-tests/debugSwapDirectly.js --network kairos
```

#### `debugEstimateSwap.js`
**목적**: Swap 예상 결과 계산 디버깅  
**기능**:
- swap 예상량 계산
- 슬리피지 계산 검증
- 예상과 실제 결과 비교

**사용법**:
```bash
npx hardhat run scripts/balancer-tests/debugEstimateSwap.js --network kairos
```

#### `debugLSTswap.js`
**목적**: LST 별 swap 과정 심층 분석  
**기능**:
- LST별 세부 동작 분석
- wrap/unwrap 과정 추적
- 프로토콜별 차이점 분석

**사용법**:
```bash
npx hardhat run scripts/balancer-tests/debugLSTswap.js --network kairos
```

#### `analyzeSwapError.js`
**목적**: Swap 오류 원인 분석  
**기능**:
- 오류 패턴 분석
- division by zero 원인 추적
- 풀 상태와 오류 상관관계 분석

**사용법**:
```bash
npx hardhat run scripts/balancer-tests/analyzeSwapError.js --network kairos
```

---

### 🔄 비교 및 분석 스크립트

#### `compareUISwap.js`
**목적**: UI swap과 컨트랙트 swap 비교  
**기능**:
- UI 실행 결과와 비교
- 차이점 분석
- 일관성 검증

**사용법**:
```bash
npx hardhat run scripts/balancer-tests/compareUISwap.js --network kairos
```

---

## 🚀 권장 실행 순서

### 1. 초기 상태 확인
```bash
# 풀 설정 및 상태 확인
npx hardhat run scripts/balancer-tests/checkBalancerPools.js --network kairos
npx hardhat run scripts/balancer-tests/checkPoolConfig.js --network kairos
npx hardhat run scripts/balancer-tests/checkCurrentLSTSwapStatus.js --network kairos
```

### 2. 기본 기능 테스트
```bash
# 간단한 swap 테스트
npx hardhat run scripts/balancer-tests/simpleSwapTest.js --network kairos
npx hardhat run scripts/balancer-tests/testSmallSwap.js --network kairos
```

### 3. 고급 기능 테스트
```bash
# LST별 상세 테스트
npx hardhat run scripts/balancer-tests/testSingleLSTSwap.js --network kairos
npx hardhat run scripts/balancer-tests/testGCKAIASwap.js --network kairos
npx hardhat run scripts/balancer-tests/testMultiLSTSwap.js --network kairos
```

### 4. 문제 발생시 디버깅
```bash
# 오류 분석
npx hardhat run scripts/balancer-tests/analyzeSwapError.js --network kairos
npx hardhat run scripts/balancer-tests/debugSwap.js --network kairos
npx hardhat run scripts/balancer-tests/debugEstimateSwap.js --network kairos
```

## 🔧 일반적인 문제 해결

### 1. "Panic(17)" 오류 (arithmetic underflow/overflow)
**원인**: 
- Balancer 풀의 영 잔액
- 잘못된 풀 설정
- 슬리피지 계산 오버플로우

**해결 방법**:
```bash
npx hardhat run scripts/balancer-tests/checkBalancerPools.js --network kairos
npx hardhat run scripts/balancer-tests/analyzeSwapError.js --network kairos
```

### 2. "BAL#401" 오류
**원인**: Balancer 내부 오류 (주로 풀 설정 문제)

**해결 방법**:
```bash
npx hardhat run scripts/balancer-tests/checkPoolConfig.js --network kairos
npx hardhat run scripts/balancer-tests/debugSwapDirectly.js --network kairos
```

### 3. Swap 실행 안됨
**원인**: 
- 풀 유동성 부족
- 토큰 주소 불일치
- 승인 문제

**해결 방법**:
```bash
npx hardhat run scripts/balancer-tests/checkCurrentLSTSwapStatus.js --network kairos
npx hardhat run scripts/balancer-tests/debugLSTswap.js --network kairos
```

## 📊 테스트 결과 해석

### ✅ 정상 동작 시그널
- 풀 잔액 > 0
- Swap 실행 성공
- 예상과 실제 결과 일치 (5% 오차 내)

### ⚠️ 경고 시그널
- 풀 잔액 부족
- 높은 슬리피지 (>5%)
- 간헐적 실행 실패

### ❌ 문제 시그널
- Division by zero 오류
- 풀 접근 불가
- 지속적 실행 실패

## 📞 지원

문제 발생 시:
1. 해당 스크립트 실행 로그 확인
2. 관련 디버깅 스크립트 실행
3. 결과를 개발팀에 공유

---

**마지막 업데이트**: 2025-01-12  
**버전**: 1.0.0