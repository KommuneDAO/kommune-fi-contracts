# CLAUDE_HISTORY.md - Historical Issues and Resolutions

This file contains the historical development issues and their resolutions from the KommuneFi Contracts project.
See CLAUDE.md for current instructions and active development guidelines.

## Session History Overview
- Initial V1: Single contract (KommuneVault)
- V1.5: Optimized KVaultV2 hit 24KB size limit  
- Helper contracts attempted with delegatecall pattern
- V2: Separated ShareVault + VaultCore architecture
- SwapContract finalized with unified sorting logic
- All 4 LSTs tested successfully with GIVEN_OUT swaps
- Project structure cleaned up and test scripts organized (2025-08-14)

---

## Historical Issues and Resolutions

### queryBatchSwap Issue Resolution (2025-08-14)

**⚠️ CRITICAL: queryBatchSwap cannot be used from smart contracts**

#### Issue Summary:
- **Symptom**: "Cannot assign to read only property '0' of object '[object Array]'" error when calling `queryBatchSwap`
- **Root Cause**: Balancer's `queryBatchSwap` modifies internal state (even though it reverts), making it incompatible with Solidity's memory safety rules
- **Environment**: This was working in previous implementations but broke after contract separation

#### Why It Happens:
1. `queryBatchSwap` is designed for **off-chain simulation only**
2. When called from a contract, Balancer tries to modify the arrays passed to it
3. Solidity's memory arrays are read-only when passed between contracts
4. The function works with `staticCall` from **external scripts** but not from within contracts

#### Solution Applied:
1. **Removed all estimation functions** from SwapContract (`estimateSwap`, `estimateSwapGivenOut`)
2. **Simplified VaultCore withdrawal logic**: Send all available LST balance to SwapContract
3. **Let SwapContract handle optimization**: `swapGivenOut` only uses what's needed and returns unused tokens
4. **Use rescueToken pattern**: Retrieve any unused tokens after swap

#### What NOT to Do:
- ❌ Don't try to call `queryBatchSwap` from within smart contracts
- ❌ Don't implement estimation functions that use `queryBatchSwap`
- ❌ Don't use `try/catch` with functions that need `staticCall`
- ❌ Don't copy estimation code from other contracts - it won't work

#### Correct Approach:
```javascript
// For off-chain estimation (JavaScript):
const estimate = await swapContract.estimateSwapGivenOut.staticCall(
    tokenInfo,
    balancerVault,
    desiredOutput
);

// For on-chain swaps (Solidity):
// Just send all available balance and let SwapContract optimize
IERC20(tokenA).transfer(swapContract, availableBalance);
swapContract.swapGivenOut(tokenInfo, vault, desiredOutput, availableBalance);
```

#### Key Learning:
- `queryBatchSwap` is for **read-only off-chain use only**
- Use `staticCall` from JavaScript/TypeScript for estimations
- For on-chain operations, use actual swap functions with proper slippage protection

### Multi-LST Sequential Swap Issue Resolution (2025-08-14)

**⚠️ CRITICAL: Always reference KommuneVaultV2.sol first for multi-LST swap logic**

#### Issue Summary:
- **Symptom**: Progressive withdrawals failed above 10% with "Core withdraw failed" error
- **Root Cause**: GIVEN_OUT swaps required more input LST than available balance
- **Key Learning**: **Always check successful implementations FIRST before reimplementing**

#### Specific Problems Found:
1. **GIVEN_OUT Input Amount Overflow**: GIVEN_OUT calculates exact output but may require more input than available
2. **No Slippage Buffer**: Target WKAIA amount had no buffer for price fluctuations  
3. **stKAIA Handling**: Incorrectly treated stKAIA like other wrapped LSTs
4. **Missing Conservative Target**: No logic to prevent input amount from exceeding balance

#### Why KommuneVaultV2 Worked:
1. **Slippage Buffer**: `targetAmount = (amt * 110) / 100` (10% buffer)
2. **Conservative Limits**: Limited swap amounts to available balance
3. **Proper stKAIA Handling**: Used asset directly without wrapping logic
4. **Sequential Processing**: Moved to next LST if current one insufficient

#### Solution Applied to VaultCore:
```solidity
// WRONG (original broken logic):
uint256 desiredWKAIA = needed;
swapContract.swapGivenOut(info, vault, desiredWKAIA, availableBalance);

// CORRECT (fixed with KommuneVaultV2 pattern):
uint256 targetWKAIA = (needed * 110) / 100; // 10% buffer
uint256 conservativeTarget = needed < availableBalance ? needed : availableBalance;  
uint256 finalTarget = conservativeTarget < targetWKAIA ? conservativeTarget : targetWKAIA;
swapContract.swapGivenOut(info, vault, finalTarget, availableBalance);
```

### Withdrawal Threshold Issue Resolution (2025-08-14)

**⚠️ CRITICAL: 50% Withdrawal Threshold Problem**

#### Issue Summary:
- **Symptom**: Withdrawals fail when amount exceeds certain threshold
- **Root Cause**: 10% slippage buffer in swap logic causes mathematical impossibility
- **Environment**: Low liquidity conditions (early stage with few users)

#### Mathematical Analysis:
1. **The Problem**:
   - LSTs distributed across 4 tokens (each ~25% of total)
   - Withdrawal needs swap with 10% slippage buffer
   - Formula: `targetWKAIA = needed * 1.1`
   - When withdrawal > ~45%, target exceeds any single LST balance
   - Example: 50% withdrawal needs 55% with buffer, but largest LST only has 25%

2. **Proof**:
   ```
   For swap to succeed: lstBalance >= targetWithSlippage
   With 4 LSTs: lstBalance ≈ totalAssets / 4 = 0.25 * totalAssets
   targetWithSlippage = withdrawAmount * 1.1
   For 50% withdrawal: 0.25 * totalAssets >= 0.5 * totalAssets * 1.1
   0.25 >= 0.55 → FALSE
   ```

3. **Minimum WKAIA Buffer Required** (for small deposits):
   - 50% withdrawal: 29% WKAIA buffer needed
   - 75% withdrawal: 54% WKAIA buffer needed
   - 100% withdrawal: 79% WKAIA buffer needed

### Withdrawal Threshold Findings (2025-08-15)

**⚠️ CRITICAL: Current configuration requires 7.5x deposit for 100% withdrawal**

#### Test Results:
- For 0.1 KAIA withdrawal, minimum 0.75 KAIA total deposits needed
- Ratio: 7.5:1 (highly inefficient)
- Root cause: 90% LST investment + 10% slippage = compound effect

#### Optimal Configuration to Reduce Threshold:
```javascript
// IMMEDIATE FIX - Reduce investRatio
await vaultCore.setInvestRatio(3000)  // 30% to LSTs, 70% liquidity
// Result: 7.5x → 1.4x threshold

// OPTIONAL - Seed liquidity
await shareVault.depositKAIA(treasury, {value: 2e18})  // 2 KAIA buffer

// OPTIONAL - Optimize APY distribution  
await vaultCore.setAPY(0, 5000)  // Focus on most liquid LST
```

#### investRatio Impact Table:
| investRatio | LST % | Liquidity % | Threshold | 
|------------|-------|-------------|-----------|
| 9000 (current) | 90% | 10% | 7.5x |
| 5000 | 50% | 50% | 2.0x |
| 3000 (recommended) | 30% | 70% | 1.4x |
| 2000 | 20% | 80% | 1.25x |

### WKAIA Deposit State Sync Fix (2025-08-18)

**✅ RESOLVED: WKAIA deposits fixed with WKAIA->KAIA conversion in ShareVault**

#### Problem Identified:
- **Symptom**: "WETH: request exceeds allowance" error when depositing WKAIA
- **Root Cause**: When WKAIA.transferFrom() and WKAIA.withdraw() are called in same transaction, internal state doesn't sync properly
- **Environment**: Specific to KAIA chain's WKAIA implementation

#### Solution Applied:
- **ShareVault** now converts WKAIA to KAIA before sending to VaultCore
- **Process**: 
  1. ShareVault pulls WKAIA from user via transferFrom
  2. Checks balance to create state sync delay
  3. Withdraws WKAIA to KAIA in ShareVault
  4. Sends KAIA to VaultCore via handleDepositKAIA

#### Implementation Details:
```solidity
// ShareVault.sol deposit() function
// Pull WKAIA from user to ShareVault
IERC20(asset()).transferFrom(msg.sender, address(this), assets);

// Check balances to create state sync delay
uint256 shareVaultWKAIA = IERC20(asset()).balanceOf(address(this));
require(shareVaultWKAIA >= assets, "WKAIA not received");

// Convert WKAIA to KAIA in ShareVault to avoid state sync issue
IWKaia(asset()).withdraw(assets);

// Send KAIA to VaultCore instead of WKAIA
(bool success,) = vaultCore.call{value: assets}(
    abi.encodeWithSignature("handleDepositKAIA()")
);
```

### Standard ERC4626 Pattern (2025-08-18)

**✅ RESOLVED: Now using Standard ERC4626 pattern (Security Audit Fix)**

#### Background:
- **Security Audit Finding**: Direct Deposit pattern had front-running vulnerability
- **Solution**: Reverted to Standard ERC4626 with approve + transferFrom
- **Current Status**: All deposits use standard pattern, security issues resolved

#### How Standard ERC4626 Works:
```javascript
// Step 1: User approves ShareVault to spend WKAIA
await wkaia.approve(shareVault, amount);

// Step 2: User calls deposit (ShareVault pulls WKAIA via transferFrom)
await shareVault.deposit(amount, receiver);
```

### ClaimManager Storage Layout Resolution (2025-08-16)

**⚠️ CRITICAL: ClaimManager storage layout must match VaultCore exactly for delegatecall**

#### Problem Discovered:
- **Initial Assumption**: Storage starts after OpenZeppelin gaps (slot 102)
- **Reality**: VaultCore proxy storage starts at slot 0
- **Impact**: tokensInfo mapping was reading wrong storage location

#### Solution:
```solidity
// CORRECT ClaimManager storage layout
contract ClaimManager {
    // Slot 0-10 must match VaultCore exactly
    address public shareVault;       // slot 0
    address public wkaia;            // slot 1
    address public balancerVault;    // slot 2
    address public swapContract;     // slot 3
    address public claimManager;     // slot 4
    mapping(uint256 => TokenInfo) public tokensInfo;  // slot 5
    // ... rest of storage
}
```

### Unstake/Claim Owner-Only Operations (2025-08-16)

**⚠️ CRITICAL: Unstake and Claim are protocol management functions, NOT user functions**

#### Background:
- **Initial Misunderstanding**: Thought the `user` parameter in claim meant the recipient of assets
- **Actual Purpose**: `user` is just for tracking/record-keeping of who initiated the unstake
- **Correct Design**: Owner periodically unstakes LSTs to harvest staking rewards for the protocol

#### Important Points:
1. **Both `unstake()` and `claim()` have `onlyOwner` modifier**
2. **Claimed WKAIA stays in VaultCore** - increases protocol's total assets
3. **Users can only `deposit()` and `withdraw()`** - cannot unstake/claim
4. **Protocol owner harvests interest periodically** for all users' benefit

### 📌 Per-Block Limit Review Reminder (2025-08-16)

**Current Status**: Per-block limit KEPT for spam prevention
```solidity
require(block.number > lastDepositBlock[msg.sender], "Same block");
```

**Why it was added**: To reduce "request exceeds allowance" errors (before Direct Deposit)

**Current situation**:
- **Technically unnecessary**: Direct Deposit eliminated the original problem
- **Kept for security**: Prevents spam/DoS attacks, provides rate limiting
- **UX impact**: Minimal (users rarely need multiple deposits per block)

### Balancer JoinPool userData Encoding (2025-08-20)

**⚠️ CRITICAL: userData encoding for Balancer joinPool must exclude BPT token amounts**

#### Correct Implementation:
```solidity
// WRONG - Causes joinPool to fail
userData: abi.encode(1, maxAmountsIn, 0)  // maxAmountsIn has 5 elements including BPT

// CORRECT - Works properly
uint256[] memory amountsForUserData = new uint256[](4);
amountsForUserData[0] = maxAmountsIn[0]; // wGCKAIA
amountsForUserData[1] = maxAmountsIn[1]; // stKAIA  
amountsForUserData[2] = maxAmountsIn[2]; // wstKLAY
amountsForUserData[3] = maxAmountsIn[3]; // wKoKAIA
// BPT amount NOT included in userData
userData: abi.encode(1, amountsForUserData, 0)  // JOIN_KIND_EXACT_TOKENS_IN_FOR_BPT_OUT
```

### LP Token Valuation in totalAssets (2025-08-21)

**✅ IMPLEMENTED: LP token values are now correctly included in totalAssets calculation**

#### Technical Details:
1. **Composable Stable Pool Structure**:
   - Total BPT supply: ~2.6 quadrillion tokens
   - Pool holds: ~2.6 quadrillion tokens (pre-minted)
   - Circulating supply: ~343 tokens (actual liquidity)

2. **Correct Calculation Method**:
   ```solidity
   // Use getActualSupply() for accurate circulating supply
   uint256 actualSupply = pool.getActualSupply(); // Returns ~343
   uint256 lpValue = (lpAmount * lstBalanceInPool) / actualSupply;
   ```

### Integrated Test Separation (2025-08-23)

**✅ RESOLVED: Integrated tests separated into STABLE and BALANCED mode tests**

#### Problem Details:
1. **Original Test Flow**:
   - Fresh deployment with STABLE mode
   - 3-wallet test in STABLE mode
   - Fresh deployment with BALANCED mode ← **Problem: invalidated contracts**
   - 3-wallet test in BALANCED mode failed

2. **Technical Issue**:
   - `deployFresh.js` creates completely new contract addresses
   - JavaScript contract instances still pointed to old addresses
   - Transactions failed with reverts on non-existent contracts

#### Solution Applied:
Created two separate test files:
1. **`testIntegratedStable.js`**: STABLE mode testing
2. **`testIntegratedBalanced.js`**: BALANCED mode testing

### Critical Lessons Learned (2025-08-26)

#### 1. Balancer Pool Token Ordering
**Problem**: BAL#100 (OUT_OF_BOUNDS) error in removeLiquidity
**Root Cause**: exitTokenIndex must refer to sorted non-BPT token indices
**Solution**: 
- Balancer internally sorts tokens alphabetically (excluding BPT)
- exitTokenIndex refers to position in sorted array after BPT exclusion
- Testnet order: [wGCKAIA(0), stKAIA(1), wstKLAY(2), wKoKAIA(3)]

#### 2. Compilation Cache Issues
**Problem**: Fresh deployments not reflecting code changes
**Root Cause**: Hardhat artifacts/cache not properly cleared
**Solution**: Always run `rm -rf artifacts cache && npx hardhat compile` when changes aren't reflected

### LP Token Value Calculation Fix (2025-09-01)

**✅ FIXED: LP tokens now properly valued with LST unwrap conversions**

#### Problem Identified:
- **Symptom**: BALANCED profile showed lower returns than STABLE despite earning additional LP fees
- **Root Cause**: LP value calculation used raw LST amounts instead of converting to WKAIA values
- **Impact**: LP tokens undervalued by ~15-18% (only counting token amounts, not actual values)

#### Solution Applied:
Added LST to WKAIA conversion in LPCalculations library:
- wKoKAIA: Uses `getUnwrappedAmount()` for ~1.16x value
- wGCKAIA: Uses `getGCKLAYByWGCKLAY()` for conversion  
- wstKLAY: Uses `getUnwrappedAmount()` for unwrapping
- stKAIA: Already in base form, valued 1:1 with WKAIA

### Contract Upgrade Issue Resolution (2025-09-02)

**⚠️ CRITICAL: Hardhat upgrades plugin cache issue prevents new implementation deployment**

#### Problem Identified:
- **Symptom**: totalDepositors function fails with "evm: execution reverted" after upgrade
- **Root Cause**: Hardhat upgrades plugin reuses cached implementation instead of deploying new one
- **Impact**: New features added to contracts are not deployed, proxy points to old implementation

#### Solution Process:
1. **Add Version Function**: Force bytecode change by adding version() function
2. **Clean Cache**: Remove OpenZeppelin upgrade cache
3. **Manual Implementation Deployment**: Deploy new implementation directly
4. **Direct Proxy Upgrade**: Use upgradeToAndCall to upgrade proxy

#### Prevention for Future:
1. **Always add version function** and increment it for each upgrade
2. **Clean cache before major upgrades**: `rm -rf .openzeppelin && npx hardhat clean`
3. **Verify implementation address changed** after upgrade
4. **Test new features immediately** after upgrade to confirm deployment
5. **Consider manual deployment** if standard upgrade doesn't deploy new implementation

### Contract Upgrade Scripts with Cache and Library Issues Resolution (2025-09-02)

**⚠️ IMPORTANT: Enhanced upgrade scripts that handle cache issues and library linking**

#### Background:
After the cache issue discovered on 2025-08-31, comprehensive upgrade scripts were created to handle:
1. **Hardhat upgrades plugin cache issues** - Forces new implementation deployment
2. **Library linking for VaultCore** - LPCalculations library must be deployed and linked
3. **Proxy registration issues** - Direct upgradeToAndCall fallback when proxy not recognized

#### Enhanced Upgrade Scripts:

##### 1. Individual Contract Upgrades (with fixes):
- **`scripts/upgradeShareVaultFixed.js`** - Handles cache issues with forced redeployment
- **`scripts/upgradeVaultCoreFixed.js`** - Includes LPCalculations library deployment and linking
- **`scripts/upgradeSwapContractFixed.js`** - Cache-aware upgrade with fallback logic
- **`scripts/upgradeAllFixed.js`** - Upgrades all contracts with comprehensive error handling

##### 2. Key Features of Fixed Scripts:
```javascript
// Library deployment for VaultCore
const LPCalculations = await ethers.getContractFactory("LPCalculations");
const lpCalculations = await LPCalculations.deploy();
const lpCalculationsAddress = await lpCalculations.getAddress();

// Link library to VaultCore
const VaultCore = await ethers.getContractFactory("VaultCore", {
    libraries: {
        LPCalculations: lpCalculationsAddress
    }
});

// Force new implementation deployment
{
    redeployImplementation: 'always',
    unsafeAllowLinkedLibraries: true,
    unsafeAllow: ['delegatecall', 'external-library-linking']
}
```

##### 3. ClaimManager Optimization (2025-09-02):
- Only redeploys ClaimManager when contract code actually changes
- Checks function selectors: executeUnstake (0x9d6922d2), executeClaim (0x9b74f48e)
- Keeps existing address if no changes detected, saving gas and maintaining consistency

---

## Complete Session History

1. **Multi-LST withdrawal issues resolved by referencing KommuneVaultV2.sol (2025-08-14)**
2. **Withdrawal threshold testing completed (2025-08-15)**
3. **Deposit function confusion resolved - always use depositKAIA() for native KAIA (2025-08-15)**
4. **Direct Deposit pattern implemented to eliminate WKAIA state sync issues (2025-08-16)**
5. **ClaimManager storage layout fixed - unstake/claim via delegatecall working (2025-08-16)**
6. **Unstake/Claim made owner-only operations - claimed assets stay in protocol (2025-08-16)**
7. **Security audit fixes applied - Standard ERC4626 pattern, no tx.origin, owner-only operations (2025-08-18)**
8. **WKAIA deposit state sync fixed with WKAIA->KAIA conversion in ShareVault (2025-08-18)**
9. **ShareVault receive() function added to accept KAIA from WKAIA.withdraw() (2025-08-18)**
10. **All integrated tests passing 100% - ready for production (2025-08-18)**
11. **BALANCED investment type implemented with Balancer pool integration (2025-08-20)**
12. **JoinPool userData encoding fixed - exclude BPT from userData array (2025-08-20)**
13. **ExitPool implementation completed with EXACT_BPT_IN_FOR_ONE_TOKEN_OUT (2025-08-20)**
14. **LP token valuation correctly included in totalAssets calculation (2025-08-21)**
15. **Profile-based deployment separation: deployFreshStable.js and deployFreshBalanced.js (2025-08-23)**
16. **Unified upgrade scripts with PROFILE environment variable support (2025-08-23)**
17. **Integration tests separated by mode - testIntegratedStable.js and testIntegratedBalanced.js (2025-08-23)**
18. **All tests updated with 3 KAIA WKAIA deposits for sufficient liquidity buffer (2025-08-23)**
19. **Sequential Swap with APY-based ordering implemented (2025-08-25)**
20. **SwapContract asset recovery functions added for stranded tokens (2025-08-25)**
21. **investRatio set to 100% for maximum LST investment (2025-08-26)**
22. **Balancer exitPool exitTokenIndex fixed - uses sorted non-BPT token indices (2025-08-26)**
23. **LP token value calculation fixed - includes all LSTs in pool, not just one (2025-08-27)**
24. **Depositor counting feature added - tracks unique depositors with shares-based logic (2025-08-28)**
25. **sendWKAIAtoVaultCores.js script created for reward distribution (2025-08-28)**
26. **LP token value calculation fixed to convert LSTs to WKAIA values - BALANCED now shows correct higher returns (2025-09-01)**
27. **Contract upgrade cache issue resolved - totalDepositors now working with manual implementation deployment (2025-09-02)**
28. **Enhanced upgrade scripts created with cache handling and library linking support (2025-09-02)**
29. **ClaimManager optimization implemented - only redeploys when contract code changes (2025-09-02)**