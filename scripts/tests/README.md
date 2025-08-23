# Test Scripts

KommuneFi 프로토콜 테스트 스크립트 모음

## 📌 통합 테스트 (Integrated Tests)

### testIntegratedStable.js
**목적**: STABLE 모드 통합 테스트 (90% LST 스테이킹)

**테스트 플로우**:
1. Fresh deployment with STABLE profile
2. 3-wallet deposit/withdraw test
3. Optional unstake/claim test (set `runUnstakeClaim = true`)
4. LST distribution verification

**사용법**:
```bash
npx hardhat run scripts/tests/testIntegratedStable.js --network kairos
# or using npm script:
npm run test:stable:testnet
```

### testIntegratedBalanced.js
**목적**: BALANCED 모드 통합 테스트 (45% LST + 45% LP 풀)

**테스트 플로우**:
1. Use existing deployment (no fresh deploy)
2. Switch to BALANCED profile
3. 3-wallet deposit/withdraw test  
4. LP token creation/removal verification
5. Balancer pool integration test

**사용법**:
```bash
npx hardhat run scripts/tests/testIntegratedBalanced.js --network kairos
# or using npm script:
npm run test:balanced:testnet
```

---

## 🧪 기능별 테스트 (Feature Tests)

### testDepositWithdraw.js
**목적**: 입출금 플로우 단독 테스트

**테스트 플로우**:
1. KAIA/WKAIA 입금 테스트
2. 출금 기능 테스트
3. Share 계산 검증
4. 수수료 및 슬리피지 확인

**사용법**:
```bash
npx hardhat run scripts/tests/testDepositWithdraw.js --network kairos
```

### testUnstakeClaim.js
**목적**: Owner의 언스테이크/클레임 작업 테스트

**테스트 플로우**:
1. wKoKAIA를 KoKAIA로 unwrap
2. Owner가 KoKAIA unstake 실행
3. 10분 대기 (테스트넷)
4. Owner가 claim 실행
5. WKAIA가 VaultCore에 남아있는지 확인

**사용법**:
```bash
npx hardhat run scripts/tests/testUnstakeClaim.js --network kairos
```

---

## 🎯 테스트 실행 가이드

### 통합 테스트 실행
```bash
# STABLE 모드 테스트
npm run test:stable:testnet

# BALANCED 모드 테스트  
npm run test:balanced:testnet

# 메인넷 테스트
npm run test:stable:mainnet
npm run test:balanced:mainnet
```

### 기능별 테스트
```bash
# 입출금 테스트
npx hardhat run scripts/tests/testDepositWithdraw.js --network kairos

# 언스테이크/클레임 테스트
npx hardhat run scripts/tests/testUnstakeClaim.js --network kairos

# 업그레이드 테스트 (scripts 폴더에 위치)
npx hardhat run scripts/testUpgrades.js --network kairos
```

## ⚠️ 주의사항

1. **테스트넷 우선**: 모든 테스트는 테스트넷에서 먼저 실행
2. **가스비 준비**: 통합 테스트는 fresh deployment 포함하여 가스비 필요
3. **시간 소요**: unstake/claim 테스트는 10분 이상 소요
4. **순서 중요**: BALANCED 테스트는 기존 deployment 필요

## 📊 결과 해석

### 성공 지표
- ✅ 모든 트랜잭션 성공
- ✅ Share 계산 정확도 확인
- ✅ LST 분배 정상 작동
- ✅ LP 토큰 생성/제거 확인 (BALANCED 모드)

### 실패 시 대응
- ❌ 트랜잭션 실패 → 가스 한도 조정
- ❌ 계산 오차 → 슬리피지 설정 확인
- ❌ 시간 초과 → 네트워크 상태 확인
- ❌ 잔액 불일치 → 스왑 로직 검토

## 🔗 관련 문서

- [STABLE 모드 통합 테스트](./testIntegratedStable.js)
- [BALANCED 모드 통합 테스트](./testIntegratedBalanced.js)
- [입출금 테스트](./testDepositWithdraw.js)
- [언스테이크/클레임 테스트](./testUnstakeClaim.js)
- [메인 README](../../README.md)
- [기술 문서](../../CLAUDE.md)