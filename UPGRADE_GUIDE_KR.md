# KommuneFi 컨트랙트 - 업그레이드 가이드

## 🔴 중요: 스토리지 레이아웃 관리

### UUPS 업그레이드 가능 컨트랙트 이해하기

UUPS (Universal Upgradeable Proxy Standard) 컨트랙트는 로직과 스토리지를 분리합니다:
- **프록시 컨트랙트**: 모든 스토리지를 보유하고 구현체로 호출을 위임
- **구현 컨트랙트**: 로직을 포함하지만 영구 스토리지는 없음
- **스토리지 충돌**: 업그레이드 실패의 가장 큰 원인

### 스토리지 레이아웃 규칙

#### ⚠️ 절대 하지 말아야 할 것:
```solidity
// 버전 1
contract VaultCore {
    address public shareVault;      // 슬롯 0
    address public wkaia;           // 슬롯 1
    uint256 public totalAssets;     // 슬롯 2
}

// 버전 2 - 잘못됨! 데이터가 손상됩니다
contract VaultCore {
    address public wkaia;           // 슬롯 0 (shareVault였음!)
    address public shareVault;      // 슬롯 1 (wkaia였음!)
    uint256 public totalAssets;     // 슬롯 2
}
```

#### ✅ 올바른 접근법:
```solidity
// 버전 1
contract VaultCore {
    address public shareVault;      // 슬롯 0
    address public wkaia;           // 슬롯 1
    uint256 public totalAssets;     // 슬롯 2
}

// 버전 2 - 올바름! 새 변수만 추가
contract VaultCore {
    address public shareVault;      // 슬롯 0 (변경 없음)
    address public wkaia;           // 슬롯 1 (변경 없음)
    uint256 public totalAssets;     // 슬롯 2 (변경 없음)
    address public newVariable;     // 슬롯 3 (새로 추가)
}
```

### KommuneFi 스토리지 레이아웃

#### ShareVault 스토리지 레이아웃
```solidity
// OpenZeppelin에서 상속 (슬롯 0-101)
// [Initializable, ERC20, ERC4626 등을 위한 OpenZeppelin 스토리지 슬롯]

// 커스텀 스토리지는 슬롯 102+부터 시작
address public vaultCore;           // 첫 번째 커스텀 변수
address public treasury;
uint256 public basisPointsFees;
mapping(address => uint256) public lastDepositBlock;
```

#### VaultCore 스토리지 레이아웃
```solidity
// 중요: delegatecall을 위해 정확한 순서 유지 필수
address public shareVault;          // 슬롯 0
address public wkaia;               // 슬롯 1
address public balancerVault;       // 슬롯 2
address public swapContract;        // 슬롯 3
address public claimManager;        // 슬롯 4
mapping(uint256 => TokenInfo) public tokensInfo;  // 슬롯 5
mapping(uint256 => uint256) public lstAPY;        // 슬롯 6
uint256 public investRatio;         // 슬롯 7
uint256 public totalInvested;       // 슬롯 8
uint256[4] public investedPerLST;   // 슬롯 9-12
// ... 정확한 순서로 계속
```

#### SharedStorage 패턴
```solidity
// ClaimManager는 delegatecall을 위해 동일한 스토리지 레이아웃을 가져야 함
contract SharedStorage {
    address public shareVault;          // 슬롯 0
    address public wkaia;               // 슬롯 1
    address public balancerVault;       // 슬롯 2
    address public swapContract;        // 슬롯 3
    address public claimManager;        // 슬롯 4
    mapping(uint256 => TokenInfo) public tokensInfo;  // 슬롯 5
    // ... VaultCore와 정확히 동일한 레이아웃
}
```

## 배포 가이드

### 신규 배포

#### 1. 환경 설정
```bash
cp .env.example .env
# .env 파일 편집:
# - KAIROS_PRIVATE_KEY 또는 KAIA_PRIVATE_KEY
# - 커스텀인 경우 RPC 엔드포인트
```

#### 2. 모든 컨트랙트 배포
```bash
# 테스트넷 (Kairos)에 배포
npx hardhat run scripts/deployFresh.js --network kairos

# 메인넷 (KAIA)에 배포
npx hardhat run scripts/deployFresh.js --network kaia
```

#### 3. 투자 프로필로 배포
```bash
# 보수적 프로필 (30% LST, 70% 유동성)
INVESTMENT_PROFILE=conservative npx hardhat run scripts/deployWithProfile.js --network kairos

# 안정적 프로필 (90% LST, 10% 유동성) - 기본값
INVESTMENT_PROFILE=stable npx hardhat run scripts/deployWithProfile.js --network kairos

# 균형 프로필 (45% LST, 45% LP, 10% 유동성)
INVESTMENT_PROFILE=balanced npx hardhat run scripts/deployWithProfile.js --network kairos
```

#### 4. 배포 검증
```bash
# STABLE 모드 테스트
npx hardhat run scripts/tests/testIntegratedStable.js --network kairos

# BALANCED 모드 테스트
npx hardhat run scripts/tests/testIntegratedBalanced.js --network kairos
```

### 배포 결과
배포 시 `deployments-{network}.json` 파일 생성:
```json
{
  "shareVault": "0x...",
  "vaultCore": "0x...",
  "swapContract": "0x...",
  "claimManager": "0x...",
  "lpCalculations": "0x...",
  "wkaia": "0x...",
  "balancerVault": "0x...",
  "chainId": "1001",
  "network": "kairos",
  "deployedAt": "2025-08-22T..."
}
```

## 업그레이드 가이드

### 업그레이드 전 체크리스트

#### 1. 스토리지 레이아웃 검증
```javascript
// scripts/verifyStorageLayout.js
const vaultCore = await ethers.getContractAt("VaultCore", address);

// 중요 스토리지 슬롯 확인
console.log("슬롯 0:", await ethers.provider.getStorage(address, 0)); // shareVault
console.log("슬롯 1:", await ethers.provider.getStorage(address, 1)); // wkaia
console.log("슬롯 2:", await ethers.provider.getStorage(address, 2)); // balancerVault
```

#### 2. 로컬에서 업그레이드 테스트
```bash
# 업그레이드 테스트 실행
npx hardhat run scripts/testUpgrades.js --network kairos
```

### 업그레이드 수행

#### 모든 컨트랙트 업그레이드
```bash
npx hardhat run scripts/upgradeAll.js --network kairos
```

#### 개별 컨트랙트 업그레이드

##### VaultCore 업그레이드
```bash
npx hardhat run scripts/upgradeVaultCore.js --network kairos
```

**VaultCore 특별 고려사항:**
- 외부 라이브러리 연결 필요 (LPCalculations)
- ClaimManager로 delegatecall 사용
- SharedStorage 호환성 유지 필수

##### ShareVault 업그레이드
```bash
npx hardhat run scripts/upgradeShareVault.js --network kairos
```

**ShareVault 특별 고려사항:**
- 표준 업그레이드 프로세스
- 외부 의존성 없음

##### SwapContract 업그레이드
```bash
npx hardhat run scripts/upgradeSwapContract.js --network kairos
```

**⚠️ 경고**: SwapContract는 최종 완성되었으며 수정하지 않아야 합니다

### 업그레이드 후 검증

#### 1. 스토리지 무결성 확인
```javascript
// 업그레이드 후, 중요 값들이 보존되었는지 확인
const vaultCore = await ethers.getContractAt("VaultCore", address);
assert(await vaultCore.shareVault() === expectedShareVault);
assert(await vaultCore.investRatio() === expectedRatio);
assert(await vaultCore.getTotalAssets() === expectedAssets);
```

#### 2. 핵심 기능 테스트
```bash
# 통합 테스트 실행
npx hardhat run scripts/tests/testIntegratedStable.js --network kairos
npx hardhat run scripts/tests/testIntegratedBalanced.js --network kairos
```

## 새 스토리지 변수 추가

### 안전한 방법: 끝에만 추가

#### 단계 1: 구현체에 추가
```solidity
contract VaultCoreV2 is VaultCore {
    // ... 모든 기존 변수 ...
    
    // 끝에만 새 변수 추가
    uint256 public newFeature;
    mapping(address => bool) public newMapping;
    
    // 새 함수 추가는 안전함
    function setNewFeature(uint256 _value) external onlyOwner {
        newFeature = _value;
    }
}
```

#### 단계 2: 새 변수 초기화
```solidity
function upgradeToV2() external onlyOwner {
    // 필요시 새 변수 초기화
    newFeature = 100;
}
```

### 스토리지 갭 사용 (고급)

```solidity
contract VaultCoreV1 {
    // ... 기존 변수 ...
    
    // 미래 사용을 위한 스토리지 슬롯 예약
    uint256[50] private __gap;
}

contract VaultCoreV2 {
    // ... 기존 변수 ...
    
    // 갭 공간을 새 변수에 사용
    uint256 public newVariable1;
    uint256 public newVariable2;
    
    // 갭 크기 조정
    uint256[48] private __gap;
}
```

## 일반적인 업그레이드 오류

### 오류: "Contract is not upgrade safe"
**원인**: 적절한 플래그 없이 delegatecall 사용
**해결책**:
```javascript
await upgrades.upgradeProxy(address, Contract, {
    unsafeAllow: ["delegatecall", "external-library-linking"]
});
```

### 오류: "Deployment at address is not registered"
**원인**: OpenZeppelin 업그레이드 레지스트리에서 프록시를 찾을 수 없음
**해결책**:
```javascript
await upgrades.forceImport(proxyAddress, Contract);
```

### 오류: 스토리지 충돌 감지
**원인**: 스토리지 레이아웃 순서 변경
**해결책**: 기존 변수 순서를 절대 수정하지 말고, 끝에만 추가

### 오류: "Cannot find library"
**원인**: VaultCore에 LPCalculations 라이브러리 필요
**해결책**:
```javascript
const LPCalculations = await ethers.getContractFactory("LPCalculations");
const lpCalc = await LPCalculations.deploy();
await lpCalc.waitForDeployment();

const VaultCore = await ethers.getContractFactory("VaultCore", {
    libraries: {
        LPCalculations: await lpCalc.getAddress()
    }
});
```

## 긴급 절차

### 업그레이드 실패 시

#### 1. 당황하지 마세요
- 프록시는 여전히 이전 구현체를 가리킴
- 사용자 자금은 안전함

#### 2. 문제 디버깅
```javascript
// 구현체 주소 확인
const proxyAdmin = await upgrades.admin.getInstance();
const implAddress = await proxyAdmin.getProxyImplementation(proxyAddress);
console.log("현재 구현체:", implAddress);
```

#### 3. 필요시 롤백
- 이전 버전을 새 구현체로 배포
- 프록시를 이전 구현체로 지정

### 스토리지 복구

스토리지가 손상된 경우:
```javascript
// 원시 스토리지 슬롯 읽기
const slot0 = await ethers.provider.getStorage(address, 0);
const slot1 = await ethers.provider.getStorage(address, 1);

// 디코드 및 검증
const shareVault = "0x" + slot0.slice(26);
console.log("ShareVault 주소:", shareVault);
```

## 모범 사례

### 1. 항상 업그레이드 테스트
- 테스트넷에서 먼저 테스트
- 업그레이드 테스트 스크립트 사용
- 스토리지 보존 확인

### 2. 변경사항 문서화
- 업그레이드 로그 유지
- 새 변수 문서화
- 중요 변경사항 기록

### 3. 점진적 업그레이드
- 한 번에 너무 많이 변경하지 않기
- 각 업그레이드 철저히 테스트
- 이전 구현체 코드 보관

### 4. 업그레이드 후 모니터링
- 트랜잭션 성공률 확인
- 비정상적인 동작 모니터링
- 업그레이드 롤백 준비

## 업그레이드 로그 템플릿

```markdown
## 업그레이드: [컨트랙트 이름] v[X.Y.Z]
날짜: YYYY-MM-DD
네트워크: Kairos/KAIA
이전 구현체: 0x...
새 구현체: 0x...

### 변경사항:
- 새 기능 X 추가
- 버그 Y 수정
- 함수 Z 최적화

### 새 스토리지 변수:
- uint256 public newVariable (슬롯 X)

### 검증:
- [ ] 스토리지 레이아웃 확인
- [ ] 업그레이드 테스트 통과
- [ ] 통합 테스트 통과
- [ ] 업그레이드 후 모니터링 (24시간)

### 참고사항:
[특별 고려사항]
```

## 문제 발생 시 연락처

업그레이드 문제 발생 시:
1. 먼저 이 가이드 확인
2. SharedStorage.sol에서 스토리지 레이아웃 검토
3. 검증 스크립트 실행
4. 기술팀 문의

---

**기억하세요**: 업그레이드 가능한 컨트랙트에서 스토리지 레이아웃은 신성합니다. 의심스러울 때는 끝에만 추가하세요!