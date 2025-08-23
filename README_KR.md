# KommuneFi 컨트랙트 ERC20

KAIA 블록체인의 자동화된 스테이킹 전략을 통한 다중 LST 수익 최적화 볼트

## 🔒 감사 상태
**외부 감사 준비 완료** - 모든 Critical 및 High 위험 이슈 해결 완료

## 프로젝트 구조

```
src/
├── ShareVault.sol         # ERC-4626 호환 지분 관리 (10.2 KB)
├── VaultCore.sol          # LST 관리 핵심 볼트 로직 (19.4 KB)
├── SwapContract.sol       # Balancer 스왑 통합 (7.3 KB) [최종 완성]
├── ClaimManager.sol       # 언스테이크/클레임 작업 (4.0 KB)
├── SharedStorage.sol      # delegatecall용 공유 스토리지 레이아웃
├── interfaces/            # 외부 프로토콜 인터페이스
│   ├── IBalancerVault.sol
│   ├── ITokenInfo.sol
│   └── [LST 인터페이스들]
└── libraries/
    ├── LPCalculations.sol # LP 토큰 가치 계산
    └── Errors.sol         # 커스텀 에러 정의

scripts/
├── deployFresh.js         # 신규 배포 스크립트
├── upgradeAll.js          # 모든 컨트랙트 업그레이드
├── setAPY.js              # APY 설정
└── tests/                 # 통합 테스트

docs/
├── INVESTMENT_PROFILES.md # 투자 전략 문서
├── BALANCED_STRATEGY.md   # Balancer 풀 통합
└── archive/               # 과거 문서
```

## 주요 기능

### 핵심 기능
- **다중 LST 지원**: 4개 주요 LST 통합 (wKoKAIA, wGCKAIA, wstKLAY, stKAIA)
- **ERC-4626 호환**: 최대 호환성을 위한 표준 볼트 인터페이스
- **자동 수익 최적화**: LST 간 동적 APY 기반 할당
- **Balancer 통합**: Balancer V2 풀을 통한 효율적인 스왑
- **투자 프로필**: 설정 가능한 위험 프로필 (Stable, Balanced, Aggressive)

### 보안 기능
- **표준 ERC-4626 패턴**: 커스텀 입금 패턴 없음, 프론트러닝 방지
- **Owner 전용 작업**: 보안을 위해 언스테이크/클레임 owner로 제한
- **슬리피지 보호**: 테스트넷 조건에 맞춘 10% 슬리피지 허용
- **Delegatecall 안전성**: 스토리지 충돌 방지를 위한 SharedStorage 패턴
- **최적화된 컨트랙트 크기**: 19.4 KB (24.576 KB 제한 이내)

## 배포 방법

### 사전 준비
- Node.js 16+
- Hardhat 2.19+
- KAIA 테스트넷(Kairos) 또는 메인넷 계정 (KAIA 보유)
- `.env` 파일에 환경 변수 설정

### 배포 명령어
```bash
# Kairos 테스트넷에 신규 배포
npx hardhat run scripts/deployFresh.js --network kairos

# KAIA 메인넷에 신규 배포
npx hardhat run scripts/deployFresh.js --network kaia

# 특정 프로필로 배포
npx hardhat run scripts/deployWithProfile.js --network kairos
```

### 업그레이드
```bash
# 모든 컨트랙트 업그레이드
npx hardhat run scripts/upgradeAll.js --network kairos

# 특정 컨트랙트 업그레이드
npx hardhat run scripts/upgradeVaultCore.js --network kairos
npx hardhat run scripts/upgradeShareVault.js --network kairos
npx hardhat run scripts/upgradeSwapContract.js --network kairos
```

## 테스트

### 단위 테스트
```bash
# 모든 단위 테스트 실행
npx hardhat test
```

### 통합 테스트
```bash
# 투자 모드별로 분리된 통합 테스트
# STABLE 모드 테스트 (90% LST 스테이킹만)
npx hardhat run scripts/tests/testIntegratedStable.js --network kairos

# BALANCED 모드 테스트 (45% LST + 45% LP 풀)
npx hardhat run scripts/tests/testIntegratedBalanced.js --network kairos

# 기능별 테스트
# 입출금 플로우 테스트
npx hardhat run scripts/tests/testDepositWithdraw.js --network kairos

# 언스테이크/클레임 작업 테스트
npx hardhat run scripts/tests/testUnstakeClaim.js --network kairos

# 컨트랙트 업그레이드 테스트
npx hardhat run scripts/testUpgrades.js --network kairos
```

## 현재 배포 상태 (Kairos 테스트넷)

| 컨트랙트 | 주소 | 크기 |
|----------|------|------|
| ShareVault | `0xF43BdDA5bc0693d952a68ABc4E0D8262A874b74e` | 10.2 KB |
| VaultCore | `0x09bE7a4bf8c0bB28725A9369484b0852cD70cBE8` | 19.4 KB |
| SwapContract | `0x5D83C399c3bFf4fE86627eA8680431c5b8084320` | 7.3 KB |
| ClaimManager | `0x72C44A898dfD0cf4689DF795D188e19049a2d996` | 4.0 KB |
| LPCalculations | `0xf955f2aA1673c46F617A446c3a45f72eA958443f` | 1.4 KB |

## 설정

### 투자 프로필

| 프로필 | Stable (LST) | Balanced (LP) | Aggressive | 유동성 |
|--------|-------------|---------------|------------|--------|
| 보수적 | 30% | 0% | 0% | 70% |
| 안정적 | 90% | 0% | 0% | 10% |
| 균형 | 45% | 45% | 0% | 10% |
| 성장 | 30% | 30% | 30% | 10% |

### APY 분배
현재 스테이킹 보상을 기반으로 4개 LST에 걸쳐 설정 가능:
- wKoKAIA: 기본 25%
- wGCKAIA: 기본 25%
- wstKLAY: 기본 25%
- stKAIA: 기본 25%

## 지원되는 LST

### 1. wKoKAIA (인덱스 0)
- 핸들러: `0xb15782EFbC2034E366670599F3997f94c7333FF9`
- 래핑된 토큰: `0x9a93e2fcDEBE43d0f8205D1cd255D709B7598317`

### 2. wGCKAIA (인덱스 1)
- 핸들러: `0xe4c732f651B39169648A22F159b815d8499F996c`
- 래핑된 토큰: `0x324353670B23b16DFacBDE169Cd8ebF8C8bf6601`

### 3. wstKLAY (인덱스 2)
- 핸들러: `0x28B13a88E72a2c8d6E93C28dD39125705d78E75F`
- 래핑된 토큰: `0x474B49DF463E528223F244670e332fE82742e1aA`

### 4. stKAIA (인덱스 3)
- 핸들러: `0x4C0d434C7DD74491A52375163a7b724ED387d0b6`
- 토큰: `0x45886b01276c45Fe337d3758b94DD8D7F3951d97`

## 보안 감사

### 해결된 이슈
- ✅ **Critical**: Direct Deposit 취약점 - 표준 ERC-4626으로 수정
- ✅ **High**: tx.origin 사용 - address(this)로 교체
- ✅ **High**: 공개 언스테이크/클레임 - owner 전용으로 변경
- ✅ **Medium**: 컨트랙트 크기 제한 - 19.4 KB로 최적화
- ✅ **Medium**: 스토리지 레이아웃 이슈 - SharedStorage 패턴 구현

### 감사 준비 상태
- 모든 Critical 및 High 위험 이슈 해결
- 포괄적인 테스트 커버리지
- 공격적인 컴파일러 설정으로 가스 최적화
- 복잡한 계산을 위한 외부 라이브러리
- 깔끔한 관심사 분리

## 중요 사항

⚠️ **SwapContract는 최종 완성됨**: SwapContract는 4개 LST 모두에 대해 철저히 테스트되었으며 수정해서는 안 됩니다.

⚠️ **V2 아키텍처 사용**: 분리된 볼트 아키텍처(ShareVault + VaultCore)가 권장 배포입니다.

⚠️ **WKAIA 입금 패턴**: WKAIA 상태 동기화 이슈로 인해, 입금 시 ShareVault에서 WKAIA를 KAIA로 변환 후 VaultCore로 전송합니다.

## 라이선스

MIT