# Balanced Investment Strategy

## Overview

The Balanced Investment Strategy allows KommuneFi to generate additional returns for users by providing liquidity to Balancer pools. When users deposit with the balanced profile, a portion of their funds is added as liquidity to earn swap fees on top of staking rewards.

## How It Works

### 1. Deposit Flow
When a user deposits with balanced investment ratios configured:
1. Funds are split according to configured ratios (e.g., 45% stable, 45% balanced)
2. Stable portion: Stakes to LST protocols for staking rewards
3. Balanced portion: 
   - First stakes to LST protocols to get wrapped LST tokens
   - Then adds these LST tokens as liquidity to Balancer pool1
   - Receives LP (Liquidity Provider) tokens representing the position

### 2. Revenue Streams
Users benefit from multiple revenue sources:
- **Staking Rewards**: From LST protocols (stable portion)
- **Swap Fees**: From Balancer pools (balanced portion)
- **Price Appreciation**: Potential LST value increase

### 3. Liquidity Pools Used
Each LST has its own pool1 configuration:
- **wKoKAIA**: Paired with intermediate token in pool1
- **wGCKAIA**: Paired with intermediate token in pool1
- **wstKLAY**: Paired with intermediate token in pool1
- **stKAIA**: Paired with intermediate token in pool1

## Implementation Details

### Storage Updates
```solidity
// SharedStorage.sol - Added LP tracking
mapping(uint256 => uint256) public lpBalances;  // LST index => LP token balance
mapping(uint256 => address) public lpTokens;    // LST index => LP token address
```

### Key Functions

#### Adding Liquidity
```solidity
function _addLiquidityToPool(uint256 lstIndex) private
```
- Automatically called during balanced investment
- Takes wrapped LST tokens and adds to Balancer pool
- Receives and tracks LP tokens

#### Removing Liquidity (Owner Only)
```solidity
function removeLiquidity(uint256 lstIndex, uint256 lpAmount) external onlyOwner
```
- Allows owner to remove liquidity for profit realization
- Burns LP tokens and receives wrapped LST tokens back
- Can be used for rebalancing or emergency withdrawals

#### Manual Liquidity Management (Owner Only)
```solidity
function addLiquidityManual(uint256 lstIndex, uint256 amount) external onlyOwner
```
- Allows adding liquidity outside of deposit flow
- Useful for optimizing pool positions

#### LP Information Query
```solidity
function getLPInfo(uint256 lstIndex) external view returns (uint256 lpBalance, address lpToken)
```
- Returns LP token balance and address for each LST

## Configuration Examples

### Balanced Profile (Recommended)
```javascript
// 90% total investment, split equally between stable and balanced
await vaultCore.setInvestRatio(9000);  // 90% total
await vaultCore.setInvestmentRatios(
    4500,  // 45% to stable (LST staking only)
    4500,  // 45% to balanced (LST + Balancer LP)
    0      // 0% to aggressive
);
```

### Conservative Balanced
```javascript
// More weight on stable staking, less on LP
await vaultCore.setInvestRatio(9000);  // 90% total
await vaultCore.setInvestmentRatios(
    6000,  // 60% to stable
    3000,  // 30% to balanced
    0      // 0% to aggressive
);
```

### Aggressive Balanced
```javascript
// More weight on LP for higher swap fee potential
await vaultCore.setInvestRatio(9000);  // 90% total
await vaultCore.setInvestmentRatios(
    3000,  // 30% to stable
    6000,  // 60% to balanced
    0      // 0% to aggressive
);
```

## Benefits

1. **Additional Revenue**: Earn swap fees on top of staking rewards
2. **Market Making**: Provide liquidity to improve LST trading
3. **Diversification**: Multiple revenue streams reduce risk
4. **Flexibility**: Owner can rebalance as needed

## Risks and Mitigations

### Impermanent Loss
- **Risk**: Price divergence between paired assets
- **Mitigation**: Single-sided liquidity reduces IL risk

### Smart Contract Risk
- **Risk**: Balancer protocol vulnerabilities
- **Mitigation**: Balancer is battle-tested with extensive audits

### Liquidity Risk
- **Risk**: Difficulty exiting large positions
- **Mitigation**: Owner can gradually remove liquidity

## Testing

Run the balanced strategy test:
```bash
npx hardhat run scripts/temp/testBalancedStrategy.js --network kairos
```

This will:
1. Configure balanced investment ratios
2. Make a test deposit
3. Check LP token balances
4. Test manual liquidity operations
5. Test liquidity removal

## LP Token Valuation

The protocol accurately calculates the underlying value of LP tokens for `getTotalAssets()`:

### Calculation Method
```solidity
underlyingAmount = (lpAmount * lstBalanceInPool) / totalLPSupply
```

This formula calculates the proportional share of LST tokens that would be received if the LP tokens were removed from the pool.

### Key Functions

#### Calculate LP Token Value (Internal)
```solidity
function _calculateLPTokenValue(uint256 lstIndex, uint256 lpAmount) private view
```
- Queries Balancer pool for current token balances
- Calculates proportional share based on LP token supply
- Returns underlying LST token amount

#### Get LP Token Value (External)
```solidity
function getLPTokenValue(uint256 lstIndex) external view returns (uint256)
```
- Public function to check LP token underlying value
- Useful for monitoring and reporting

### Accuracy Considerations
- The calculation assumes single-sided exit to the LST token
- Actual received amount may vary slightly due to:
  - Pool rebalancing
  - Swap fees accumulated
  - Slippage during exit

## Future Enhancements

1. **Auto-Compounding**: Automatically reinvest swap fees
2. **Dynamic Rebalancing**: Adjust LP positions based on APY
3. **Multi-Pool Strategy**: Use both pool1 and pool2 for optimization
4. **Price Oracle Integration**: Use oracle prices for more accurate total asset valuation
5. **Yield Aggregation**: Integrate with other DeFi protocols