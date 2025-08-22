# KommuneFi 컨트랙트 - 외부 감사 문서

## 개요

KommuneFi는 KAIA 블록체인의 다중 LST 수익 최적화 볼트로, 사용자 예치금을 APY 최적화 기반으로 여러 Liquid Staking Token (LST) 프로토콜에 자동 분배합니다. 이 프로토콜은 최대 호환성과 보안을 위해 ERC-4626 표준을 사용합니다.

## 감사 범위

### 감사 대상 컨트랙트

| 컨트랙트 | 위치 | 크기 | 목적 |
|----------|------|------|------|
| ShareVault | `src/ShareVault.sol` | 10.2 KB | ERC-4626 볼트 지분 관리 |
| VaultCore | `src/VaultCore.sol` | 19.4 KB | 핵심 볼트 로직 및 LST 관리 |
| SwapContract | `src/SwapContract.sol` | 7.3 KB | Balancer V2 스왑 통합 |
| ClaimManager | `src/ClaimManager.sol` | 4.0 KB | 언스테이크/클레임 작업 |
| SharedStorage | `src/SharedStorage.sol` | 1.0 KB | delegatecall용 스토리지 레이아웃 |
| LPCalculations | `src/libraries/LPCalculations.sol` | 1.4 KB | LP 토큰 가치 계산 |
| Errors | `src/libraries/Errors.sol` | 0.5 KB | 커스텀 에러 정의 |

### 감사 제외 대상
- `scripts/` 디렉토리의 테스트 스크립트
- `src/interfaces/`의 인터페이스 정의
- 레거시 컨트랙트 (`KommuneVault.sol`, `KommuneVaultV2.sol`)

## 아키텍처 개요

```
사용자
  ↓
ShareVault (ERC-4626)
  ↓
VaultCore (로직)
  ├→ LST 프로토콜 (4개 토큰)
  ├→ SwapContract (출금)
  ├→ ClaimManager (delegatecall)
  └→ Balancer 풀 (LP)
```

## 주요 보안 기능

### 1. 표준 ERC-4626 구현
- 커스텀 입금 패턴 없음
- 표준 approve + transferFrom 플로우
- 프론트러닝 취약점 방지

### 2. 접근 제어
- Owner 전용 관리 함수
- SwapContract에 대한 인증된 호출자 패턴
- tx.origin 사용 안 함

### 3. 스토리지 안전성
- delegatecall을 위한 SharedStorage 기본 컨트랙트
- 컨트랙트 간 동일한 스토리지 레이아웃
- UUPS 업그레이드 가능 패턴

### 4. 재진입 보호
- 모든 진입점에 ReentrancyGuard
- Check-effects-interactions 패턴

## 투자 전략

### Stable (기본값)
- LST 스테이킹에 90%
- 유동성 버퍼 10%
- 가장 낮은 위험 프로필

### Balanced
- LST 스테이킹에 45%
- Balancer LP에 45%
- 중간 위험/보상

### Aggressive (미래)
- 미래 전략을 위해 예약됨
- 현재 비활성

## 검토해야 할 중요 함수

### 입금 플로우
1. `ShareVault.depositKAIA()` - 네이티브 KAIA 입금
2. `ShareVault.deposit()` - WKAIA 입금 (내부적으로 KAIA로 변환)
3. `VaultCore.handleDepositKAIA()` - 입금 처리 및 LST로 분배

### 출금 플로우
1. `ShareVault.withdraw()` - 사용자가 출금 시작
2. `VaultCore.handleWithdraw()` - 출금 처리
3. `SwapContract.swapGivenOut()` - 정확한 WKAIA 출력을 위해 LST 스왑

### 투자 관리
1. `VaultCore._investToLSTs()` - APY 기반 자금 분배
2. `VaultCore._addLSTsToPool1()` - Balancer 풀에 유동성 추가
3. `VaultCore._removeLiquidityFromPool1()` - 필요시 유동성 제거

### 관리자 함수
1. `VaultCore.setAPY()` - LST APY 값 설정
2. `VaultCore.setInvestmentRatios()` - 투자 전략 설정
3. `VaultCore.unstake()` - Owner 전용 LST 언스테이킹
4. `VaultCore.claim()` - Owner 전용 보상 클레임

## 알려진 설계 결정사항

### 1. Owner 전용 언스테이크/클레임
- **결정**: 프로토콜 owner만 언스테이크/클레임 가능
- **근거**: 사용자가 프로토콜 운영을 방해하는 것 방지
- **영향**: 보안을 위한 중앙화 트레이드오프

### 2. 10% 슬리피지 허용
- **결정**: 스왑에 대한 높은 슬리피지 허용
- **근거**: 테스트넷 유동성 조건
- **영향**: 메인넷에서는 감소시켜야 함

### 3. 단일 LP 토큰 추적
- **결정**: 모든 LST가 동일한 Balancer 풀 공유
- **근거**: 추적 단순화 및 가스 비용 절감
- **영향**: 덜 세분화된 회계

### 4. WKAIA 상태 동기화 해결책
- **결정**: ShareVault에서 WKAIA를 KAIA로 변환
- **근거**: WKAIA 구현에 상태 동기화 문제 있음
- **영향**: 추가 변환 단계이지만 더 안정적

## 테스트 커버리지

### 단위 테스트
- 실행: `npx hardhat test`
- 커버리지: 핵심 기능

### 통합 테스트
- 입금/출금: `scripts/tests/testDepositWithdraw.js`
- 언스테이크/클레임: `scripts/tests/testUnstakeClaim.js`
- 업그레이드: `scripts/testUpgrades.js`

### 테스트 결과
- ✅ 모든 입금 (KAIA & WKAIA) 작동
- ✅ 모든 출금 (부분 & 전체) 작동
- ✅ LST 분배 검증됨
- ✅ LP 통합 테스트됨
- ✅ 업그레이드 안전성 확인됨

## 가스 최적화

### 구현된 최적화
1. LP 계산을 위한 외부 라이브러리
2. 문자열 대신 커스텀 에러
3. 공격적인 컴파일러 최적화 (runs: 1)
4. 가능한 곳에서 배치 작업

### 컴파일러 설정
```javascript
optimizer: {
  enabled: true,
  runs: 1,
  details: {
    yul: true,
    yulDetails: {
      stackAllocation: true,
      optimizerSteps: "dhfoDgvulfnTUtnIf[...]"
    }
  }
}
```

## 배포 정보

### Kairos 테스트넷 (현재)
- ShareVault: `0xF43BdDA5bc0693d952a68ABc4E0D8262A874b74e`
- VaultCore: `0x09bE7a4bf8c0bB28725A9369484b0852cD70cBE8`
- SwapContract: `0x5D83C399c3bFf4fE86627eA8680431c5b8084320`
- ClaimManager: `0x72C44A898dfD0cf4689DF795D188e19049a2d996`

### 외부 의존성
- WKAIA: `0x0339d5Eb6D195Ba90B13ed1BCeAa97EbD198b106`
- Balancer Vault: `0x1c9074AA147648567015287B0d4185Cb4E04F86d`

## 감사 체크리스트

### 접근 제어
- [ ] 모든 관리자 함수에 적절한 modifier 있음
- [ ] 중요 함수에 대한 무단 접근 없음
- [ ] onlyOwner 패턴 적절히 사용

### 재진입
- [ ] 모든 외부 호출이 CEI 패턴 따름
- [ ] ReentrancyGuard 적절히 구현됨
- [ ] 교차 함수 재진입 없음

### 수학 연산
- [ ] 정수 오버플로우/언더플로우 없음
- [ ] 적절한 소수점 처리
- [ ] 사용자에게 유리한 반올림

### 외부 호출
- [ ] 모든 외부 컨트랙트 검증됨
- [ ] 반환 값 확인됨
- [ ] 가스 한계 고려됨

### 업그레이드 가능성
- [ ] 스토리지 레이아웃 일관성
- [ ] Initializer 보호
- [ ] 업그레이드 권한

### 경제적 보안
- [ ] 플래시론 취약점 없음
- [ ] 슬리피지 보호 적절함
- [ ] 수수료 계산 정확함

## 연락처 정보

감사 중 질문사항:
- 기술 리드: [연락처 정보]
- GitHub: https://github.com/KommuneFi
- 문서: README_KR.md 및 CLAUDE.md 참조

## 추가 자료

- `README_KR.md` - 일반 프로젝트 문서
- `CLAUDE.md` - 상세 기술 문서
- `docs/INVESTMENT_PROFILES.md` - 투자 전략 세부사항
- `docs/BALANCED_STRATEGY.md` - Balancer 통합 세부사항

---

**감사 시작일**: [입력 예정]
**감사 종료일**: [입력 예정]
**감사인**: [입력 예정]