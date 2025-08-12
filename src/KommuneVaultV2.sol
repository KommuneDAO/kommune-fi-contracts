// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC4626Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import {IAsset, IBalancerVault} from "./interfaces/IBalancerVault.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./interfaces/IGcKaia.sol";
import {IKoKaia} from "./interfaces/IKoKaia.sol";
import "./interfaces/IStKaia.sol";
import {IStKlay} from "./interfaces/IStKlay.sol";
import {IWKaia} from "./interfaces/IWKaia.sol";
import {IWrapped} from "./interfaces/IWrapped.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SwapContract} from "./SwapContract.sol";
import {TokenInfo} from "./interfaces/ITokenInfo.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @dev ERC-4626 vault with entry/exit fees
abstract contract ERC4626FeesUpgradeable is ERC4626Upgradeable {
    using Math for uint256;

    uint256 private constant _BASIS_POINT_SCALE = 1e4;
    uint256 public basisPointsFees;
    uint256 public investRatio;
    address public treasury;
    address public vault;
    uint256 public depositLimit;
    uint256 private slippage;

    mapping(uint256 => uint256) public lstAPY;

    struct DepositInfo {
        uint256 amount;
        uint256 timestamp;
    }
    mapping(address => DepositInfo) public deposits;

    mapping(uint256 => TokenInfo) public tokensInfo;
    SwapContract public swapContract;

    event BatchSwap(
        int256 indexed delta0,
        int256 indexed delta1,
        int256 indexed delta2
    );
    event SwapInfo(uint256 indexed, uint256 indexed, uint256 indexed);
    event EstimateSwap(uint256, int256 indexed, int256 indexed, int256 indexed);
    event Fee(uint256 indexed, uint256 indexed);
    event MaxDeposit(uint256 indexed);
    event BasisPointsFees(uint256 indexed);
    event InvestRatio(uint256 indexed);
    event Slippage(uint256 indexed);
    event MultiAssetWithdraw(uint256 indexed amt, uint256 indexed used, uint256 swp);

    function _initTokenInfo() internal {
        uint256 id;
        assembly { id := chainid() }
        if (id == 8217) _initMainnet(); else _initTestnet();
    }

    function _initMainnet() private {
        address[4] memory handlers = [0xA1338309658D3Da331C747518d0bb414031F22fd, 0x999999999939Ba65AbB254339eEc0b2A0daC80E9, 0xF80F2b22932fCEC6189b9153aA18662b15CC9C00, 0x42952B873ed6f7f0A7E4992E2a9818E3A9001995];
        address[4] memory assets = [0xA1338309658D3Da331C747518d0bb414031F22fd, 0x999999999939Ba65AbB254339eEc0b2A0daC80E9, 0xF80F2b22932fCEC6189b9153aA18662b15CC9C00, 0x42952B873ed6f7f0A7E4992E2a9818E3A9001995];
        address[4] memory tokenAs = [0xdEC2Cc84f0a37Ef917f63212FE8ba7494b0E4B15, 0xa9999999c3D05Fb75cE7230e0D22F5625527d583, 0x031fB2854029885E1D46b394c8B7881c8ec6AD63, 0x42952B873ed6f7f0A7E4992E2a9818E3A9001995];
        address tokenB = 0xA006e8dF6A3CBc66D4D707C97A9FDAf026096487;
        address tokenC = 0x19Aac5f612f524B754CA7e7c41cbFa2E981A4432;
        bytes32 pool1 = 0xa006e8df6a3cbc66d4d707c97a9fdaf026096487000000000000000000000000;
        bytes32 pool2 = 0x17f3eda2bf1aa1e7983906e675ac9a2ab6bc57de000000000000000000000001;
        for (uint i = 0; i < 4; i++) {
            tokensInfo[i] = TokenInfo(handlers[i], assets[i], tokenAs[i], tokenB, tokenC, pool1, pool2);
        }
    }

    function _initTestnet() private {
        address[4] memory handlers = [0xb15782EFbC2034E366670599F3997f94c7333FF9, 0xe4c732f651B39169648A22F159b815d8499F996c, 0x28B13a88E72a2c8d6E93C28dD39125705d78E75F, 0x4C0d434C7DD74491A52375163a7b724ED387d0b6];
        address[4] memory assets = [0xb15782EFbC2034E366670599F3997f94c7333FF9, 0x4EC04F4D46D7e34EBf0C3932B65068168FDcE7f6, 0x524dCFf07BFF606225A4FA76AFA55D705B052004, 0x45886b01276c45Fe337d3758b94DD8D7F3951d97];
        address[4] memory tokenAs = [0x9a93e2fcDEBE43d0f8205D1cd255D709B7598317, 0x324353670B23b16DFacBDE169Cd8ebF8C8bf6601, 0x474B49DF463E528223F244670e332fE82742e1aA, 0x45886b01276c45Fe337d3758b94DD8D7F3951d97];
        bytes32 pool1_0 = 0x8193fe745f2784b1f55e51f71145d2b8b0739b8100020000000000000000000e;
        bytes32 pool1_other = 0x7a665fb838477cbf719f5f34af4b7c1faebb7112000100000000000000000014;
        bytes32 pool2 = 0x0c5da2fa11fc2d7eee16c06740072e3c5e1bb4a7000200000000000000000001;
        for (uint i = 0; i < 4; i++) {
            tokensInfo[i] = TokenInfo(handlers[i], assets[i], tokenAs[i], 0x985acD34f36D91768aD4b0cB295Aa919A7ABDb27, 0x0339d5Eb6D195Ba90B13ed1BCeAa97EbD198b106, i == 0 ? pool1_0 : pool1_other, pool2);
        }
    }

    function __ERC4626Fees_init(
        uint256 _basisPointsFees,
        uint256 _investRatio,
        address _treasury,
        address _vault
    ) internal onlyInitializing {
        basisPointsFees = _basisPointsFees;
        investRatio = _investRatio;
        treasury = _treasury;
        vault = _vault;
        depositLimit = 100 * 1e18;
        slippage = 1000;
    }


    function previewDeposit(
        uint256 assets
    ) public view virtual override returns (uint256) {
        // uint256 fee = _feeOnTotal(assets, _entryFeeBasisPoints());
        // return super.previewDeposit(assets - fee);
        return super.previewDeposit(assets);
    }

    function previewMint(
        uint256 shares
    ) public view virtual override returns (uint256) {
        // uint256 assets = super.previewMint(shares);
        // return assets + _feeOnRaw(assets, _entryFeeBasisPoints());
        return super.previewMint(shares);
    }

    function _deposit(
        address caller,
        address receiver,
        uint256 assets,
        uint256 shares
    ) internal virtual override {
        require(
            deposits[caller].amount + assets <= depositLimit,
""
        );
        super._deposit(caller, receiver, assets, shares);

        uint256 amount = _portionOnRaw(assets, investRatio);

        IWKaia(asset()).withdraw(amount);

        stake(amount);

        deposits[caller].amount = deposits[caller].amount + assets;
        deposits[caller].timestamp = block.timestamp;
    }


    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal virtual override {
        address recipient = treasury;
        uint256 max = maxWithdraw(caller);

        uint256 balWKaia = IERC20(asset()).balanceOf(address(this));
        if (assets > balWKaia) {
            uint256 lack = assets - balWKaia;
            (uint256 idx, uint256 avail) = selectAsset(lack);
            if (avail >= lack) {
                _performSmartSwap(idx, lack);
            } else {
                execWithdraw(lack);
            }
            require(IERC20(asset()).balanceOf(address(this)) >= assets, "");
        }

        uint256 fee = 0;
        uint256 principal = assets;
        if (max >= deposits[caller].amount) {
            uint256 profit = (assets * (max - deposits[caller].amount)) /
                max; // Profit included in assets

            fee = _feeOnTotal(profit, basisPointsFees);
            principal = assets - profit;
            emit Fee(profit, fee);
        }

        super._withdraw(caller, receiver, owner, assets - fee, shares);
        // 원금 제외, 수익에 대해서만 10%의 Protocol Fee 부과
        if (fee > 0 && recipient != address(this)) {
            SafeERC20.safeTransfer(IERC20(asset()), recipient, fee);
        }

        (, uint256 remain) = deposits[caller].amount.trySub(principal);
        deposits[caller].amount = remain;
        deposits[caller].timestamp = block.timestamp;
    }




    function _feeOnRaw(
        uint256 assets,
        uint256 feeBasisPoints
    ) private pure returns (uint256) {
        return
assets.mulDiv(feeBasisPoints, _BASIS_POINT_SCALE, Math.Rounding.Ceil);
    }

    function _feeOnTotal(
        uint256 assets,
        uint256 feeBasisPoints
    ) private pure returns (uint256) {
        return
assets.mulDiv(feeBasisPoints, feeBasisPoints + _BASIS_POINT_SCALE, Math.Rounding.Ceil);
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
assets.mulDiv(ratio, ratio + _BASIS_POINT_SCALE, Math.Rounding.Ceil);
    }

    function totalAssets() public view override returns (uint256) {
        uint256 balKaia = address(this).balance;
        uint256 balWKaia = IWKaia(asset()).balanceOf(address(this));
        uint256 sum = balKaia + balWKaia;

        if (tokensInfo[0].asset != address(0)) {
            sum = sum + IKoKaia(tokensInfo[0].asset).balanceOf(address(this));
            uint256 num1 = IWrapped(tokensInfo[0].tokenA).balanceOf(address(this));
            uint256 uw1 = IWrapped(tokensInfo[0].tokenA).getUnwrappedAmount(
                num1
            );
            sum = sum + uw1;

            sum = sum + IGcKaia(tokensInfo[1].asset).balanceOf(address(this));
            uint256 num2 = IWrapped(tokensInfo[1].tokenA).balanceOf(address(this));
            sum = sum + IWrapped(tokensInfo[1].tokenA).getGCKLAYByWGCKLAY(num2);

            sum = sum + IStKlay(tokensInfo[2].asset).balanceOf(address(this));
            uint256 num3 = IWrapped(tokensInfo[2].tokenA).balanceOf(address(this));
            uint256 uw3 = IWrapped(tokensInfo[2].tokenA).getUnwrappedAmount(
                num3
            );
            sum = sum + uw3;

            uint256 num4 = IStKaia(tokensInfo[3].asset).balanceOf(address(this));
            sum =
                sum +
                IStKaia(tokensInfo[3].asset).getRatioNativeTokenByStakingToken(
                    num4
                );
        }

        return sum;
    }

    function swap(uint256 index, uint256 amountIn, uint256 numWrap) public returns (int256[] memory) {
        return swapContract.swap(tokensInfo[index], vault, amountIn, numWrap);
    }

    function estimateSwap(uint256 index, uint256 amountOut) public returns (uint256) {
        uint256 result = swapContract.estimateSwap(tokensInfo[index], vault, amountOut);
        emit EstimateSwap(index, int256(result), 0, 0);
        return result;
    }

    function setMaxDeposit(uint256 newValue) public virtual {
        depositLimit = newValue;
        emit MaxDeposit(newValue);
    }

    function setBasisPointsFees(uint256 newValue) public virtual {
        basisPointsFees = newValue;
        emit BasisPointsFees(newValue);
    }

    function setInvestRatio(uint256 newValue) public virtual {
        investRatio = newValue;
        emit InvestRatio(newValue);
    }

    function setSlippage(uint256 newValue) public virtual {
        slippage = newValue;
        emit Slippage(newValue);
    }

    function calcWeight()
        internal
        view
        returns (uint256[4] memory weights, uint256 tw)
    {
        tw = 0;
        for (uint256 i = 0; i < 4; i++) {
            // Use actual APY values for weight calculation (divide by 10 to get original percentage)
            weights[i] = lstAPY[i] / 10;
            tw += weights[i];
        }
        require(tw > 0, "");
    }

    function distAPY(
        uint256 totalAmount
    ) internal view returns (uint256[4] memory distributions) {
        (
            uint256[4] memory weights,
            uint256 tw
        ) = calcWeight();

        uint256 allocatedAmount = 0;
        for (uint256 i = 0; i < 3; i++) {
            distributions[i] = (totalAmount * weights[i]) / tw;
            allocatedAmount += distributions[i];
        }
        distributions[3] = totalAmount - allocatedAmount;
    }

    function stake(uint256 amount) internal {
        uint256[4] memory distributions = distAPY(amount);

        for (uint256 i = 0; i < 4; i++) {
            if (distributions[i] > 0) {
                if (i == 0) {
                    IKoKaia(tokensInfo[i].handler).stake{
                        value: distributions[i]
                    }();
                } else if (i == 1) {
                    IGcKaia(tokensInfo[i].handler).stake{
                        value: distributions[i]
                    }();
                } else if (i == 2) {
                    IStKlay(tokensInfo[i].handler).stake{
                        value: distributions[i]
                    }();
                } else if (i == 3) {
                    IStKaia(tokensInfo[i].handler).stake{
                        value: distributions[i]
                    }();
                }
            }
        }
    }

    struct AssetBalance {
        uint256 balance;
        uint256 wrapBal;
        uint256 totalValue;
    }

    function getLSTBalances() internal view returns (AssetBalance[4] memory balances) {
        for (uint256 i = 0; i < 4; i++) {
            // Get asset balance safely
            try IERC20(tokensInfo[i].asset).balanceOf(address(this)) returns (uint256 balance) {
                balances[i].balance = balance;
            } catch {
                balances[i].balance = 0;
            }
            
            if (i < 3) {
                // Get wrapped balance safely
                try IWrapped(tokensInfo[i].tokenA).balanceOf(address(this)) returns (uint256 wrapBalance) {
                    balances[i].wrapBal = wrapBalance;
                } catch {
                    balances[i].wrapBal = 0;
                }
                
                uint256 uw = 0;
                if (balances[i].wrapBal > 0) {
                    if (i == 1) {
                        uw = balances[i].wrapBal;
                    } else {
                        try IWrapped(tokensInfo[i].tokenA).getUnwrappedAmount(balances[i].wrapBal) returns (uint256 unwrapped) {
                            uw = unwrapped;
                        } catch {
                            uw = balances[i].wrapBal; // Fallback to 1:1 ratio
                        }
                    }
                }
                
                balances[i].totalValue = balances[i].balance + uw;
                
            } else {
                balances[i].wrapBal = 0;
                try IStKaia(tokensInfo[i].asset).getRatioNativeTokenByStakingToken(balances[i].balance) returns (uint256 ratio) {
                    balances[i].totalValue = ratio;
                } catch {
                    balances[i].totalValue = balances[i].balance; // Fallback to 1:1 ratio
                }
            }
        }
    }

    struct WithdrawPlan {
        uint256[] indices;
        uint256[] amounts;
        uint256 totAvail;
    }

    function selectAsset(
        uint256 amt
    ) internal view returns (uint256 idx, uint256 avail) {
        AssetBalance[4] memory balances = getLSTBalances();

        idx = 0;
        avail = 0;

        for (uint256 i = 0; i < 4; i++) {
            if (
                balances[i].totalValue >= amt &&
                balances[i].totalValue > avail
            ) {
                idx = i;
                avail = balances[i].totalValue;
            }
        }

        if (avail == 0) {
            for (uint256 i = 0; i < 4; i++) {
                if (balances[i].totalValue > avail) {
                    idx = i;
                    avail = balances[i].totalValue;
                }
            }
        }
    }

    function planWithdraw(
        uint256 amt
    ) internal view returns (WithdrawPlan memory plan) {
        AssetBalance[4] memory balances = getLSTBalances();

        plan.indices = new uint256[](4);
        plan.amounts = new uint256[](4);
        plan.totAvail = 0;

        uint256 rem = amt;
        uint256 cnt = 0;

        uint256[4] memory sorted = getSorted();

        for (uint256 i = 0; i < 4 && rem > 0; i++) {
            uint256 idx = sorted[i];
            if (balances[idx].totalValue > 0) {
                uint256 use = rem > balances[idx].totalValue ?
                    balances[idx].totalValue : rem;

                plan.indices[cnt] = idx;
                plan.amounts[cnt] = use;
                plan.totAvail += use;
                rem = rem > use ? rem - use : 0;
                cnt++;
            }
        }

        uint256[] memory fin = new uint256[](cnt);
        uint256[] memory finAmt = new uint256[](cnt);

        for (uint256 i = 0; i < cnt; i++) {
            fin[i] = plan.indices[i];
            finAmt[i] = plan.amounts[i];
        }

        plan.indices = fin;
        plan.amounts = finAmt;
    }

    function getSorted() internal view returns (uint256[4] memory sorted) {
        // Use actual APY values for sorting (safely divide by 10 to get original percentage)
        uint256[4] memory apys = [
            lstAPY[0] > 0 ? lstAPY[0] / 10 : 0, 
            lstAPY[1] > 0 ? lstAPY[1] / 10 : 0, 
            lstAPY[2] > 0 ? lstAPY[2] / 10 : 0, 
            lstAPY[3] > 0 ? lstAPY[3] / 10 : 0
        ];
        sorted = [uint256(0), 1, 2, 3];

        for (uint256 i = 0; i < 3; i++) {
            for (uint256 j = 0; j < 3 - i; j++) {
                if (apys[j] > apys[j + 1]) {
                    (apys[j], apys[j + 1]) = (apys[j + 1], apys[j]);
                    (sorted[j], sorted[j + 1]) = (sorted[j + 1], sorted[j]);
                }
            }
        }
    }

    function execWithdraw(uint256 amt) internal {
        WithdrawPlan memory plan = planWithdraw(amt);

        require(plan.totAvail >= amt, "");

        uint256 used = 0;
        uint256 initBal = IERC20(asset()).balanceOf(address(this));

        for (uint256 i = 0; i < plan.indices.length; i++) {
            if (plan.amounts[i] > 0) {
                _performSmartSwap(plan.indices[i], plan.amounts[i]);
                used++;
            }
        }

        uint256 finalBal = IERC20(asset()).balanceOf(address(this));
        uint256 swp = finalBal > initBal ? finalBal - initBal : 0;
        emit MultiAssetWithdraw(amt, used, swp);
    }


    function _performSmartSwap(uint256 index, uint256 amt) internal {
        if (amt == 0) return;
        
        AssetBalance[4] memory balances = getLSTBalances();
        if (balances[index].totalValue == 0) return;

        if (index == 3) {
            // stKAIA unstaking logic
            uint256 targetAmount = (amt * 110) / 100; // 10% buffer for stKAIA
            uint256 needed;
            unchecked {
                needed = IStKaia(tokensInfo[index].asset).getRatioStakingTokenByNativeToken(targetAmount);
                if (needed > balances[index].balance) needed = balances[index].balance;
            }

            if (needed > 0) {
                IERC20(tokensInfo[index].asset).approve(tokensInfo[index].handler, 0);
                IERC20(tokensInfo[index].asset).approve(tokensInfo[index].handler, needed);
                IStKaia(tokensInfo[index].handler).unstake(0x1856E6fDbF8FF701Fa1aB295E1bf229ABaB56899, address(this), needed);

                uint256 kaia = address(this).balance;
                if (kaia > 0) IWKaia(asset()).deposit{value: kaia}();
            }
        } else {
            // Step 1: estimateSwap으로 필요한 wrapped token 양 계산
            uint256 requiredWrapped;
            try this.estimateSwap(index, amt) returns (uint256 estimated) {
                requiredWrapped = (estimated * 105) / 100; // 5% buffer for safety
            } catch {
                requiredWrapped = (amt * 120) / 100; // More conservative fallback
            }
            
            // Step 2: 현재 wrapped balance 확인
            uint256 currentWrapped = balances[index].wrapBal;
            uint256 assetToWrap = 0;
            
            if (requiredWrapped > currentWrapped) {
                uint256 needToWrap = requiredWrapped - currentWrapped;
                
                // Step 3: getUnwrappedAmount로 필요한 asset 양 계산
                if (index == 0 || index == 2) {
                    try IWrapped(tokensInfo[index].tokenA).getUnwrappedAmount(needToWrap) returns (uint256 unwrapped) {
                        assetToWrap = unwrapped;
                    } catch { assetToWrap = (needToWrap * 101) / 100; }
                } else {
                    try IWrapped(tokensInfo[index].tokenA).getGCKLAYByWGCKLAY(needToWrap) returns (uint256 gck) {
                        assetToWrap = gck;
                    } catch { assetToWrap = (needToWrap * 101) / 100; }
                }
                
                // Step 4: Asset 잔액으로 제한하고 wrap 실행
                if (assetToWrap > balances[index].balance) {
                    assetToWrap = balances[index].balance;
                }
                
                if (assetToWrap > 0) {
                    IERC20(tokensInfo[index].asset).approve(tokensInfo[index].tokenA, 0);
                    IERC20(tokensInfo[index].asset).approve(tokensInfo[index].tokenA, assetToWrap);
                    
                    uint256 balanceBefore = IWrapped(tokensInfo[index].tokenA).balanceOf(address(this));
                    IWrapped(tokensInfo[index].tokenA).wrap(assetToWrap);
                    uint256 balanceAfter = IWrapped(tokensInfo[index].tokenA).balanceOf(address(this));
                    require(balanceAfter > balanceBefore, "Wrap failed");
                }
            }
            
            // Step 5: 실제 swap 실행
            uint256 finalWrapped = IWrapped(tokensInfo[index].tokenA).balanceOf(address(this));
            if (finalWrapped > 0) {
                // SwapContract로 wrapped token 전송
                IERC20(tokensInfo[index].tokenA).transfer(address(swapContract), finalWrapped);
                
                int256[] memory deltas = swap(index, finalWrapped, 0); // numWrap=0 since we already wrapped
                emit BatchSwap(deltas[0], deltas[1], deltas[2]);
                
                // Safe absolute value conversion
                uint256 absValue;
                unchecked {
                    if (deltas[2] >= 0) {
                        absValue = uint256(deltas[2]);
                    } else {
                        int256 negValue = deltas[2];
                        if (negValue == type(int256).min) {
                            absValue = uint256(type(int256).max) + 1;
                        } else {
                            absValue = uint256(-negValue);
                        }
                    }
                }
                emit SwapInfo(index, amt, absValue);
            }
        }
    }
}

contract KVaultV2 is ERC4626FeesUpgradeable, OwnableUpgradeable {
    using Math for uint256;
    address payable public vaultOwner;
    int constant V = 2;

    mapping(address => bool) public operators;


    event Operator(uint256 indexed, address indexed);
    event APYUpdated(uint256 indexed index, uint256 oldAPY, uint256 newAPY);

    function _initDefaultAPY() private {
        // Set default APY values (in percentage format with 2 decimals)
        // Values are stored as basis points (multiply by 10)
        // These are example values - should be updated with real APY data
        lstAPY[0] = 500 * 10; // 5.00% -> stored as 5000 basis points
        lstAPY[1] = 500 * 10; // 5.00% -> stored as 5000 basis points
        lstAPY[2] = 500 * 10; // 5.00% -> stored as 5000 basis points
        lstAPY[3] = 500 * 10; // 5.00% -> stored as 5000 basis points
    }

    function initialize(
        IERC20 _asset,
        uint256 basisPointsFees,
        uint256 investRatio,
        address treasury,
        address vault,
        address _swapContract
    ) external initializer {
        __ERC20_init("Kommune Vault Kaia", "kvKAIA");
        __ERC4626_init(_asset);
        __ERC4626Fees_init(basisPointsFees, investRatio, treasury, vault);
        __Ownable_init(msg.sender);

        vaultOwner = payable(msg.sender);
        operators[msg.sender] = true;
        operators[0x5415a7f2556170CbB001B7a72b2d972362839FbE] = true;
        
        swapContract = SwapContract(_swapContract);
        _initTokenInfo();
        _initDefaultAPY();
    }

    receive() external payable {}

    // TODO : TokenA → Pool1 → TokenB → Pool2 → TokenC
    //    function performBatchSwap(
    //        uint256 index,
    //        uint256 amountIn
    //    ) external returns (int256[] memory) {
    //        // wrap Asset
    //        uint256 amount = amountIn +
    //            amountIn.mulDiv(1500, 10000, Math.Rounding.Ceil);
    //        IERC20(tokensInfo[index].asset).approve(
    //            tokensInfo[index].tokenA,
    //            amount
    //        );
    //        IWrapped(tokensInfo[index].tokenA).wrap(amount);
    //
    //    //        IERC20(tokensInfo[index].tokenA).approve(address(vault), amountIn);
    //
    //        // Prepare assets (as IAsset)
    //        IAsset[] memory assets = new IAsset[](3);
    //        assets[0] = IAsset(tokensInfo[index].tokenA);
    //        assets[1] = IAsset(tokensInfo[index].tokenB);
    //        assets[2] = IAsset(tokensInfo[index].tokenC);
    //
    //        // Set up BatchSwapStep[]
    //        IBalancerVault.BatchSwapStep[]
    //            memory steps = new IBalancerVault.BatchSwapStep[](2);
    //        steps[0] = IBalancerVault.BatchSwapStep({
    //            poolId: tokensInfo[index].pool1,
    //            assetInIndex: 0,
    //            assetOutIndex: 1,
    //            amount: amountIn,
    //        });
    //
    //        steps[1] = IBalancerVault.BatchSwapStep({
    //            poolId: tokensInfo[index].pool2,
    //            assetInIndex: 1,
    //            assetOutIndex: 2,
    //            amount: 0, // for multihop, set 0
    //        });
    //
    //        // Limit: positive = max input, negative = min output
    //        int256[] memory limits = new int256[](3);
    //        limits[0] = int256(amountIn); // max amountIn
    //        limits[1] = 0; // intermediate
    //        limits[2] = -1_000_000_000; // minimum amountOut (accept anything > 0)
    //
    //        // Fund setup
    //        IBalancerVault.FundManagement memory funds = IBalancerVault
    //            .FundManagement({
    //                sender: address(this),
    //                fromInternalBalance: false,
    //                recipient: msg.sender,
    //                toInternalBalance: false
    //            });
    //
    //        // Execute swap
    //        return
    //            IBalancerVault(vault).batchSwap(
    //                IBalancerVault.SwapKind.GIVEN_IN,
    //                steps,
    //                assets,
    //                funds,
    //                limits,
    //                block.timestamp + 600
    //            );
    //    }

    function setMaxDeposit(uint256 newValue) public override onlyOwner {
        super.setMaxDeposit(newValue);
    }

    function setBasisPointsFees(uint256 newValue) public override onlyOwner {
        super.setBasisPointsFees(newValue);
    }

    function setInvestRatio(uint256 newValue) public override onlyOwner {
        super.setInvestRatio(newValue);
    }

    function version() public pure returns (int) {
        return 2;
    }

    function setAPY(uint256 index, uint256 apy) public {
        require(operators[msg.sender], "");
        require(index < 4, "Invalid index");
        require(apy <= 10000, "APY too high"); // Max 100.00%
        /*
         * APY format: percentage with 2 decimals (e.g., 5.25% = 525)
         * Stored as basis points for calculations (525 -> 5250)
         * 0: KoKAIA (KommuneDAO)
         * 1: GCKAIA (Swapscanner)
         * 2: stKLAY (Kracker Labs)
         * 3: stKAIA (Lair Finance)
         */
        uint256 oldAPY = lstAPY[index] / 10;
        lstAPY[index] = apy * 10; // Convert to basis points (525 -> 5250)
        emit APYUpdated(index, oldAPY, apy);
    }

    function getAPY(uint256 index) public view returns (uint256) {
        require(index < 4, "Invalid index");
        return lstAPY[index] / 10; // Convert back to percentage format
    }

    function getAPYInBasisPoints(uint256 index) public view returns (uint256) {
        require(index < 4, "Invalid index");
        return lstAPY[index]; // Return raw basis points
    }

    function setMultipleAPY(uint256[4] calldata apyValues) external {
        require(operators[msg.sender], "");
        for (uint256 i = 0; i < 4; i++) {
            require(apyValues[i] <= 10000, "APY too high");
            uint256 oldAPY = lstAPY[i] / 10;
            lstAPY[i] = apyValues[i] * 10;
            emit APYUpdated(i, oldAPY, apyValues[i]);
        }
    }

    function getAllAPY() external view returns (uint256[4] memory) {
        return [lstAPY[0] / 10, lstAPY[1] / 10, lstAPY[2] / 10, lstAPY[3] / 10];
    }

    function addOperator(address addr) public onlyOwner {
        operators[addr] = true;
        emit Operator(1, addr);
    }

    function removeOperator(address addr) public onlyOwner {
        operators[addr] = false;
        emit Operator(2, addr);
    }

    function unstake(uint256 index, uint256 amount) public onlyOwner {
        if (index == 0) {
            IKoKaia(tokensInfo[index].handler).unstake(amount);
        }
        if (index == 1) {
            IGcKaia(tokensInfo[index].handler).unstake(amount);
        }
        if (index == 2) {
            IStKlay(tokensInfo[index].handler).unstake(amount);
        }
        if (index == 3) {
            IStKaia(tokensInfo[index].handler).unstake(
                0x1856E6fDbF8FF701Fa1aB295E1bf229ABaB56899, // BugHole
                msg.sender,
                amount
            );
        }
    }

    function claim(uint256 index, address user) public onlyOwner {
        if (index == 0) {
            IKoKaia(tokensInfo[index].handler).claim(user);
        }
        if (index == 1) {
            uint256 id;
            assembly {
                id := chainid()
            }
            if (id == 8217) {
                IERC721Enumerable uGCKAIA = IERC721Enumerable(
                    0x000000000fa7F32F228e04B8bffFE4Ce6E52dC7E
                );
                uint256 count = uGCKAIA.balanceOf(user);
                uint256[] memory ids = new uint256[](count);

                for (uint256 i; i < count; ++i) {
                    ids[i] = uGCKAIA.tokenOfOwnerByIndex(user, i);
                }
                for (uint256 i; i < count; ++i) {
                    // How to check it is over 1 week ?
                    uint256 value;
                    uint256 withdrawableFrom;
                    WithdrawalRequestState state;
                    // uint256 stakeLockup = IGcKaia(tokensInfo[index].handler)
                    //     .withdrawalRequestTTL();

                    (value, withdrawableFrom, state) = IGcKaia(
                        tokensInfo[index].handler
                    ).withdrawalRequestInfo(ids[i]);
                    if (state == WithdrawalRequestState.Unknown) {
                        // if (withdrawableFrom + stakeLockup < block.timestamp) {
                        // // Expired - restake
                        // } else
                        if (withdrawableFrom < block.timestamp) {
                            IGcKaia(tokensInfo[index].handler).claim(ids[i]);
                        }
                        // else {
                        // // Pending - not yet claimable
                        // }
                    }
                }
            }
        }
        if (index == 2) {
            IStKlay(tokensInfo[index].handler).claim(user);
        }
        if (index == 3) {
            uint256 length = IStKaia(tokensInfo[index].handler)
                .getUnstakeRequestInfoLength(user);
            UnstakeInfo[] memory infos = IStKaia(tokensInfo[index].handler)
                .getUnstakeInfos(
                    user,
                    0, // 1st page
                    length
                );

            for (uint256 i; i < infos.length; ++i) {
                // Over 1 week
                if (infos[i].unstakeTime + 604800 < block.timestamp) {
                    IStKaia(tokensInfo[index].handler).claim(
                        user,
                        infos[i].unstakeId
                    );
                }
            }
        }
    }
}
