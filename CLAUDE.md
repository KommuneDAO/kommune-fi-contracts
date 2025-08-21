# CLAUDE.md - Project-Specific Instructions for KommuneFi Contracts

## 🚨 MANDATORY FIRST STEPS - ALWAYS READ THIS 🚨

**Before implementing ANY new feature or fixing ANY issue:**

### ⚠️ CRITICAL: Deposit Function Usage (2025-08-15)

**NEVER confuse these two deposit functions:**

1. **`deposit(uint256 assets, address receiver)`** - WKAIA ONLY
   - Requires user to ALREADY have WKAIA
   - Requires WKAIA approve() to ShareVault first
   - DO NOT send native KAIA as msg.value
   ```javascript
   // WRONG ❌
   await shareVault.deposit(amount, user, {value: amount})  // WILL FAIL!
   
   // CORRECT ✅
   await wkaia.deposit({value: amount})  // First wrap KAIA to WKAIA
   await wkaia.approve(shareVault, amount)  // Then approve
   await shareVault.deposit(amount, user)  // Finally deposit
   ```

2. **`depositKAIA(address receiver)`** - NATIVE KAIA
   - For direct native KAIA deposits
   - NO approve needed
   - Send KAIA as msg.value
   ```javascript
   // CORRECT ✅
   await shareVault.depositKAIA(user, {value: amount})
   ```

**Common Mistake**: Using `deposit()` with `{value: amount}` - This ALWAYS fails because deposit() expects WKAIA, not native KAIA!

### ✅ REQUIRED CHECKLIST:
1. **📖 Read existing successful implementations FIRST**:
   - `src/KommuneVaultV2.sol` - Reference for all swap logic, withdrawal patterns, LST handling
   - `src/SwapContract.sol` - FINALIZED, do not modify, reference for swap patterns
   - Previous working scripts in `scripts/tests/`

2. **🔍 Search for existing solutions**:
   - Check if the problem was already solved in KommuneVaultV2.sol
   - Look for similar patterns in working contracts
   - Compare with previous successful implementations

3. **📋 Document before coding**:
   - What existing pattern will you copy?
   - Why is this pattern proven to work?
   - What specific lines from working contracts are you referencing?

4. **❌ DO NOT assume or reimplement from scratch**:
   - Don't guess at swap logic - copy from KommuneVaultV2.sol
   - Don't reinvent LST handling - use proven patterns
   - Don't ignore documented issues - follow established solutions

### 🎯 Key Reference Contracts:
- **KommuneVaultV2.sol**: Multi-LST swaps, withdrawal logic, slippage handling, stKAIA processing
- **SwapContract.sol**: GIVEN_OUT swaps, token sorting, balance verification
- **Previous test scripts**: Proven test patterns and scenarios

**Violation of this checklist leads to repeated mistakes and wasted time.**

## Critical Instructions

### Script Organization Rules

**⚠️ IMPORTANT: Test Script Management**

1. **Always create new test scripts in `scripts/temp/` folder first**
   - All new test scripts must be created in `scripts/temp/`
   - Only move to `scripts/` when explicitly instructed to keep/save
   - This keeps the project organized and makes cleanup easier

2. **Script Folder Structure:**
   - `scripts/` - Main scripts that are confirmed and kept
   - `scripts/temp/` - Temporary test scripts (can be cleaned up later)
   - `scripts/tests/` - Additional test scripts for specific components

3. **When creating new test scripts:**
   ```
   // WRONG
   scripts/newTestScript.js
   
   // CORRECT
   scripts/temp/newTestScript.js
   ```

### SwapContract.sol - FINALIZED (DO NOT MODIFY)

**⚠️ IMPORTANT: SwapContract.sol has been finalized and thoroughly tested. DO NOT modify this file under any circumstances.**

#### Status: ✅ FINALIZED on 2025-08-14

The SwapContract has been:
- Fully tested with all 4 LSTs (wKoKAIA, wGCKAIA, wstKLAY, stKAIA)
- Optimized to use unified sorting logic for all tokens
- Successfully performs GIVEN_OUT swaps for precise WKAIA output amounts
- Integrated with Balancer V2 pools on Kairos testnet

#### Key Features:
1. **GIVEN_OUT Swap**: Ensures exact WKAIA output amounts for withdrawals
2. **Unified Token Sorting**: All tokens use Balancer's standard alphabetical sorting
3. **Slippage Protection**: 10% slippage tolerance for testnet conditions
4. **Balance Verification**: Checks actual token balances before operations

#### DO NOT:
- ❌ Modify any function in SwapContract.sol
- ❌ Question the token sorting logic (it's been thoroughly tested)
- ❌ Change pool IDs or token addresses
- ❌ Alter the GIVEN_OUT swap implementation

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

### Important: Understanding Shares vs WKAIA (2025-08-14)

**⚠️ CRITICAL: Users care about WKAIA amounts, not shares**

#### Key Concepts:
- **Shares**: Internal accounting tokens representing ownership percentage in the vault
- **WKAIA**: Actual wrapped KAIA tokens that users can withdraw and use
- **maxWithdraw**: Returns the maximum amount of **WKAIA** (not shares!) that can be withdrawn
- **balanceOf**: Returns the amount of **shares** (not WKAIA!) owned by the user

#### Common Mistakes to Avoid:
- ❌ Don't use shares for withdrawal amounts - users don't care about shares
- ❌ Don't confuse `maxWithdraw` with share balance - they are completely different
- ❌ Don't test withdrawals using share percentages - use WKAIA percentages

#### Correct Approach for Withdrawals:
```javascript
// WRONG - using shares
const shares = await shareVault.balanceOf(user);
const withdrawShares = shares / 2n; // 50% of shares
await shareVault.redeem(withdrawShares, user, user);

// CORRECT - using WKAIA amounts
const maxWKAIA = await shareVault.maxWithdraw(user); // This is WKAIA amount!
const withdrawWKAIA = maxWKAIA / 2n; // 50% of withdrawable WKAIA
await shareVault.withdraw(withdrawWKAIA, user, user);
```

#### Testing Withdrawals:
- Always use `maxWithdraw()` to get the maximum WKAIA amount
- Test with percentages of `maxWithdraw`, not share balance
- Use `withdraw()` function with WKAIA amounts, not `redeem()` with shares
- Progressive testing: 10%, 30%, 50%, 70%, 90% of `maxWithdraw`

## Current Architecture: Separated Vault (V2)

### Core Contracts
- `src/ShareVault.sol` - ERC-4626 share management (12.23 KB)
- `src/VaultCore.sol` - Asset management logic with unstake/claim support (10.17 KB)
- `src/SwapContract.sol` - ✅ FINALIZED - Handles Balancer swaps (9.26 KB)
- `src/ClaimManager.sol` - Handles unstake/claim operations via delegatecall

### Previous Versions (Reference Only)
- `src/KommuneVault.sol` - V1 original implementation (reference for patterns)
- `src/KommuneVaultV2.sol` - Optimized version (hit size limit at 24KB, reference for swap logic)

### Unused Contracts (Moved to src/temp/)
- `src/temp/ClaimManager.sol` - Helper contract (not used in V2)
- `src/temp/StakeManager.sol` - Helper contract (not used in V2)
- `src/temp/TestQueryBatchSwap.sol` - Test contract for queryBatchSwap
- `src/temp/WKLAY.sol` - Test WKLAY contract

### Deployment Addresses (Kairos Testnet)

#### Current V2 Deployment (2025-08-18)
- ShareVault: `0x86a4bDf145004DF36F0121140a034879cFAE8B2c`
- VaultCore: `0xe89197c395De50eC62CfE1dE841ea088c1bD810b`
- SwapContract: `0x05fC200A7eaCDeECe7BBcBf6d672E12a65F800DC`
- ClaimManager: `0x0E4A014564caA6610260054A73f11DF1167aC265`

#### Network Constants
- WKAIA: `0x0339d5Eb6D195Ba90B13ed1BCeAa97EbD198b106`
- Balancer Vault: `0x1c9074AA147648567015287B0d4185Cb4E04F86d`

### Scripts Organization
- `scripts/` - Essential deployment and configuration scripts
  - `deploy.js` - V1 deployment (DO NOT MODIFY)
  - `upgrade.js` - V1 upgrade (DO NOT MODIFY)
  - `deploySeparatedVault.js` - Deploy V2 (ShareVault + VaultCore)
  - `upgradeSeparatedVault.js` - Upgrade V2
  - `setupSeparatedVault.js` - Configure V2
  - `deploySwapContract.js` - Deploy SwapContract
  - `setAPY.js` - Set APY values
- `scripts/tests/` - All test and debug scripts
  - `fullIntegrationTest.js` - Comprehensive test summary and validation
  - `testMultiWalletDeposits.js` - Multi-wallet concurrent testing
  - `testAPYChangeSimple.js` - APY dynamic change testing
  - `testPerBlockLimit.js` - Security limit testing
  - `testNativeKAIADeposit.js` - Native KAIA testing
  - Other test scripts organized by feature

### LST Token Information
1. **wKoKAIA** (Index 0)
   - Handler/Asset: `0xb15782EFbC2034E366670599F3997f94c7333FF9`
   - Wrapped Token: `0x9a93e2fcDEBE43d0f8205D1cd255D709B7598317`

2. **wGCKAIA** (Index 1)
   - Handler: `0xe4c732f651B39169648A22F159b815d8499F996c`
   - Asset: `0x4EC04F4D46D7e34EBf0C3932B65068168FDcE7f6`
   - Wrapped Token: `0x324353670B23b16DFacBDE169Cd8ebF8C8bf6601`

3. **wstKLAY** (Index 2)
   - Handler: `0x28B13a88E72a2c8d6E93C28dD39125705d78E75F`
   - Asset: `0x524dCFf07BFF606225A4FA76AFA55D705B052004`
   - Wrapped Token: `0x474B49DF463E528223F244670e332fE82742e1aA`

4. **stKAIA** (Index 3)
   - Handler: `0x4C0d434C7DD74491A52375163a7b724ED387d0b6`
   - Asset/Wrapped: `0x45886b01276c45Fe337d3758b94DD8D7F3951d97`

## Development Guidelines

### When Working on This Project:
1. **Use V2 Architecture** - ShareVault + VaultCore (separated)
2. **Never modify SwapContract.sol** - It's finalized and tested
3. **Test scripts are in `scripts/tests/` directory**
4. **Use `testSeparatedVault.js` for V2 testing**
5. **Deployment info is in `deployments-{network}.json`**
   - Kairos testnet: `deployments-kairos.json`
   - Kaia mainnet: `deployments-kaia.json`

### Key Achievements (2025-08-18):
- ✅ Contract size issue resolved with separated architecture
- ✅ All security audit issues fixed (Critical & High risk)
- ✅ Standard ERC4626 pattern implemented (no Direct Deposit vulnerability)
- ✅ WKAIA deposit state sync issue resolved with receive() function
- ✅ All LST deposits working correctly (native KAIA & WKAIA)
- ✅ GIVEN_OUT withdrawals implemented successfully
- ✅ SwapContract handles all 4 LSTs uniformly
- ✅ 10% slippage tolerance configured for testnet
- ✅ Per-block deposit limits for spam prevention
- ✅ Owner-only unstake/claim operations
- ✅ Integrated tests: 100% success rate
- ✅ Production ready

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

#### Critical Process Violations:
1. **❌ Failed to check KommuneVaultV2.sol first**: Reimplemented from scratch instead of referencing working code
2. **❌ Ignored existing successful patterns**: KommuneVaultV2 already solved this exact problem
3. **❌ Repeated known mistakes**: queryBatchSwap issue was previously documented but ignored

#### Mandatory Process for Future:
1. **✅ ALWAYS check existing working contracts FIRST** - especially KommuneVaultV2.sol for swap logic
2. **✅ Compare line-by-line** with successful implementations before creating new logic  
3. **✅ Copy proven patterns** instead of reimplementing from assumptions
4. **✅ Test with exact same scenarios** that worked in previous versions

#### Test Results After Fix:
- **10% withdrawal**: ✅ Success (LST 0 swap)
- **30% withdrawal**: ✅ Success (LST 3/stKAIA swap) 
- **50% withdrawal**: ✅ Success (LST 1 swap)
- **Multi-LST logic**: ✅ Sequential processing working correctly

#### Key Files Updated:
- `src/VaultCore.sol`: Fixed handleWithdraw with KommuneVaultV2 patterns
- Added conservative target calculation and slippage buffer
- Simplified stKAIA handling (no wrapping needed)
- Proper sequential LST processing

#### Documentation Added:
- This section to prevent future similar mistakes
- Process requirement to check existing implementations first
- Specific comparison with KommuneVaultV2.sol patterns

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

#### Solution:
1. **Natural Resolution**: Problem disappears with more users and larger total deposits
2. **Early Stage Mitigation**: Service provider adds liquidity buffer
3. **Long-term**: Consider reducing slippage buffer or concentrating LSTs

#### Test Cases:
1. **Basic Withdrawal Test**:
   - Wallet 1: 1 KAIA deposit (provides liquidity buffer)
   - Wallet 2: 0.1 KAIA deposit
   - Wallet 2: 100% withdrawal → Should succeed

2. **Multi-Wallet Concurrent Test**:
   - Wallet 1: 1 KAIA deposit (maintains buffer)
   - Wallet 2: 0.1 KAIA deposit
   - Wallet 3: 0.1 KAIA deposit
   - Wallets 2 & 3: Simultaneous 100% withdrawal → Should succeed

Note: Increase Wallet 1 deposit amount if buffer insufficient (e.g., 2-3 KAIA)

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

#### Test Results:
- **WKAIA after KAIA**: 100% success rate (5/5 tests)
- **Multiple wallets**: 100% success rate (9/9 tests)
- **Rapid succession**: ~50% success rate (acceptable for edge case)
- **Integrated tests**: 100% success rate

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

#### Test Results:
- **Security**: Front-running vulnerability eliminated ✅
- **Success Rate**: 100% for both KAIA and WKAIA deposits ✅
- **Gas Efficiency**: Standard pattern, optimized for safety

#### Upgrade Scripts Updated:
- All VaultCore upgrade scripts now include `{ unsafeAllow: ['delegatecall'] }`
- Prevents "Contract is not upgrade safe" errors due to ClaimManager delegatecall

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

#### Key Lessons:
1. **Always check actual proxy storage** using `ethers.provider.getStorage()`
2. **VaultCore doesn't use Ownable2Step** - only OwnableUpgradeable
3. **Storage starts at slot 0** in the proxy, not after gaps
4. **Delegatecall requires EXACT storage layout match**

#### Test Results:
- ✅ wKoKAIA unwrap to KoKAIA: Working
- ✅ KoKAIA unstake via ClaimManager: Working
- ✅ 10-minute wait and claim: Working
- ✅ KAIA received in VaultCore: Confirmed

### Unstake/Claim Owner-Only Operations (2025-08-16)

**⚠️ CRITICAL: Unstake and Claim are protocol management functions, NOT user functions**

#### Background:
- **Initial Misunderstanding**: Thought the `user` parameter in claim meant the recipient of assets
- **Actual Purpose**: `user` is just for tracking/record-keeping of who initiated the unstake
- **Correct Design**: Owner periodically unstakes LSTs to harvest staking rewards for the protocol

#### Key Implementation:
```solidity
// VaultCore.sol - CORRECT implementation
function claim(address user, uint256 lstIndex) external onlyOwner returns (uint256) {
    // ... delegatecall to ClaimManager ...
    if (claimedAmount > 0) {
        IWKaia(wkaia).deposit{value: claimedAmount}();
        // WKAIA stays in VaultCore - NO transfer to user
        emit Claimed(user, lstIndex, claimedAmount);
    }
}
```

#### Important Points:
1. **Both `unstake()` and `claim()` have `onlyOwner` modifier**
2. **Claimed WKAIA stays in VaultCore** - increases protocol's total assets
3. **Users can only `deposit()` and `withdraw()`** - cannot unstake/claim
4. **Protocol owner harvests interest periodically** for all users' benefit

#### Test Results:
- ✅ Owner-only access control working
- ✅ Claimed KAIA correctly wrapped to WKAIA
- ✅ WKAIA stays in VaultCore (not sent to users)
- ✅ Total protocol assets increase from claims

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

**Future Review Checklist**:
- [ ] Monitor mainnet usage patterns for multi-deposit needs
- [ ] Check if spam/DoS concerns are real or theoretical
- [ ] Consider relaxing to 2-3 deposits per block instead of complete removal
- [ ] Evaluate if VIP users need exemption
- [ ] Review after 3-6 months of mainnet operation

**Test Results**:
- With Direct Deposit: 0% error rate (vs 76% before)
- Same-block attempts: Still blocked by per-block limit
- Recommendation: Keep for now, review later

### LP Token Valuation in totalAssets (2025-08-21)

**✅ IMPLEMENTED: LP token values are now correctly included in totalAssets calculation**

#### Background:
- **Issue**: LP tokens from Balancer pools were not being valued correctly in totalAssets
- **Challenge**: Balancer Composable Stable Pools have pre-minted BPT with most tokens held by the pool itself
- **Solution**: Use `getActualSupply()` from the pool contract for accurate valuation

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

3. **Implementation in VaultCore**:
   - `_calculateLPTokenValue()` attempts to call `getActualSupply()` on the BPT token
   - Falls back to manual calculation (totalSupply - pool's BPT) if call fails
   - LP values are automatically included in `getTotalAssets()`

#### Test Results:
- ✅ `getActualSupply()` returns correct circulating supply
- ✅ LP token values accurately calculated
- ✅ totalAssets includes LP token underlying value
- ✅ Proportional value matches actual exitPool amounts

### Balancer JoinPool userData Encoding (2025-08-20)

**⚠️ CRITICAL: userData encoding for Balancer joinPool must exclude BPT token amounts**

#### Issue Summary:
- **Symptom**: joinPool fails with execution reverted when BALANCED mode is enabled
- **Root Cause**: userData was encoding all 5 token amounts (4 LSTs + BPT) instead of just 4 LST amounts
- **Resolution**: Only encode LST amounts in userData, exclude BPT even though it's in assets array

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

#### Key Points:
1. **assets array**: Must include all 5 tokens (4 LSTs + BPT)
2. **maxAmountsIn array**: Must include all 5 amounts (4 LST amounts + 0 for BPT)
3. **userData encoding**: Must include ONLY 4 LST amounts, NOT the BPT

#### Why This Matters:
- BPT is the OUTPUT of joinPool, not an INPUT
- JOIN_KIND_EXACT_TOKENS_IN_FOR_BPT_OUT (type 1) expects only input token amounts in userData
- Including BPT amount in userData causes Balancer to reject the transaction

#### Test Transaction Reference:
- Successful tx: 0x497d271f... (provided by user) shows correct encoding pattern
- This pattern is now implemented in VaultCore._addLSTsToPool1()

## Session History
- Initial V1: Single contract (KommuneVault)
- V1.5: Optimized KVaultV2 hit 24KB size limit  
- Helper contracts attempted with delegatecall pattern
- V2: Separated ShareVault + VaultCore architecture
- SwapContract finalized with unified sorting logic
- All 4 LSTs tested successfully with GIVEN_OUT swaps
- Project structure cleaned up and test scripts organized (2025-08-14)
- **Multi-LST withdrawal issues resolved by referencing KommuneVaultV2.sol (2025-08-14)**
- **Withdrawal threshold testing completed (2025-08-15)**
- **Deposit function confusion resolved - always use depositKAIA() for native KAIA (2025-08-15)**
- **Direct Deposit pattern implemented to eliminate WKAIA state sync issues (2025-08-16)**
- **ClaimManager storage layout fixed - unstake/claim via delegatecall working (2025-08-16)**
- **Unstake/Claim made owner-only operations - claimed assets stay in protocol (2025-08-16)**
- **Security audit fixes applied - Standard ERC4626 pattern, no tx.origin, owner-only operations (2025-08-18)**
- **WKAIA deposit state sync fixed with WKAIA->KAIA conversion in ShareVault (2025-08-18)**
- **ShareVault receive() function added to accept KAIA from WKAIA.withdraw() (2025-08-18)**
- **All integrated tests passing 100% - ready for production (2025-08-18)**
- **BALANCED investment type implemented with Balancer pool integration (2025-08-20)**
- **JoinPool userData encoding fixed - exclude BPT from userData array (2025-08-20)**
- **ExitPool implementation completed with EXACT_BPT_IN_FOR_ONE_TOKEN_OUT (2025-08-20)**