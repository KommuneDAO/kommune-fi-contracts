# Investment Profiles for KommuneFi V2

## Overview

KommuneFi V2 supports flexible investment strategy allocation through configurable ratios. Instead of fixed vault types, the system uses investment ratios that can be adjusted to create different risk/return profiles.

## Architecture

### Investment Ratio System

The system uses basis points (10000 = 100%) for precise ratio control:

- **investRatio**: Total percentage of deposits to invest (vs keeping as liquidity)
- **stableRatio**: Allocation to stable strategy (LST staking only)
- **balancedRatio**: Allocation to balanced strategy (LST staking + Balancer LP for swap fees)
- **aggressiveRatio**: Allocation to aggressive strategy (future implementation)

**Important**: `stableRatio + balancedRatio + aggressiveRatio` must equal `investRatio`

### Storage Layout

Investment ratios are stored in SharedStorage.sol to ensure consistent storage layout:

```solidity
uint256 public investRatio;      // slot 7 - Total investment percentage
uint256 public stableRatio;      // slot 12 - Allocation to stable strategy
uint256 public balancedRatio;    // slot 13 - Allocation to balanced strategy  
uint256 public aggressiveRatio;  // slot 14 - Allocation to aggressive strategy
```

## Investment Profiles

### 1. Stable Profile (Conservative)
- **Total Investment**: 90%
- **Distribution**: 100% to LST staking
- **Liquidity Buffer**: 10%
- **Risk Level**: Low
- **Target Users**: Conservative investors seeking maximum returns from LST staking

```javascript
investRatio: 9000      // 90% total (maximum returns)
stableRatio: 9000      // 90% to LST
balancedRatio: 0       // 0%
aggressiveRatio: 0     // 0%
```

### 2. Balanced Profile (Moderate)
- **Total Investment**: 90%
- **Distribution**: 50% LST staking, 50% Balancer LP
- **Liquidity Buffer**: 10%
- **Risk Level**: Medium
- **Target Users**: Moderate investors seeking diversified returns with swap fee income

**Revenue Streams**:
- Staking rewards from LST protocols (45% of deposits)
- Swap fees from Balancer liquidity provision (45% of deposits)
- Potential price appreciation of LST tokens

```javascript
investRatio: 9000      // 90% total (maximum returns)
stableRatio: 4500      // 45% to LST staking only
balancedRatio: 4500    // 45% to LST + Balancer LP
aggressiveRatio: 0     // 0%
```

### 3. Aggressive Profile (Growth)
- **Total Investment**: 90%
- **Distribution**: 40% LST, 30% balanced, 30% aggressive
- **Liquidity Buffer**: 10%
- **Risk Level**: High
- **Target Users**: Growth-focused investors seeking maximum returns with higher risk

```javascript
investRatio: 9000      // 90% total (maximum returns)
stableRatio: 3600      // 36% to LST (40% of 90%)
balancedRatio: 2700    // 27% to balanced (30% of 90%)
aggressiveRatio: 2700  // 27% to aggressive (30% of 90%)
```

## Implementation

### Setting Investment Ratios

```solidity
// Set stable profile
await vaultCore.setInvestRatio(9000);  // 90% total investment for maximum returns
await vaultCore.setInvestmentRatios(
    9000,  // All 90% to stable
    0,     // 0% to balanced
    0      // 0% to aggressive
);
```

### Getting Current Ratios

```solidity
const ratios = await vaultCore.getInvestmentRatios();
console.log(`Stable: ${ratios.stable / 100}%`);
console.log(`Balanced: ${ratios.balanced / 100}%`);
console.log(`Aggressive: ${ratios.aggressive / 100}%`);
console.log(`Total: ${ratios.total / 100}%`);
```

### Investment Flow

When deposits are made:

1. **Calculate Investment Amount**: `amountToInvest = deposit * investRatio / 10000`
2. **Distribute to Strategies**:
   - **Stable**: `stableAmount = deposit * stableRatio / 10000` → Direct LST staking for rewards
   - **Balanced**: `balancedAmount = deposit * balancedRatio / 10000` → LST staking + Balancer LP for swap fees
   - **Aggressive**: `aggressiveAmount = deposit * aggressiveRatio / 10000` → Future high-risk strategies
3. **Maintain Liquidity**: Remaining amount stays as WKAIA for withdrawals

#### Balanced Strategy Details
The balanced strategy provides dual revenue streams:
1. **Staking Phase**: Stake KAIA to LST protocols to get wrapped tokens
2. **Liquidity Phase**: Add wrapped LST tokens to Balancer pools
3. **Revenue**: Earn both staking rewards AND swap fees
4. **Management**: Owner can add/remove liquidity as needed

## Deployment

### Using deployWithProfile.js

Deploy with specific profile:

```bash
# Deploy stable profile (default)
INVESTMENT_PROFILE=stable npx hardhat run scripts/deployWithProfile.js --network kairos

# Deploy balanced profile
INVESTMENT_PROFILE=balanced npx hardhat run scripts/deployWithProfile.js --network kairos

# Deploy aggressive profile
INVESTMENT_PROFILE=aggressive npx hardhat run scripts/deployWithProfile.js --network kairos
```

### Upgrading Existing Deployment

```javascript
// Upgrade VaultCore
const VaultCore = await ethers.getContractFactory("VaultCore");
const vaultCore = await upgrades.upgradeProxy(
    vaultCoreAddress,
    VaultCore,
    { unsafeAllow: ['delegatecall'] }
);

// Set investment ratios
await vaultCore.setInvestmentRatios(
    stableRatio,
    balancedRatio,
    aggressiveRatio
);
```

## Testing

### Test Scripts

- `scripts/temp/testInvestmentRatios.js` - Test ratio functionality
- `scripts/testIntegrated.js` - Full integration test with stable profile
- `scripts/deployWithProfile.js` - Deploy with specific profile

### Test Coverage

- ✅ Get/set investment ratios
- ✅ Ratio validation (sum must equal investRatio)
- ✅ Deposit distribution based on ratios
- ✅ Profile switching
- ✅ Edge case handling

## Future Strategies

### Balanced Strategy (Planned)
- Liquidity provision in DEXs
- Yield farming protocols
- Stable-stable LP positions
- Medium-risk DeFi strategies

### Aggressive Strategy (Planned)
- Leveraged positions
- High-APY protocols
- Volatile asset exposure
- Advanced DeFi strategies

## Security Considerations

1. **Ratio Validation**: Sum of strategy ratios must equal investRatio
2. **Owner Control**: Only owner can modify investment ratios
3. **Gradual Changes**: Consider implementing timelock for ratio changes
4. **Audit Trail**: All ratio changes should be logged and monitored
5. **Emergency Pause**: Ability to set investRatio to 0 in emergencies

## Migration Path

For existing deployments:

1. Upgrade VaultCore contract
2. Initialize ratios based on current investRatio
3. All existing investment goes to stable strategy by default
4. Adjust ratios as needed for desired profile

## Monitoring

Key metrics to monitor:

- Current investment ratios
- Total assets vs liquidity buffer
- Strategy performance metrics
- Withdrawal success rates
- Gas costs for different profiles