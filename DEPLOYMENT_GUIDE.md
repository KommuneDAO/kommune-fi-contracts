# KommuneFi Contracts - Deployment Guide

## Prerequisites

### 1. Environment Setup
```bash
# Clone repository
git clone https://github.com/KommuneFi/kommune-fi-contracts-erc20.git
cd kommune-fi-contracts-erc20

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

### 2. Configure .env File
```bash
# Required for Kairos testnet
KAIROS_PRIVATE_KEY=your_private_key_here

# Required for KAIA mainnet
KAIA_PRIVATE_KEY=your_private_key_here

# Optional: Custom RPC endpoints
KAIROS_RPC_URL=https://public-en-kairos.node.kaia.io
KAIA_RPC_URL=https://klaytn-en.kommunedao.xyz:8651
```

### 3. Fund Deployment Wallet
- **Testnet (Kairos)**: Need ~5 KAIA for deployment
- **Mainnet (KAIA)**: Need ~10 KAIA for deployment
- Get testnet KAIA from: https://kairos.wallet.kaia.io/faucet

## Deployment Options

### Option 1: Quick Deployment with Profile (Recommended)

Deploy with pre-configured investment profiles:

```bash
# Conservative Profile (30% LST, 70% liquidity)
INVESTMENT_PROFILE=conservative npx hardhat run scripts/deployWithProfile.js --network kairos

# Stable Profile (90% LST, 10% liquidity) - DEFAULT
INVESTMENT_PROFILE=stable npx hardhat run scripts/deployWithProfile.js --network kairos

# Balanced Profile (90% to LST, then 50% of LST → LP = 45% LST + 45% LP + 10% liquidity)
INVESTMENT_PROFILE=balanced npx hardhat run scripts/deployWithProfile.js --network kairos

# Growth Profile (30% LST, 30% LP, 30% aggressive, 10% liquidity)
INVESTMENT_PROFILE=growth npx hardhat run scripts/deployWithProfile.js --network kairos
```

### Option 2: Standard Fresh Deployment

Complete control over all parameters:

```bash
# Deploy to testnet
npx hardhat run scripts/deployFresh.js --network kairos

# Deploy to mainnet
npx hardhat run scripts/deployFresh.js --network kaia
```

## Deployment Process Breakdown

### What Gets Deployed

1. **ClaimManager** (Non-upgradeable)
   - Handles unstake/claim operations
   - Used via delegatecall from VaultCore

2. **SwapContract** (UUPS Proxy)
   - Manages Balancer V2 swaps
   - Handles GIVEN_OUT swaps for withdrawals

3. **LPCalculations** (Library)
   - External library for LP token calculations
   - Reduces VaultCore contract size

4. **VaultCore** (UUPS Proxy)
   - Core vault logic
   - Manages LST investments
   - Handles deposits/withdrawals

5. **ShareVault** (UUPS Proxy)
   - ERC-4626 compliant vault
   - Manages user shares (kvKAIA)
   - Entry point for users

### Deployment Order & Dependencies

```
1. ClaimManager (standalone)
2. SwapContract (standalone)
3. LPCalculations (library)
4. VaultCore (needs LPCalculations address)
5. ShareVault (needs VaultCore address)
6. Configuration (connect all contracts)
```

## Post-Deployment Configuration

### Automatic Configuration
The deployment script automatically:
- ✅ Sets ShareVault in VaultCore
- ✅ Sets ClaimManager in VaultCore
- ✅ Authorizes VaultCore in SwapContract
- ✅ Configures initial APY (25% for each LST)
- ✅ Sets investment ratios based on profile

### Manual Configuration (Optional)

#### 1. Adjust APY Distribution
```bash
npx hardhat run scripts/setAPY.js --network kairos
```

Or programmatically:
```javascript
await vaultCore.setAPY(0, 3000); // 30% for wKoKAIA
await vaultCore.setAPY(1, 2500); // 25% for wGCKAIA
await vaultCore.setAPY(2, 2500); // 25% for wstKLAY
await vaultCore.setAPY(3, 2000); // 20% for stKAIA
```

#### 2. Change Investment Ratios
```javascript
// Example: Switch to balanced profile
await vaultCore.setInvestmentRatios(
    4500,  // 45% to LST staking
    4500,  // 45% to Balancer LP
    0      // 0% to aggressive
);
```

#### 3. Update Fee Structure
```javascript
// Set protocol fee (default: 10%)
await shareVault.setFees(1000); // 10% = 1000 basis points
```

## Deployment Output

### Generated Files

#### deployments-{network}.json
```json
{
  "shareVault": "0xF43BdDA5bc0693d952a68ABc4E0D8262A874b74e",
  "vaultCore": "0x09bE7a4bf8c0bB28725A9369484b0852cD70cBE8",
  "swapContract": "0x5D83C399c3bFf4fE86627eA8680431c5b8084320",
  "claimManager": "0x72C44A898dfD0cf4689DF795D188e19049a2d996",
  "lpCalculations": "0xf955f2aA1673c46F617A446c3a45f72eA958443f",
  "wkaia": "0x0339d5Eb6D195Ba90B13ed1BCeAa97EbD198b106",
  "balancerVault": "0x1c9074AA147648567015287B0d4185Cb4E04F86d",
  "chainId": "1001",
  "network": "kairos",
  "deployedAt": "2025-08-22T10:30:00.000Z",
  "profile": "stable",
  "configuration": {
    "investRatio": 9000,
    "stableRatio": 9000,
    "balancedRatio": 0,
    "aggressiveRatio": 0
  }
}
```

## Verification Steps

### 1. Verify Contract Connections
```bash
npx hardhat console --network kairos

> const deployments = require('./deployments-kairos.json')
> const vaultCore = await ethers.getContractAt("VaultCore", deployments.vaultCore)
> await vaultCore.shareVault() // Should return ShareVault address
> await vaultCore.swapContract() // Should return SwapContract address
```

### 2. Run Integration Test
```bash
# Test STABLE mode
npx hardhat run scripts/tests/testIntegratedStable.js --network kairos

# Test BALANCED mode
npx hardhat run scripts/tests/testIntegratedBalanced.js --network kairos
```

### 3. Test Small Deposit
```bash
npx hardhat console --network kairos

> const shareVault = await ethers.getContractAt("ShareVault", deployments.shareVault)
> await shareVault.depositKAIA(signer.address, {value: ethers.parseEther("0.1")})
```

## Network-Specific Information

### Kairos Testnet
```javascript
{
  chainId: 1001,
  rpc: "https://public-en-kairos.node.kaia.io",
  explorer: "https://kairos.kaiascan.io",
  wkaia: "0x0339d5Eb6D195Ba90B13ed1BCeAa97EbD198b106",
  balancerVault: "0x1c9074AA147648567015287B0d4185Cb4E04F86d"
}
```

### KAIA Mainnet
```javascript
{
  chainId: 8217,
  rpc: "https://klaytn-en.kommunedao.xyz:8651",
  explorer: "https://kaiascan.io",
  wkaia: "0x19aac5f612f524b754ca7e7c41cbfa2e981a4332",
  balancerVault: "0xTBD" // To be deployed
}
```

## Troubleshooting

### Common Issues

#### 1. "Insufficient funds for gas"
- **Solution**: Ensure deployment wallet has enough KAIA
- Testnet: ~5 KAIA needed
- Mainnet: ~10 KAIA needed

#### 2. "Contract size exceeds limit"
- **Solution**: Already optimized to 19.4 KB
- If modified, ensure optimizer is enabled in hardhat.config.js

#### 3. "Library not found"
- **Solution**: Deploy LPCalculations library first
- Library address must be linked to VaultCore

#### 4. "Transaction timeout"
- **Solution**: Increase timeout in hardhat.config.js
```javascript
networks: {
  kairos: {
    timeout: 600000 // 10 minutes
  }
}
```

#### 5. "Nonce too high"
- **Solution**: Reset nonce in wallet or wait for pending transactions

## Security Checklist

Before mainnet deployment:

- [ ] Audit completed and issues resolved
- [ ] All tests passing
- [ ] Deployment wallet is secure (hardware wallet recommended)
- [ ] Multi-sig wallet ready for ownership transfer
- [ ] Emergency pause mechanism tested
- [ ] Upgrade process documented and tested
- [ ] Initial liquidity prepared (recommend 10+ KAIA)
- [ ] APY values verified with current market rates
- [ ] Investment ratios appropriate for launch

## Post-Deployment Actions

### 1. Transfer Ownership (Mainnet Only)
```javascript
// Transfer to multi-sig
await shareVault.transferOwnership(multiSigAddress);
await vaultCore.transferOwnership(multiSigAddress);
await swapContract.transferOwnership(multiSigAddress);
```

### 2. Seed Initial Liquidity
```javascript
// Add initial liquidity for smooth operations
await shareVault.depositKAIA(treasury, {value: ethers.parseEther("10")});
```

### 3. Configure Monitoring
- Set up transaction monitoring
- Configure alerts for large deposits/withdrawals
- Monitor TVL and APY performance

### 4. Update Frontend
- Update contract addresses in frontend config
- Update ABI files if changed
- Test frontend integration

## Deployment Cost Estimates

### Testnet (Kairos)
- ClaimManager: ~0.5 KAIA
- SwapContract: ~1.0 KAIA
- LPCalculations: ~0.3 KAIA
- VaultCore: ~2.0 KAIA
- ShareVault: ~1.5 KAIA
- **Total: ~5.3 KAIA**

### Mainnet (KAIA)
- Expected similar costs
- Add 2x buffer for gas price variations
- **Recommended: 10+ KAIA**

## Support

For deployment issues:
1. Check this guide
2. Review error messages carefully
3. Verify network configuration
4. Contact technical team

---

**Version**: 1.0.0
**Last Updated**: 2025-08-22
**Tested On**: Kairos Testnet