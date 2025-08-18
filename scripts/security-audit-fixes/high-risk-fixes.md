# High Risk Security Fixes

## Issue 1: Direct Deposit Front-running Vulnerability

### Problem:
User transfers WKAIA to VaultCore first, then calls deposit(). 
Attacker can front-run and steal the WKAIA by calling deposit() first.

### Solution Options:

#### Option 1: Revert to Standard ERC4626 Pattern (RECOMMENDED)
```solidity
// ShareVault.sol
function deposit(uint256 assets, address receiver) public override returns (uint256 shares) {
    require(assets > 0, "Zero amount");
    
    // Standard ERC4626: Pull tokens from user directly
    IERC20(asset()).transferFrom(msg.sender, vaultCore, assets);
    
    shares = previewDeposit(assets);
    require(shares > 0, "Zero shares");
    
    // Process deposit in VaultCore
    (bool success,) = vaultCore.call(
        abi.encodeWithSignature("handleDeposit(uint256,address)", assets, msg.sender)
    );
    require(success, "Core deposit failed");
    
    _mint(receiver, shares);
    emit Deposit(msg.sender, receiver, assets, shares);
}
```

#### Option 2: Track Depositor Transfers
```solidity
// Track who sent WKAIA to VaultCore
mapping(address => uint256) public userPendingDeposits;

// In VaultCore - track incoming transfers
function onTokenTransfer(address from, uint256 amount) external {
    require(msg.sender == wkaia, "Only WKAIA");
    userPendingDeposits[from] += amount;
}

// In ShareVault - only use sender's deposits
function deposit(uint256 assets, address receiver) external returns (uint256) {
    require(userPendingDeposits[msg.sender] >= assets, "Insufficient pending deposit");
    userPendingDeposits[msg.sender] -= assets;
    // ... rest of logic
}
```

## Issue 2: Delegatecall Storage Layout Mismatch Risk

### Problem:
ClaimManager and VaultCore must have identical storage layouts for delegatecall.
Any mismatch causes critical storage corruption.

### Solution: Shared Storage Base Contract

#### Step 1: Create SharedStorage.sol
```solidity
// contracts/SharedStorage.sol
pragma solidity ^0.8.20;

import {TokenInfo} from "./interfaces/ITokenInfo.sol";

/**
 * @title SharedStorage
 * @dev Base storage contract to ensure identical layout for delegatecall
 * CRITICAL: Never modify order, only append new variables at the end
 */
contract SharedStorage {
    // ========== CORE ADDRESSES (slots 0-4) ==========
    address public shareVault;       // slot 0
    address public wkaia;            // slot 1
    address public balancerVault;    // slot 2
    address public swapContract;     // slot 3
    address public claimManager;     // slot 4
    
    // ========== MAPPINGS (slots 5-6) ==========
    mapping(uint256 => TokenInfo) public tokensInfo;  // slot 5
    mapping(uint256 => uint256) public lstAPY;        // slot 6
    
    // ========== CONFIG (slots 7-8) ==========
    uint256 public investRatio;     // slot 7
    uint256 public slippage;        // slot 8
    
    // ========== UNSTAKE DATA (slots 9-10) ==========
    mapping(address => mapping(uint256 => uint256)) public unstakeRequests;  // slot 9
    mapping(address => mapping(uint256 => uint256)) public unstakeAmounts;   // slot 10
    
    // ========== RESERVE FOR UPGRADES ==========
    uint256[40] private __gap;  // Reserve 40 slots for future variables
}
```

#### Step 2: Update VaultCore.sol
```solidity
import "./SharedStorage.sol";

contract VaultCore is SharedStorage, OwnableUpgradeable, UUPSUpgradeable {
    // Remove all duplicate storage variables
    // Only add NEW variables after SharedStorage
    
    // New variables (if any) go here, after __gap
    // mapping(address => uint256) public newVariable; // slot 51+
}
```

#### Step 3: Update ClaimManager.sol
```solidity
import "./SharedStorage.sol";

contract ClaimManager is SharedStorage {
    // Remove all duplicate storage variables
    // This contract should ONLY have logic, no new storage
    
    // All functions remain the same
    function executeUnstake(...) external { ... }
    function executeClaim(...) external { ... }
}
```

## Testing Requirements:

1. **Front-running Test**:
   - Deploy contracts
   - User A transfers WKAIA to VaultCore
   - User B tries to deposit User A's funds
   - Should fail with new protection

2. **Storage Layout Test**:
   ```javascript
   // Verify storage slots match
   const vaultSlot0 = await ethers.provider.getStorageAt(vaultCore.address, 0);
   const claimSlot0 = await ethers.provider.getStorageAt(claimManager.address, 0);
   // Should be identical when using SharedStorage
   ```

3. **Delegatecall Test**:
   - Perform unstake via delegatecall
   - Verify correct storage slots are modified
   - Check no storage corruption

## Risk Assessment:

### Before Fix:
- **High**: Anyone can steal pending deposits via front-running
- **High**: Storage corruption risk with delegatecall

### After Fix:
- **Low**: Deposits are protected from front-running
- **Low**: Storage layout guaranteed to match via inheritance