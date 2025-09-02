// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IBalancerVaultExtended} from "../interfaces/IBalancerVaultExtended.sol";
import {TokenInfo} from "../interfaces/ITokenInfo.sol";

interface IWrappedLST {
    function getUnwrappedAmount(uint256 amount) external view returns (uint256);
    function getGCKLAYByWGCKLAY(uint256 amount) external view returns (uint256);
}

interface IRateProvider {
    function getRate() external view returns (uint256);
}

/**
 * @title LPCalculations
 * @dev Library for LP token value calculations to reduce main contract size
 */
library LPCalculations {
    // Mainnet rate provider addresses
    address constant KOKAIA_RATE_PROVIDER = 0x0b500A7139c1f3300e28EA7aE796AF7FD9DE529F;
    address constant GCKAIA_RATE_PROVIDER = 0x8cCbEa45e02535475E461CEab1520EF961A0BE46;
    address constant STKLAY_RATE_PROVIDER = 0x532Db3B7ecc60b21149b515eBA271c58996dcB99;
    address constant STKAIA_RATE_PROVIDER = 0xefBDe60d5402a570DF7CA0d26Ddfedc413260146;
    address constant SKLAY_RATE_PROVIDER = 0x15F6f25fDedf002B02d6E6be410451866Ff5Ac93;
    
    // Check if on mainnet (chainId 8217)
    function isMainnet() internal view returns (bool) {
        return block.chainid == 8217;
    }
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
     * Takes into account unwrapping ratios for each LST type and rate providers on mainnet
     */
    function convertLSTtoWKAIAValue(
        address token,
        uint256 amount,
        TokenInfo[4] memory allTokensInfo
    ) internal view returns (uint256) {
        if (amount == 0) return 0;
        
        // Special handling for sKLAY on mainnet (not in our tokensInfo but exists in pool)
        if (isMainnet() && token == 0xA323d7386b671E8799dcA3582D6658FdcDcD940A) {
            // sKLAY uses its rate provider
            try IRateProvider(SKLAY_RATE_PROVIDER).getRate() returns (uint256 rate) {
                return (amount * rate) / 1e18;
            } catch {
                return amount; // Fallback to 1:1 if rate provider fails
            }
        }
        
        // Find which LST this token corresponds to
        for (uint256 i = 0; i < 4; i++) {
            TokenInfo memory info = allTokensInfo[i];
            
            // Check if this is the wrapped token (tokenA)
            if (info.tokenA == token && info.tokenA != address(0)) {
                uint256 unwrappedAmount = amount;
                
                // First unwrap the token
                // wKoKAIA (index 0) or wstKLAY (index 2) - use getUnwrappedAmount
                if (i == 0 || i == 2) {
                    try IWrappedLST(token).getUnwrappedAmount(amount) returns (uint256 unwrapped) {
                        unwrappedAmount = unwrapped;
                    } catch {
                        // Fallback to 1:1 if call fails
                    }
                }
                // wGCKAIA (index 1) - use getGCKLAYByWGCKLAY
                else if (i == 1) {
                    try IWrappedLST(token).getGCKLAYByWGCKLAY(amount) returns (uint256 unwrapped) {
                        unwrappedAmount = unwrapped;
                    } catch {
                        // Fallback to 1:1 if call fails
                    }
                }
                
                // Then apply rate provider conversion on mainnet
                if (isMainnet()) {
                    return applyRateProvider(unwrappedAmount, i);
                }
                
                return unwrappedAmount;
            }
            // Check if this is the unwrapped asset
            else if (info.asset == token) {
                // For unwrapped assets, apply rate provider if on mainnet
                if (isMainnet()) {
                    return applyRateProvider(amount, i);
                }
                // Otherwise return as is (1:1 with WKAIA on testnet)
                return amount;
            }
        }
        
        // If token not found in tokensInfo, assume 1:1 with WKAIA
        return amount;
    }
    
    /**
     * @dev Apply rate provider conversion for mainnet
     * @param amount The amount of unwrapped LST
     * @param lstIndex The index of the LST (0=KoKAIA, 1=GCKAIA, 2=stKLAY, 3=stKAIA)
     * @return The amount converted to KAIA value
     */
    function applyRateProvider(uint256 amount, uint256 lstIndex) internal view returns (uint256) {
        // KoKAIA (index 0), GCKAIA (index 1), stKLAY (index 2) don't use rate providers
        // They just use unwrapped amounts directly
        if (lstIndex == 0 || lstIndex == 1 || lstIndex == 2) {
            return amount;
        }
        
        // Only stKAIA (index 3) uses rate provider
        if (lstIndex == 3) {
            address rateProvider = STKAIA_RATE_PROVIDER;
            
            // Get rate from provider
            try IRateProvider(rateProvider).getRate() returns (uint256 rate) {
                // Rate is typically in 1e18 format (1e18 = 1:1 ratio)
                // Convert: amount * rate / 1e18
                return (amount * rate) / 1e18;
            } catch {
                // If rate provider fails, return original amount
                return amount;
            }
        }
        
        // Unknown LST, return as is
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