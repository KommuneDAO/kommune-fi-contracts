# 🔄 Balancer Pool & Swap 전용 테스트

KommuneFi Vault의 Balancer 통합 및 LST swap 메커니즘을 위한 전용 테스트 스크립트 모음입니다.

> 📖 **전체 가이드**: 상위 폴더의 `README.md`에서 전체 스크립트 시스템 가이드를 확인하세요.

## 🚀 빠른 시작

### 기본 점검 (문제 발생시 우선 실행)
```bash
# 풀 상태 확인
npx hardhat run scripts/balancer-tests/checkBalancerPools.js --network kairos

# 간단한 swap 테스트
npx hardhat run scripts/balancer-tests/simpleSwapTest.js --network kairos

# 오류 분석 (문제 발생시)
npx hardhat run scripts/balancer-tests/analyzeSwapError.js --network kairos
```

## 📋 스크립트 분류 (16개)

### 🔍 풀 상태 확인 (4개)
- `checkBalancerPools.js` ⭐ - 풀 설정 및 상태 검증 (우선 실행)
- `checkPoolConfig.js` - 풀 설정 구성 검증
- `checkAssetOrder.js` - 풀 내 자산 순서 확인
- `checkCurrentLSTSwapStatus.js` - 현재 LST swap 상태 점검

### 🧪 Swap 기능 테스트 (7개)
- `simpleSwapTest.js` ⭐ - 간단한 swap 기능 검증 (빠른 검증용)
- `testLSTSwap.js` - 기본 LST swap 기능 테스트
- `testSingleLSTSwap.js` - 개별 LST 상세 swap 테스트
- `testMultiLSTSwap.js` - 다중 LST 대량 swap 테스트
- `testGCKAIASwap.js` - GCKAIA 전용 swap 테스트
- `testSmallSwap.js` - 소액 swap 테스트

### 🐛 디버깅 스크립트 (5개)
- `analyzeSwapError.js` ⭐ - Swap 오류 원인 분석 (문제 발생시 우선)
- `debugSwap.js` - Swap 실행 과정 상세 디버깅
- `debugSwapDirectly.js` - Balancer Vault 직접 호출 테스트
- `debugEstimateSwap.js` - Swap 예상 결과 계산 디버깅
- `debugLSTswap.js` - LST별 swap 과정 심층 분석
- `compareUISwap.js` - UI와 컨트랙트 swap 결과 비교

## 🔧 일반적인 문제 해결

### "Panic(17)" 오류 (division by zero)
```bash
npx hardhat run scripts/balancer-tests/checkBalancerPools.js --network kairos
npx hardhat run scripts/balancer-tests/analyzeSwapError.js --network kairos
```

### "BAL#401/BAL#507" 오류
```bash
npx hardhat run scripts/balancer-tests/checkPoolConfig.js --network kairos
npx hardhat run scripts/balancer-tests/debugSwapDirectly.js --network kairos
```

### Swap 실행 안됨
```bash
npx hardhat run scripts/balancer-tests/checkCurrentLSTSwapStatus.js --network kairos
npx hardhat run scripts/balancer-tests/debugLSTswap.js --network kairos
```

## 📊 상태 시그널

- ✅ **정상**: 풀 잔액 > 0, Swap 성공, 오차 <5%
- ⚠️ **경고**: 풀 잔액 부족, 높은 슬리피지 >5%
- ❌ **문제**: Division by zero, 풀 접근 불가, 지속적 실패

---

**상세 사용법**: 각 스크립트 파일 내부의 주석을 참조하거나 상위 폴더 `README.md` 확인  
**버전**: 2.0.0 (간소화 완료)