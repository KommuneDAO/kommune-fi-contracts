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
        IERC20(token.asset).approve(token.tokenA, numWrap);
        IWrapped(token.tokenA).wrap(numWrap);
        IERC20(token.tokenA).approve(vault, amountIn);

        IAsset[] memory assets = new IAsset[](3);
        assets[0] = IAsset(token.tokenA);
        assets[1] = IAsset(token.tokenB);
        assets[2] = IAsset(token.tokenC);

        IBalancerVault.BatchSwapStep[] memory steps = new IBalancerVault.BatchSwapStep[](2);
        steps[0] = IBalancerVault.BatchSwapStep({
            poolId: token.pool1,
            assetInIndex: 0,
            assetOutIndex: 1,
            amount: amountIn,
            userData: ""
        });

        steps[1] = IBalancerVault.BatchSwapStep({
            poolId: token.pool2,
            assetInIndex: 1,
            assetOutIndex: 2,
            amount: 0,
            userData: ""
        });

        int256[] memory limits = new int256[](3);
        limits[0] = int256(amountIn);
        limits[1] = 0;
        limits[2] = -1_000_000_000;

        IBalancerVault.FundManagement memory funds = IBalancerVault.FundManagement({
            sender: msg.sender,
            fromInternalBalance: false,
            recipient: msg.sender,
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
        IAsset[] memory assets = new IAsset[](3);
        assets[0] = IAsset(token.tokenA);
        assets[1] = IAsset(token.tokenB);
        assets[2] = IAsset(token.tokenC);

        IBalancerVault.BatchSwapStep[] memory steps = new IBalancerVault.BatchSwapStep[](2);
        steps[0] = IBalancerVault.BatchSwapStep({
            poolId: token.pool2,
            assetInIndex: 1,
            assetOutIndex: 2,
            amount: amountOut,
            userData: ""
        });

        steps[1] = IBalancerVault.BatchSwapStep({
            poolId: token.pool1,
            assetInIndex: 0,
            assetOutIndex: 1,
            amount: 0,
            userData: ""
        });

        IBalancerVault.FundManagement memory funds = IBalancerVault.FundManagement({
            sender: msg.sender,
            fromInternalBalance: false,
            recipient: msg.sender,
            toInternalBalance: false
        });

        int256[] memory limits = new int256[](3);
        limits[0] = type(int256).max;
        limits[1] = 0;
        limits[2] = int256(amountOut);

        int256[] memory deltas = IBalancerVault(vault).queryBatchSwap(
            IBalancerVault.SwapKind.GIVEN_OUT,
            steps,
            assets,
            funds
        );
        
        require(deltas[0] != type(int256).min, "");
        return uint256(deltas[0] >= 0 ? deltas[0] : -deltas[0]);
    }
}