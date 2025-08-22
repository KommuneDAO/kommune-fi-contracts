# KommuneFi 컨트랙트 - 배포 가이드

## 사전 준비

### 1. 환경 설정
```bash
# 레포지토리 복제
git clone https://github.com/KommuneFi/kommune-fi-contracts-erc20.git
cd kommune-fi-contracts-erc20

# 의존성 설치
npm install

# 환경 파일 생성
cp .env.example .env
```

### 2. .env 파일 설정
```bash
# Kairos 테스트넷용 (필수)
KAIROS_PRIVATE_KEY=여기에_프라이빗_키_입력

# KAIA 메인넷용 (필수)
KAIA_PRIVATE_KEY=여기에_프라이빗_키_입력

# 선택사항: 커스텀 RPC 엔드포인트
KAIROS_RPC_URL=https://public-en-kairos.node.kaia.io
KAIA_RPC_URL=https://klaytn-en.kommunedao.xyz:8651
```

### 3. 배포 지갑 자금 준비
- **테스트넷 (Kairos)**: 배포를 위해 ~5 KAIA 필요
- **메인넷 (KAIA)**: 배포를 위해 ~10 KAIA 필요
- 테스트넷 KAIA 받기: https://kairos.wallet.kaia.io/faucet

## 배포 옵션

### 옵션 1: 프로필을 사용한 빠른 배포 (권장)

사전 설정된 투자 프로필로 배포:

```bash
# 보수적 프로필 (30% LST, 70% 유동성)
INVESTMENT_PROFILE=conservative npx hardhat run scripts/deployWithProfile.js --network kairos

# 안정적 프로필 (90% LST, 10% 유동성) - 기본값
INVESTMENT_PROFILE=stable npx hardhat run scripts/deployWithProfile.js --network kairos

# 균형 프로필 (45% LST, 45% LP, 10% 유동성)
INVESTMENT_PROFILE=balanced npx hardhat run scripts/deployWithProfile.js --network kairos

# 성장 프로필 (30% LST, 30% LP, 30% 공격적, 10% 유동성)
INVESTMENT_PROFILE=growth npx hardhat run scripts/deployWithProfile.js --network kairos
```

### 옵션 2: 표준 신규 배포

모든 매개변수를 완전히 제어:

```bash
# 테스트넷에 배포
npx hardhat run scripts/deployFresh.js --network kairos

# 메인넷에 배포
npx hardhat run scripts/deployFresh.js --network kaia
```

## 배포 프로세스 상세

### 배포되는 항목

1. **ClaimManager** (업그레이드 불가)
   - 언스테이크/클레임 작업 처리
   - VaultCore에서 delegatecall로 사용

2. **SwapContract** (UUPS 프록시)
   - Balancer V2 스왑 관리
   - 출금을 위한 GIVEN_OUT 스왑 처리

3. **LPCalculations** (라이브러리)
   - LP 토큰 계산을 위한 외부 라이브러리
   - VaultCore 컨트랙트 크기 감소

4. **VaultCore** (UUPS 프록시)
   - 핵심 볼트 로직
   - LST 투자 관리
   - 입출금 처리

5. **ShareVault** (UUPS 프록시)
   - ERC-4626 호환 볼트
   - 사용자 지분(kvKAIA) 관리
   - 사용자 진입점

### 배포 순서 및 의존성

```
1. ClaimManager (독립적)
2. SwapContract (독립적)
3. LPCalculations (라이브러리)
4. VaultCore (LPCalculations 주소 필요)
5. ShareVault (VaultCore 주소 필요)
6. 설정 (모든 컨트랙트 연결)
```

## 배포 후 설정

### 자동 설정
배포 스크립트가 자동으로 수행:
- ✅ VaultCore에 ShareVault 설정
- ✅ VaultCore에 ClaimManager 설정
- ✅ SwapContract에서 VaultCore 인증
- ✅ 초기 APY 설정 (각 LST당 25%)
- ✅ 프로필에 따른 투자 비율 설정

### 수동 설정 (선택사항)

#### 1. APY 분배 조정
```bash
npx hardhat run scripts/setAPY.js --network kairos
```

또는 프로그래밍 방식:
```javascript
await vaultCore.setAPY(0, 3000); // wKoKAIA 30%
await vaultCore.setAPY(1, 2500); // wGCKAIA 25%
await vaultCore.setAPY(2, 2500); // wstKLAY 25%
await vaultCore.setAPY(3, 2000); // stKAIA 20%
```

#### 2. 투자 비율 변경
```javascript
// 예시: 균형 프로필로 전환
await vaultCore.setInvestmentRatios(
    4500,  // LST 스테이킹에 45%
    4500,  // Balancer LP에 45%
    0      // 공격적 전략에 0%
);
```

#### 3. 수수료 구조 업데이트
```javascript
// 프로토콜 수수료 설정 (기본값: 10%)
await shareVault.setFees(1000); // 10% = 1000 베이시스 포인트
```

## 배포 결과

### 생성되는 파일

#### deployments-{network}.json
```json
{
  "shareVault": "0xF43BdDA5bc0693d952a68ABc4E0D8262A874b74e",
  "vaultCore": "0x09bE7a4bf8c0bB28725A9369484b0852cD70cBE8",
  "swapContract": "0x5D83C399c3bFf4fE86627eA8680431c5b8084320",
  "claimManager": "0x72C44A898dfD0cf4689DF795D188e19049a2d996",
  "lpCalculations": "0xf955f2aA1673c46F617A446c3a45f72eA958443f",
  "wkaia": "0x0339d5Eb6D195Ba90B13ed1BCeAa97EbD198b106",
  "balancerVault": "0x1c9074AA147648567015287B0d4185Cb4E04F86d",
  "chainId": "1001",
  "network": "kairos",
  "deployedAt": "2025-08-22T10:30:00.000Z",
  "profile": "stable",
  "configuration": {
    "investRatio": 9000,
    "stableRatio": 9000,
    "balancedRatio": 0,
    "aggressiveRatio": 0
  }
}
```

## 검증 단계

### 1. 컨트랙트 연결 확인
```bash
npx hardhat console --network kairos

> const deployments = require('./deployments-kairos.json')
> const vaultCore = await ethers.getContractAt("VaultCore", deployments.vaultCore)
> await vaultCore.shareVault() // ShareVault 주소 반환해야 함
> await vaultCore.swapContract() // SwapContract 주소 반환해야 함
```

### 2. 통합 테스트 실행
```bash
npx hardhat run scripts/tests/testDepositWithdraw.js --network kairos
```

### 3. 소액 입금 테스트
```bash
npx hardhat console --network kairos

> const shareVault = await ethers.getContractAt("ShareVault", deployments.shareVault)
> await shareVault.depositKAIA(signer.address, {value: ethers.parseEther("0.1")})
```

## 네트워크별 정보

### Kairos 테스트넷
```javascript
{
  chainId: 1001,
  rpc: "https://public-en-kairos.node.kaia.io",
  explorer: "https://kairos.kaiascan.io",
  wkaia: "0x0339d5Eb6D195Ba90B13ed1BCeAa97EbD198b106",
  balancerVault: "0x1c9074AA147648567015287B0d4185Cb4E04F86d"
}
```

### KAIA 메인넷
```javascript
{
  chainId: 8217,
  rpc: "https://klaytn-en.kommunedao.xyz:8651",
  explorer: "https://kaiascan.io",
  wkaia: "0x19aac5f612f524b754ca7e7c41cbfa2e981a4332",
  balancerVault: "0xTBD" // 배포 예정
}
```

## 문제 해결

### 일반적인 문제

#### 1. "가스 부족 오류"
- **해결책**: 배포 지갑에 충분한 KAIA 확인
- 테스트넷: ~5 KAIA 필요
- 메인넷: ~10 KAIA 필요

#### 2. "컨트랙트 크기 초과"
- **해결책**: 이미 19.4 KB로 최적화됨
- 수정한 경우, hardhat.config.js에서 optimizer 활성화 확인

#### 3. "라이브러리를 찾을 수 없음"
- **해결책**: LPCalculations 라이브러리 먼저 배포
- 라이브러리 주소를 VaultCore에 연결해야 함

#### 4. "트랜잭션 타임아웃"
- **해결책**: hardhat.config.js에서 타임아웃 증가
```javascript
networks: {
  kairos: {
    timeout: 600000 // 10분
  }
}
```

#### 5. "논스가 너무 높음"
- **해결책**: 지갑에서 논스 리셋 또는 대기 중인 트랜잭션 대기

## 보안 체크리스트

메인넷 배포 전:

- [ ] 감사 완료 및 이슈 해결
- [ ] 모든 테스트 통과
- [ ] 배포 지갑 보안 (하드웨어 지갑 권장)
- [ ] 소유권 이전용 멀티시그 지갑 준비
- [ ] 긴급 일시정지 메커니즘 테스트
- [ ] 업그레이드 프로세스 문서화 및 테스트
- [ ] 초기 유동성 준비 (10+ KAIA 권장)
- [ ] 현재 시장 금리로 APY 값 검증
- [ ] 런칭에 적합한 투자 비율 확인

## 배포 후 작업

### 1. 소유권 이전 (메인넷만)
```javascript
// 멀티시그로 이전
await shareVault.transferOwnership(multiSigAddress);
await vaultCore.transferOwnership(multiSigAddress);
await swapContract.transferOwnership(multiSigAddress);
```

### 2. 초기 유동성 추가
```javascript
// 원활한 운영을 위한 초기 유동성 추가
await shareVault.depositKAIA(treasury, {value: ethers.parseEther("10")});
```

### 3. 모니터링 설정
- 트랜잭션 모니터링 설정
- 대량 입출금 알림 설정
- TVL 및 APY 성능 모니터링

### 4. 프론트엔드 업데이트
- 프론트엔드 설정에서 컨트랙트 주소 업데이트
- 변경된 경우 ABI 파일 업데이트
- 프론트엔드 통합 테스트

## 배포 비용 예상

### 테스트넷 (Kairos)
- ClaimManager: ~0.5 KAIA
- SwapContract: ~1.0 KAIA
- LPCalculations: ~0.3 KAIA
- VaultCore: ~2.0 KAIA
- ShareVault: ~1.5 KAIA
- **총계: ~5.3 KAIA**

### 메인넷 (KAIA)
- 비슷한 비용 예상
- 가스 가격 변동을 위해 2배 버퍼 추가
- **권장: 10+ KAIA**

## 지원

배포 문제 발생 시:
1. 이 가이드 확인
2. 오류 메시지 자세히 검토
3. 네트워크 설정 확인
4. 기술팀 문의

---

**버전**: 1.0.0
**최종 업데이트**: 2025-08-22
**테스트 환경**: Kairos 테스트넷