# Mainnet vs Testnet Pool Token Indices Documentation

## Overview
This document details the token indices for `removeLiquidity` function in both mainnet and testnet environments.

## LST Token Mapping
Our system uses 4 LST tokens with internal indices:
- **LST Index 0**: wKoKAIA
- **LST Index 1**: wGCKAIA (wGCKLAY on mainnet - same token)
- **LST Index 2**: wstKLAY
- **LST Index 3**: stKAIA

## Testnet Pool (5 tokens)

### Pool Token Order:
| Pool Index | Token | Address |
|------------|-------|---------|
| 0 | wGCKAIA | 0x324353670B23b16DFacBDE169Cd8ebF8C8bf6601 |
| 1 | stKAIA | 0x45886b01276c45Fe337d3758b94DD8D7F3951d97 |
| 2 | wstKLAY | 0x474B49DF463E528223F244670e332fE82742e1aA |
| 3 | wKoKAIA | 0x9a93e2fcDEBE43d0f8205D1cd255D709B7598317 |
| 4 | BPT | 0xCC163330E85C34788840773E32917E2F51878B95 |

### removeLiquidity Exit Token Indices (Testnet):
```solidity
if (lstIndex == 0) exitTokenIndex = 3;  // wKoKAIA at pool index 3
if (lstIndex == 1) exitTokenIndex = 0;  // wGCKAIA at pool index 0
if (lstIndex == 2) exitTokenIndex = 2;  // wstKLAY at pool index 2
if (lstIndex == 3) exitTokenIndex = 1;  // stKAIA at pool index 1
```

## Mainnet Pool (6 tokens)

### Pool Token Order:
| Pool Index | Token | Address |
|------------|-------|---------|
| 0 | wstKLAY | 0x031fb2854029885e1d46b394c8b7881c8ec6ad63 |
| 1 | stKAIA | 0x42952b873ed6f7f0a7e4992e2a9818e3a9001995 |
| 2 | BPT (5LST) | 0xa006e8df6a3cbc66d4d707c97a9fdaf026096487 |
| 3 | SKLAY | 0xa323d7386b671e8799dca3582d6658fdcdcd940a |
| 4 | wGCKAIA | 0xa9999999c3d05fb75ce7230e0d22f5625527d583 |
| 5 | wKoKAIA | 0xdec2cc84f0a37ef917f63212fe8ba7494b0e4b15 |

### removeLiquidity Exit Token Indices (Mainnet):
```solidity
if (lstIndex == 0) exitTokenIndex = 5;  // wKoKAIA at pool index 5
if (lstIndex == 1) exitTokenIndex = 4;  // wGCKAIA at pool index 4
if (lstIndex == 2) exitTokenIndex = 0;  // wstKLAY at pool index 0
if (lstIndex == 3) exitTokenIndex = 1;  // stKAIA at pool index 1
```

## Quick Reference Table

| LST Index | Token Name | Testnet Exit Index | Mainnet Exit Index |
|-----------|------------|-------------------|-------------------|
| 0 | wKoKAIA | 3 | 5 |
| 1 | wGCKAIA | 0 | 4 |
| 2 | wstKLAY | 2 | 0 |
| 3 | stKAIA | 1 | 1 |

## Important Notes

1. **SKLAY Handling**: 
   - SKLAY (index 3 in mainnet pool) is NOT supported for staking
   - Always set to 0 amount in joinPool operations
   - Cannot be used as exit token in removeLiquidity

2. **BPT Position**:
   - Testnet: BPT is at index 4 (last position)
   - Mainnet: BPT is at index 2 (middle position)

3. **userData Encoding**:
   - Testnet joinPool: 4 amounts (exclude BPT at index 4)
   - Mainnet joinPool: 5 amounts (exclude BPT at index 2, include SKLAY=0 at position 2)

4. **Network Detection**:
   - Automatically detected via chainId
   - Mainnet: chainId == 8217
   - Testnet (Kairos): chainId == 1001

## Example Usage

### Testnet removeLiquidity for wKoKAIA (lstIndex = 0):
```javascript
// exitTokenIndex = 3 (wKoKAIA is at pool index 3 in testnet)
userData = abi.encode(0, lpAmount, 3);
```

### Mainnet removeLiquidity for wKoKAIA (lstIndex = 0):
```javascript
// exitTokenIndex = 5 (wKoKAIA is at pool index 5 in mainnet)
userData = abi.encode(0, lpAmount, 5);
```

## Testing Recommendations

1. **Before Mainnet Deployment**:
   - Fork mainnet and test with actual pool configuration
   - Verify SKLAY = 0 doesn't cause issues
   - Test all 4 LST removeLiquidity operations

2. **Critical Test Cases**:
   - joinPool with SKLAY = 0
   - removeLiquidity for each LST with correct indices
   - Verify received amounts match expectations

## Contract Implementation Reference

The logic is implemented in `VaultCore.sol`:
- `_addLSTsToPool1()`: Handles joinPool with dynamic token count
- `removeLiquidity()`: Uses network-specific exit token indices
- `isMainnet`: Boolean flag set during initialization based on chainId