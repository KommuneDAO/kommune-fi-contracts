// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IKoKaia.sol";
import "./interfaces/IGcKaia.sol";
import "./interfaces/IStKaia.sol";
import "./interfaces/IStKlay.sol";
import {TokenInfo} from "./interfaces/ITokenInfo.sol";
import {SharedStorage} from "./SharedStorage.sol";

/**
 * @title ClaimManager
 * @dev Handles unstake and claim operations for VaultCore via delegatecall
 * 
 * CRITICAL: Inherits from SharedStorage to ensure identical storage layout with VaultCore
 * for safe delegatecall operations. NEVER add storage variables here.
 */
contract ClaimManager is SharedStorage {
    // All storage variables are inherited from SharedStorage
    // DO NOT add any storage variables here - add them to SharedStorage instead
    
    // Events
    event UnstakeRequested(address indexed user, uint256 indexed lstIndex, uint256 amount, uint256 timestamp);
    event Claimed(address indexed user, uint256 indexed lstIndex, uint256 amount);
    
    address internal constant BugHole = 0x1856E6fDbF8FF701Fa1aB295E1bf229ABaB56899;
    
    function executeUnstake(address user, uint256 index, uint256 amount) external returns (bool) {
        require(index < 4, "Invalid index");
        require(amount > 0, "Amount must be positive");
        
        TokenInfo memory info = tokensInfo[index];
        
        // Check balance
        uint256 balance = IERC20(info.asset).balanceOf(address(this));
        require(balance >= amount, "Insufficient balance");
        
        // Approve if needed
        IERC20(info.asset).approve(info.handler, amount);
        
        if (index == 0) {
            // KoKaia
            IKoKaia(info.handler).unstake(amount);
        } else if (index == 1) {
            // GcKaia
            IGcKaia(info.handler).unstake(amount);
        } else if (index == 2) {
            // StKlay
            IStKlay(info.handler).unstake(amount);
        } else {
            // StKaia
            // Use address(this) instead of tx.origin for security
            // In delegatecall context, address(this) is VaultCore
            IStKaia(info.handler).unstake(BugHole, address(this), amount);
        }
        
        // Record request
        unstakeRequests[user][index] = block.timestamp;
        unstakeAmounts[user][index] += amount;
        
        emit UnstakeRequested(user, index, amount, block.timestamp);
        return true;
    }
    
    function executeClaim(address user, uint256 index) external returns (uint256) {
        require(unstakeRequests[user][index] > 0, "No unstake request");
        
        uint256 claimDelay = block.chainid == 1001 ? 10 minutes : 7 days;
        require(block.timestamp >= unstakeRequests[user][index] + claimDelay, "Not ready");
        
        TokenInfo memory info = tokensInfo[index];
        uint256 claimedAmount = 0;
        
        if (index == 0) {
            // KoKaia - claim to VaultCore
            uint256 before = address(this).balance;
            IKoKaia(info.handler).claim(address(this));
            claimedAmount = address(this).balance - before;
        } else if (index == 1) {
            // GcKaia
            uint256 before = address(this).balance;
            try IGcKaia(info.handler).claim(0) {} catch {}
            claimedAmount = address(this).balance - before;
        } else if (index == 2) {
            // StKlay
            uint256 before = address(this).balance;
            IStKlay(info.handler).claim(user);
            claimedAmount = address(this).balance - before;
        } else {
            // StKaia
            uint256 before = address(this).balance;
            uint256 count = IStKaia(info.handler).getUnstakeRequestInfoLength(user);
            for (uint256 i = 0; i < count; i++) {
                try IStKaia(info.handler).claim(user, i) {} catch {}
            }
            claimedAmount = address(this).balance - before;
        }
        
        unstakeAmounts[user][index] = 0;
        unstakeRequests[user][index] = 0;
        
        emit Claimed(user, index, claimedAmount);
        return claimedAmount;
    }
    
    function isClaimReady(address user, uint256 index) external view returns (bool) {
        if (unstakeRequests[user][index] == 0) return false;
        uint256 claimDelay = block.chainid == 1001 ? 10 minutes : 7 days;
        return block.timestamp >= unstakeRequests[user][index] + claimDelay;
    }
    
    function getTimeUntilClaim(address user, uint256 index) external view returns (uint256) {
        if (unstakeRequests[user][index] == 0) return type(uint256).max;
        uint256 claimDelay = block.chainid == 1001 ? 10 minutes : 7 days;
        uint256 claimTime = unstakeRequests[user][index] + claimDelay;
        if (block.timestamp >= claimTime) return 0;
        return claimTime - block.timestamp;
    }
}
