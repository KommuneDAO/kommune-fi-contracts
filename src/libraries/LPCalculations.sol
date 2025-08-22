// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IBalancerVaultExtended} from "../interfaces/IBalancerVaultExtended.sol";
import {TokenInfo} from "../interfaces/ITokenInfo.sol";

/**
 * @title LPCalculations
 * @dev Library for LP token value calculations to reduce main contract size
 */
library LPCalculations {
    /**
     * @dev Calculate the underlying value of LP tokens
     */
    function calculateLPTokenValue(
        uint256 lpAmount,
        address lpToken,
        address balancerVault,
        TokenInfo memory tokenInfo
    ) external view returns (uint256) {
        if (lpAmount == 0 || lpToken == address(0)) {
            return 0;
        }
        
        // Get pool token balances
        (address[] memory poolTokens, uint256[] memory balances, ) = 
            IBalancerVaultExtended(balancerVault).getPoolTokens(tokenInfo.pool1);
        
        // Find token indices
        uint256 lstTokenIndex = type(uint256).max;
        uint256 bptIndex = type(uint256).max;
        
        for (uint256 i = 0; i < poolTokens.length; i++) {
            if (poolTokens[i] == tokenInfo.tokenA) {
                lstTokenIndex = i;
            }
            if (poolTokens[i] == lpToken) {
                bptIndex = i;
            }
        }
        
        if (lstTokenIndex == type(uint256).max) {
            return 0;
        }
        
        // Get actual supply
        uint256 actualSupply = getActualSupply(lpToken, bptIndex, balances);
        if (actualSupply == 0) {
            return 0;
        }
        
        // Calculate proportional share
        uint256 lstBalanceInPool = balances[lstTokenIndex];
        return (lpAmount * lstBalanceInPool) / actualSupply;
    }
    
    /**
     * @dev Get actual circulating supply of LP tokens
     */
    function getActualSupply(
        address lpToken,
        uint256 bptIndex,
        uint256[] memory balances
    ) internal view returns (uint256) {
        uint256 totalSupply = IERC20(lpToken).totalSupply();
        if (totalSupply == 0) {
            return 0;
        }
        
        // Calculate circulating supply
        uint256 circulatingSupply = totalSupply;
        if (bptIndex != type(uint256).max) {
            circulatingSupply = totalSupply - balances[bptIndex];
        }
        
        // Try to get actual supply from pool
        (bool success, bytes memory data) = lpToken.staticcall(
            abi.encodeWithSignature("getActualSupply()")
        );
        
        if (success && data.length >= 32) {
            uint256 poolActualSupply = abi.decode(data, (uint256));
            if (poolActualSupply > 0) {
                return poolActualSupply;
            }
        }
        
        return circulatingSupply;
    }
}