// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IBalancerVaultExtended} from "../interfaces/IBalancerVaultExtended.sol";
import {TokenInfo} from "../interfaces/ITokenInfo.sol";

interface IWrappedLST {
    function getUnwrappedAmount(uint256 amount) external view returns (uint256);
    function getGCKLAYByWGCKLAY(uint256 amount) external view returns (uint256);
}

/**
 * @title LPCalculations
 * @dev Library for LP token value calculations to reduce main contract size
 */
library LPCalculations {
    /**
     * @dev Calculate the underlying value of LP tokens in WKAIA terms
     * Converts each LST to its WKAIA value before summing
     */
    function calculateLPTokenValue(
        uint256 lpAmount,
        address lpToken,
        address balancerVault,
        TokenInfo memory tokenInfo,
        TokenInfo[4] memory allTokensInfo
    ) external view returns (uint256) {
        if (lpAmount == 0 || lpToken == address(0)) {
            return 0;
        }
        
        // Get pool token balances
        (address[] memory poolTokens, uint256[] memory balances, ) = 
            IBalancerVaultExtended(balancerVault).getPoolTokens(tokenInfo.pool1);
        
        // Find BPT index to exclude from total value calculation
        uint256 bptIndex = type(uint256).max;
        
        for (uint256 i = 0; i < poolTokens.length; i++) {
            if (poolTokens[i] == lpToken) {
                bptIndex = i;
                break;
            }
        }
        
        // Get actual supply
        uint256 actualSupply = getActualSupply(lpToken, bptIndex, balances);
        if (actualSupply == 0) {
            return 0;
        }
        
        // Calculate total value of all non-BPT tokens in the pool (in WKAIA terms)
        uint256 totalPoolValue = 0;
        for (uint256 i = 0; i < poolTokens.length; i++) {
            // Skip BPT token itself (it's not part of the underlying value)
            if (i != bptIndex) {
                // Convert each LST to its WKAIA value
                uint256 lstWkaiaValue = convertLSTtoWKAIAValue(poolTokens[i], balances[i], allTokensInfo);
                totalPoolValue += lstWkaiaValue;
            }
        }
        
        // Calculate proportional share based on all underlying tokens
        // This gives the actual value of LP tokens in terms of underlying assets
        return (lpAmount * totalPoolValue) / actualSupply;
    }
    
    /**
     * @dev Convert LST token amount to WKAIA value
     * Takes into account unwrapping ratios for each LST type
     */
    function convertLSTtoWKAIAValue(
        address token,
        uint256 amount,
        TokenInfo[4] memory allTokensInfo
    ) internal view returns (uint256) {
        if (amount == 0) return 0;
        
        // Find which LST this token corresponds to
        for (uint256 i = 0; i < 4; i++) {
            TokenInfo memory info = allTokensInfo[i];
            
            // Check if this is the wrapped token (tokenA)
            if (info.tokenA == token && info.tokenA != address(0)) {
                // wKoKAIA (index 0) or wstKLAY (index 2) - use getUnwrappedAmount
                if (i == 0 || i == 2) {
                    try IWrappedLST(token).getUnwrappedAmount(amount) returns (uint256 unwrapped) {
                        return unwrapped;
                    } catch {
                        return amount; // Fallback to 1:1 if call fails
                    }
                }
                // wGCKAIA (index 1) - use getGCKLAYByWGCKLAY
                else if (i == 1) {
                    try IWrappedLST(token).getGCKLAYByWGCKLAY(amount) returns (uint256 unwrapped) {
                        return unwrapped;
                    } catch {
                        return amount; // Fallback to 1:1 if call fails
                    }
                }
            }
            // Check if this is the unwrapped asset
            else if (info.asset == token) {
                // For unwrapped assets (stKAIA at index 3 or others), return as is
                // These are already in their base form and valued 1:1 with WKAIA
                return amount;
            }
        }
        
        // If token not found in tokensInfo, assume 1:1 with WKAIA
        return amount;
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