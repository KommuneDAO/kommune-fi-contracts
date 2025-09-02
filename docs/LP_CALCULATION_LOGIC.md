# LP Calculation Logic Documentation

## Overview
This document describes the LP (Liquidity Pool) token value calculation logic for the KommuneFi Vault system on Kaia mainnet.

## Mainnet Pool Configuration (6-token pool)

The mainnet Balancer pool contains 6 tokens:

| Index | Token | Address | Type |
|-------|-------|---------|------|
| 0 | wstKLAY | Varies by pool | Wrapped LST |
| 1 | stKAIA | 0x45886b01276c45Fe337d3758b94DD8D7F3951d97 | Direct LST |
| 2 | BPT | Pool token | Pool token (excluded from value) |
| 3 | sKLAY | 0xA323d7386b671E8799dcA3582D6658FdcDcD940A | External LST |
| 4 | wGCKAIA | Varies by pool | Wrapped LST |
| 5 | wKoKAIA | Varies by pool | Wrapped LST |

## LP Value Calculation Process

### 1. Get Pool Token Balances
```solidity
(address[] memory poolTokens, uint256[] memory balances, ) = 
    IBalancerVaultExtended(balancerVault).getPoolTokens(tokenInfo.pool1);
```
This returns all 6 tokens with their current balances in the pool.

### 2. Calculate Total Pool Value
The system iterates through all tokens except BPT and converts each to WKAIA value:

```solidity
for (uint256 i = 0; i < poolTokens.length; i++) {
    if (i != bptIndex) { // Skip BPT
        uint256 lstWkaiaValue = convertLSTtoWKAIAValue(poolTokens[i], balances[i], allTokensInfo);
        totalPoolValue += lstWkaiaValue;
    }
}
```

### 3. Token-Specific Value Conversion

#### Managed LSTs (4 tokens in tokensInfo array)

**KoKAIA (LST Index 0)**
- Pool position: wKoKAIA at index 5
- Step 1: Unwrap using `getUnwrappedAmount()`
- Step 2: Use unwrapped amount directly (NO rate provider)
- Formula: `unwrappedAmount`

**GCKAIA (LST Index 1)**
- Pool position: wGCKAIA at index 4
- Step 1: Unwrap using `getGCKLAYByWGCKLAY()`
- Step 2: Use unwrapped amount directly (NO rate provider)
- Formula: `unwrappedAmount`

**stKLAY (LST Index 2)**
- Pool position: wstKLAY at index 0
- Step 1: Unwrap using `getUnwrappedAmount()`
- Step 2: Use unwrapped amount directly (NO rate provider)
- Formula: `unwrappedAmount`

**stKAIA (LST Index 3)**
- Pool position: stKAIA at index 1
- Step 1: No unwrapping needed (direct asset)
- Step 2: Apply rate provider multiplication
- Formula: `amount * rate / 1e18`
- Rate Provider: `0xefBDe60d5402a570DF7CA0d26Ddfedc413260146`

#### External LST (not managed by VaultCore)

**sKLAY**
- Pool position: sKLAY at index 3
- Not in tokensInfo array (special handling)
- Apply rate provider multiplication
- Formula: `amount * rate / 1e18`
- Rate Provider: `0x15F6f25fDedf002B02d6E6be410451866Ff5Ac93`

### 4. Calculate LP Token Value
```solidity
return (lpAmount * totalPoolValue) / actualSupply;
```
The LP token value is the proportional share of the total pool value.

## Summary Table

| Token | Unwrap? | Use Rate Provider? | Final Formula |
|-------|---------|-------------------|---------------|
| wKoKAIA → KoKAIA | Yes | No | `unwrappedAmount` |
| wGCKAIA → GCKAIA | Yes | No | `unwrappedAmount` |
| wstKLAY → stKLAY | Yes | No | `unwrappedAmount` |
| stKAIA | No | Yes | `amount * rate / 1e18` |
| sKLAY | No | Yes | `amount * rate / 1e18` |
| BPT | - | - | Excluded from calculation |

## Implementation Details

### Rate Providers
- **stKAIA Rate Provider**: `0xefBDe60d5402a570DF7CA0d26Ddfedc413260146`
- **sKLAY Rate Provider**: `0x15F6f25fDedf002B02d6E6be410451866Ff5Ac93`
- Rate providers return rates in 1e18 format where 1e18 = 1:1 ratio

### Key Functions
- `calculateLPTokenValue()`: Main entry point for LP value calculation
- `convertLSTtoWKAIAValue()`: Converts each LST to WKAIA value
- `applyRateProvider()`: Applies rate provider multiplication where needed
- `getActualSupply()`: Gets the actual circulating supply of LP tokens

## Version History
- **2025-09-02**: Final implementation with correct handling of all 5 non-BPT tokens
  - KoKAIA, GCKAIA, stKLAY: Unwrapped amounts only
  - stKAIA, sKLAY: Rate provider multiplication