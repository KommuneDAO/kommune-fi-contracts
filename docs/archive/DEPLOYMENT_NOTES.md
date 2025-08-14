# Deployment Notes

## Latest Deployment (2025-08-13)

### Kairos Testnet
- **SwapContract**: `0x7C755d984352cdEcCcae5137483ab1bd1Cd618DA`
- **KVaultV2**: `0x77270A884A3Cb595Af3F57Dc795bAC3E14Ab23e8`
- **Deployer**: `0xdc926E34E73292cD7c48c6fD7375af7D93435D36`

### Contract Configuration
- **Asset**: WKAIA (`0x0339d5Eb6D195Ba90B13ed1BCeAa97EbD198b106`)
- **Treasury**: `0xDdb24eCaF1cCeF3dd3BcF2e2b93A231e809B89B0`
- **Basis Points Fees**: 1000 (10%)
- **Invest Ratio**: 10000 (100%)

## Contract Features

### KVaultV2
- ERC4626 compliant tokenized vault
- APY-based asset allocation across 4 LST protocols:
  - koKAIA (wrapped as wKoKAIA)
  - gcKAIA (wrapped as wGCKAIA)
  - stKLAY (wrapped as wstKLAY)
  - stKAIA (not wrapped)
- Automatic wrapping of LST tokens after staking
- Multi-asset withdrawal with priority-based selection
- Upgradeable proxy pattern

### SwapContract
- Balancer DEX integration
- Cross-protocol token swapping
- Slippage protection (3% buffer, 1% tolerance)
- GIVEN_OUT swap support with estimation

## Testing Summary

### Integration Test Results (Fresh Deployment)
| Test | Description | Status |
|------|-------------|--------|
| Test 1 | Initial State Check | ✅ Pass |
| Test 2 | WKAIA Deposit | ✅ Pass |
| Test 3 | LST Balance Verification | ✅ Pass |
| Test 4 | Withdrawal | ✅ Pass |
| Test 5 | APY-Based Distribution | ✅ Pass |
| Test 6 | Multi-LST Support | ✅ Pass |

### Key Findings
1. **Wrapping Functionality**: Successfully wraps koKAIA, gcKAIA, and stKLAY to their wrapped versions
2. **APY Distribution**: Works correctly with dynamic APY values
3. **State Accumulation Issue**: After multiple deposits with APY changes, may encounter "WETH: request exceeds allowance"
   - **Workaround**: Fresh deployment resolves the issue
   - **Root Cause**: Under investigation

## Deployment Commands

### Fresh Deployment
```bash
# Remove existing deployment file
rm deployments-kairos.json

# Deploy all contracts
npm run deploy-all:dev  # For testnet
npm run deploy-all:prod # For mainnet
```

### Upgrade Existing Contracts
```bash
# Upgrade KVaultV2
yarn upgrade-vault:dev  # For testnet
yarn upgrade-vault:prod # For mainnet

# Upgrade SwapContract
yarn upgrade-swap:dev   # For testnet
yarn upgrade-swap:prod  # For mainnet
```

## Important Notes

1. **APY Storage**: APY values are stored internally as value * 10 (e.g., 755 = 7.55%)
2. **Default APY**: All protocols start with 500 (5.00%)
3. **Wrapping Process**: Happens automatically after staking for koKAIA, gcKAIA, and stKLAY
4. **Contract Size**: Optimized with runs=1 to stay within 24KB limit
5. **Test Environment**: All tests should be run on Kairos testnet first

## Troubleshooting

### "WETH: request exceeds allowance" Error
- **Symptoms**: Occurs after multiple deposits and APY changes
- **Solution**: Deploy fresh contracts
- **Prevention**: Monitor contract state accumulation

### Withdrawal Failures
- **Symptoms**: Transaction revert during withdrawal
- **Possible Causes**: Insufficient liquidity, swap calculation issues
- **Solution**: Check pool liquidity and wrapped token balances

### Contract Size Issues
- **Solution**: Reduce optimizer runs in hardhat.config.js
- **Current Setting**: runs: 1 (minimum for size optimization)