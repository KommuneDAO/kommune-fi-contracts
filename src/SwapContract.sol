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
        
        // Check actual balance of wrapped tokens (might be sent from outside)
        uint256 actualBalance = IERC20(token.tokenA).balanceOf(address(this));
        uint256 amountToApprove = amountIn > 0 ? amountIn : actualBalance;
        
        // Safe approve pattern for tokenA → vault
        if (amountToApprove > 0) {
            IERC20(token.tokenA).approve(vault, 0);
            IERC20(token.tokenA).approve(vault, amountToApprove);
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

    // Note: estimateSwap functions removed as queryBatchSwap cannot be used safely
    // from smart contracts due to state modification issues.
    // Use off-chain simulation or staticCall from external scripts instead.

    function swapGivenOut(
        TokenInfo memory token,
        address vault,
        uint256 amountOut,  // Desired WKAIA amount
        uint256 maxAmountIn  // Maximum wrapped LST to use
    ) external returns (int256[] memory) {
        // Check actual balance and approve
        uint256 actualBalance = IERC20(token.tokenA).balanceOf(address(this));
        uint256 amountToApprove = actualBalance < maxAmountIn ? actualBalance : maxAmountIn;
        
        if (amountToApprove > 0) {
            IERC20(token.tokenA).approve(vault, 0);
            IERC20(token.tokenA).approve(vault, amountToApprove);
        }

        // Create assets array and sort by address (Balancer requirement)
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
        
        // Find correct indices after sorting
        uint256 tokenAIndex;
        uint256 tokenBIndex;
        uint256 tokenCIndex;
        
        for (uint i = 0; i < 3; i++) {
            if (tokenAddresses[i] == token.tokenA) tokenAIndex = i;
            else if (tokenAddresses[i] == token.tokenB) tokenBIndex = i;
            else if (tokenAddresses[i] == token.tokenC) tokenCIndex = i;
        }
        
        IAsset[] memory assets = new IAsset[](3);
        assets[0] = IAsset(tokenAddresses[0]);
        assets[1] = IAsset(tokenAddresses[1]);
        assets[2] = IAsset(tokenAddresses[2]);

        // For GIVEN_OUT, swap steps are in reverse order!
        IBalancerVault.BatchSwapStep[] memory steps = new IBalancerVault.BatchSwapStep[](2);
        
        // Step 1: Pool2 (tokenB → tokenC/WKAIA) with exact output amount
        steps[0] = IBalancerVault.BatchSwapStep({
            poolId: token.pool2,
            assetInIndex: tokenBIndex,  // Intermediate token in
            assetOutIndex: tokenCIndex,  // WKAIA out
            amount: amountOut,  // Exact WKAIA amount we want
            userData: ""
        });

        // Step 2: Pool1 (tokenA/wrapped LST → tokenB) amount calculated by Balancer
        steps[1] = IBalancerVault.BatchSwapStep({
            poolId: token.pool1,
            assetInIndex: tokenAIndex,  // Wrapped LST in
            assetOutIndex: tokenBIndex,  // Intermediate token out
            amount: 0,  // Will be calculated by Balancer
            userData: ""
        });

        // Set limits for GIVEN_OUT swap
        int256[] memory limits = new int256[](3);
        // Use actual balance as the limit for tokenA
        limits[tokenAIndex] = amountToApprove <= uint256(type(int256).max) ? int256(amountToApprove) : type(int256).max; // Max wrapped LST to use
        limits[tokenBIndex] = type(int256).max;  // Allow any amount for intermediate token
        limits[tokenCIndex] = amountOut <= uint256(type(int256).max) ? -int256(amountOut) : type(int256).min; // Min WKAIA to receive (negative)

        IBalancerVault.FundManagement memory funds = IBalancerVault.FundManagement({
            sender: address(this),        // SwapContract holds the tokens
            fromInternalBalance: false,
            recipient: msg.sender,        // Send output to KVaultV2
            toInternalBalance: false
        });

        return IBalancerVault(vault).batchSwap(
            IBalancerVault.SwapKind.GIVEN_OUT,  // GIVEN_OUT = 1
            steps,
            assets,
            funds,
            limits,
            block.timestamp + 600
        );
    }
    
    // Emergency function to rescue stuck tokens
    // Only callable by authorized contracts (VaultCore)
    address public authorizedCaller;
    
    function setAuthorizedCaller(address _caller) external {
        require(authorizedCaller == address(0), "Already set");
        authorizedCaller = _caller;
    }
    
    function rescueToken(address token, uint256 amount) external {
        require(msg.sender == authorizedCaller, "Not authorized");
        IERC20(token).transfer(msg.sender, amount);
    }
}