// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IBalancerVault.sol";

contract TestQueryBatchSwap {
    struct TokenInfo {
        address asset;      // Unwrapped LST token
        address tokenA;     // Wrapped version
        address tokenB;     // Base token for pool2
        address tokenC;     // WKAIA
        bytes32 pool1;      // Pool ID for tokenA <-> tokenB
        bytes32 pool2;      // Pool ID for tokenB <-> tokenC
    }
    function testQuery(
        address vault,
        TokenInfo memory token,
        uint256 amountOut
    ) external returns (int256[] memory) {
        // Method 1: Create new arrays in memory
        address[] memory assets = new address[](3);
        assets[0] = token.tokenA;
        assets[1] = token.tokenB;
        assets[2] = token.tokenC;
        
        // Sort assets
        for (uint i = 0; i < 2; i++) {
            for (uint j = 0; j < 2 - i; j++) {
                if (assets[j] > assets[j + 1]) {
                    address temp = assets[j];
                    assets[j] = assets[j + 1];
                    assets[j + 1] = temp;
                }
            }
        }
        
        // Find indices
        uint256 tokenAIndex;
        uint256 tokenBIndex;
        uint256 tokenCIndex;
        
        for (uint i = 0; i < 3; i++) {
            if (assets[i] == token.tokenA) tokenAIndex = i;
            else if (assets[i] == token.tokenB) tokenBIndex = i;
            else if (assets[i] == token.tokenC) tokenCIndex = i;
        }
        
        // Create batch swap steps
        IBalancerVault.BatchSwapStep[] memory steps = new IBalancerVault.BatchSwapStep[](2);
        steps[0] = IBalancerVault.BatchSwapStep({
            poolId: token.pool2,
            assetInIndex: tokenBIndex,
            assetOutIndex: tokenCIndex,
            amount: amountOut,
            userData: ""
        });
        steps[1] = IBalancerVault.BatchSwapStep({
            poolId: token.pool1,
            assetInIndex: tokenAIndex,
            assetOutIndex: tokenBIndex,
            amount: 0,
            userData: ""
        });
        
        // Create funds struct
        IBalancerVault.FundManagement memory funds = IBalancerVault.FundManagement({
            sender: address(0),
            fromInternalBalance: false,
            recipient: address(0),
            toInternalBalance: false
        });
        
        // Convert to IAsset array
        IAsset[] memory iassets = new IAsset[](3);
        iassets[0] = IAsset(assets[0]);
        iassets[1] = IAsset(assets[1]);
        iassets[2] = IAsset(assets[2]);
        
        // Call queryBatchSwap
        return IBalancerVault(vault).queryBatchSwap(
            IBalancerVault.SwapKind.GIVEN_OUT,
            steps,
            iassets,
            funds
        );
    }
    
    // Alternative method: use assembly to create truly fresh arrays
    function testQueryWithAssembly(
        address vault,
        TokenInfo memory token,
        uint256 amountOut
    ) external returns (int256[] memory) {
        // Create completely fresh arrays
        address tokenA = token.tokenA;
        address tokenB = token.tokenB;
        address tokenC = token.tokenC;
        bytes32 pool1 = token.pool1;
        bytes32 pool2 = token.pool2;
        
        address[] memory assets = new address[](3);
        assembly {
            let arr := add(assets, 0x20)
            mstore(arr, tokenA)
            mstore(add(arr, 0x20), tokenB)
            mstore(add(arr, 0x40), tokenC)
        }
        
        // Sort assets
        for (uint i = 0; i < 2; i++) {
            for (uint j = 0; j < 2 - i; j++) {
                if (assets[j] > assets[j + 1]) {
                    address temp = assets[j];
                    assets[j] = assets[j + 1];
                    assets[j + 1] = temp;
                }
            }
        }
        
        // Rest of the logic...
        uint256 tokenAIndex;
        uint256 tokenBIndex;
        uint256 tokenCIndex;
        
        for (uint i = 0; i < 3; i++) {
            if (assets[i] == tokenA) tokenAIndex = i;
            else if (assets[i] == tokenB) tokenBIndex = i;
            else if (assets[i] == tokenC) tokenCIndex = i;
        }
        
        IBalancerVault.BatchSwapStep[] memory steps = new IBalancerVault.BatchSwapStep[](2);
        steps[0] = IBalancerVault.BatchSwapStep({
            poolId: pool2,
            assetInIndex: tokenBIndex,
            assetOutIndex: tokenCIndex,
            amount: amountOut,
            userData: ""
        });
        steps[1] = IBalancerVault.BatchSwapStep({
            poolId: pool1,
            assetInIndex: tokenAIndex,
            assetOutIndex: tokenBIndex,
            amount: 0,
            userData: ""
        });
        
        IBalancerVault.FundManagement memory funds = IBalancerVault.FundManagement({
            sender: address(this),
            fromInternalBalance: false,
            recipient: address(this),
            toInternalBalance: false
        });
        
        IAsset[] memory iassets = new IAsset[](3);
        for (uint i = 0; i < 3; i++) {
            iassets[i] = IAsset(assets[i]);
        }
        
        return IBalancerVault(vault).queryBatchSwap(
            IBalancerVault.SwapKind.GIVEN_OUT,
            steps,
            iassets,
            funds
        );
    }
}