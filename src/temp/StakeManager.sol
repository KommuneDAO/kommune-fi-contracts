// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IGcKaia} from "../interfaces/IGcKaia.sol";
import {IKoKaia} from "../interfaces/IKoKaia.sol";
import {IStKaia} from "../interfaces/IStKaia.sol";
import {IStKlay} from "../interfaces/IStKlay.sol";
import {IWrapped} from "../interfaces/IWrapped.sol";
import {TokenInfo} from "../interfaces/ITokenInfo.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title StakeManager
 * @dev Separate contract for handling staking and wrapping operations via delegatecall
 * This significantly reduces the main vault contract size
 */
contract StakeManager {
    using SafeERC20 for IERC20;
    
    // Storage layout must match KVaultV2 for delegatecall
    // These storage slots must match exactly with KVaultV2
    // Inherited from ERC4626FeesUpgradeable (slots 0-50 approximately)
    uint256[50] private __gap_erc4626;
    
    // From ERC4626FeesUpgradeable
    uint256 private basisPointsFees;
    uint256 private investRatio;
    address private treasury;
    address private vault;
    uint256 private depositLimit;
    uint256 private slippage;
    mapping(uint256 => uint256) private lstAPY;
    
    // DepositInfo struct
    struct DepositInfo {
        uint256 amount;
        uint256 timestamp;
    }
    mapping(address => DepositInfo) private deposits;
    
    mapping(uint256 => TokenInfo) private tokensInfo;
    address private swapContract;
    mapping(address => uint256) private lastDepositBlock;
    address private claimManager;
    
    /**
     * @dev Execute stake operation across LST protocols based on APY distribution
     * Called via delegatecall from KVaultV2
     */
    function executeStake(uint256 amount) external returns (bool) {
        // Allow amount to be 0 (skip staking)
        if (amount == 0) return true;
        
        require(address(this).balance >= amount, "IBS");
        
        // Calculate APY-based distribution inline
        uint256[4] memory distributions;
        uint256 tw = 0;
        for (uint256 i = 0; i < 4; i++) {
            require(lstAPY[i] >= 10, "ATL");
            tw += lstAPY[i] / 10;
        }
        require(tw > 0, "TWP");
        
        uint256 allocatedAmount = 0;
        for (uint256 i = 0; i < 3; i++) {
            distributions[i] = (amount * (lstAPY[i] / 10)) / tw;
            allocatedAmount += distributions[i];
        }
        distributions[3] = amount - allocatedAmount;
        
        uint256 totalDistributed = 0;

        for (uint256 i = 0; i < 4; i++) {
            if (distributions[i] > 0) {
                require(tokensInfo[i].handler != address(0), "IHA");
                
                uint256 balanceBefore = IERC20(tokensInfo[i].asset).balanceOf(address(this));
                uint256 ethBalanceBefore = address(this).balance;
                
                bool success = false;
                if (i == 0) {
                    try IKoKaia(tokensInfo[i].handler).stake{value: distributions[i]}() {
                        success = true;
                    } catch {}
                } else if (i == 1) {
                    try IGcKaia(tokensInfo[i].handler).stake{value: distributions[i]}() {
                        success = true;
                    } catch {}
                } else if (i == 2) {
                    try IStKlay(tokensInfo[i].handler).stake{value: distributions[i]}() {
                        success = true;
                    } catch {}
                } else if (i == 3) {
                    try IStKaia(tokensInfo[i].handler).stake{value: distributions[i]}() {
                        success = true;
                    } catch {}
                }
                
                if (success) {
                    uint256 balanceAfter = IERC20(tokensInfo[i].asset).balanceOf(address(this));
                    uint256 ethBalanceAfter = address(this).balance;
                    
                    require(
                        balanceAfter > balanceBefore || 
                        ethBalanceBefore - ethBalanceAfter >= distributions[i],
                        "SF"
                    );
                    
                    totalDistributed += distributions[i];
                    
                    // Wrap LST if needed (except for stKAIA which doesn't need wrapping)
                    if (i < 3) {
                        uint256 lstBalance = IERC20(tokensInfo[i].asset).balanceOf(address(this));
                        if (lstBalance > 0) {
                            _executeWrapLST(i, lstBalance);
                        }
                    }
                }
            }
        }
        
        require(totalDistributed > 0, "NSO");
        
        // If there's remaining KAIA, wrap it to WKAIA
        if (address(this).balance > 0) {
            _wrapRemainingKAIA();
        }
        
        return true;
    }
    
    /**
     * @dev Wrap LST tokens to their wrapped versions
     * Internal function called during staking
     */
    function _executeWrapLST(uint256 protocolIndex, uint256 amount) internal {
        if (amount == 0) return;
        
        TokenInfo memory info = tokensInfo[protocolIndex];
        
        // For stKAIA (index 3), no wrapping needed as stKAIA is already the wrapped version
        if (protocolIndex == 3) {
            return;
        }
        
        // Approve the wrapper contract
        IERC20(info.asset).approve(info.tokenA, 0);
        IERC20(info.asset).approve(info.tokenA, amount);
        
        uint256 balanceBefore = IERC20(info.tokenA).balanceOf(address(this));
        
        // Perform wrapping based on protocol
        if (protocolIndex == 0) {
            // KoKaia wrapping
            IWrapped(info.tokenA).wrap(amount);
        } else if (protocolIndex == 1) {
            // GcKaia wrapping
            IWrapped(info.tokenA).wrap(amount);
        } else if (protocolIndex == 2) {
            // StKlay wrapping
            IWrapped(info.tokenA).wrap(amount);
        }
        
        uint256 balanceAfter = IERC20(info.tokenA).balanceOf(address(this));
        require(balanceAfter > balanceBefore, "WF");
    }
    
    /**
     * @dev Wrap remaining KAIA to WKAIA
     * Called after staking operations
     */
    function _wrapRemainingKAIA() internal {
        uint256 kaiaBal = address(this).balance;
        if (kaiaBal > 0) {
            // Get WKAIA address from tokenC of any tokensInfo (they all use WKAIA)
            address wkaia = tokensInfo[0].tokenC;
            require(wkaia != address(0), "WKAIA not set");
            
            // Wrap KAIA to WKAIA
            (bool success,) = wkaia.call{value: kaiaBal}("");
            require(success, "WKAIA wrap failed");
        }
    }
    
    /**
     * @dev Public wrapper for wrapLST operation
     * Called via delegatecall from KVaultV2
     */
    function executeWrapLST(uint256 protocolIndex, uint256 amount) external returns (bool) {
        require(protocolIndex < 4, "Invalid index");
        require(amount > 0, "Amount must be positive");
        
        _executeWrapLST(protocolIndex, amount);
        return true;
    }
    
    /**
     * @dev Get LST balances for all protocols
     * Called via delegatecall from KVaultV2
     */
    function executeGetLSTBalances() external view returns (
        uint256[4] memory assets,
        uint256[4] memory wrapped
    ) {
        for (uint256 i = 0; i < 4; i++) {
            assets[i] = IERC20(tokensInfo[i].asset).balanceOf(address(this));
            
            // For stKAIA (index 3), asset and wrapped are the same
            if (i == 3) {
                wrapped[i] = assets[i];
            } else {
                wrapped[i] = IERC20(tokensInfo[i].tokenA).balanceOf(address(this));
            }
        }
        
        return (assets, wrapped);
    }
    
    /**
     * @dev Calculate weighted APY distribution
     * Returns distribution amounts for each protocol
     */
    function executeDistributeByAPY(uint256 amount) external view returns (uint256[4] memory distributions) {
        uint256 tw = 0;
        for (uint256 i = 0; i < 4; i++) {
            require(lstAPY[i] >= 10, "ATL");
            tw += lstAPY[i] / 10;
        }
        require(tw > 0, "TWP");
        
        uint256 allocatedAmount = 0;
        for (uint256 i = 0; i < 3; i++) {
            distributions[i] = (amount * (lstAPY[i] / 10)) / tw;
            allocatedAmount += distributions[i];
        }
        distributions[3] = amount - allocatedAmount;
        
        return distributions;
    }
}