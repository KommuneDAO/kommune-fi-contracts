# 메인넷 vs 테스트넷 풀 토큰 인덱스 문서

## 개요
이 문서는 메인넷과 테스트넷 환경에서 `removeLiquidity` 함수의 토큰 인덱스를 상세히 설명합니다.

## LST 토큰 매핑
우리 시스템은 4개의 LST 토큰을 내부 인덱스로 관리합니다:
- **LST 인덱스 0**: wKoKAIA
- **LST 인덱스 1**: wGCKAIA (메인넷에서는 wGCKLAY - 동일한 토큰)
- **LST 인덱스 2**: wstKLAY
- **LST 인덱스 3**: stKAIA

## 테스트넷 풀 (5개 토큰)

### 풀 토큰 순서:
| 풀 인덱스 | 토큰 | 주소 |
|-----------|------|------|
| 0 | wGCKAIA | 0x324353670B23b16DFacBDE169Cd8ebF8C8bf6601 |
| 1 | stKAIA | 0x45886b01276c45Fe337d3758b94DD8D7F3951d97 |
| 2 | wstKLAY | 0x474B49DF463E528223F244670e332fE82742e1aA |
| 3 | wKoKAIA | 0x9a93e2fcDEBE43d0f8205D1cd255D709B7598317 |
| 4 | BPT | 0xCC163330E85C34788840773E32917E2F51878B95 |

### removeLiquidity 출금 토큰 인덱스 (테스트넷):
```solidity
if (lstIndex == 0) exitTokenIndex = 3;  // wKoKAIA는 풀 인덱스 3
if (lstIndex == 1) exitTokenIndex = 0;  // wGCKAIA는 풀 인덱스 0
if (lstIndex == 2) exitTokenIndex = 2;  // wstKLAY는 풀 인덱스 2
if (lstIndex == 3) exitTokenIndex = 1;  // stKAIA는 풀 인덱스 1
```

## 메인넷 풀 (6개 토큰)

### 풀 토큰 순서:
| 풀 인덱스 | 토큰 | 주소 |
|-----------|------|------|
| 0 | wstKLAY | 0x031fb2854029885e1d46b394c8b7881c8ec6ad63 |
| 1 | stKAIA | 0x42952b873ed6f7f0a7e4992e2a9818e3a9001995 |
| 2 | BPT (5LST) | 0xa006e8df6a3cbc66d4d707c97a9fdaf026096487 |
| 3 | SKLAY | 0xa323d7386b671e8799dca3582d6658fdcdcd940a |
| 4 | wGCKAIA | 0xa9999999c3d05fb75ce7230e0d22f5625527d583 |
| 5 | wKoKAIA | 0xdec2cc84f0a37ef917f63212fe8ba7494b0e4b15 |

### removeLiquidity 출금 토큰 인덱스 (메인넷):
```solidity
if (lstIndex == 0) exitTokenIndex = 5;  // wKoKAIA는 풀 인덱스 5
if (lstIndex == 1) exitTokenIndex = 4;  // wGCKAIA는 풀 인덱스 4
if (lstIndex == 2) exitTokenIndex = 0;  // wstKLAY는 풀 인덱스 0
if (lstIndex == 3) exitTokenIndex = 1;  // stKAIA는 풀 인덱스 1
```

## 빠른 참조 테이블

| LST 인덱스 | 토큰 이름 | 테스트넷 출금 인덱스 | 메인넷 출금 인덱스 |
|------------|-----------|---------------------|-------------------|
| 0 | wKoKAIA | 3 | 5 |
| 1 | wGCKAIA | 0 | 4 |
| 2 | wstKLAY | 2 | 0 |
| 3 | stKAIA | 1 | 1 |

## 중요 사항

1. **SKLAY 처리**: 
   - SKLAY (메인넷 풀의 인덱스 3)는 스테이킹을 지원하지 않음
   - joinPool 작업에서 항상 0으로 설정
   - removeLiquidity에서 출금 토큰으로 사용할 수 없음

2. **BPT 위치**:
   - 테스트넷: BPT는 인덱스 4에 위치 (마지막)
   - 메인넷: BPT는 인덱스 2에 위치 (중간)

3. **userData 인코딩**:
   - 테스트넷 joinPool: 4개 금액 (인덱스 4의 BPT 제외)
   - 메인넷 joinPool: 5개 금액 (인덱스 2의 BPT 제외, 위치 2에 SKLAY=0 포함)

4. **네트워크 감지**:
   - chainId를 통해 자동 감지
   - 메인넷: chainId == 8217
   - 테스트넷 (Kairos): chainId == 1001

## 사용 예시

### 테스트넷에서 wKoKAIA removeLiquidity (lstIndex = 0):
```javascript
// exitTokenIndex = 3 (테스트넷에서 wKoKAIA는 풀 인덱스 3)
userData = abi.encode(0, lpAmount, 3);
```

### 메인넷에서 wKoKAIA removeLiquidity (lstIndex = 0):
```javascript
// exitTokenIndex = 5 (메인넷에서 wKoKAIA는 풀 인덱스 5)
userData = abi.encode(0, lpAmount, 5);
```

## 테스트 권장사항

1. **메인넷 배포 전**:
   - 메인넷을 포크하여 실제 풀 구성으로 테스트
   - SKLAY = 0이 문제를 일으키지 않는지 확인
   - 4개 LST 모두에 대한 removeLiquidity 작업 테스트

2. **중요 테스트 케이스**:
   - SKLAY = 0으로 joinPool 실행
   - 각 LST에 대해 올바른 인덱스로 removeLiquidity 실행
   - 받은 금액이 예상과 일치하는지 확인

## 컨트랙트 구현 참조

로직은 `VaultCore.sol`에 구현되어 있습니다:
- `_addLSTsToPool1()`: 동적 토큰 개수로 joinPool 처리
- `removeLiquidity()`: 네트워크별 출금 토큰 인덱스 사용
- `isMainnet`: chainId 기반으로 초기화 시 설정되는 불린 플래그

## 주요 차이점 요약

### 테스트넷 (Kairos)
- **토큰 개수**: 5개 (4 LST + 1 BPT)
- **BPT 위치**: 마지막 (인덱스 4)
- **SKLAY**: 없음
- **userData**: 4개 금액

### 메인넷 (Kaia)
- **토큰 개수**: 6개 (4 LST + 1 SKLAY + 1 BPT)
- **BPT 위치**: 중간 (인덱스 2)
- **SKLAY**: 인덱스 3 (항상 0)
- **userData**: 5개 금액

## 트러블슈팅

### 문제: joinPool이 실패하는 경우
- **원인**: 잘못된 토큰 개수 또는 userData 인코딩
- **해결**: isMainnet 플래그가 올바르게 설정되었는지 확인
- **확인**: `await vaultCore.isMainnet()` 호출로 네트워크 확인

### 문제: removeLiquidity가 잘못된 토큰을 반환하는 경우
- **원인**: 잘못된 exitTokenIndex 사용
- **해결**: 위의 인덱스 매핑 테이블 참조
- **확인**: 트랜잭션 로그에서 실제 받은 토큰 확인

### 문제: SKLAY 관련 오류
- **원인**: SKLAY를 0이 아닌 값으로 설정
- **해결**: maxAmountsIn[3] = 0 확인 (메인넷)
- **주의**: SKLAY는 절대 스테이킹에 사용하지 않음

## LP 가치 계산 (2025-09-02 업데이트)

### LP 토큰 가치 계산 시 토큰 처리 방식

메인넷 6-토큰 풀에서 LP 가치를 계산할 때, 각 토큰은 다음과 같이 처리됩니다:

| 토큰 | 언래핑 | Rate Provider 사용 | 최종 가치 계산 |
|------|--------|-------------------|---------------|
| wKoKAIA → KoKAIA | ✅ | ❌ | 언래핑된 수량 직접 사용 |
| wGCKAIA → GCKAIA | ✅ | ❌ | 언래핑된 수량 직접 사용 |
| wstKLAY → stKLAY | ✅ | ❌ | 언래핑된 수량 직접 사용 |
| stKAIA | ❌ | ✅ | `amount * rate / 1e18` |
| sKLAY | ❌ | ✅ | `amount * rate / 1e18` |
| BPT | - | - | 계산에서 제외 |

**Rate Providers:**
- stKAIA: `0xefBDe60d5402a570DF7CA0d26Ddfedc413260146`
- sKLAY: `0x15F6f25fDedf002B02d6E6be410451866Ff5Ac93`

자세한 내용은 [LP_CALCULATION_LOGIC_KR.md](./LP_CALCULATION_LOGIC_KR.md) 참조