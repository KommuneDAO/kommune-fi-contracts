// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TokenInfo} from "./interfaces/ITokenInfo.sol";

/**
 * @title SharedStorage
 * @dev Base storage contract to ensure identical layout for VaultCore and ClaimManager delegatecall
 * 
 * CRITICAL RULES:
 * 1. NEVER modify the order of existing variables
 * 2. NEVER remove variables
 * 3. ONLY add new variables at the end (before __gap)
 * 4. Always decrease __gap size when adding new variables
 * 
 * This contract ensures VaultCore and ClaimManager have identical storage layouts,
 * preventing storage collision when using delegatecall.
 */
contract SharedStorage {
    // ========== CORE ADDRESSES (slots 0-4) ==========
    address public shareVault;       // slot 0
    address public wkaia;            // slot 1
    address public balancerVault;    // slot 2
    address public swapContract;     // slot 3
    address public claimManager;     // slot 4
    
    // ========== LST CONFIGURATION (slots 5-6) ==========
    mapping(uint256 => TokenInfo) public tokensInfo;  // slot 5
    mapping(uint256 => uint256) public lstAPY;        // slot 6
    
    // ========== INVESTMENT PARAMETERS (slots 7-8) ==========
    uint256 public investRatio;     // slot 7 - basis points (e.g., 9000 = 90%)
    uint256 public slippage;        // slot 8 - basis points (e.g., 1000 = 10%)
    
    // ========== UNSTAKE TRACKING (slots 9-10) ==========
    mapping(address => mapping(uint256 => uint256)) public unstakeRequests;  // slot 9 - user => lstIndex => timestamp
    mapping(address => mapping(uint256 => uint256)) public unstakeAmounts;   // slot 10 - user => lstIndex => amount
    
    // ========== DEPOSIT TRACKING (slot 11) ==========
    mapping(address => uint256) public lastDepositBlock;  // slot 11 - anti-spam protection
    
    // ========== RESERVE FOR FUTURE UPGRADES ==========
    // When adding new variables:
    // 1. Add them here (before __gap)
    // 2. Decrease __gap size accordingly
    // Example: uint256 public newVariable; // slot 12
    //          uint256[38] private __gap;  // reduced from 39
    
    uint256[39] private __gap;  // Reserve slots 12-50 for future variables
}