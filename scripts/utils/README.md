# Utility Scripts

유틸리티 스크립트 모음 - KommuneFi 프로토콜 관리 및 모니터링 도구

## 📊 analyzeWKAIAState.js

**목적**: WKAIA 토큰 상태 및 잔액 분석

**기능**:
- Vault의 WKAIA 잔액 확인
- 사용자별 WKAIA 할당량 분석
- 전체 WKAIA 유동성 상태 파악
- LST별 WKAIA 변환 가능량 계산

**사용법**:
```bash
npx hardhat run scripts/utils/analyzeWKAIAState.js --network kairos
```

**출력 정보**:
- Total WKAIA in vault
- Available WKAIA for withdrawals
- WKAIA locked in LSTs
- Per-user WKAIA allocation

---

## 💰 checkWalletStates.js

**목적**: 지갑 상태 및 잔액 종합 확인

**기능**:
- 여러 지갑의 잔액 동시 확인
- kvKAIA (shares) 잔액 조회
- WKAIA 잔액 조회
- 네이티브 KAIA 잔액 조회
- maxWithdraw 가능 금액 계산

**사용법**:
```bash
npx hardhat run scripts/utils/checkWalletStates.js --network kairos
```

**출력 정보**:
- 각 지갑별 kvKAIA shares
- 각 지갑별 WKAIA 잔액
- 각 지갑별 출금 가능 금액
- 전체 TVL (Total Value Locked)

---

## 🚨 rescueTokens.js

**목적**: 긴급 상황시 토큰 복구

**기능**:
- 컨트랙트에 갇힌 토큰 복구
- 잘못 전송된 토큰 회수
- SwapContract의 미사용 토큰 회수
- 긴급 출금 처리

**사용법**:
```bash
# 특정 토큰 복구
npx hardhat run scripts/utils/rescueTokens.js --network kairos

# 환경변수로 토큰 지정
TOKEN_ADDRESS=0x... npx hardhat run scripts/utils/rescueTokens.js --network kairos
```

**주의사항**:
- Owner 권한 필요
- 긴급 상황에서만 사용
- 복구 전 잔액 확인 필수
- 트랜잭션 기록 보관

---

## ⚙️ setInvestRatio.js

**목적**: 투자 비율 설정 및 조정

**기능**:
- VaultCore의 investRatio 설정
- 유동성 보유 비율 조정
- LST 투자 비율 변경
- 현재 비율 조회

**사용법**:
```bash
# 90% 투자, 10% 유동성 (기본값)
npx hardhat run scripts/utils/setInvestRatio.js --network kairos

# 커스텀 비율 설정 (환경변수)
INVEST_RATIO=8500 npx hardhat run scripts/utils/setInvestRatio.js --network kairos
```

**파라미터**:
- `INVEST_RATIO`: 0-10000 (0-100%)
- 9000 = 90% 투자, 10% 유동성 유지
- 10000 = 100% 투자 (유동성 없음, 권장하지 않음)

**출력 정보**:
- 이전 투자 비율
- 새로운 투자 비율
- 변경 트랜잭션 해시

---

## 🔧 사용 예시

### 일일 모니터링 루틴
```bash
# 1. 전체 상태 확인
npx hardhat run scripts/utils/checkWalletStates.js --network kairos

# 2. WKAIA 유동성 분석
npx hardhat run scripts/utils/analyzeWKAIAState.js --network kairos

# 3. 필요시 투자 비율 조정
INVEST_RATIO=9500 npx hardhat run scripts/utils/setInvestRatio.js --network kairos
```

### 긴급 상황 대응
```bash
# 1. 문제 확인
npx hardhat run scripts/utils/analyzeWKAIAState.js --network kairos

# 2. 토큰 복구 (필요시)
TOKEN_ADDRESS=0x... npx hardhat run scripts/utils/rescueTokens.js --network kairos

# 3. 투자 비율 임시 조정 (유동성 확보)
INVEST_RATIO=5000 npx hardhat run scripts/utils/setInvestRatio.js --network kairos
```

## 📝 주의사항

1. **권한 관리**: 대부분의 유틸리티는 Owner 권한이 필요합니다
2. **네트워크 확인**: 실행 전 반드시 네트워크 확인 (--network kairos/kaia)
3. **가스비**: 상태 변경 작업은 가스비가 필요합니다
4. **백업**: 중요한 변경 전 현재 상태를 기록해두세요

## 🔍 문제 해결

### 권한 오류
```
Error: Ownable: caller is not the owner
```
→ 배포 계정으로 실행하거나 Owner 권한 확인

### 네트워크 오류
```
Error: Unsupported network
```
→ hardhat.config.js의 네트워크 설정 확인

### 잔액 부족
```
Error: Insufficient balance
```
→ 실행 계정의 KAIA 잔액 확인

## 📚 추가 정보

- 메인 문서: [../../README.md](../../README.md)
- 컨트랙트 문서: [../../CLAUDE.md](../../CLAUDE.md)
- 배포 정보: [../../deployments-kairos.json](../../deployments-kairos.json)