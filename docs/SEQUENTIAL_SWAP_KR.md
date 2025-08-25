# APY 기반 순차 스왑 (Sequential Swap)

## 개요
VaultCore 컨트랙트는 지능형 순차 스왑 메커니즘을 구현하여, 가장 낮은 APY를 가진 LST부터 우선적으로 사용함으로써 사용자의 가치 손실을 최소화합니다.

## 주요 기능

### 1. APY 기반 스왑 우선순위
- **목적**: 낮은 APY LST를 먼저 사용하여 가치 손실 최소화
- **구현**: 버블 정렬 알고리즘으로 LST를 APY 오름차순 정렬
- **예시**: APY가 [7000%, 1000%, 1000%, 1000%]인 경우, 스왑 순서는 인덱스 [1, 2, 3, 0]

### 2. 순차적 폴백 메커니즘
- **자동 진행**: 하나의 LST가 충분한 WKAIA를 제공할 수 없으면 자동으로 다음 LST로 이동
- **부분 스왑**: 각 LST는 제공 가능한 만큼만 스왑하고, 나머지는 다음 LST가 처리
- **실패 처리**: Try-catch 패턴으로 스왑 실패가 전체 출금을 중단시키지 않도록 보장

### 3. 설정 가능한 슬리피지 허용치
- **소유자 제어**: 컨트랙트 소유자가 시장 상황에 따라 슬리피지 허용치 조정 가능
- **기본 설정**: 1000 베이시스 포인트 (10%)
- **범위**: 0-10000 베이시스 포인트 (0-100%)

## 기술 구현

### APY 정렬 (VaultCore.sol)
```solidity
// APY 기준으로 정렬된 인덱스 배열 생성 (낮은 순)
uint256[4] memory sortedIndices;
uint256[4] memory apyValues;

// 원본 인덱스와 APY 값으로 초기화
for (uint256 i = 0; i < 4; i++) {
    sortedIndices[i] = i;
    apyValues[i] = lstAPY[i];
}

// APY 기준으로 인덱스 정렬 (4개 요소에 대한 버블 정렬)
for (uint256 i = 0; i < 3; i++) {
    for (uint256 j = 0; j < 3 - i; j++) {
        if (apyValues[j] > apyValues[j + 1]) {
            // APY 값과 인덱스 교환
            uint256 tempAPY = apyValues[j];
            apyValues[j] = apyValues[j + 1];
            apyValues[j + 1] = tempAPY;
            
            uint256 tempIndex = sortedIndices[j];
            sortedIndices[j] = sortedIndices[j + 1];
            sortedIndices[j + 1] = tempIndex;
        }
    }
}
```

### 순차 스왑 로직
```solidity
// APY 순서대로 LST 순회
for (uint256 i = 0; i < 4 && needed > 0; i++) {
    uint256 lstIndex = sortedIndices[i];
    TokenInfo memory info = tokensInfo[lstIndex];
    
    // 슬리피지 버퍼를 포함한 목표 계산
    uint256 targetWKAIA = (needed * (10000 + slippage)) / 10000;
    
    try ISwapContract(swapContract).swapGivenOut(
        info,
        balancerVault,
        targetWKAIA,
        availableBalance
    ) returns (int256[] memory deltas) {
        // 필요 금액 업데이트
        uint256 received = uint256(-deltas[tokenCIndex]);
        needed = needed > received ? needed - received : 0;
    } catch {
        // 스왑 실패, 다음 LST로 계속
        continue;
    }
}
```

### 슬리피지 설정
```solidity
// 슬리피지 설정 (소유자만 가능)
function setSlippage(uint256 _slippage) external onlyOwner {
    if (_slippage > 10000) revert("Slippage too high");
    slippage = _slippage;
}
```

## 설정 가이드라인

### 테스트넷 (Kairos)
- **권장 슬리피지**: 1500-2000 베이시스 포인트 (15-20%)
- **이유**: 테스트넷 풀의 낮은 유동성으로 인한 높은 가격 영향
- **참고**: 테스트넷에서 stKAIA 효율성은 예상 90% 대비 ~39.5%

### 메인넷 (Kaia)
- **권장 슬리피지**: 500-1000 베이시스 포인트 (5-10%)
- **이유**: 더 나은 유동성으로 인한 낮은 가격 영향
- **조정**: 실제 스왑 효율성을 모니터링하고 필요에 따라 조정

## 사용 예시

### 슬리피지 설정
```javascript
// 테스트넷용 15% 슬리피지 설정
await vaultCore.setSlippage(1500);

// 메인넷용 5% 슬리피지 설정
await vaultCore.setSlippage(500);
```

### APY 값 설정
```javascript
// 스왑 우선순위 제어를 위한 APY 값 설정
await vaultCore.setAPY(0, 7000); // wKoKAIA - 70%
await vaultCore.setAPY(1, 1000); // wGCKAIA - 10%
await vaultCore.setAPY(2, 1000); // wstKLAY - 10%
await vaultCore.setAPY(3, 1000); // stKAIA - 10%
```

## 장점

1. **가치 최적화**: 가장 낮은 수익률 LST를 먼저 사용하여 사용자 가치 극대화
2. **복원력**: 개별 스왑이 실패해도 시스템은 계속 작동
3. **유연성**: 조정 가능한 슬리피지로 시장 상황에 적응
4. **투명성**: 공개적으로 확인 가능한 APY 값에 기반한 명확한 순서 로직

## 보안 고려사항

1. **소유자 전용 기능**: 슬리피지 및 APY 설정은 컨트랙트 소유자로 제한
2. **슬리피지 제한**: 최대 100% 슬리피지로 비합리적인 설정 방지
3. **Try-Catch 안전성**: 스왑 실패가 전체 출금을 되돌리지 않고 우아하게 처리

## 테스트

포괄적인 테스트로 검증된 사항:
- ✅ APY 정렬이 가장 낮은 APY를 올바르게 우선순위화
- ✅ 단일 LST가 불충분할 때 순차 스왑 실행
- ✅ 실패한 스왑이 자동으로 다음 LST로 이동
- ✅ 슬리피지 설정이 예상대로 작동
- ✅ 시스템이 엣지 케이스 처리 (낮은 유동성, 높은 슬리피지)

## 구현 세부사항

### 개선 사항 요약
1. **출금 시 부족분 WKAIA는 APY가 낮은 LST부터 순차적으로 스왑**
   - 버블 정렬로 APY 오름차순 정렬 구현
   - 가장 낮은 APY를 가진 LST부터 스왑 시도

2. **가능한 만큼만 스왑하고 부족하면 다음 LST로 이동**
   - Try-catch 패턴으로 스왑 실패를 우아하게 처리
   - 각 LST는 제공 가능한 만큼만 스왑
   - 부족분은 자동으로 다음 LST에서 처리

3. **GIVEN_OUT 스왑의 최대 허용 슬리피지 설정 가능**
   - 기본값: 10% (1000 베이시스 포인트)
   - 소유자가 `setSlippage()` 함수로 조정 가능
   - 테스트넷과 메인넷 환경에 맞게 최적화 가능