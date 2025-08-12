# 📋 스크립트 마이그레이션 가이드

2025-01-12 대규모 스크립트 정리에 따른 마이그레이션 가이드입니다.

## 🔄 변경 사항 요약

### ✅ 새로운 구조
- **통합 테스트 스위트**: 5개 주요 테스트 스위트로 통합
- **Balancer 전용 폴더**: `scripts/balancer-tests/`로 분리
- **정리된 스크립트**: 불필요한 40개 이상 스크립트 삭제
- **명확한 문서**: 각 스크립트의 용도와 사용법 문서화

### ❌ 삭제된 스크립트들

#### 중복된 테스트 스크립트
```bash
# 삭제됨
scripts/comprehensiveWithdrawTest.js
scripts/fullWithdrawTest.js  
scripts/minimalWithdrawTest.js
scripts/simpleWithdrawTest.js
scripts/testFixedLSTWithdraw.js
scripts/testGradualWithdraw.js
scripts/testLSTSwapWithdraw.js
scripts/testLargeWithdraw.js
scripts/testMinimalLST.js
scripts/testSimpleWithdraw.js
scripts/testWithdraw.js

# → 대체: scripts/runAllTests.js 또는 개별 테스트 스위트
```

#### 임시 디버깅 스크립트
```bash  
# 삭제됨
scripts/debugContractWrap.js
scripts/debugStKLAY.js
scripts/debugWithdrawError.js
scripts/deepDebugWithdraw.js
scripts/diagnosticTest.js
scripts/findWrapFunction.js
scripts/analyzeSuccessfulWrap.js

# → 대체: scripts/balancer-tests/ 폴더의 디버깅 스크립트
```

#### 개별 토큰 테스트
```bash
# 삭제됨
scripts/testStKAIA.js
scripts/testStKAIAUnstake.js
scripts/testWstKLAY.js
scripts/testTokenOrdering.js
scripts/testApprove.js

# → 대체: scripts/advancedTestSuite.js (포괄적 테스트 포함)
```

#### 기타 임시 스크립트
```bash
# 삭제됨
scripts/thresholdTest.js
scripts/compareImplementations.js
scripts/finalTest.js
scripts/testNewLogic.js

# → 대체: 새로운 테스트 스위트들
```

## 🔄 마이그레이션 가이드

### 기존 사용 → 새로운 사용법

#### 1. 종합적인 withdraw 테스트
```bash
# 기존 (삭제됨)
node scripts/comprehensiveWithdrawTest.js
node scripts/fullWithdrawTest.js

# 새로운 방법 ✅
yarn test:all                              # 통합 테스트 실행
# 또는
npx hardhat run scripts/runAllTests.js --network kairos
```

#### 2. 개별 LST swap 테스트  
```bash
# 기존 (이동됨)
node scripts/testMultiLSTSwap.js

# 새로운 방법 ✅  
npx hardhat run scripts/balancer-tests/testMultiLSTSwap.js --network kairos
```

#### 3. Balancer 관련 디버깅
```bash
# 기존 (삭제됨)
node scripts/debugSwap.js
node scripts/analyzeSwapError.js

# 새로운 방법 ✅
npx hardhat run scripts/balancer-tests/debugSwap.js --network kairos
npx hardhat run scripts/balancer-tests/analyzeSwapError.js --network kairos
```

#### 4. 기본 deposit/withdraw 테스트
```bash
# 기존 (일부 기능 유지)
node scripts/testDepositWithdraw.js

# 새로운 방법 (권장) ✅
yarn test:basic                            # 기본 테스트 스위트
# 또는  
npx hardhat run scripts/testSuite.js --network kairos
```

#### 5. 성능 및 가스 분석
```bash
# 기존 (삭제된 개별 스크립트들 대신)
# 새로운 방법 ✅
yarn test:performance                      # 성능 테스트 스위트
# 또는
npx hardhat run scripts/performanceTestSuite.js --network kairos
```

## 🎯 새로운 테스트 명령어

### yarn 명령어 (권장)
```bash
# 기본 테스트
yarn test:basic              # 핵심 기능 테스트
yarn test:advanced           # 고급 시나리오 테스트  
yarn test:edge               # Edge case 테스트
yarn test:performance        # 성능 벤치마크
yarn test:all                # 전체 통합 테스트

# Balancer 관련
yarn test:balancer           # Balancer 풀 상태 확인
```

### npx hardhat 명령어  
```bash
# 메인 테스트 스위트
npx hardhat run scripts/testSuite.js --network kairos
npx hardhat run scripts/advancedTestSuite.js --network kairos  
npx hardhat run scripts/edgeCaseTestSuite.js --network kairos
npx hardhat run scripts/performanceTestSuite.js --network kairos
npx hardhat run scripts/runAllTests.js --network kairos

# Balancer 전용 테스트
npx hardhat run scripts/balancer-tests/checkBalancerPools.js --network kairos
npx hardhat run scripts/balancer-tests/testMultiLSTSwap.js --network kairos
npx hardhat run scripts/balancer-tests/analyzeSwapError.js --network kairos
npx hardhat run scripts/balancer-tests/debugSwap.js --network kairos
```

## 📚 새로운 문서 구조

### 주요 문서들
- **[scripts/README.md](./scripts/README.md)**: 전체 스크립트 구조
- **[scripts/balancer-tests/README.md](./scripts/balancer-tests/README.md)**: Balancer 전용 가이드  
- **[TEST_GUIDE.md](./TEST_GUIDE.md)**: 종합 테스트 가이드
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)**: 배포 가이드

### 빠른 시작
1. **기본 테스트**: `yarn test:basic`
2. **전체 테스트**: `yarn test:all`  
3. **Balancer 문제**: `yarn test:balancer`

## 🔍 문제 해결

### 스크립트를 찾을 수 없음
```bash
Error: Cannot find module './scripts/testLargeWithdraw.js'
```
**해결**: 새로운 통합 테스트 사용
```bash
yarn test:all  # 또는 yarn test:advanced
```

### Balancer 관련 스크립트 실행 안됨
```bash  
Error: Cannot find module './scripts/debugSwap.js'
```
**해결**: Balancer 전용 폴더 사용
```bash
npx hardhat run scripts/balancer-tests/debugSwap.js --network kairos
```

### 성능 테스트 관련
```bash
# 개별 성능 스크립트들 대신
yarn test:performance  # 통합 성능 벤치마크 사용
```

## 💡 권장 사항

### 개발 워크플로우
1. **개발 시**: `yarn test:basic` (빠른 검증)
2. **완료 전**: `yarn test:all` (전체 검증)  
3. **Balancer 이슈**: `scripts/balancer-tests/` 스크립트 사용
4. **성능 확인**: `yarn test:performance`

### CI/CD 통합
```yaml
# GitHub Actions 예시
- name: Run Tests
  run: |
    yarn test:all
    if [ $? -ne 0 ]; then
      echo "Tests failed"
      exit 1
    fi
```

## 🆕 새로운 기능

### 통합 리포트 생성
- 실행 시 JSON 리포트 자동 생성
- 성능 메트릭 수집 및 분석
- 시간별 성능 변화 추적

### 스마트 에러 분석  
- 에러 타입별 분류 및 해결책 제시
- Balancer 관련 에러 전문 분석
- Edge case 시나리오별 상세 진단

---

**마이그레이션 완료일**: 2025-01-12  
**버전**: 2.0.0  
**문의**: 문제 발생 시 새로운 문서들 참조