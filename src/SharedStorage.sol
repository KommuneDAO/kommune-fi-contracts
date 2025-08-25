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
    
    // ========== INVESTMENT STRATEGY ALLOCATION (slots 12-13) ==========
    // All ratios are in basis points (10000 = 100%)
    // balancedRatio + aggressiveRatio <= 10000 (100%)
    // These determine how much of the LSTs (obtained via investRatio) go to pools
    uint256 public balancedRatio;   // slot 12 - % of LSTs to add to pool1 for LP tokens
    uint256 public aggressiveRatio; // slot 13 - % of LSTs to add to pool2 for LP tokens
    
    // ========== BALANCER LP TRACKING (slots 15-16) ==========
    uint256 public lpBalance;           // slot 15 - Total BPT balance (all LSTs share same pool)
    address public lpToken;             // slot 16 - BPT token address
    
    // ========== NETWORK CONFIGURATION (slot 17) ==========
    bool public isMainnet;              // slot 17 - true for mainnet (6-token pool), false for testnet (5-token pool)
    
    // ========== RESERVE FOR FUTURE UPGRADES ==========
    // When adding new variables:
    // 1. Add them here (before __gap)
    // 2. Decrease __gap size accordingly
    // Example: uint256 public newVariable; // slot 18
    //          uint256[32] private __gap;  // reduced from 33
    
    uint256[33] private __gap;  // Reserve slots 18-50 for future variables
}