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

## 📚 Historical Issues Reference

For detailed historical issues and their resolutions, see **[CLAUDE_HISTORY.md](./CLAUDE_HISTORY.md)**

Key resolved issues include:
- queryBatchSwap smart contract limitations
- Multi-LST sequential swap patterns  
- Withdrawal threshold calculations
- WKAIA deposit state sync fixes
- ClaimManager storage layout
- LP token valuation
- Contract upgrade cache issues

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

#### Status: ✅ FINALIZED on 2025-08-14 (Asset recovery functions added 2025-08-25)

The SwapContract has been:
- Fully tested with all 4 LSTs (wKoKAIA, wGCKAIA, wstKLAY, stKAIA)
- Optimized to use unified sorting logic for all tokens
- Successfully performs GIVEN_OUT swaps for precise WKAIA output amounts
- Integrated with Balancer V2 pools on Kairos testnet
- Asset recovery functions added for stranded tokens

#### DO NOT:
- ❌ Modify any function in SwapContract.sol
- ❌ Question the token sorting logic (it's been thoroughly tested)
- ❌ Change pool IDs or token addresses
- ❌ Alter the GIVEN_OUT swap implementation

## Key Concepts

### stKAIA Rate Provider Application (Fixed 2025-09-03)

**✅ FIXED: Direct stKAIA holdings now correctly apply rate provider (1.0589x)**

#### Background:
- stKAIA is a rebasing token where 1 stKAIA > 1 KAIA due to accumulated staking rewards
- Rate provider at 0xefBDe60d5402a570DF7CA0d26Ddfedc413260146 provides the conversion rate
- Other LSTs (wKoKAIA, wGCKAIA, wstKLAY) use unwrapping functions for conversion

#### The Fix:
VaultCore now applies the rate provider when calculating totalAssets for direct stKAIA holdings (index 3).

### Important: Understanding Shares vs WKAIA

**⚠️ CRITICAL: Users care about WKAIA amounts, not shares**

#### Key Concepts:
- **Shares**: Internal accounting tokens representing ownership percentage in the vault
- **WKAIA**: Actual wrapped KAIA tokens that users can withdraw and use
- **maxWithdraw**: Returns the maximum amount of **WKAIA** (not shares!) that can be withdrawn
- **balanceOf**: Returns the amount of **shares** (not WKAIA!) owned by the user

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

## Current Architecture: Separated Vault (V2)

### Core Contracts
- `src/ShareVault.sol` - ERC-4626 share management (12.23 KB)
- `src/VaultCore.sol` - Asset management logic with LP support (~20 KB)
- `src/SwapContract.sol` - ✅ FINALIZED - Handles Balancer swaps (9.26 KB)
- `src/ClaimManager.sol` - Handles unstake/claim operations via delegatecall

### Deployment Addresses

**Note**: Always refer to `deployments-{profile}-{network}.json` files for the latest addresses.

#### Kairos Testnet

##### STABLE Profile (Last Updated: 2025-09-02)
- ShareVault: `0x90af1a8b94480Ce57a4c4E86d14c8Fb3D95b425E`
- VaultCore: `0xB4a79CAd8988f5698CF76b3A7806BE1A8929AFDd`
- SwapContract: `0xC0AE8cdb7dd42eAfC2A5371d397369856c73130B`
- ClaimManager: `0xef479B31D3540133dd34d011A202853C7E96Bf6E`
- WKAIA: `0x0339d5Eb6D195Ba90B13ed1BCeAa97EbD198b106`
- Balancer Vault: `0x1c9074AA147648567015287B0d4185Cb4E04F86d`

##### BALANCED Profile (Last Updated: 2025-09-02)
- ShareVault: `0x6c0B7b618bcECF5b5bA9F59dD0694ffbe86C6966`
- VaultCore: `0x05fac5656f155bE7d2a94b4621AF902059Fc078A`
- SwapContract: `0x28e0F46B94267620A20d5Eb368d054367731875c`
- ClaimManager: `0x6784bb46a251532bF4426761b8DbFaf3b11381EC`
- WKAIA: `0x0339d5Eb6D195Ba90B13ed1BCeAa97EbD198b106`
- Balancer Vault: `0x1c9074AA147648567015287B0d4185Cb4E04F86d`

#### Kaia Mainnet

##### STABLE Profile (Last Updated: 2025-09-01)
- ShareVault: `0x86799f0B252822dE36c8D8384d443355E4d478AE`
- VaultCore: `0x06ce7e66D219a261eDa4F15Fd503F2Ac2B81Afc9`
- SwapContract: `0xAB0330C58760A85Bc40c296C4415b2fD04F9128B`
- ClaimManager: `0x30d2850364af9b357cf7557078bf5B7B43ee9f8f`
- WKAIA: `0x19Aac5f612f524B754CA7e7c41cbFa2E981A4432`
- Balancer Vault: `0xbF1f3C783C8f6f4582c0a0508f2790b4E2C2E581`

##### BALANCED Profile (Last Updated: 2025-09-01)
- ShareVault: `0xF4C64918dbbdd7a17327C0Ea1aA625A9f3Ed2b9b`
- VaultCore: `0x95A257399BeB3D2c959a1E64d35DD872Fdedb2dA`
- SwapContract: `0x015da9B47A34F98C4efC70D9898e4E0913FF7e4d`
- ClaimManager: `0xab1D9E799Cf560f50449e4A0FB7c7A26c507a366`
- WKAIA: `0x19Aac5f612f524B754CA7e7c41cbFa2E981A4432`
- Balancer Vault: `0xbF1f3C783C8f6f4582c0a0508f2790b4E2C2E581`

### Scripts Organization
- `scripts/` - Essential deployment and configuration scripts
  - **Deployment Scripts:**
    - `deployFreshStable.js` - Deploy fresh V2 with STABLE profile
    - `deployFreshBalanced.js` - Deploy fresh V2 with BALANCED profile
  - **Standard Upgrade Scripts** (may encounter cache issues):
    - `upgradeAll.js` - Upgrade all V2 contracts (supports PROFILE env var)
    - `upgradeShareVault.js` - Upgrade ShareVault only
    - `upgradeVaultCore.js` - Upgrade VaultCore only
    - `upgradeSwapContract.js` - Upgrade SwapContract only
  - **Enhanced Upgrade Scripts** (with cache and library fixes - RECOMMENDED):
    - `upgradeAllFixed.js` - Upgrade all contracts with cache handling and library linking
    - `upgradeShareVaultFixed.js` - ShareVault upgrade with forced redeployment
    - `upgradeVaultCoreFixed.js` - VaultCore upgrade with LPCalculations library linking
    - `upgradeSwapContractFixed.js` - SwapContract upgrade with cache handling
  - **Configuration Scripts:**
    - `setAPY.js` - Set APY values
    - `sendWKAIAtoVaultCores.js` - Send WKAIA rewards to VaultCore contracts
    - `recoverSwapAssets.js` - Recover stranded assets from SwapContract
- `scripts/tests/` - Test scripts
  - `testIntegratedStable.js` - STABLE mode integrated test
  - `testIntegratedBalanced.js` - BALANCED mode integrated test
  - `testUnstakeClaim.js` - Owner unstake/claim operations test
- `scripts/temp/` - Temporary test scripts (create new tests here first)

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
4. **ALWAYS use deployment files for addresses** - Never hardcode addresses
   - Kairos testnet: `deployments-stable-kairos.json`, `deployments-balanced-kairos.json`
   - Kaia mainnet: `deployments-stable-kaia.json`, `deployments-balanced-kaia.json`
   - These files are the source of truth for all contract addresses

### Getting Contract Addresses:
```javascript
// Always read from deployment files
const deployments = JSON.parse(fs.readFileSync(`deployments-${profile}-${network}.json`, 'utf8'));
const shareVault = deployments.shareVault;
const vaultCore = deployments.vaultCore;
// etc...
```

### Sending Rewards to VaultCore:
Use `scripts/sendWKAIAtoVaultCores.js` to send WKAIA rewards:
```bash
# Send 0.5 WKAIA to each VaultCore (default)
npx hardhat run scripts/sendWKAIAtoVaultCores.js --network kaia
npx hardhat run scripts/sendWKAIAtoVaultCores.js --network kairos

# Send custom amount
SEND_AMOUNT=1 npx hardhat run scripts/sendWKAIAtoVaultCores.js --network kaia
```
This increases totalAssets for all depositors proportionally.

### Investment Profile Ratios Explained:
- **investRatio**: Percentage of total WKAIA to convert to LSTs (e.g., 100%)
- **balancedRatio**: Percentage of LSTs to add to LP pools (e.g., 50%)
- **Example**: With investRatio=100% and balancedRatio=50%:
  - 0% remains as WKAIA liquidity buffer
  - 50% becomes LST and stays as LST (100% × 50%)
  - 50% becomes LST then goes to LP pools (100% × 50%)

## Recent Updates

### LP Query Tools Added (2025-09-03)

**New utility scripts for LP token analysis:**
- **`scripts/queryLPExit.js`** - Query single-token exit values from Balancer pools
  - Supports custom LP amounts and specific token exits
  - Calculates unwrapped KAIA values with rate providers
- **`scripts/queryBPTSwap.js`** - Query BPT→WKAIA swap rates through dedicated pool
  - Alternative to proportional exits for Composable Stable Pools
  - Provides market-based pricing

See [README.md](./README.md#lp-token-valuation-tools) for detailed usage instructions.

### stKAIA Rate Provider Fix (2025-09-03)

**✅ FIXED: Direct stKAIA holdings now correctly apply rate provider**

VaultCore's `getTotalAssets()` now properly applies the rate provider (1.0589x) to direct stKAIA holdings, ensuring accurate share pricing for all depositors.

### LP Calculation Logic for Mainnet 6-Token Pool (2025-09-02)

**✅ FINALIZED: LP value calculation correctly handles all tokens in mainnet pool**

The LP calculation logic has been updated to properly handle the 6-token mainnet pool:

**Token Handling:**
- **KoKAIA, GCKAIA, stKLAY**: Use unwrapped amounts only (no rate provider multiplication)
- **stKAIA**: Uses rate provider (0xefBDe60d5402a570DF7CA0d26Ddfedc413260146) for KAIA conversion
- **sKLAY**: Uses rate provider (0x15F6f25fDedf002B02d6E6be410451866Ff5Ac93) for KAIA conversion
- **BPT**: Excluded from value calculation

For detailed implementation, see [LP_CALCULATION_LOGIC.md](./docs/LP_CALCULATION_LOGIC.md)

### Contract Upgrade Scripts with Cache and Library Issues Resolution (2025-09-02)

**⚠️ IMPORTANT: Enhanced upgrade scripts that handle cache issues and library linking**

#### Background:
After cache issues discovered, comprehensive upgrade scripts were created to handle:
1. **Hardhat upgrades plugin cache issues** - Forces new implementation deployment
2. **Library linking for VaultCore** - LPCalculations library must be deployed and linked
3. **Proxy registration issues** - Direct upgradeToAndCall fallback when proxy not recognized
4. **ClaimManager optimization** - Only redeploys when contract code changes

#### Enhanced Upgrade Scripts:
- **`scripts/upgradeAllFixed.js`** - Upgrades all contracts with comprehensive error handling
- **`scripts/upgradeShareVaultFixed.js`** - Handles cache issues with forced redeployment
- **`scripts/upgradeVaultCoreFixed.js`** - Includes LPCalculations library deployment and linking
- **`scripts/upgradeSwapContractFixed.js`** - Cache-aware upgrade with fallback logic

#### Usage:
```bash
# Clean cache and upgrade all contracts
CLEAN_CACHE=true PROFILE=stable npx hardhat run scripts/upgradeAllFixed.js --network kairos

# Individual upgrades with specific profile
PROFILE=balanced npx hardhat run scripts/upgradeVaultCoreFixed.js --network kaia

# Force cache cleaning before upgrade
rm -rf .openzeppelin cache artifacts/build-info
npx hardhat compile
```

### Key Features & Achievements:
- ✅ Contract size issue resolved with separated architecture
- ✅ All security audit issues fixed (Critical & High risk)
- ✅ Standard ERC4626 pattern implemented
- ✅ WKAIA deposit state sync issue resolved
- ✅ All LST deposits working correctly
- ✅ GIVEN_OUT withdrawals implemented successfully
- ✅ SwapContract handles all 4 LSTs uniformly
- ✅ Integrated tests: 100% success rate
- ✅ Sequential Swap with APY-based ordering
- ✅ Depositor counting feature
- ✅ LP token valuation with LST unwrap conversions
- ✅ Enhanced upgrade scripts with cache handling
- ✅ ClaimManager optimization (only redeploys when needed)
- ✅ Production ready

## Important Configuration Notes

### Current Settings:
- **STABLE**: investRatio = 100% (all to LSTs, no WKAIA buffer)
- **BALANCED**: investRatio = 100%, balancedRatio = 50% (50% LST, 50% LP)
- **Slippage**: 10% default for testnet conditions
- **Withdrawal Fees**: 0.3% (30 basis points)

### Future Considerations:
1. **LP Removal Optimization**: Consider optimizing LP removal to minimize unnecessary removals
2. **Per-Block Limit Review**: Monitor mainnet usage patterns for multi-deposit needs
3. **Slippage Adjustment**: Reduce to 5-10% for mainnet with better liquidity

## Testing

### Quick Test Commands:
```bash
# Test STABLE mode (testnet)
npm run test:stable:testnet

# Test BALANCED mode (testnet)
npm run test:balanced:testnet

# Upgrade with cache handling (testnet)
npm run upgrade:testnet:stable:fixed
npm run upgrade:testnet:balanced:fixed
```

For more details on specific issues and their resolutions, refer to **[CLAUDE_HISTORY.md](./CLAUDE_HISTORY.md)**