# Sequential Swap with APY-based Ordering

## Overview
The VaultCore contract implements an intelligent sequential swap mechanism that optimizes withdrawals by prioritizing LSTs with the lowest APY first, minimizing value loss for users.

## Key Features

### 1. APY-based Swap Priority
- **Purpose**: Minimize value loss by using lowest APY LSTs first
- **Implementation**: Bubble sort algorithm orders LSTs by ascending APY
- **Example**: With APYs [7000%, 1000%, 1000%, 1000%], the swap order will be indices [1, 2, 3, 0]

### 2. Sequential Fallback Mechanism
- **Automatic Progression**: If one LST cannot provide enough WKAIA, the system automatically moves to the next LST
- **Partial Swaps**: Each LST swaps what it can provide, with the remainder handled by subsequent LSTs
- **Failure Handling**: Try-catch pattern ensures swap failures don't halt the withdrawal process

### 3. Configurable Slippage Tolerance
- **Owner Control**: Contract owner can adjust slippage tolerance based on market conditions
- **Default Setting**: 1000 basis points (10%)
- **Range**: 0-10000 basis points (0-100%)

## Technical Implementation

### APY Ordering (VaultCore.sol)
```solidity
// Create array of indices sorted by APY (lowest first)
uint256[4] memory sortedIndices;
uint256[4] memory apyValues;

// Initialize with original indices and APY values
for (uint256 i = 0; i < 4; i++) {
    sortedIndices[i] = i;
    apyValues[i] = lstAPY[i];
}

// Sort indices by APY (bubble sort for 4 elements)
for (uint256 i = 0; i < 3; i++) {
    for (uint256 j = 0; j < 3 - i; j++) {
        if (apyValues[j] > apyValues[j + 1]) {
            // Swap APY values and indices
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

### Sequential Swap Logic
```solidity
// Iterate through LSTs in APY order
for (uint256 i = 0; i < 4 && needed > 0; i++) {
    uint256 lstIndex = sortedIndices[i];
    TokenInfo memory info = tokensInfo[lstIndex];
    
    // Calculate target with slippage buffer
    uint256 targetWKAIA = (needed * (10000 + slippage)) / 10000;
    
    try ISwapContract(swapContract).swapGivenOut(
        info,
        balancerVault,
        targetWKAIA,
        availableBalance
    ) returns (int256[] memory deltas) {
        // Update needed amount
        uint256 received = uint256(-deltas[tokenCIndex]);
        needed = needed > received ? needed - received : 0;
    } catch {
        // Swap failed, continue to next LST
        continue;
    }
}
```

### Slippage Configuration
```solidity
// Set slippage (owner only)
function setSlippage(uint256 _slippage) external onlyOwner {
    if (_slippage > 10000) revert("Slippage too high");
    slippage = _slippage;
}
```

## Configuration Guidelines

### Testnet (Kairos)
- **Recommended Slippage**: 1500-2000 basis points (15-20%)
- **Reason**: Low liquidity in testnet pools causes higher price impact
- **Note**: stKAIA efficiency on testnet is ~39.5% vs expected 90%

### Mainnet (Kaia)
- **Recommended Slippage**: 500-1000 basis points (5-10%)
- **Reason**: Better liquidity should result in lower price impact
- **Adjustment**: Monitor actual swap efficiency and adjust as needed

## Usage Examples

### Setting Slippage
```javascript
// Set slippage to 15% for testnet
await vaultCore.setSlippage(1500);

// Set slippage to 5% for mainnet
await vaultCore.setSlippage(500);
```

### Setting APY Values
```javascript
// Set APY values to control swap priority
await vaultCore.setAPY(0, 7000); // wKoKAIA - 70%
await vaultCore.setAPY(1, 1000); // wGCKAIA - 10%
await vaultCore.setAPY(2, 1000); // wstKLAY - 10%
await vaultCore.setAPY(3, 1000); // stKAIA - 10%
```

## Benefits

1. **Value Optimization**: Users get maximum value by using lowest-yield LSTs first
2. **Resilience**: System continues functioning even if individual swaps fail
3. **Flexibility**: Adjustable slippage allows adaptation to market conditions
4. **Transparency**: Clear ordering logic based on publicly visible APY values

## Security Considerations

1. **Owner-Only Functions**: Slippage and APY settings are restricted to contract owner
2. **Slippage Limits**: Maximum 100% slippage prevents unreasonable settings
3. **Try-Catch Safety**: Swap failures are handled gracefully without reverting entire withdrawal

## Testing

Comprehensive testing has verified:
- ✅ APY ordering correctly prioritizes lowest APY first
- ✅ Sequential swaps execute when single LST is insufficient
- ✅ Failed swaps automatically skip to next LST
- ✅ Slippage configuration works as expected
- ✅ System handles edge cases (low liquidity, high slippage)