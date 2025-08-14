// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import "./interfaces/IGcKaia.sol";
import {IKoKaia} from "./interfaces/IKoKaia.sol";
import "./interfaces/IStKaia.sol";
import {IStKlay} from "./interfaces/IStKlay.sol";
import {TokenInfo} from "./interfaces/ITokenInfo.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ClaimManager
 * @dev Separate contract for handling unstake and claim operations via delegatecall
 * This significantly reduces the main vault contract size
 */
contract ClaimManager {
    using SafeERC20 for IERC20;
    
    address internal constant BugHole = 0x1856E6fDbF8FF701Fa1aB295E1bf229ABaB56899;
    
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
    
    /**
     * @dev Performs unstake operation for different LST protocols
     * Called via delegatecall from KVaultV2
     */
    function executeUnstake(uint256 index, uint256 amount) external returns (bool) {
        require(index < 4, "Invalid index");
        require(amount > 0, "Amount must be positive");
        
        TokenInfo memory info = tokensInfo[index];
        
        if (index == 0) {
            // KoKaia unstake
            IKoKaia(info.handler).unstake(amount);
        } else if (index == 1) {
            // GcKaia unstake
            IGcKaia(info.handler).unstake(amount);
        } else if (index == 2) {
            // StKlay unstake  
            IStKlay(info.handler).unstake(amount);
        } else {
            // StKaia unstake - requires specific parameters
            // msg.sender in delegatecall context is the original caller
            IStKaia(info.handler).unstake(BugHole, tx.origin, amount);
        }
        
        return true;
    }
    
    /**
     * @dev Performs claim operation for different LST protocols
     * Called via delegatecall from KVaultV2
     */
    function executeClaim(uint256 index, address user) external returns (bool) {
        require(index < 4, "Invalid index");
        require(user != address(0), "Invalid user");
        
        TokenInfo memory info = tokensInfo[index];
        
        if (index == 0) {
            // KoKaia simple claim
            IKoKaia(info.handler).claim(user);
            
        } else if (index == 1) {
            // GcKaia complex claim with NFT handling
            _handleGcKaiaClaim(info.handler, user);
            
        } else if (index == 2) {
            // StKlay simple claim
            IStKlay(info.handler).claim(user);
            
        } else {
            // StKaia complex claim with multiple unstake requests
            _handleStKaiaClaim(info.handler, user);
        }
        
        return true;
    }
    
    /**
     * @dev Batch operations for multiple claims
     */
    function executeBatchClaim(uint256[] calldata indices, address[] calldata users) external returns (bool) {
        require(indices.length == users.length, "Length mismatch");
        
        for (uint256 i = 0; i < indices.length; i++) {
            this.executeClaim(indices[i], users[i]);
        }
        
        return true;
    }
    
    /**
     * @dev Emergency withdrawal function
     * Allows recovering stuck LST tokens to the vault
     */
    function executeEmergencyWithdraw(uint256 index) external returns (bool) {
        require(index < 4, "Invalid index");
        
        TokenInfo memory info = tokensInfo[index];
        
        // Transfer any LST tokens held by this contract back to vault
        uint256 balance = IERC20(info.asset).balanceOf(address(this));
        if (balance > 0) {
            SafeERC20.safeTransfer(IERC20(info.asset), msg.sender, balance);
        }
        
        // For wrapped versions (not stKAIA)
        if (index < 3) {
            uint256 wrappedBalance = IERC20(info.tokenA).balanceOf(address(this));
            if (wrappedBalance > 0) {
                SafeERC20.safeTransfer(IERC20(info.tokenA), msg.sender, wrappedBalance);
            }
        }
        
        return true;
    }
    
    /**
     * @dev Internal function to handle GcKaia claims
     */
    function _handleGcKaiaClaim(address handler, address user) private {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        
        // Only process on mainnet
        if (chainId == 8217) {
            IERC721Enumerable uGCKAIA = IERC721Enumerable(
                0x000000000fa7F32F228e04B8bffFE4Ce6E52dC7E
            );
            
            uint256 count = uGCKAIA.balanceOf(user);
            if (count == 0) return;
            
            uint256[] memory tokenIds = new uint256[](count);
            for (uint256 i = 0; i < count; i++) {
                tokenIds[i] = uGCKAIA.tokenOfOwnerByIndex(user, i);
            }
            
            for (uint256 i = 0; i < count; i++) {
                (,uint256 withdrawableFrom, WithdrawalRequestState state) = IGcKaia(handler)
                    .withdrawalRequestInfo(tokenIds[i]);
                    
                if (state == WithdrawalRequestState.Unknown && withdrawableFrom < block.timestamp) {
                    IGcKaia(handler).claim(tokenIds[i]);
                }
            }
        }
    }
    
    /**
     * @dev Internal function to handle StKaia claims
     */
    function _handleStKaiaClaim(address handler, address user) private {
        uint256 length = IStKaia(handler).getUnstakeRequestInfoLength(user);
        if (length == 0) return;
        
        UnstakeInfo[] memory infos = IStKaia(handler).getUnstakeInfos(
            user,
            0,
            length
        );
        
        // Claim all matured unstake requests (after 7 days)
        for (uint256 i = 0; i < infos.length; i++) {
            if (infos[i].unstakeTime + 604800 < block.timestamp) {
                IStKaia(handler).claim(user, infos[i].unstakeId);
            }
        }
    }
    
    /**
     * @dev Set APY for a specific LST protocol
     */
    function executeSetAPY(uint256 index, uint256 apy) external returns (bool) {
        require(index < 4, "Invalid index");
        require(apy <= 10000, "APY too high");
        
        lstAPY[index] = apy * 10;
        return true;
    }
    
    /**
     * @dev Set multiple APY values at once
     */
    function executeSetMultipleAPY(uint256[4] calldata apyValues) external returns (bool) {
        for (uint256 i = 0; i < 4; i++) {
            require(apyValues[i] <= 10000, "APY too high");
            lstAPY[i] = apyValues[i] * 10;
        }
        return true;
    }
    
    /**
     * @dev Get APY for a specific LST
     */
    function executeGetAPY(uint256 index) external view returns (uint256) {
        require(index < 4, "Invalid index");
        return lstAPY[index] / 10;
    }
    
    /**
     * @dev Get all APY values
     */
    function executeGetAllAPY() external view returns (uint256[4] memory) {
        uint256[4] memory apys;
        for (uint256 i = 0; i < 4; i++) {
            apys[i] = lstAPY[i] / 10;
        }
        return apys;
    }
    
    /**
     * @dev Get claim status for a user
     */
    function getClaimStatus(uint256 index, address user) external view returns (uint256 claimable, uint256 pending) {
        require(index < 4, "Invalid index");
        
        TokenInfo memory info = tokensInfo[index];
        
        if (index == 3) {
            // StKaia - check unstake requests
            uint256 length = IStKaia(info.handler).getUnstakeRequestInfoLength(user);
            if (length > 0) {
                UnstakeInfo[] memory infos = IStKaia(info.handler).getUnstakeInfos(user, 0, length);
                
                for (uint256 i = 0; i < infos.length; i++) {
                    if (infos[i].unstakeTime + 604800 < block.timestamp) {
                        claimable += infos[i].amount;
                    } else {
                        pending += infos[i].amount;
                    }
                }
            }
        }
        // Add similar logic for other protocols if needed
        
        return (claimable, pending);
    }
}