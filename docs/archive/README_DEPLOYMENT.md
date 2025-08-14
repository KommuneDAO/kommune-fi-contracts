# KVaultV2 Deployment and Upgrade Guide

## Overview
KVaultV2 has been optimized to fit within the 24KB contract size limit by using helper contracts with delegatecall pattern.

## Contract Architecture
- **KVaultV2**: Main vault contract (UUPS upgradeable)
- **ClaimManager**: Handles unstake/claim operations via delegatecall
- **StakeManager**: Handles staking and LST wrapping via delegatecall
- **SwapContract**: Handles Balancer pool swaps (already deployed)

## Contract Sizes
- KVaultV2: 24.13 KB (under 24 KB limit ✅)
- ClaimManager: 6.24 KB
- StakeManager: 5.19 KB

## Deployment

### Fresh Deployment
```bash
npx hardhat run scripts/deployOptimizedVault.js --network kairos
```

This will:
1. Deploy ClaimManager contract
2. Deploy StakeManager contract
3. Deploy KVaultV2 proxy with UUPS pattern
4. Set helper contracts in KVaultV2
5. Save addresses to `deployments-kairos.json`

### Setup After Deployment
```bash
npx hardhat run scripts/setupVault.js --network kairos
```

This will set APY values for each LST protocol.

## Upgrade

### Upgrade Existing Vault
```bash
npx hardhat run scripts/upgradeVault.js --network kairos
```

This will:
1. Deploy helper contracts if not already deployed
2. Upgrade KVaultV2 implementation
3. Configure helper contracts
4. Update `deployments-kairos.json`

## Deployed Addresses (Kairos Testnet)

Latest deployment:
- **KVaultV2 Proxy**: 0x510Ae60275193c9537B571049ABD5CBCc4Ec2d5E
- **KVaultV2 Implementation**: 0x97104A7a21FffF4D1d8E6C121D7a68a9876Fcf95
- **ClaimManager**: 0xDa1da0Ba0b500f07a9D8518d0E866Bf37d85aC11
- **StakeManager**: 0x782eBbbc18C170B906987e2938aaD69534401006
- **SwapContract**: 0x829718DBf5e19AB36ab305ac7A7c6C9995bB5F15

## Testing

### Test Native KAIA Deposits
```bash
npx hardhat run scripts/testOptimizedVault.js --network kairos
```

### Debug Vault State
```bash
npx hardhat run scripts/debugVault.js --network kairos
```

## Known Issues

1. **First Deposit Issue**: The vault may have issues with the first deposit when totalSupply is 0. This is a common ERC4626 issue. Solution: Initialize with a small deposit first.

2. **Delegatecall Storage Layout**: Helper contracts must maintain exact storage layout matching KVaultV2 for delegatecall to work correctly.

3. **APY Setup Required**: APY values must be set before deposits can work properly.

## Optimization Strategies Used

1. **Function Separation**: Large functions moved to helper contracts
2. **Error Message Shortening**: Long error messages replaced with short codes
3. **Function Removal**: Removed unused functions (swap, estimateSwap)
4. **Inline Optimization**: Inlined small helper functions
5. **Import Cleanup**: Removed unused imports

## Error Codes

- `AMP`: Amount must be positive
- `DLE`: Deposit limit exceeded
- `SBD`: Same block deposit not allowed
- `ZS`: Zero shares
- `SF`: Stake failed
- `WF`: Wrap failed
- `CMS`: ClaimManager not set
- `SMS`: StakeManager not set
- `IA`: Invalid address
- `UF`: Unstake failed
- `CF`: Claim failed
- `BCF`: Batch claim failed