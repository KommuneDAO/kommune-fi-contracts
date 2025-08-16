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

#### Current V2 Deployment
- ShareVault: `0xfd2853D33733fC841248838525824fC7828441cb`
- VaultCore: `0x42Ec587DEb0EDe5296b507591EbB84140D2280F2`
- SwapContract: `0x829718DBf5e19AB36ab305ac7A7c6C9995bB5F15`

#### Previous Deployments
- KVaultV2: `0xfBF698074Cc9D6496c22faa117616E2038551424`
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

### Key Achievements (2025-08-14):
- ✅ Contract size issue resolved with separated architecture
- ✅ All LST deposits working correctly
- ✅ GIVEN_OUT withdrawals implemented successfully
- ✅ SwapContract handles all 4 LSTs uniformly
- ✅ Native KAIA deposits supported
- ✅ 10% slippage tolerance configured for testnet
- ✅ Fixed staking issue: Use `stake()` instead of `deposit()` for LST handlers
- ✅ Added WKAIA balance verification before withdraw attempts
- ✅ Per-block deposit limits working correctly
- ✅ Multi-wallet concurrent deposits: 60/60 successful
- ✅ APY dynamic changes tested and working
- ✅ All 4 LSTs receive correct distributions and wrap automatically

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

### Direct Deposit Pattern (2025-08-16)

**⚠️ IMPORTANT: WKAIA deposits now use Direct Deposit pattern to avoid state sync issues**

#### Background:
- **Issue**: WKAIA state synchronization problems between contracts causing "WETH: request exceeds allowance" errors
- **Root Cause**: Complex transaction chain (User → ShareVault → VaultCore → WKAIA.withdraw) amplifies state sync issues
- **Solution**: Direct Deposit pattern - User transfers WKAIA directly to VaultCore first

#### How Direct Deposit Works:
```javascript
// Step 1: User transfers WKAIA directly to VaultCore
await wkaia.transfer(vaultCore, amount);

// Step 2: User calls deposit on ShareVault (which now uses handleDirectDeposit)
await shareVault.deposit(amount, receiver);
```

#### Test Results:
- **Old Pattern**: 76% error rate due to state sync issues
- **Direct Deposit**: 0% error rate - complete elimination of the problem

#### Implementation Details:
1. **ShareVault.sol**:
   - `deposit()` and `mint()` functions updated to use Direct Deposit
   - Requires WKAIA to be at VaultCore before calling
   - Calls `handleDirectDeposit()` instead of transferring

2. **VaultCore.sol**:
   - New `handleDirectDeposit()` function processes pre-transferred WKAIA
   - `handleDeposit()` redirects to `handleDirectDeposit` for backward compatibility
   - Added `DirectDepositFrom` event for tracking

3. **Native KAIA deposits**: Continue using `depositKAIA()` as before (no changes)

#### Upgrade Scripts Updated:
- All VaultCore upgrade scripts now include `{ unsafeAllow: ['delegatecall'] }`
- Prevents "Contract is not upgrade safe" errors due to ClaimManager delegatecall

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