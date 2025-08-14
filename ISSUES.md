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

### 2. WKAIA Deposit WETH Error
**Priority**: HIGH  
**Status**: 🔍 Investigation Required  
**Assignee**: TBD  

#### Description
Intermittent error message mentioning "WETH" during WKAIA deposit operations. Error occurs sporadically and is not consistently reproducible.

#### Error Details
```
Error: WETH [specific error message needed]
```

#### Potential Causes
1. **Interface Confusion**
   - WKAIA might be using IWETH9 interface
   - Check if WKAIA inherits from WETH standard
   - Verify interface compatibility

2. **Import Issues**
   - Check for WETH imports in contracts
   - Verify no accidental WETH references

3. **Library Dependencies**
   - Review OpenZeppelin imports
   - Check for WETH dependencies

#### Investigation Steps
- [ ] Search all contracts for "WETH" references
- [ ] Check WKAIA interface implementation
- [ ] Review deposit function call stack
- [ ] Add detailed error logging
- [ ] Create reproducible test case
- [ ] Implement fix
- [ ] Add regression tests

#### Files to Check
- `src/ShareVault.sol`
- `src/VaultCore.sol`
- `src/interfaces/IWKAIA.sol` (if exists)
- Any imported OpenZeppelin contracts

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