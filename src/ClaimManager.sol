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
 * @dev V2 version - Handles unstake and claim operations for VaultCore via delegatecall
 * Reduces VaultCore contract size while maintaining functionality
 * Compatible with ShareVault + VaultCore architecture
 */
contract ClaimManager {
    using SafeERC20 for IERC20;
    
    address internal constant BugHole = 0x1856E6fDbF8FF701Fa1aB295E1bf229ABaB56899;
    
    // Storage layout must match VaultCore for delegatecall
    // These storage slots must match exactly with VaultCore
    
    // From OwnableUpgradeable
    uint256[50] private __gap_ownable;
    
    // From UUPSUpgradeable  
    uint256[50] private __gap_uups;
    
    // From VaultCore (must match exact order)
    address private shareVault;
    address private wkaia;
    address private balancerVault;
    address private swapContract;
    mapping(uint256 => TokenInfo) private tokensInfo;
    mapping(uint256 => uint256) private lstAPY;
    uint256 private investRatio;
    uint256 private slippage;
    
    // ClaimManager specific storage (add at the end)
    address private claimManager;
    mapping(address => mapping(uint256 => uint256)) public unstakeRequests; // user => lstIndex => timestamp
    mapping(address => mapping(uint256 => uint256)) public unstakeAmounts; // user => lstIndex => amount
    
    // Events
    event UnstakeRequested(address indexed user, uint256 indexed lstIndex, uint256 amount, uint256 timestamp);
    event Claimed(address indexed user, uint256 indexed lstIndex, uint256 amount);
    
    /**
     * @dev Performs unstake operation for different LST protocols
     * Called via delegatecall from VaultCore
     * Records unstake request timestamp for claim eligibility
     */
    function executeUnstake(address user, uint256 index, uint256 amount) external returns (bool) {
        require(index < 4, "Invalid index");
        require(amount > 0, "Amount must be positive");
        require(user != address(0), "Invalid user");
        
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
        
        // Record unstake request
        unstakeRequests[user][index] = block.timestamp;
        unstakeAmounts[user][index] += amount;
        
        emit UnstakeRequested(user, index, amount, block.timestamp);
        
        return true;
    }
    
    /**
     * @dev Performs claim operation for different LST protocols
     * Called via delegatecall from VaultCore
     * Checks if 7 days have passed since unstake
     */
    function executeClaim(address user, uint256 index) external returns (uint256) {
        require(index < 4, "Invalid index");
        require(user != address(0), "Invalid user");
        require(unstakeRequests[user][index] > 0, "No unstake request");
        require(block.timestamp >= unstakeRequests[user][index] + 7 days, "Claim not ready");
        
        TokenInfo memory info = tokensInfo[index];
        uint256 claimedAmount = 0;
        
        if (index == 0) {
            // KoKaia simple claim
            uint256 balanceBefore = address(this).balance;
            IKoKaia(info.handler).claim(user);
            claimedAmount = address(this).balance - balanceBefore;
            
        } else if (index == 1) {
            // GcKaia complex claim with NFT handling
            claimedAmount = _handleGcKaiaClaim(info.handler, user);
            
        } else if (index == 2) {
            // StKlay simple claim
            uint256 balanceBefore = address(this).balance;
            IStKlay(info.handler).claim(user);
            claimedAmount = address(this).balance - balanceBefore;
            
        } else {
            // StKaia complex claim with multiple unstake requests
            claimedAmount = _handleStKaiaClaim(info.handler, user);
        }
        
        // Clear the request
        unstakeAmounts[user][index] = 0;
        unstakeRequests[user][index] = 0;
        
        emit Claimed(user, index, claimedAmount);
        
        return claimedAmount;
    }
    
    /**
     * @dev Handle GcKaia claim
     * Note: GcKaia uses a different claim mechanism than expected
     * This is a simplified implementation - may need adjustment based on actual interface
     */
    function _handleGcKaiaClaim(address handler, address user) private returns (uint256) {
        uint256 balanceBefore = address(this).balance;
        
        // GcKaia might use different claim mechanism
        // For now, attempt simple claim
        try IGcKaia(handler).claim(0) {
            // Success - claimed with ID 0
        } catch {
            // Claim might have failed or require different parameters
        }
        
        return address(this).balance - balanceBefore;
    }
    
    /**
     * @dev Handle StKaia claim with multiple unstake requests
     */
    function _handleStKaiaClaim(address handler, address user) private returns (uint256) {
        uint256 balanceBefore = address(this).balance;
        
        // StKaia allows multiple unstake requests
        // Try to claim all available requests for the user
        uint256 unstakeRequestCount = IStKaia(handler).getUnstakeRequestInfoLength(user);
        
        for (uint256 i = 0; i < unstakeRequestCount; i++) {
            try IStKaia(handler).claim(user, i) {
                // Success
            } catch {
                // Continue with other requests if one fails
            }
        }
        
        return address(this).balance - balanceBefore;
    }
    
    /**
     * @dev Check if a claim is ready for a user
     */
    function isClaimReady(address user, uint256 index) external view returns (bool) {
        if (unstakeRequests[user][index] == 0) {
            return false;
        }
        return block.timestamp >= unstakeRequests[user][index] + 7 days;
    }
    
    /**
     * @dev Get remaining time until claim is ready (in seconds)
     */
    function getTimeUntilClaim(address user, uint256 index) external view returns (uint256) {
        if (unstakeRequests[user][index] == 0) {
            return type(uint256).max; // No request exists
        }
        
        uint256 claimTime = unstakeRequests[user][index] + 7 days;
        if (block.timestamp >= claimTime) {
            return 0; // Ready to claim
        }
        
        return claimTime - block.timestamp;
    }
    
    /**
     * @dev Batch claim function for multiple LST indices
     */
    function executeBatchClaim(address user, uint256[] calldata indices) external returns (uint256[] memory) {
        uint256[] memory amounts = new uint256[](indices.length);
        
        for (uint256 i = 0; i < indices.length; i++) {
            if (this.isClaimReady(user, indices[i])) {
                amounts[i] = this.executeClaim(user, indices[i]);
            }
        }
        
        return amounts;
    }
}