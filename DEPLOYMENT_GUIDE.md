# Deployment Guide - Separated Vault Architecture

## Overview
This guide covers the deployment and management of the KommuneFi separated vault architecture (ShareVault + VaultCore).

## Prerequisites

### 1. Environment Setup
```bash
# Install dependencies
npm install

# Create and configure .env file
cp .env.example .env
```

Edit `.env` file:
```
PRIVATE_KEY=your_private_key_here
```

### 2. Network Configuration
Ensure you have KAIA tokens for gas fees:
- **Kairos Testnet**: Get test KAIA from faucet
- **Mainnet**: Ensure sufficient KAIA balance

## Deployment Process

### Step 1: Deploy Contracts
```bash
# For testnet
npx hardhat run scripts/deploySeparatedVault.js --network kairos

# For mainnet
npx hardhat run scripts/deploySeparatedVault.js --network kaia
```

This script will:
1. Deploy VaultCore (UUPS proxy)
2. Deploy ShareVault (UUPS proxy)
3. Connect ShareVault ↔ VaultCore
4. Set initial APY values (5%, 6%, 7%, 8%)
5. Save deployment addresses to `deployments-{network}.json`

Expected output:
```
Deploying separated vault architecture...

Deploying with account: 0x...
1. Deploying VaultCore...
VaultCore deployed at: 0x...

2. Deploying ShareVault...
ShareVault deployed at: 0x...

3. Configuring contracts...
ShareVault set in VaultCore

4. Setting APY values...
APY for LST 0 set to 5%
APY for LST 1 set to 6%
APY for LST 2 set to 7%
APY for LST 3 set to 8%

✅ Deployment complete!
Deployment info saved to deployments-kairos.json
```

### Step 2: Verify Configuration
```bash
npx hardhat run scripts/setupSeparatedVault.js --network kairos
```

This will verify and configure:
- APY values for each LST
- Invest ratio (90%)
- Deposit limit (100 WKAIA)
- Fee structure (0.1%)

### Step 3: Test Deployment
```bash
npx hardhat run scripts/testSeparatedVault.js --network kairos
```

Run comprehensive tests to verify:
- Initial state
- Deposit functionality
- Withdrawal functionality
- Share calculations
- State consistency

## Upgrade Process

### Upgrading Contracts
```bash
npx hardhat run scripts/upgradeSeparatedVault.js --network kairos
```

This script will:
1. Upgrade VaultCore implementation
2. Upgrade ShareVault implementation
3. Verify configuration remains intact
4. Check and restore APY values if needed

⚠️ **Important**: Always test upgrades on testnet first!

## Configuration Management

### APY Management
```bash
# Set individual APY
npx hardhat run scripts/setAPY.js --network kairos

# Or use console
npx hardhat console --network kairos
> const vaultCore = await ethers.getContractAt("VaultCore", "0x5CB80D92b24d14236C17Bfba0d0Cb96e728A87B3")
> await vaultCore.setAPY(0, 5500) // Set wKoKAIA to 5.5%
```

### Parameter Updates
```javascript
// Update invest ratio (90% = 9000)
await vaultCore.setInvestRatio(9000)

// Update deposit limit
await shareVault.setDepositLimit(ethers.parseEther("200"))

// Update fees (0.1% = 10 basis points)
await shareVault.setFees(10)
```

## Deployment Checklist

### Pre-Deployment
- [ ] `.env` file configured with private key
- [ ] Sufficient KAIA for gas fees
- [ ] Review APY values to set
- [ ] Confirm network (testnet vs mainnet)

### Deployment
- [ ] Run deployment script
- [ ] Verify contracts deployed successfully
- [ ] Check `deployments-{network}.json` created
- [ ] Verify contract connections

### Post-Deployment
- [ ] Run setup script to verify configuration
- [ ] Execute test suite
- [ ] Document deployment addresses
- [ ] Transfer ownership if needed

## Contract Addresses

### Latest Deployment (Kairos Testnet)
```json
{
  "shareVault": "0x69f222BC8e7730A182fe81D938BF4d4DA4089a48",
  "vaultCore": "0x5CB80D92b24d14236C17Bfba0d0Cb96e728A87B3",
  "swapContract": "0x829718DBf5e19AB36ab305ac7A7c6C9995bB5F15"
}
```

## Troubleshooting

### Common Issues

#### 1. "Contract size exceeds limit"
The separated architecture specifically addresses this. Ensure you're using:
- ShareVault: ~12.23 KB
- VaultCore: ~10.17 KB

#### 2. "ShareVault not set in VaultCore"
Run the setup script to restore connections:
```bash
npx hardhat run scripts/setupSeparatedVault.js --network kairos
```

#### 3. "Zero shares" error
This typically occurs on first deposit. Solutions:
- Ensure APY values are set (non-zero)
- Check total supply is properly initialized
- Verify WKAIA balance in contracts

#### 4. Gas estimation errors
Increase gas limit in transactions:
```javascript
{ gasLimit: 5000000 }
```

## Security Considerations

### Access Control
- Only owner can upgrade contracts
- Only owner can set APY values
- Only owner can update parameters

### Best Practices
1. Always test on Kairos testnet first
2. Use multisig for production deployments
3. Verify all parameters before mainnet deployment
4. Keep deployment artifacts secure
5. Document all configuration changes

## Monitoring

### Key Metrics to Monitor
- Total Value Locked (TVL)
- Share price (assets/shares ratio)
- APY distribution across LSTs
- User deposit/withdrawal patterns
- Gas usage patterns

### Events to Track
```solidity
event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)
event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)
event APYUpdated(uint256 indexed index, uint256 apy)
```

## Emergency Procedures

### Pause Operations
Currently no pause mechanism. For emergency:
1. Set APY to 0 for all protocols
2. Prepare upgrade with fixes
3. Deploy upgrade

### Recovery from Failed Upgrade
1. Deploy new implementation
2. Use upgrade script with new implementation
3. Verify state is preserved
4. Test all functionality

## Support

For issues or questions:
- Review test scripts in `/scripts/tests/`
- Check deployment logs in `deployments-{network}.json`
- Verify contract state using read functions

## Next Steps

After successful deployment:
1. Monitor initial deposits
2. Verify APY distribution working correctly
3. Test withdrawal functionality
4. Document any custom configurations
5. Set up monitoring dashboards