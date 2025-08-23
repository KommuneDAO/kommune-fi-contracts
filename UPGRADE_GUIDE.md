# KommuneFi Contracts - Upgrade Guide

## 🔴 Critical: Storage Layout Management

### Understanding UUPS Upgradeable Contracts

UUPS (Universal Upgradeable Proxy Standard) contracts separate logic from storage:
- **Proxy Contract**: Holds all storage and delegates calls to implementation
- **Implementation Contract**: Contains logic but no persistent storage
- **Storage Collision**: The #1 cause of failed upgrades

### Storage Layout Rules

#### ⚠️ NEVER DO THIS:
```solidity
// Version 1
contract VaultCore {
    address public shareVault;      // slot 0
    address public wkaia;           // slot 1
    uint256 public totalAssets;     // slot 2
}

// Version 2 - WRONG! This will corrupt data
contract VaultCore {
    address public wkaia;           // slot 0 (was shareVault!)
    address public shareVault;      // slot 1 (was wkaia!)
    uint256 public totalAssets;     // slot 2
}
```

#### ✅ CORRECT APPROACH:
```solidity
// Version 1
contract VaultCore {
    address public shareVault;      // slot 0
    address public wkaia;           // slot 1
    uint256 public totalAssets;     // slot 2
}

// Version 2 - CORRECT! Only append new variables
contract VaultCore {
    address public shareVault;      // slot 0 (unchanged)
    address public wkaia;           // slot 1 (unchanged)
    uint256 public totalAssets;     // slot 2 (unchanged)
    address public newVariable;     // slot 3 (new)
}
```

### Storage Layout for KommuneFi

#### ShareVault Storage Layout
```solidity
// Inherited from OpenZeppelin (slots 0-101)
// [OpenZeppelin storage slots for Initializable, ERC20, ERC4626, etc.]

// Custom storage starts at slot 102+
address public vaultCore;           // First custom variable
address public treasury;
uint256 public basisPointsFees;
mapping(address => uint256) public lastDepositBlock;
```

#### VaultCore Storage Layout
```solidity
// Critical: Must maintain exact order for delegatecall
address public shareVault;          // slot 0
address public wkaia;               // slot 1
address public balancerVault;       // slot 2
address public swapContract;        // slot 3
address public claimManager;        // slot 4
mapping(uint256 => TokenInfo) public tokensInfo;  // slot 5
mapping(uint256 => uint256) public lstAPY;        // slot 6
uint256 public investRatio;         // slot 7
uint256 public totalInvested;       // slot 8
uint256[4] public investedPerLST;   // slots 9-12
// ... continue in exact order
```

#### SharedStorage Pattern
```solidity
// ClaimManager MUST have identical storage layout for delegatecall
contract SharedStorage {
    address public shareVault;          // slot 0
    address public wkaia;               // slot 1
    address public balancerVault;       // slot 2
    address public swapContract;        // slot 3
    address public claimManager;        // slot 4
    mapping(uint256 => TokenInfo) public tokensInfo;  // slot 5
    // ... exact same layout as VaultCore
}
```

## Deployment Guide

### Fresh Deployment

#### 1. Configure Environment
```bash
cp .env.example .env
# Edit .env with:
# - KAIROS_PRIVATE_KEY or KAIA_PRIVATE_KEY
# - RPC endpoints if custom
```

#### 2. Deploy All Contracts
```bash
# Deploy to testnet (Kairos)
npx hardhat run scripts/deployFresh.js --network kairos

# Deploy to mainnet (KAIA)
npx hardhat run scripts/deployFresh.js --network kaia
```

#### 3. Deploy with Investment Profile
```bash
# Conservative profile (30% LST, 70% liquidity)
INVESTMENT_PROFILE=conservative npx hardhat run scripts/deployWithProfile.js --network kairos

# Stable profile (90% LST, 10% liquidity) - DEFAULT
INVESTMENT_PROFILE=stable npx hardhat run scripts/deployWithProfile.js --network kairos

# Balanced profile (90% to LST, then 50% of LST → LP = 45% LST + 45% LP + 10% liquidity)
INVESTMENT_PROFILE=balanced npx hardhat run scripts/deployWithProfile.js --network kairos
```

#### 4. Verify Deployment
```bash
# Test STABLE mode
npx hardhat run scripts/tests/testIntegratedStable.js --network kairos

# Test BALANCED mode
npx hardhat run scripts/tests/testIntegratedBalanced.js --network kairos
```

### Deployment Output
The deployment creates `deployments-{network}.json`:
```json
{
  "shareVault": "0x...",
  "vaultCore": "0x...",
  "swapContract": "0x...",
  "claimManager": "0x...",
  "lpCalculations": "0x...",
  "wkaia": "0x...",
  "balancerVault": "0x...",
  "chainId": "1001",
  "network": "kairos",
  "deployedAt": "2025-08-22T..."
}
```

## Upgrade Guide

### Pre-Upgrade Checklist

#### 1. Storage Layout Verification
```javascript
// scripts/verifyStorageLayout.js
const vaultCore = await ethers.getContractAt("VaultCore", address);

// Check critical storage slots
console.log("Slot 0:", await ethers.provider.getStorage(address, 0)); // shareVault
console.log("Slot 1:", await ethers.provider.getStorage(address, 1)); // wkaia
console.log("Slot 2:", await ethers.provider.getStorage(address, 2)); // balancerVault
```

#### 2. Test Upgrade Locally
```bash
# Run upgrade test
npx hardhat run scripts/testUpgrades.js --network kairos
```

### Performing Upgrades

#### Upgrade All Contracts
```bash
npx hardhat run scripts/upgradeAll.js --network kairos
```

#### Upgrade Individual Contracts

##### VaultCore Upgrade
```bash
npx hardhat run scripts/upgradeVaultCore.js --network kairos
```

**Special Considerations for VaultCore:**
- Requires external library linking (LPCalculations)
- Uses delegatecall to ClaimManager
- Must maintain SharedStorage compatibility

##### ShareVault Upgrade
```bash
npx hardhat run scripts/upgradeShareVault.js --network kairos
```

**Special Considerations for ShareVault:**
- Standard upgrade process
- No external dependencies

##### SwapContract Upgrade
```bash
npx hardhat run scripts/upgradeSwapContract.js --network kairos
```

**⚠️ WARNING**: SwapContract is FINALIZED and should not be modified

### Post-Upgrade Verification

#### 1. Verify Storage Integrity
```javascript
// After upgrade, verify critical values preserved
const vaultCore = await ethers.getContractAt("VaultCore", address);
assert(await vaultCore.shareVault() === expectedShareVault);
assert(await vaultCore.investRatio() === expectedRatio);
assert(await vaultCore.getTotalAssets() === expectedAssets);
```

#### 2. Test Core Functionality
```bash
# Run integration tests
npx hardhat run scripts/tests/testIntegratedStable.js --network kairos
npx hardhat run scripts/tests/testIntegratedBalanced.js --network kairos
```

## Adding New Storage Variables

### Safe Method: Append Only

#### Step 1: Add to Implementation
```solidity
contract VaultCoreV2 is VaultCore {
    // ... all existing variables ...
    
    // New variables at the END only
    uint256 public newFeature;
    mapping(address => bool) public newMapping;
    
    // Safe to add new functions
    function setNewFeature(uint256 _value) external onlyOwner {
        newFeature = _value;
    }
}
```

#### Step 2: Initialize New Variables
```solidity
function upgradeToV2() external onlyOwner {
    // Initialize new variables if needed
    newFeature = 100;
}
```

### Using Storage Gaps (Advanced)

```solidity
contract VaultCoreV1 {
    // ... existing variables ...
    
    // Reserve storage slots for future use
    uint256[50] private __gap;
}

contract VaultCoreV2 {
    // ... existing variables ...
    
    // Use gap space for new variables
    uint256 public newVariable1;
    uint256 public newVariable2;
    
    // Reduce gap accordingly
    uint256[48] private __gap;
}
```

## Common Upgrade Errors

### Error: "Contract is not upgrade safe"
**Cause**: Using delegatecall without proper flag
**Solution**:
```javascript
await upgrades.upgradeProxy(address, Contract, {
    unsafeAllow: ["delegatecall", "external-library-linking"]
});
```

### Error: "Deployment at address is not registered"
**Cause**: Proxy not found in OpenZeppelin's upgrade registry
**Solution**:
```javascript
await upgrades.forceImport(proxyAddress, Contract);
```

### Error: Storage collision detected
**Cause**: Changed storage layout order
**Solution**: Never modify existing variable order, only append

### Error: "Cannot find library"
**Cause**: VaultCore requires LPCalculations library
**Solution**:
```javascript
const LPCalculations = await ethers.getContractFactory("LPCalculations");
const lpCalc = await LPCalculations.deploy();
await lpCalc.waitForDeployment();

const VaultCore = await ethers.getContractFactory("VaultCore", {
    libraries: {
        LPCalculations: await lpCalc.getAddress()
    }
});
```

## Emergency Procedures

### If Upgrade Fails

#### 1. DO NOT PANIC
- Proxy still points to old implementation
- User funds are safe

#### 2. Debug the Issue
```javascript
// Check implementation address
const proxyAdmin = await upgrades.admin.getInstance();
const implAddress = await proxyAdmin.getProxyImplementation(proxyAddress);
console.log("Current implementation:", implAddress);
```

#### 3. Rollback if Needed
- Deploy previous version as new implementation
- Point proxy to previous implementation

### Storage Recovery

If storage is corrupted:
```javascript
// Read raw storage slots
const slot0 = await ethers.provider.getStorage(address, 0);
const slot1 = await ethers.provider.getStorage(address, 1);

// Decode and verify
const shareVault = "0x" + slot0.slice(26);
console.log("ShareVault address:", shareVault);
```

## Best Practices

### 1. Always Test Upgrades
- Test on testnet first
- Use upgrade test scripts
- Verify storage preservation

### 2. Document Changes
- Keep upgrade log
- Document new variables
- Note any breaking changes

### 3. Incremental Upgrades
- Don't change too much at once
- Test each upgrade thoroughly
- Keep old implementation code

### 4. Monitor After Upgrade
- Check transaction success rates
- Monitor for unusual behavior
- Keep upgrade rollback ready

## Upgrade Log Template

```markdown
## Upgrade: [Contract Name] v[X.Y.Z]
Date: YYYY-MM-DD
Network: Kairos/KAIA
Old Implementation: 0x...
New Implementation: 0x...

### Changes:
- Added new feature X
- Fixed bug Y
- Optimized function Z

### New Storage Variables:
- uint256 public newVariable (slot X)

### Verification:
- [ ] Storage layout verified
- [ ] Upgrade test passed
- [ ] Integration test passed
- [ ] Post-upgrade monitoring (24h)

### Notes:
[Any special considerations]
```

## Contact for Issues

If you encounter upgrade issues:
1. Check this guide first
2. Review storage layout in SharedStorage.sol
3. Run verification scripts
4. Contact technical team

---

**Remember**: Storage layout is SACRED in upgradeable contracts. When in doubt, only append!