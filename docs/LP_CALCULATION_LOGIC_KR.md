# LP 계산 로직 문서

## 개요
이 문서는 Kaia 메인넷에서 KommuneFi Vault 시스템의 LP(유동성 풀) 토큰 가치 계산 로직을 설명합니다.

## 메인넷 풀 구성 (6-토큰 풀)

메인넷 Balancer 풀은 6개의 토큰을 포함합니다:

| 인덱스 | 토큰 | 주소 | 타입 |
|-------|-------|---------|------|
| 0 | wstKLAY | 풀에 따라 다름 | Wrapped LST |
| 1 | stKAIA | 0x45886b01276c45Fe337d3758b94DD8D7F3951d97 | Direct LST |
| 2 | BPT | 풀 토큰 | 풀 토큰 (가치 계산에서 제외) |
| 3 | sKLAY | 0xA323d7386b671E8799dcA3582D6658FdcDcD940A | 외부 LST |
| 4 | wGCKAIA | 풀에 따라 다름 | Wrapped LST |
| 5 | wKoKAIA | 풀에 따라 다름 | Wrapped LST |

## LP 가치 계산 프로세스

### 1. 풀 토큰 잔액 가져오기
```solidity
(address[] memory poolTokens, uint256[] memory balances, ) = 
    IBalancerVaultExtended(balancerVault).getPoolTokens(tokenInfo.pool1);
```
이는 풀에 있는 모든 6개 토큰과 현재 잔액을 반환합니다.

### 2. 총 풀 가치 계산
시스템은 BPT를 제외한 모든 토큰을 순회하며 각각을 WKAIA 가치로 변환합니다:

```solidity
for (uint256 i = 0; i < poolTokens.length; i++) {
    if (i != bptIndex) { // BPT 건너뛰기
        uint256 lstWkaiaValue = convertLSTtoWKAIAValue(poolTokens[i], balances[i], allTokensInfo);
        totalPoolValue += lstWkaiaValue;
    }
}
```

### 3. 토큰별 가치 변환

#### 관리되는 LST (tokensInfo 배열의 4개 토큰)

**KoKAIA (LST 인덱스 0)**
- 풀 위치: wKoKAIA at 인덱스 5
- 단계 1: `getUnwrappedAmount()`를 사용하여 언래핑
- 단계 2: 언래핑된 수량을 직접 사용 (rate provider 없음)
- 공식: `unwrappedAmount`

**GCKAIA (LST 인덱스 1)**
- 풀 위치: wGCKAIA at 인덱스 4
- 단계 1: `getGCKLAYByWGCKLAY()`를 사용하여 언래핑
- 단계 2: 언래핑된 수량을 직접 사용 (rate provider 없음)
- 공식: `unwrappedAmount`

**stKLAY (LST 인덱스 2)**
- 풀 위치: wstKLAY at 인덱스 0
- 단계 1: `getUnwrappedAmount()`를 사용하여 언래핑
- 단계 2: 언래핑된 수량을 직접 사용 (rate provider 없음)
- 공식: `unwrappedAmount`

**stKAIA (LST 인덱스 3)**
- 풀 위치: stKAIA at 인덱스 1
- 단계 1: 언래핑 불필요 (직접 자산)
- 단계 2: rate provider 곱셈 적용
- 공식: `amount * rate / 1e18`
- Rate Provider: `0xefBDe60d5402a570DF7CA0d26Ddfedc413260146`

#### 외부 LST (VaultCore가 관리하지 않음)

**sKLAY**
- 풀 위치: sKLAY at 인덱스 3
- tokensInfo 배열에 없음 (특별 처리)
- rate provider 곱셈 적용
- 공식: `amount * rate / 1e18`
- Rate Provider: `0x15F6f25fDedf002B02d6E6be410451866Ff5Ac93`

### 4. LP 토큰 가치 계산
```solidity
return (lpAmount * totalPoolValue) / actualSupply;
```
LP 토큰 가치는 총 풀 가치의 비례 지분입니다.

## 요약 테이블

| 토큰 | 언래핑? | Rate Provider 사용? | 최종 공식 |
|-------|---------|-------------------|---------------|
| wKoKAIA → KoKAIA | 예 | 아니오 | `unwrappedAmount` |
| wGCKAIA → GCKAIA | 예 | 아니오 | `unwrappedAmount` |
| wstKLAY → stKLAY | 예 | 아니오 | `unwrappedAmount` |
| stKAIA | 아니오 | 예 | `amount * rate / 1e18` |
| sKLAY | 아니오 | 예 | `amount * rate / 1e18` |
| BPT | - | - | 계산에서 제외 |

## 구현 세부사항

### Rate Providers
- **stKAIA Rate Provider**: `0xefBDe60d5402a570DF7CA0d26Ddfedc413260146`
- **sKLAY Rate Provider**: `0x15F6f25fDedf002B02d6E6be410451866Ff5Ac93`
- Rate provider는 1e18 형식으로 비율을 반환합니다 (1e18 = 1:1 비율)

### 주요 함수
- `calculateLPTokenValue()`: LP 가치 계산의 메인 진입점
- `convertLSTtoWKAIAValue()`: 각 LST를 WKAIA 가치로 변환
- `applyRateProvider()`: 필요한 경우 rate provider 곱셈 적용
- `getActualSupply()`: LP 토큰의 실제 유통 공급량 가져오기

## 버전 히스토리
- **2025-09-02**: BPT를 제외한 모든 5개 토큰의 올바른 처리를 포함한 최종 구현
  - KoKAIA, GCKAIA, stKLAY: 언래핑된 수량만 사용
  - stKAIA, sKLAY: Rate provider 곱셈 적용