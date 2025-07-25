// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IAsset, IBalancerVault} from "./interfaces/IBalancerVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IKoKaia} from "./interfaces/IKoKaia.sol";
import {IWKaia} from "./interfaces/IWKaia.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @dev ERC-4626 vault with entry/exit fees expressed in https://en.wikipedia.org/wiki/Basis_point[basis point (bp)].
///
/// NOTE: The contract charges fees in terms of assets, not shares. This means that the fees are calculated based on the
/// amount of assets that are being deposited or withdrawn, and not based on the amount of shares that are being minted or
/// redeemed. This is an opinionated design decision that should be taken into account when integrating this contract.
///
/// WARNING: This contract has not been audited and shouldn't be considered production ready. Consider using it with caution.
abstract contract ERC4626Fees is ERC4626 {
    using Math for uint256;

    uint256 private constant _BASIS_POINT_SCALE = 1e4;
    uint256 public basisPointsFees;
    address public treasury;
    address public koKaia;

    constructor(uint256 _basisPointsFees, address _treasury, address _koKaia) {
        basisPointsFees = _basisPointsFees;
        treasury = _treasury;
        koKaia = _koKaia;
    }

    // === Overrides ===

    /// @dev Preview taking an entry fee on deposit. See {IERC4626-previewDeposit}.
    function previewDeposit(
        uint256 assets
    ) public view virtual override returns (uint256) {
        uint256 fee = _feeOnTotal(assets, _entryFeeBasisPoints());
        return super.previewDeposit(assets - fee);
    }

    /// @dev Preview adding an entry fee on mint. See {IERC4626-previewMint}.
    function previewMint(
        uint256 shares
    ) public view virtual override returns (uint256) {
        uint256 assets = super.previewMint(shares);
        return assets + _feeOnRaw(assets, _entryFeeBasisPoints());
    }

    /// @dev Send entry fee to {_entryFeeRecipient}. See {IERC4626-_deposit}.
    function _deposit(
        address caller,
        address receiver,
        uint256 assets,
        uint256 shares
    ) internal virtual override {
        uint256 fee = _feeOnTotal(assets, _entryFeeBasisPoints());
        address recipient = _entryFeeRecipient();

        super._deposit(caller, receiver, assets, shares);

        if (fee > 0 && recipient != address(this)) {
            SafeERC20.safeTransfer(IERC20(asset()), recipient, fee);
        }
    }

    /// @dev Send exit fee to {_exitFeeRecipient}. See {IERC4626-_deposit}.
    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal virtual override {
        uint256 fee = _feeOnRaw(assets, _exitFeeBasisPoints());
        address recipient = _exitFeeRecipient();

        super._withdraw(caller, receiver, owner, assets - fee, shares);

        if (fee > 0 && recipient != address(this)) {
            SafeERC20.safeTransfer(IERC20(asset()), recipient, fee);
        }
    }

    // === Fee configuration ===

    function _entryFeeBasisPoints() internal view virtual returns (uint256) {
        return basisPointsFees; // replace with e.g. 100 for 1%
    }

    function _exitFeeBasisPoints() internal view virtual returns (uint256) {
        return basisPointsFees; // replace with e.g. 100 for 1%
    }

    function _entryFeeRecipient() internal view virtual returns (address) {
        return treasury; // replace with e.g. a treasury address
    }

    function _exitFeeRecipient() internal view virtual returns (address) {
        return treasury; // replace with e.g. a treasury address
    }

    // === Fee operations ===

    /// @dev Calculates the fees that should be added to an amount `assets` that does not already include fees.
    /// Used in {IERC4626-mint} and {IERC4626-withdraw} operations.
    function _feeOnRaw(
        uint256 assets,
        uint256 feeBasisPoints
    ) private pure returns (uint256) {
        return
            assets.mulDiv(
                feeBasisPoints,
                _BASIS_POINT_SCALE,
                Math.Rounding.Ceil
            );
    }

    /// @dev Calculates the fee part of an amount `assets` that already includes fees.
    /// Used in {IERC4626-deposit} and {IERC4626-redeem} operations.
    function _feeOnTotal(
        uint256 assets,
        uint256 feeBasisPoints
    ) private pure returns (uint256) {
        return
            assets.mulDiv(
                feeBasisPoints,
                feeBasisPoints + _BASIS_POINT_SCALE,
                Math.Rounding.Ceil
            );
    }

    function totalAssets() public view override returns (uint256) {
        uint256 balKaia = address(this).balance;
        uint256 balWKaia = IERC20(asset()).balanceOf(address(this));
        uint256 balKoKaia = IERC20(koKaia).balanceOf(address(this));
        return balKaia + balWKaia + balKoKaia;
    }
}

contract TokenizedVault is ERC4626Fees, Ownable(msg.sender) {
    address payable public vaultOwner;
    address public vault;
    //  address public poolId; // Swap Pool : KoKaia -> wKaia

    constructor(
        IERC20 _asset,
        uint256 basisPointsFees,
        address treasury,
        address koKaia,
        address _vault
    )
        ERC4626Fees(basisPointsFees, treasury, koKaia)
        ERC4626(_asset)
        ERC20("Kommune Vault Token", "vKDO")
    {
        vaultOwner = payable(msg.sender);
        vault = _vault;
    }

    receive() external payable {}

    function invest(uint256 assets) public onlyOwner {
        require(
            assets <= IERC20(asset()).balanceOf(address(this)),
            "Bigger than balance"
        );
        IWKaia(asset()).withdraw(assets);
        IKoKaia(koKaia).stake{value: assets}();
    }

    // TODO : TokenA → Pool1 → TokenB → Pool2 → TokenC
    function performBatchSwap(
        bytes32[] calldata poolIds, // [Pool1, Pool2]
        address[] calldata tokens, // [TokenA, TokenB, TokenC]
        uint256 amountIn
    ) external {
        require(tokens.length == 3, "only 2-hop swap supported");

        // Transfer TokenA from user
        IERC20(tokens[0]).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokens[0]).approve(address(vault), amountIn);

        // Prepare assets (as IAsset)
        IAsset[] memory assets;
        for (uint i = 0; i < 3; i++) {
            assets[i] = IAsset(tokens[i]);
        }

        // Set up BatchSwapStep[]
        IBalancerVault.BatchSwapStep[] memory steps;
        steps[0] = IBalancerVault.BatchSwapStep({
            poolId: poolIds[0],
            assetInIndex: 0,
            assetOutIndex: 1,
            amount: amountIn,
            userData: ""
        });

        steps[1] = IBalancerVault.BatchSwapStep({
            poolId: poolIds[1],
            assetInIndex: 1,
            assetOutIndex: 2,
            amount: 0, // for multihop, set 0
            userData: ""
        });

        // Limit: positive = max input, negative = min output
        int256[] memory limits;
        limits[0] = int256(amountIn); // max amountIn
        limits[1] = 0; // intermediate
        limits[2] = -1_000_000_000; // minimum amountOut (accept anything > 0)

        // Fund setup
        IBalancerVault.FundManagement memory funds = IBalancerVault
            .FundManagement({
                sender: address(this),
                fromInternalBalance: false,
                recipient: msg.sender,
                toInternalBalance: false
            });

        // Execute swap
        IBalancerVault(vault).batchSwap(
            IBalancerVault.SwapKind.GIVEN_IN,
            steps,
            assets,
            funds,
            limits,
            block.timestamp + 600
        );
    }

    //  function swapTokenIn(uint256 amountIn, uint256 minAmountOut) external returns (uint256 amountOut) {
    //    // 1. 사용자 토큰 받기
    //    IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
    //
    //    // 2. approve to Balancer Vault
    //    IERC20(tokenIn).approve(address(vault), amountIn);
    //
    //    // 3. Set up swap
    //    IBalancerVault.SingleSwap memory singleSwap = IBalancerVault.SingleSwap({
    //      poolId: poolId,
    //      kind: IBalancerVault.SwapKind.GIVEN_IN,
    //      assetIn: tokenIn,
    //      assetOut: tokenOut,
    //      amount: amountIn,
    //      userData: bytes("") // 일반적인 스왑은 빈값
    //    });
    //
    //    IBalancerVault.FundManagement memory funds = IBalancerVault.FundManagement({
    //      sender: address(this),
    //      fromInternalBalance: false,
    //      recipient: msg.sender,
    //      toInternalBalance: false
    //    });
    //
    //    // 4. Execute swap
    //    amountOut = vault.swap(
    //      singleSwap,
    //      funds,
    //      minAmountOut,         // limit
    //      block.timestamp + 300 // deadline (5분 후)
    //    );
    //  }
}
