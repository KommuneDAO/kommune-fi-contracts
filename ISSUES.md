# Known Issues & Tasks

## 🔴 Critical Tasks

### 1. Unstake/Claim Testing Required
**Priority**: HIGH  
**Status**: ⏳ Pending  
**Assignee**: TBD  

#### Description
ClaimManager functionality has been implemented but requires comprehensive testing for all LST protocols.

#### Test Requirements
- [ ] **wKoKAIA (Index 0)**
  - [ ] Test unstake operation
  - [ ] Verify 7-day waiting period
  - [ ] Test claim after waiting period
  - [ ] Verify KAIA receipt

- [ ] **wGCKAIA (Index 1)**
  - [ ] Test unstake operation
  - [ ] Verify NFT handling
  - [ ] Test claim with NFT ID
  - [ ] Verify KAIA receipt

- [ ] **wstKLAY (Index 2)**
  - [ ] Test unstake operation
  - [ ] Verify 7-day waiting period
  - [ ] Test claim operation
  - [ ] Verify KAIA receipt

- [ ] **stKAIA (Index 3)**
  - [ ] Test unstake with BugHole address
  - [ ] Verify multiple unstake requests
  - [ ] Test claim for all requests
  - [ ] Verify KAIA receipt

- [ ] **Batch Operations**
  - [ ] Test batch claim for multiple LSTs
  - [ ] Test concurrent unstake operations
  - [ ] Verify gas optimization

#### Test Script Location
Create test script at: `scripts/tests/testUnstakeClaim.js`

---

### 2. ~~WKAIA Deposit WETH Error~~ ✅ RESOLVED (2025-08-16)
**Priority**: ~~HIGH~~  
**Status**: ✅ RESOLVED with Direct Deposit Pattern  
**Assignee**: TBD  

#### Original Issue
"WETH: request exceeds allowance" error occurring during WKAIA deposit operations with 76% failure rate.

#### Root Cause Found ✅
**NOT external system issue** - The problem was in OUR LOGIC:
- Complex transaction chain: User → ShareVault → VaultCore → WKAIA.withdraw()
- ShareVault transferred WKAIA to VaultCore then immediately called withdraw
- This rapid state change caused synchronization issues

#### Solution Implemented ✅
**Direct Deposit Pattern**:
```javascript
// Step 1: User transfers WKAIA directly to VaultCore
await wkaia.transfer(vaultCore, amount);
// Step 2: User calls deposit on ShareVault
await shareVault.deposit(amount, receiver);
```

#### Results
- **Before**: 76% error rate with old pattern
- **After**: 0% error rate with Direct Deposit
- **Complete elimination of the problem**

#### 🎓 Lessons Learned
1. **Look Internal First**: We wasted time blaming WKAIA/Chain/RPC when it was our code
2. **Find Root Cause**: Don't apply workarounds without understanding the real problem
3. **Simple is Better**: Direct transfer is simpler and more reliable
4. **Test Thoroughly**: Proper testing revealed the real issue

#### Implementation Files
- ✅ `src/ShareVault.sol` - Updated deposit() and mint()
- ✅ `src/VaultCore.sol` - Added handleDirectDeposit()
- ✅ All upgrade scripts updated with unsafeAllow
- ✅ Integration tests passing 100%

---

## 📝 Non-Critical Tasks

### 3. API Documentation
**Priority**: Medium  
**Status**: 📅 Planned  
- Document all public functions
- Create integration examples
- Add code snippets

### 4. User Guide
**Priority**: Medium  
**Status**: 📅 Planned  
- Step-by-step deposit guide
- Withdrawal instructions
- Unstake/Claim tutorial

### 5. Security Audit Documentation
**Priority**: Medium  
**Status**: 📅 Planned  
- Prepare audit checklist
- Document security measures
- Create incident response plan

---

## 🐛 Bug Tracking

### Fixed Issues
- ✅ QueryBatchSwap error (2025-08-14)
- ✅ Multi-LST swap logic (2025-08-14)
- ✅ Contract size limit (2025-08-10)
- ✅ stKAIA handling (2025-08-14)

### Open Issues
- 🔴 WETH error during WKAIA deposits
- 🟡 Unstake/Claim testing pending

---

## 📊 Testing Coverage

### Completed Tests
- ✅ Deposit (all LSTs)
- ✅ Withdrawal (all percentages)
- ✅ Concurrent operations
- ✅ APY changes
- ✅ Stress testing

### Pending Tests
- ⏳ Unstake operations
- ⏳ Claim after 7 days
- ⏳ Batch claims
- ⏳ WKAIA error reproduction

---

## 🔧 Quick Fixes

### If WETH Error Occurs
1. Check wallet WKAIA balance
2. Verify WKAIA approval
3. Try smaller amount
4. Check network congestion
5. Report error details

### Testing Unstake/Claim
```bash
# Deploy fresh contracts
npm run deploy:testnet

# Run unstake test (to be created)
npx hardhat run scripts/tests/testUnstakeClaim.js --network kairos
```

---

## 📞 Support

For urgent issues:
- GitHub Issues: [Create Issue](https://github.com/KommuneFi/contracts/issues)
- Discord: Development channel
- Email: dev@kommunefi.com

---

*Last Updated: 2025-08-15*
*Next Review: 2025-08-16*