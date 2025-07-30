// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC4626Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import {IAsset, IBalancerVault} from "./interfaces/IBalancerVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IKoKaia} from "./interfaces/IKoKaia.sol";
import {IWKaia} from "./interfaces/IWKaia.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IWKoKaia} from "./interfaces/IWKoKaia.sol";

/// @dev ERC-4626 vault with entry/exit fees expressed in https://en.wikipedia.org/wiki/Basis_point[basis point (bp)].
///
/// NOTE: The contract charges fees in terms of assets, not shares. This means that the fees are calculated based on the
/// amount of assets that are being deposited or withdrawn, and not based on the amount of shares that are being minted or
/// redeemed. This is an opinionated design decision that should be taken into account when integrating this contract.
///
/// WARNING: This contract has not been audited and shouldn't be considered production ready. Consider using it with caution.
abstract contract ERC4626FeesUpgradeable is ERC4626Upgradeable {
    using Math for uint256;

    uint256 private constant _BASIS_POINT_SCALE = 1e4;
    uint256 public basisPointsFees;
    uint256 public investRatio;
    address public treasury;
    address public koKaia;
    address public vault;
    uint256 public depositLimit;

    struct DepositInfo {
        uint256 amount;
        uint256 timestamp;
    }
    mapping(address => DepositInfo) public deposits;

    event BatchSwap(int256 indexed, int256 indexed, int256 indexed);
    event Fee(uint256 indexed, uint256 indexed);
    event MaxDeposit(uint256 indexed);
    event BasisPointsFees(uint256 indexed);
    event InvestRatio(uint256 indexed);

    function getSwapToken(int index) public view returns (address) {
        uint256 id;
        assembly {
            id := chainid()
        }
        if (id == 8217) {
            if (index == 1) return 0xdEC2Cc84f0a37Ef917f63212FE8ba7494b0E4B15; // wKoKAIA
            if (index == 2) return 0xA006e8dF6A3CBc66D4D707C97A9FDAf026096487; // 5LST
            return 0x19Aac5f612f524B754CA7e7c41cbFa2E981A4432; // WKAIA
        } else {
            if (index == 1) return 0x9a93e2fcDEBE43d0f8205D1cd255D709B7598317;
            if (index == 2) return 0x985acD34f36D91768aD4b0cB295Aa919A7ABDb27;
            return 0x0339d5Eb6D195Ba90B13ed1BCeAa97EbD198b106;
        }
    }

    function getSwapPool(int index) public view returns (bytes32) {
        uint256 id;
        assembly {
            id := chainid()
        }
        if (id == 8217) {
            if (index == 1)
                return
                    0xa006e8df6a3cbc66d4d707c97a9fdaf026096487000000000000000000000000; // LST Pool
            return
                0x17f3eda2bf1aa1e7983906e675ac9a2ab6bc57de000000000000000000000001; // WKAIA-5LST Pool
        } else {
            if (index == 1)
                return
                    0x8193fe745f2784b1f55e51f71145d2b8b0739b8100020000000000000000000e;
            return
                0x0c5da2fa11fc2d7eee16c06740072e3c5e1bb4a7000200000000000000000001;
        }
    }

    function __ERC4626Fees_init(
        uint256 _basisPointsFees,
        uint256 _investRatio,
        address _treasury,
        address _koKaia,
        address _vault
    ) internal onlyInitializing {
        basisPointsFees = _basisPointsFees;
        investRatio = _investRatio;
        treasury = _treasury;
        koKaia = _koKaia;
        vault = _vault;
        depositLimit = 100 * 1e18;
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
        require(
            deposits[caller].amount + assets <= depositLimit,
            "Max. amount of deposit is over."
        );
        super._deposit(caller, receiver, assets, shares);

        // Invest to GC Staking Pool
        uint256 amount = _portionOnRaw(assets, _reserveRatio());

        // WKaia -> KAIA
        IWKaia(asset()).withdraw(amount);
        // Stake KAIA to earn
        IKoKaia(koKaia).stake{value: amount}();

        deposits[caller].amount = deposits[caller].amount + assets;
        deposits[caller].timestamp = block.timestamp;
    }

    /// @dev Send exit fee to {_exitFeeRecipient}. See {IERC4626-_deposit}.
    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal virtual override {
        address recipient = _exitFeeRecipient();
        uint256 max = maxWithdraw(caller);

        uint256 balWKaia = IERC20(asset()).balanceOf(address(this));
        if (assets > balWKaia) {
            uint256 lack = assets - balWKaia;
            uint256 _swap = lack + _portionOnRaw(lack, 2000); // Swap 20% more because of Slippage
            int256[] memory assetDeltas = swap(_swap);
            emit BatchSwap(assetDeltas[0], assetDeltas[1], assetDeltas[2]);
            // require(counts[2] >= 0, "Swap returned negative output");
            // require(
            //   balWKaia + uint256(counts[2]) >= assets,
            //   "Lack of WKAIA to withdraw"
            // );
            require(
                IERC20(asset()).balanceOf(address(this)) >= assets,
                "Lack of WKAIA to withdraw"
            );
        }

        uint256 fee = 0;
        uint256 principalShare = assets;
        // assets = principalShare + profitShare
        if (max >= deposits[caller].amount) {
            uint256 profitShare = (assets * (max - deposits[caller].amount)) /
                max; // Profit included in assets

            fee = _feeOnTotal(profitShare, _exitFeeBasisPoints()); // 10% of Profit
            principalShare = assets - profitShare; // Principle included in assets
            emit Fee(profitShare, fee);
        }

        uint256 amount = assets - fee; // Principle + 90% of Profit
        super._withdraw(caller, receiver, owner, amount, shares);

        if (fee > 0 && recipient != address(this)) {
            SafeERC20.safeTransfer(IERC20(asset()), recipient, fee);
        }

        (, uint256 remain) = deposits[caller].amount.trySub(principalShare);
        deposits[caller].amount = remain;
        deposits[caller].timestamp = block.timestamp;
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

    function _reserveRatio() internal view virtual returns (uint256) {
        return investRatio; // replace with e.g. 100 for 1%
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

    function _portionOnRaw(
        uint256 assets,
        uint256 ratio
    ) private pure returns (uint256) {
        return assets.mulDiv(ratio, _BASIS_POINT_SCALE, Math.Rounding.Ceil);
    }

    function _portionOnTotal(
        uint256 assets,
        uint256 ratio
    ) private pure returns (uint256) {
        return
            assets.mulDiv(
                ratio,
                ratio + _BASIS_POINT_SCALE,
                Math.Rounding.Ceil
            );
    }

    function totalAssets() public view override returns (uint256) {
        uint256 balKaia = address(this).balance;
        uint256 balWKaia = IERC20(asset()).balanceOf(address(this));
        uint256 balKoKaia = IERC20(koKaia).balanceOf(address(this));
        uint256 balWKoKaia = IERC20(getSwapToken(1)).balanceOf(address(this));
        return balKaia + balWKaia + balKoKaia + balWKoKaia;
    }

    function swap(uint256 amountIn) private returns (int256[] memory) {
        // wrap KoKAIA
        uint256 amount = amountIn + _portionOnRaw(amountIn, 1500);
        IERC20(koKaia).approve(getSwapToken(1), amount);
        IWKoKaia(getSwapToken(1)).wrap(amount);

        // approve
        IERC20(getSwapToken(1)).approve(address(vault), amountIn);

        // Prepare assets (as IAsset)
        IAsset[] memory assets = new IAsset[](3);
        assets[0] = IAsset(getSwapToken(1));
        assets[1] = IAsset(getSwapToken(2));
        assets[2] = IAsset(getSwapToken(3));

        // Set up BatchSwapStep[]
        IBalancerVault.BatchSwapStep[]
            memory steps = new IBalancerVault.BatchSwapStep[](2);
        steps[0] = IBalancerVault.BatchSwapStep({
            poolId: getSwapPool(1),
            assetInIndex: 0,
            assetOutIndex: 1,
            amount: amountIn,
            userData: ""
        });

        steps[1] = IBalancerVault.BatchSwapStep({
            poolId: getSwapPool(2),
            assetInIndex: 1,
            assetOutIndex: 2,
            amount: 0, // for multihop, set 0
            userData: ""
        });

        // Limit: positive = max input, negative = min output
        int256[] memory limits = new int256[](3);
        limits[0] = int256(amountIn); // max amountIn
        limits[1] = 0; // intermediate
        limits[2] = -1_000_000_000; // minimum amountOut (accept anything > 0)

        // Fund setup
        IBalancerVault.FundManagement memory funds = IBalancerVault
            .FundManagement({
                sender: address(this),
                fromInternalBalance: false,
                recipient: address(this),
                toInternalBalance: false
            });

        // Execute swap
        return
            IBalancerVault(vault).batchSwap(
                IBalancerVault.SwapKind.GIVEN_IN,
                steps,
                assets,
                funds,
                limits,
                block.timestamp + 600
            );
    }

    function setMaxDeposit(uint256 newValue) public virtual {
        depositLimit = newValue;
        emit MaxDeposit(newValue);
    }

    function setBasisPointsFees(uint256 newValue) public virtual {
        basisPointsFees = newValue; // 100 = 1%
        emit BasisPointsFees(newValue);
    }

    function setInvestRatio(uint256 newValue) public virtual {
        investRatio = newValue;
        emit InvestRatio(newValue);
    }

    function depositWithKaia(
        uint256 assets,
        address receiver
    ) public payable returns (uint256) {
        uint256 maxAssets = maxDeposit(receiver);
        if (assets > maxAssets) {
            revert ERC4626ExceededMaxDeposit(receiver, assets, maxAssets);
        }

        address caller = _msgSender();
        require(
            deposits[caller].amount + assets <= depositLimit,
            "Max. amount of deposit is over."
        );

        uint256 shares = previewDeposit(assets);
        _mint(receiver, shares);

        emit Deposit(caller, receiver, assets, shares);

        // Invest to GC Staking Pool
        uint256 amount = _portionOnRaw(assets, _reserveRatio());
        IKoKaia(koKaia).stake{value: amount}();

        // Update States
        deposits[caller].amount = deposits[caller].amount + assets;
        deposits[caller].timestamp = block.timestamp;

        return shares;
    }

    function withdrawWithKaia(
        uint256 assets,
        address receiver,
        address owner
    ) public virtual returns (uint256) {
        uint256 maxAssets = maxWithdraw(owner);
        if (assets > maxAssets) {
            revert ERC4626ExceededMaxWithdraw(owner, assets, maxAssets);
        }

        address caller = _msgSender();
        address recipient = _exitFeeRecipient();
        uint256 shares = previewWithdraw(assets);
        uint256 max = maxWithdraw(caller);

        uint256 balKaia = address(this).balance;
        if (assets > balKaia) {
            uint256 lack = assets - balKaia;
            uint256 _swap = lack + _portionOnRaw(lack, 2000); // Swap 20% more because of Slippage
            int256[] memory assetDeltas = swap(_swap);
            emit BatchSwap(assetDeltas[0], assetDeltas[1], assetDeltas[2]);

            IWKaia(asset()).withdraw(lack);
            require(
                address(this).balance >= assets,
                "Lack of WKAIA to withdraw"
            );
        }

        uint256 fee = 0;
        uint256 principalShare = assets;
        // assets = principalShare + profitShare
        if (max >= deposits[caller].amount) {
            uint256 profitShare = (assets * (max - deposits[caller].amount)) /
                max; // Profit included in assets

            fee = _feeOnTotal(profitShare, _exitFeeBasisPoints()); // 10% of Profit
            principalShare = assets - profitShare; // Principle included in assets
            emit Fee(profitShare, fee);
        }

        uint256 amount = assets - fee; // Principle + 90% of Profit

        if (caller != owner) {
            _spendAllowance(owner, caller, shares);
        }

        _burn(owner, shares);
        (bool rltReceiver, ) = payable(receiver).call{value: amount}("");
        require(rltReceiver, "Fail to send KAIA to the receiver");

        emit Withdraw(caller, receiver, owner, amount, shares);

        if (fee > 0 && recipient != address(this)) {
            (bool rltTreasury, ) = payable(recipient).call{value: fee}("");
            require(rltTreasury, "Fail to send KAIA to the treasury");
        }

        (, uint256 remain) = deposits[caller].amount.trySub(principalShare);
        deposits[caller].amount = remain;
        deposits[caller].timestamp = block.timestamp;

        return shares;
    }
}

contract KommuneVault is ERC4626FeesUpgradeable, OwnableUpgradeable {
    using Math for uint256;
    address payable public vaultOwner;
    int constant VERSION = 1;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        IERC20 _asset,
        uint256 basisPointsFees,
        uint256 investRatio,
        address treasury,
        address koKaia,
        address vault
    ) external initializer {
        __ERC20_init("Vault USDC Token", "vUSDC");
        __ERC4626_init(_asset);
        __ERC4626Fees_init(
            basisPointsFees,
            investRatio,
            treasury,
            koKaia,
            vault
        );
        __Ownable_init(msg.sender);

        vaultOwner = payable(msg.sender);
    }

    receive() external payable {}

    // TODO : TokenA → Pool1 → TokenB → Pool2 → TokenC
    function performBatchSwap(
        //        bytes32[] calldata poolIds, // [Pool1, Pool2]
        //        address[] calldata tokens, // [TokenA, TokenB, TokenC]
        uint256 amountIn
    ) external returns (int256[] memory) {
        //        require(tokens.length == 3, "only 2-hop swap supported");

        // wrap KoKAIA
        uint256 amount = amountIn +
            amountIn.mulDiv(1500, 10000, Math.Rounding.Ceil);
        IERC20(koKaia).approve(getSwapToken(1), amount);
        IWKoKaia(getSwapToken(1)).wrap(amount);

        // approve
        IERC20(getSwapToken(1)).approve(address(vault), amountIn);

        // Prepare assets (as IAsset)
        IAsset[] memory assets = new IAsset[](3);
        //        for (uint i = 0; i < 3; i++) {
        //            assets[i] = IAsset(tokens[i]);
        //        }
        assets[0] = IAsset(getSwapToken(1));
        assets[1] = IAsset(getSwapToken(2));
        assets[2] = IAsset(getSwapToken(3));

        // Set up BatchSwapStep[]
        IBalancerVault.BatchSwapStep[]
            memory steps = new IBalancerVault.BatchSwapStep[](2);
        steps[0] = IBalancerVault.BatchSwapStep({
            //            poolId: poolIds[0],
            poolId: getSwapPool(1),
            assetInIndex: 0,
            assetOutIndex: 1,
            amount: amountIn,
            userData: ""
        });

        steps[1] = IBalancerVault.BatchSwapStep({
            //            poolId: poolIds[1],
            poolId: getSwapPool(2),
            assetInIndex: 1,
            assetOutIndex: 2,
            amount: 0, // for multihop, set 0
            userData: ""
        });

        // Limit: positive = max input, negative = min output
        int256[] memory limits = new int256[](3);
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
        return
            IBalancerVault(vault).batchSwap(
                IBalancerVault.SwapKind.GIVEN_IN,
                steps,
                assets,
                funds,
                limits,
                block.timestamp + 600
            );
    }

    function setMaxDeposit(uint256 newValue) public override onlyOwner {
        super.setMaxDeposit(newValue);
    }

    function setBasisPointsFees(uint256 newValue) public override onlyOwner {
        super.setBasisPointsFees(newValue);
    }

    function setInvestRatio(uint256 newValue) public override onlyOwner {
        super.setInvestRatio(newValue);
    }

    function version() public view returns (int) {
        return VERSION;
    }
}
