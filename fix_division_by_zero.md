# Division by Zero 해결 방법들

## 방법 1: 안전 검사 추가
```solidity
function _performSmartSwap(uint256 index, uint256 amt) internal {
    // Zero amount 체크
    if (amt == 0) return;
    
    AssetBalance[4] memory balances = getLSTBalances();
    
    // 잔액 체크
    if (balances[index].totalValue == 0) {
        revert("No assets available for swap");
    }
    
    uint256 actual = amt + _portionOnRaw(amt, slippage);
    // ... 기존 로직
}
```

## 방법 2: Emergency Withdrawal 기능
```solidity
function emergencyWithdraw(uint256 shares) external {
    require(balanceOf(msg.sender) >= shares, "Insufficient shares");
    
    // 직접 LST 토큰 전송 (스왑 없이)
    uint256 proportion = shares * 1e18 / totalSupply();
    
    for (uint256 i = 0; i < 4; i++) {
        uint256 lstBalance = getLSTBalance(i);
        uint256 userShare = lstBalance * proportion / 1e18;
        if (userShare > 0) {
            IERC20(tokensInfo[i].asset).transfer(msg.sender, userShare);
        }
    }
    
    _burn(msg.sender, shares);
}
```

## 방법 3: 최소 WKAIA 보유량 유지
```solidity
function _deposit(...) internal override {
    // ... 기존 로직
    
    // 최소 WKAIA 보유량 유지 (예: 0.01 WKAIA)
    uint256 minReserve = 0.01 ether;
    uint256 investAmount = assets > minReserve ? assets - minReserve : 0;
    
    if (investAmount > 0) {
        stake(investAmount);
    }
}
```

## 방법 4: Pool Balance 체크
```solidity
function _performSmartSwap(uint256 index, uint256 amt) internal {
    // Balancer Pool에 충분한 유동성이 있는지 체크
    uint256 poolBalance = IBalancerVault(vault).getPoolTokens(poolId);
    require(poolBalance > amt, "Insufficient pool liquidity");
    
    // ... 기존 로직
}
```

## 방법 5: 점진적 Swap
```solidity
function _performSmartSwap(uint256 index, uint256 amt) internal {
    uint256 maxSwapSize = amt / 10; // 10%씩 나누어서 처리
    uint256 remaining = amt;
    
    while (remaining > 0) {
        uint256 currentSwap = remaining > maxSwapSize ? maxSwapSize : remaining;
        _performSingleSwap(index, currentSwap);
        remaining -= currentSwap;
    }
}
```