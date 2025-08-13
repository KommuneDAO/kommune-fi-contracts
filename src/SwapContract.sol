// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAsset, IBalancerVault} from "./interfaces/IBalancerVault.sol";
import {IWrapped} from "./interfaces/IWrapped.sol";
import {TokenInfo} from "./interfaces/ITokenInfo.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract SwapContract is Initializable, OwnableUpgradeable {
    
    function initialize() external initializer {
        __Ownable_init(msg.sender);
    }

    function swap(
        TokenInfo memory token,
        address vault,
        uint256 amountIn,
        uint256 numWrap
    ) external returns (int256[] memory) {
        // Safe approve pattern for asset → tokenA
        if (numWrap > 0) {
            IERC20(token.asset).approve(token.tokenA, 0);
            IERC20(token.asset).approve(token.tokenA, numWrap);
            
            // Store balance before wrap to verify success
            uint256 balanceBefore = IERC20(token.tokenA).balanceOf(address(this));
            
            IWrapped(token.tokenA).wrap(numWrap);
            
            // Verify wrap was successful
            uint256 balanceAfter = IERC20(token.tokenA).balanceOf(address(this));
            require(balanceAfter > balanceBefore, "Wrap failed: no tokens received");
        }
        
        // Safe approve pattern for tokenA → vault
        if (amountIn > 0) {
            IERC20(token.tokenA).approve(vault, 0);
            IERC20(token.tokenA).approve(vault, amountIn);
        }

        // Create assets array and sort by address
        address[] memory tokenAddresses = new address[](3);
        tokenAddresses[0] = token.tokenA;
        tokenAddresses[1] = token.tokenB;
        tokenAddresses[2] = token.tokenC;
        
        // Simple bubble sort for 3 elements
        for (uint i = 0; i < 2; i++) {
            for (uint j = 0; j < 2 - i; j++) {
                if (tokenAddresses[j] > tokenAddresses[j + 1]) {
                    address temp = tokenAddresses[j];
                    tokenAddresses[j] = tokenAddresses[j + 1];
                    tokenAddresses[j + 1] = temp;
                }
            }
        }
        
        IAsset[] memory assets = new IAsset[](3);
        assets[0] = IAsset(tokenAddresses[0]);
        assets[1] = IAsset(tokenAddresses[1]);
        assets[2] = IAsset(tokenAddresses[2]);
        
        // Find correct indices after sorting
        uint256 tokenAIndex;
        uint256 tokenBIndex;
        uint256 tokenCIndex;
        
        for (uint i = 0; i < 3; i++) {
            if (tokenAddresses[i] == token.tokenA) tokenAIndex = i;
            else if (tokenAddresses[i] == token.tokenB) tokenBIndex = i;
            else if (tokenAddresses[i] == token.tokenC) tokenCIndex = i;
        }

        IBalancerVault.BatchSwapStep[] memory steps = new IBalancerVault.BatchSwapStep[](2);
        steps[0] = IBalancerVault.BatchSwapStep({
            poolId: token.pool1,
            assetInIndex: tokenAIndex,
            assetOutIndex: tokenBIndex,
            amount: amountIn,
            userData: ""
        });

        steps[1] = IBalancerVault.BatchSwapStep({
            poolId: token.pool2,
            assetInIndex: tokenBIndex,
            assetOutIndex: tokenCIndex,
            amount: 0,
            userData: ""
        });

        // Safety checks for division by zero
        require(amountIn > 0, "Amount must be positive");
        require(token.pool1 != bytes32(0), "Pool1 not set");
        require(token.pool2 != bytes32(0), "Pool2 not set");

        int256[] memory limits = new int256[](3);
        limits[tokenAIndex] = amountIn <= uint256(type(int256).max) ? int256(amountIn) : type(int256).max; // Max input for tokenA
        limits[tokenBIndex] = 0;                         // No limit for intermediate tokenB
        uint256 minOutput = (amountIn * 80) / 100;       // 20% 슬리피지로 개선 (보안 강화)
        limits[tokenCIndex] = minOutput <= uint256(type(int256).max) ? -int256(minOutput) : type(int256).min; // Min output for tokenC

        IBalancerVault.FundManagement memory funds = IBalancerVault.FundManagement({
            sender: address(this),        // SwapContract holds the tokens
            fromInternalBalance: false,
            recipient: msg.sender,        // Send output to KVaultV2
            toInternalBalance: false
        });

        return IBalancerVault(vault).batchSwap(
            IBalancerVault.SwapKind.GIVEN_IN,
            steps,
            assets,
            funds,
            limits,
            block.timestamp + 600
        );
    }

    function estimateSwap(
        TokenInfo memory token,
        address vault,
        uint256 amountOut
    ) external returns (uint256) {
        // Create assets array and sort by address
        address[] memory tokenAddresses = new address[](3);
        tokenAddresses[0] = token.tokenA;
        tokenAddresses[1] = token.tokenB;
        tokenAddresses[2] = token.tokenC;
        
        // Simple bubble sort for 3 elements
        for (uint i = 0; i < 2; i++) {
            for (uint j = 0; j < 2 - i; j++) {
                if (tokenAddresses[j] > tokenAddresses[j + 1]) {
                    address temp = tokenAddresses[j];
                    tokenAddresses[j] = tokenAddresses[j + 1];
                    tokenAddresses[j + 1] = temp;
                }
            }
        }
        
        IAsset[] memory assets = new IAsset[](3);
        assets[0] = IAsset(tokenAddresses[0]);
        assets[1] = IAsset(tokenAddresses[1]);
        assets[2] = IAsset(tokenAddresses[2]);
        
        // Find correct indices after sorting
        uint256 tokenAIndex;
        uint256 tokenBIndex;
        uint256 tokenCIndex;
        
        for (uint i = 0; i < 3; i++) {
            if (tokenAddresses[i] == token.tokenA) tokenAIndex = i;
            else if (tokenAddresses[i] == token.tokenB) tokenBIndex = i;
            else if (tokenAddresses[i] == token.tokenC) tokenCIndex = i;
        }

        IBalancerVault.BatchSwapStep[] memory steps = new IBalancerVault.BatchSwapStep[](2);
        // For GIVEN_OUT, we specify the exact output and work backwards
        // The steps are still in forward order, but with the output amount specified
        steps[0] = IBalancerVault.BatchSwapStep({
            poolId: token.pool2,
            assetInIndex: tokenBIndex,  // Input tokenB
            assetOutIndex: tokenCIndex,  // Output tokenC
            amount: amountOut,  // Exact amount of tokenC we want out
            userData: ""
        });

        steps[1] = IBalancerVault.BatchSwapStep({
            poolId: token.pool1,
            assetInIndex: tokenAIndex,  // Input tokenA
            assetOutIndex: tokenBIndex,  // Output tokenB
            amount: 0,  // Will be calculated to produce enough tokenB for step 0
            userData: ""
        });

        IBalancerVault.FundManagement memory funds = IBalancerVault.FundManagement({
            sender: address(0),  // For query, sender doesn't matter
            fromInternalBalance: false,
            recipient: address(0),  // For query, recipient doesn't matter
            toInternalBalance: false
        });

        int256[] memory limits = new int256[](3);
        limits[tokenAIndex] = type(int256).max;           // No limit for tokenA input
        limits[tokenBIndex] = 0;                          // No limit for tokenB intermediate  
        limits[tokenCIndex] = amountOut <= uint256(type(int256).max) ? int256(amountOut) : type(int256).max; // Exact output for tokenC

        int256[] memory deltas = IBalancerVault(vault).queryBatchSwap(
            IBalancerVault.SwapKind.GIVEN_OUT,
            steps,
            assets,
            funds
        );
        
        require(deltas[tokenAIndex] != type(int256).min, "");
        return uint256(deltas[tokenAIndex] >= 0 ? deltas[tokenAIndex] : -deltas[tokenAIndex]);
    }
}