# Test Scripts

KommuneFi 프로토콜 추가 테스트 스크립트 모음

## 🏃 stressTestDeposits.js

**목적**: 대량 입금 및 동시성 스트레스 테스트

**테스트 시나리오**:
- 동시 다중 사용자 입금 (10-100명)
- 빠른 연속 입금 처리
- 가스 한계 테스트
- 트랜잭션 충돌 처리
- 메모리 풀 혼잡 상황 시뮬레이션

**사용법**:
```bash
npx hardhat run scripts/tests/stressTestDeposits.js --network kairos
```

**설정 가능 파라미터**:
- `CONCURRENT_USERS`: 동시 사용자 수 (기본: 20)
- `DEPOSIT_AMOUNT`: 사용자당 입금액 (기본: 0.1 KAIA)
- `BATCH_SIZE`: 배치 크기 (기본: 5)

**성공 기준**:
- 모든 입금 성공
- 가스 사용량 < 300,000 per tx
- 처리 시간 < 60초
- Share 계산 정확도 100%

---

## ⏱️ testDepositWithDelay.js

**목적**: 지연된 입금 및 시간 기반 시나리오 테스트

**테스트 시나리오**:
- 입금 간 시간 지연 (1분, 5분, 1시간)
- APY 변경 중 입금
- 블록 타임스탬프 변화 영향
- 리워드 누적 중 입금
- 장기간 유휴 후 입금

**사용법**:
```bash
npx hardhat run scripts/tests/testDepositWithDelay.js --network kairos
```

**설정 가능 파라미터**:
- `DELAY_SECONDS`: 입금 간 지연 시간 (기본: 300)
- `NUM_DEPOSITS`: 총 입금 횟수 (기본: 5)
- `APY_CHANGE`: APY 변경 여부 (기본: true)

**검증 항목**:
- Share 가격 변화 추적
- 리워드 누적 정확성
- 시간 가중 수익률
- 지연 후 상태 일관성

---

## 📈 testProgressiveWithdrawal.js

**목적**: 점진적 출금 패턴 및 부분 출금 테스트

**테스트 시나리오**:
- 10% → 30% → 50% → 100% 점진적 출금
- 다양한 출금 비율 조합
- 잔액 부족 상황 처리
- 슬리피지 영향 분석
- 다중 LST 스왑 최적화

**사용법**:
```bash
npx hardhat run scripts/tests/testProgressiveWithdrawal.js --network kairos
```

**테스트 단계**:
1. 초기 대량 입금 (3 KAIA)
2. 소규모 사용자 입금 (0.1-1 KAIA)
3. 점진적 출금 시작
   - Stage 1: 10% 출금
   - Stage 2: 30% 출금
   - Stage 3: 50% 출금
   - Stage 4: 나머지 전액
4. 각 단계별 가스 사용량 측정
5. 최종 상태 검증

**성공 기준**:
- 모든 출금 단계 성공
- 슬리피지 < 10%
- 잔액 정확도 99.9%
- 가스 최적화 확인

---

## 🔄 testStableDepositsWithdrawals.js

**목적**: 안정적인 입출금 사이클 및 장기 운영 테스트

**테스트 시나리오**:
- 24시간 연속 입출금 시뮬레이션
- 랜덤 입출금 패턴
- 다양한 사용자 행동 패턴
- 풀 사이클 안정성 검증
- 장기 운영 시뮬레이션

**사용법**:
```bash
npx hardhat run scripts/tests/testStableDepositsWithdrawals.js --network kairos
```

**시뮬레이션 패턴**:
- **Conservative User**: 대량 입금, 장기 보유, 전액 출금
- **Active Trader**: 빈번한 소액 입출금
- **Whale**: 대량 입출금으로 시장 영향
- **Average User**: 일반적인 사용 패턴

**모니터링 지표**:
- TVL 변화 추이
- Share 가격 안정성
- 가스 사용 패턴
- 오류 발생률
- 처리 시간 분포

---

## 🎯 테스트 실행 가이드

### 전체 테스트 스위트 실행
```bash
# 순차 실행 (권장)
npm run test:testnet

# 개별 실행
npx hardhat run scripts/tests/stressTestDeposits.js --network kairos
npx hardhat run scripts/tests/testDepositWithDelay.js --network kairos
npx hardhat run scripts/tests/testProgressiveWithdrawal.js --network kairos
npx hardhat run scripts/tests/testStableDepositsWithdrawals.js --network kairos
```

### 메인넷 테스트 (주의 필요)
```bash
# 소규모 테스트만 실행
CONCURRENT_USERS=3 npx hardhat run scripts/tests/stressTestDeposits.js --network kaia
```

## ⚠️ 주의사항

1. **테스트넷 우선**: 모든 테스트는 테스트넷에서 먼저 실행
2. **가스비 준비**: 스트레스 테스트는 많은 가스비 필요
3. **시간 소요**: 일부 테스트는 장시간 소요 (최대 1시간)
4. **환경 변수**: 테스트 파라미터는 환경 변수로 조정 가능
5. **로그 저장**: 중요 테스트 결과는 로그 파일로 저장 권장

## 📊 결과 해석

### 성공 지표
- ✅ 모든 트랜잭션 성공
- ✅ Share 계산 오차 < 0.1%
- ✅ 가스 사용 예측 범위 내
- ✅ 처리 시간 목표 달성

### 실패 시 대응
- ❌ 트랜잭션 실패 → 가스 한도 조정
- ❌ 계산 오차 → 슬리피지 설정 확인
- ❌ 시간 초과 → 네트워크 상태 확인
- ❌ 잔액 불일치 → 스왑 로직 검토

## 🔗 관련 문서

- [통합 테스트](testIntegrated.js)
- [유틸리티 도구](../utils/README.md)
- [메인 README](../../README.md)
- [기술 문서](../../CLAUDE.md)