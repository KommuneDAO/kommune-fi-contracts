// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title Errors
 * @dev Custom errors to replace revert strings and save gas/size
 */
library Errors {
    // General errors
    error Unauthorized();
    error InvalidAmount();
    error InvalidAddress();
    error InvalidIndex();
    error InsufficientBalance();
    error TransferFailed();
    
    // LST errors
    error InvalidLSTIndex();
    error NoHandler();
    error UnstakeFailed();
    error ClaimFailed();
    error WrapFailed();
    error UnwrapFailed();
    
    // LP errors  
    error InsufficientLPBalance();
    error NoLPToken();
    error AddLiquidityFailed();
    error RemoveLiquidityFailed();
    
    // Investment errors
    error InvalidRatio();
    error RatioExceeded();
    
    // Swap errors
    error SwapFailed();
    error SlippageExceeded();
}