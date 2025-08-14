# CLAUDE.md - Project-Specific Instructions for KommuneFi Contracts

## Critical Instructions

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

## Current Architecture: Separated Vault (V2)

### Core Contracts
- `src/ShareVault.sol` - ERC-4626 share management (12.23 KB)
- `src/VaultCore.sol` - Asset management logic (10.17 KB)
- `src/SwapContract.sol` - ✅ FINALIZED - Handles Balancer swaps (9.26 KB)

### Previous Versions (Reference Only)
- `src/KommuneVault.sol` - V1 original implementation
- `src/KVaultV2.sol` - Optimized version (hit size limit at 24KB)
- `src/ClaimManager.sol` - Helper contract (not used in V2)
- `src/StakeManager.sol` - Helper contract (not used in V2)

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

## Session History
- Initial V1: Single contract (KommuneVault)
- V1.5: Optimized KVaultV2 hit 24KB size limit
- Helper contracts attempted with delegatecall pattern
- V2: Separated ShareVault + VaultCore architecture
- SwapContract finalized with unified sorting logic
- All 4 LSTs tested successfully with GIVEN_OUT swaps
- Project structure cleaned up and test scripts organized (2025-08-14)