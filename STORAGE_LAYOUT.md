# KommuneFi Contracts - Storage Layout Documentation

## 🔴 CRITICAL: This Document is Essential for Safe Upgrades

This document defines the EXACT storage layout for all upgradeable contracts. 
**ANY deviation from these layouts will corrupt contract storage and potentially lose user funds.**

## Storage Slot Calculation

### How Solidity Allocates Storage
- Each storage slot is 32 bytes (256 bits)
- Variables are packed when possible
- Mappings and dynamic arrays use hash-based storage
- Inherited contracts use slots 0+ before child contract

### Tools to Verify Storage
```javascript
// Check specific storage slot
await ethers.provider.getStorage(contractAddress, slotNumber);

// Decode address from slot (addresses are 20 bytes, padded left)
const rawSlot = await ethers.provider.getStorage(address, 0);
const decodedAddress = "0x" + rawSlot.slice(26);
```

## ShareVault Storage Layout

### Inheritance Chain
```
Initializable → ContextUpgradeable → ERC20Upgradeable → ERC4626Upgradeable → OwnableUpgradeable → UUPSUpgradeable → ReentrancyGuardUpgradeable → ShareVault
```

### Storage Layout
```solidity
// ============ OpenZeppelin Storage (Slots 0-101) ============
// Initializable (1 slot)
uint64 private _initialized;           // slot 0 (8 bytes)
bool private _initializing;            // slot 0 (1 byte, packed)

// ERC20Upgradeable (4 slots)
mapping(address => uint256) _balances; // slot 1
mapping(address => mapping(address => uint256)) _allowances; // slot 2
uint256 _totalSupply;                  // slot 3
string _name;                          // slot 4 (dynamic)
string _symbol;                        // slot 5 (dynamic)

// ERC4626Upgradeable (1 slot)
IERC20 _asset;                         // slot 6

// OwnableUpgradeable (1 slot)
address _owner;                        // slot 7

// ReentrancyGuardUpgradeable (1 slot)
uint256 _status;                       // slot 8

// Gap arrays for upgradeability
uint256[50] __gap;                     // slots 9-58

// ============ ShareVault Custom Storage ============
address public vaultCore;              // slot 59
address public treasury;               // slot 60
uint256 public basisPointsFees;        // slot 61
mapping(address => uint256) public lastDepositBlock; // slot 62
```

## VaultCore Storage Layout

### ⚠️ CRITICAL: Must Match SharedStorage EXACTLY

```solidity
// ============ Core Protocol Storage ============
address public shareVault;             // slot 0
address public wkaia;                  // slot 1
address public balancerVault;          // slot 2
address public swapContract;           // slot 3
address public claimManager;           // slot 4

// ============ LST Management ============
mapping(uint256 => TokenInfo) public tokensInfo;     // slot 5
mapping(uint256 => uint256) public lstAPY;           // slot 6

// ============ Investment Ratios ============
uint256 public investRatio;            // slot 7 (total to invest)
uint256 public totalInvested;          // slot 8
uint256[4] public investedPerLST;      // slots 9-12

// ============ LP Token Management ============
address public lpToken;                // slot 13 (single BPT token)
uint256 public lpBalance;              // slot 14 (total LP balance)

// ============ New Investment Strategies ============
uint256 public balancedRatio;          // slot 15 (% to Balancer LP)
uint256 public aggressiveRatio;        // slot 16 (% to future strategies)

// ============ FUTURE EXPANSION ============
// Only add new variables HERE, never above
// uint256 public newVariable;         // slot 17
// mapping(...) public newMapping;     // slot 18
```

## SharedStorage (Base for Delegatecall)

### Used By: VaultCore, ClaimManager

```solidity
contract SharedStorage {
    // MUST be IDENTICAL to VaultCore slots 0-16
    address public shareVault;             // slot 0
    address public wkaia;                  // slot 1
    address public balancerVault;          // slot 2
    address public swapContract;           // slot 3
    address public claimManager;           // slot 4
    mapping(uint256 => TokenInfo) public tokensInfo;     // slot 5
    mapping(uint256 => uint256) public lstAPY;           // slot 6
    uint256 public investRatio;            // slot 7
    uint256 public totalInvested;          // slot 8
    uint256[4] public investedPerLST;      // slots 9-12
    address public lpToken;                // slot 13
    uint256 public lpBalance;              // slot 14
    uint256 public balancedRatio;          // slot 15
    uint256 public aggressiveRatio;        // slot 16
}
```

## SwapContract Storage Layout

### Inheritance Chain
```
Initializable → OwnableUpgradeable → UUPSUpgradeable → SwapContract
```

### Storage Layout
```solidity
// ============ OpenZeppelin Storage ============
uint64 private _initialized;           // slot 0 (partial)
bool private _initializing;            // slot 0 (partial)
address private _owner;                // slot 1

// ============ SwapContract Custom Storage ============
address public authorizedCaller;       // slot 2
address public wkaia;                  // slot 3
address public balancerVault;          // slot 4
```

## ClaimManager Storage Layout (Non-Upgradeable)

### ⚠️ MUST Match VaultCore for Delegatecall

```solidity
contract ClaimManager is SharedStorage {
    // Inherits exact storage layout from SharedStorage
    // NO additional storage variables allowed
    // All functions use inherited storage via delegatecall
}
```

## TokenInfo Struct Layout

```solidity
struct TokenInfo {
    address handler;     // 20 bytes
    address tokenA;      // 20 bytes (LST or asset)
    address tokenB;      // 20 bytes (BPT for Balancer pools)
    address wrapped;     // 20 bytes (wrapped version if exists)
    uint256 tokenType;   // 0 = LST staking, 1 = LP token
    bytes32 pool0;       // Pool ID for swaps
    bytes32 pool1;       // Pool ID for LP (Balancer)
    bool isActive;       // Active status
}
```

## Storage Verification Scripts

### 1. Verify VaultCore Storage
```javascript
async function verifyVaultCoreStorage(address) {
    const vaultCore = await ethers.getContractAt("VaultCore", address);
    
    // Verify slot 0-4 (critical addresses)
    console.log("=== Core Addresses ===");
    console.log("Slot 0 (shareVault):", await vaultCore.shareVault());
    console.log("Slot 1 (wkaia):", await vaultCore.wkaia());
    console.log("Slot 2 (balancerVault):", await vaultCore.balancerVault());
    console.log("Slot 3 (swapContract):", await vaultCore.swapContract());
    console.log("Slot 4 (claimManager):", await vaultCore.claimManager());
    
    // Verify investment ratios
    console.log("\n=== Investment Ratios ===");
    console.log("Slot 7 (investRatio):", await vaultCore.investRatio());
    console.log("Slot 15 (balancedRatio):", await vaultCore.balancedRatio());
    console.log("Slot 16 (aggressiveRatio):", await vaultCore.aggressiveRatio());
    
    // Verify LP token
    console.log("\n=== LP Management ===");
    console.log("Slot 13 (lpToken):", await vaultCore.lpToken());
    console.log("Slot 14 (lpBalance):", await vaultCore.lpBalance());
}
```

### 2. Compare Storage Before/After Upgrade
```javascript
async function compareStorage(proxyAddress) {
    const SLOTS_TO_CHECK = 17;
    const before = [];
    const after = [];
    
    // Capture before upgrade
    for (let i = 0; i < SLOTS_TO_CHECK; i++) {
        before[i] = await ethers.provider.getStorage(proxyAddress, i);
    }
    
    // Perform upgrade...
    
    // Capture after upgrade
    for (let i = 0; i < SLOTS_TO_CHECK; i++) {
        after[i] = await ethers.provider.getStorage(proxyAddress, i);
    }
    
    // Compare
    for (let i = 0; i < SLOTS_TO_CHECK; i++) {
        if (before[i] !== after[i]) {
            console.log(`CHANGED Slot ${i}: ${before[i]} → ${after[i]}`);
        }
    }
}
```

## Migration Examples

### Safe: Adding New Variable
```solidity
// VaultCore V1
contract VaultCoreV1 {
    // ... slots 0-16 ...
}

// VaultCore V2 - SAFE
contract VaultCoreV2 {
    // ... slots 0-16 (unchanged) ...
    uint256 public newFeature;  // slot 17 (NEW)
}
```

### Safe: Adding New Mapping
```solidity
// VaultCore V2 - SAFE
contract VaultCoreV2 {
    // ... slots 0-16 (unchanged) ...
    mapping(address => uint256) public userRewards;  // slot 17 (NEW)
}
```

### UNSAFE: Reordering Variables
```solidity
// VaultCore V2 - DANGEROUS! Will corrupt storage
contract VaultCoreV2 {
    address public wkaia;           // slot 0 (was slot 1) ❌
    address public shareVault;      // slot 1 (was slot 0) ❌
    // Data corruption!
}
```

### UNSAFE: Changing Variable Types
```solidity
// VaultCore V2 - DANGEROUS! 
contract VaultCoreV2 {
    // ... slots 0-6 ...
    uint128 public investRatio;     // was uint256 ❌
    // Type change corrupts data!
}
```

### UNSAFE: Inserting Variables
```solidity
// VaultCore V2 - DANGEROUS!
contract VaultCoreV2 {
    address public shareVault;      // slot 0
    address public newVariable;     // slot 1 (inserted) ❌
    address public wkaia;           // slot 2 (was slot 1) ❌
    // Everything after shifts!
}
```

## Emergency Storage Recovery

### If Storage Gets Corrupted

```javascript
// 1. Read raw storage
const slot0 = await ethers.provider.getStorage(proxy, 0);
const slot1 = await ethers.provider.getStorage(proxy, 1);

// 2. Decode values
const shareVault = "0x" + slot0.slice(26);  // Address is 20 bytes
const wkaia = "0x" + slot1.slice(26);

// 3. Deploy recovery contract with corrected layout
contract RecoveryContract {
    address public shareVault;      // Restore to slot 0
    address public wkaia;           // Restore to slot 1
    
    function fixStorage(address _shareVault, address _wkaia) external {
        shareVault = _shareVault;
        wkaia = _wkaia;
    }
}

// 4. Upgrade proxy to recovery contract
// 5. Call fixStorage with recovered values
// 6. Upgrade to corrected implementation
```

## Checklist for Storage Safety

Before ANY upgrade:

- [ ] Review this document
- [ ] Check no variables were reordered
- [ ] Check no variables were removed
- [ ] Check no variable types changed
- [ ] New variables only added at END
- [ ] Run storage verification script
- [ ] Test upgrade on testnet first
- [ ] Compare storage before/after upgrade
- [ ] Document any new storage variables

## Critical Reminders

1. **NEVER** modify the order of existing storage variables
2. **NEVER** delete or rename existing storage variables
3. **NEVER** change the type of existing storage variables
4. **ALWAYS** add new variables at the end
5. **ALWAYS** test upgrades on testnet first
6. **ALWAYS** verify storage preservation after upgrade
7. **ALWAYS** keep this document updated

---

**Last Updated**: 2025-08-22
**Version**: 1.0.0
**Critical Slots**: 0-16 (VaultCore), 0-61 (ShareVault)