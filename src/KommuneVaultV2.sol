// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC4626Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import {IAsset, IBalancerVault} from "./interfaces/IBalancerVault.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
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
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @dev ERC-4626 vault with entry/exit fees
abstract contract ERC4626FeesUpgradeable is ERC4626Upgradeable {
    using Math for uint256;

    uint256 private constant _BASIS_POINT_SCALE = 1e4;
    
    // stKAIA protocol constants
    address internal constant BugHole = 0x1856E6fDbF8FF701Fa1aB295E1bf229ABaB56899;
    
    uint256 public basisPointsFees;
    uint256 public investRatio;
    address public treasury;
    address public vault;
    uint256 public depositLimit;
    uint256 private slippage;
    
    address public emergencyAdmin;

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
    event StakingSuccess(uint256 indexed protocolIndex, uint256 amount);
    event StakingFailed(uint256 indexed protocolIndex, uint256 amount, string reason);
    event LSTWrapped(uint256 indexed protocolIndex, uint256 lstAmount, uint256 wrappedAmount);
    event LSTWrapFailed(uint256 indexed protocolIndex, uint256 amount, string reason);

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
        // Correct pool IDs from successful Balancer UI transactions
        bytes32 pool1_wKoKAIA = 0xdc1503e263d3cf33cf37fb4e5ca953ef20c9e5bb000200000000000000000018;
        bytes32 pool2_wKoKAIA = 0xc51ebf09fc3f6b2f02b3a1e957a39f88b019e6ae000200000000000000000003;
        bytes32 pool1_other = 0x7a665fb838477cbf719f5f34af4b7c1faebb7112000100000000000000000014;
        bytes32 pool2_other = 0x0c5da2fa11fc2d7eee16c06740072e3c5e1bb4a7000200000000000000000001;
        
        // Set correct pools for each LST
        // wKoKAIA (index 0) uses different pools
        tokensInfo[0] = TokenInfo(handlers[0], assets[0], tokenAs[0], 0xe8A9F4EB1215dd3EeD0E36D5ca82728DC93f0B48, 0x0339d5Eb6D195Ba90B13ed1BCeAa97EbD198b106, pool1_wKoKAIA, pool2_wKoKAIA);
        // wGCKAIA, wstKLAY, stKAIA (indices 1-3) use the same pools
        for (uint i = 1; i < 4; i++) {
            tokensInfo[i] = TokenInfo(handlers[i], assets[i], tokenAs[i], 0x985acD34f36D91768aD4b0cB295Aa919A7ABDb27, 0x0339d5Eb6D195Ba90B13ed1BCeAa97EbD198b106, pool1_other, pool2_other);
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
        require(assets > 0, "AMP");
        require(deposits[caller].amount + assets <= depositLimit, "DLE");
        
        uint256 newDepositAmount = deposits[caller].amount + assets;
        require(newDepositAmount >= deposits[caller].amount, "DAO");
        
        super._deposit(caller, receiver, assets, shares);

        uint256 amount = _portionOnRaw(assets, investRatio);
        require(amount <= assets, "IAE");

        uint256 balanceBefore = address(this).balance;
        IWKaia(asset()).withdraw(amount);
        uint256 balanceAfter = address(this).balance;
        require(balanceAfter >= balanceBefore + amount, "WWF");

        stake(amount);

        deposits[caller].amount = newDepositAmount;
        deposits[caller].timestamp = block.timestamp;
    }


    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal virtual override {
        require(assets > 0, "AMP");
        address recipient = treasury;
        uint256 max = maxWithdraw(owner);  // Fixed: use owner instead of caller
        require(max > 0, "NWA");

        uint256 balWKaia = IERC20(asset()).balanceOf(address(this));
        if (assets > balWKaia) {
            uint256 lack = assets - balWKaia;
            
            // First try to wrap native KAIA if available
            uint256 nativeBalance = address(this).balance;
            if (nativeBalance > 0) {
                uint256 toWrap = nativeBalance >= lack ? lack : nativeBalance;
                IWKaia(asset()).deposit{value: toWrap}();
                lack = lack > toWrap ? lack - toWrap : 0;
            }
            
            // If still not enough, use LST swaps
            if (lack > 0) {
                (uint256 idx, uint256 avail) = selectAsset(lack);
                if (avail >= lack) {
                    _performSmartSwap(idx, lack);
                } else {
                    execWithdraw(lack);
                }
            }
            // Allow up to 1% slippage tolerance in the final balance check
            uint256 currentBalance = IERC20(asset()).balanceOf(address(this));
            uint256 minimumAcceptable = (assets * 99) / 100;  // 99% of requested amount
            require(currentBalance >= minimumAcceptable, "IBA");
            
            // Adjust assets to actual amount received if less than requested
            if (currentBalance < assets) {
                assets = currentBalance;
            }
        }

        uint256 fee = 0;
        uint256 principal = assets;
        
        if (max > deposits[owner].amount && max > 0) {
            uint256 depositAmount = deposits[owner].amount;
            require(max >= depositAmount, "IWC");
            
            uint256 profitMultiplier = max - depositAmount;
            uint256 profit = (assets * profitMultiplier) / max;
            require(profit <= assets, "PCO");

            fee = _feeOnTotal(profit, basisPointsFees);
            require(assets >= profit, "APU");
            principal = assets - profit;
            emit Fee(profit, fee);
        }

        require(assets >= fee, "FEA");
        super._withdraw(caller, receiver, owner, assets - fee, shares);
        
        if (fee > 0 && recipient != address(this)) {
            require(IERC20(asset()).balanceOf(address(this)) >= fee, "IBF");
            SafeERC20.safeTransfer(IERC20(asset()), recipient, fee);
        }

        if (principal <= deposits[owner].amount) {
            deposits[owner].amount = deposits[owner].amount - principal;
        } else {
            deposits[owner].amount = 0;
        }
        deposits[owner].timestamp = block.timestamp;
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
        return assets.mulDiv(feeBasisPoints, feeBasisPoints + _BASIS_POINT_SCALE, Math.Rounding.Ceil);
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
        return assets.mulDiv(ratio, ratio + _BASIS_POINT_SCALE, Math.Rounding.Ceil);
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
            require(lstAPY[i] >= 10, "ATL");
            weights[i] = lstAPY[i] / 10;
            tw += weights[i];
        }
        require(tw > 0, "TWP");
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
        // Calculate the last distribution to avoid rounding errors
        distributions[3] = totalAmount - allocatedAmount;
    }

    function stake(uint256 amount) internal {
        require(amount > 0, "SMP");
        require(address(this).balance >= amount, "IBS");
        
        uint256[4] memory distributions = distAPY(amount);
        uint256 totalDistributed = 0;

        for (uint256 i = 0; i < 4; i++) {
            if (distributions[i] > 0) {
                require(tokensInfo[i].handler != address(0), "IHA");
                
                uint256 balanceBefore = IERC20(tokensInfo[i].asset).balanceOf(address(this));
                uint256 ethBalanceBefore = address(this).balance;
                
                bool success = false;
                if (i == 0) {
                    try IKoKaia(tokensInfo[i].handler).stake{value: distributions[i]}() {
                        success = true;
                    } catch {}
                } else if (i == 1) {
                    try IGcKaia(tokensInfo[i].handler).stake{value: distributions[i]}() {
                        success = true;
                    } catch {}
                } else if (i == 2) {
                    try IStKlay(tokensInfo[i].handler).stake{value: distributions[i]}() {
                        success = true;
                    } catch {}
                } else if (i == 3) {
                    try IStKaia(tokensInfo[i].handler).stake{value: distributions[i]}() {
                        success = true;
                    } catch {}
                }
                
                if (success) {
                    uint256 balanceAfter = IERC20(tokensInfo[i].asset).balanceOf(address(this));
                    uint256 ethBalanceAfter = address(this).balance;
                    
                    require(
                        balanceAfter > balanceBefore || ethBalanceAfter == ethBalanceBefore - distributions[i],
                        "SVF"
                    );
                    
                    // Wrap LST to Wrapped LST immediately after staking (except stKAIA)
                    if (i < 3) {  // KoKAIA, GCKAIA, stKLAY need wrapping
                        uint256 lstReceived = balanceAfter - balanceBefore;
                        if (lstReceived > 0) {
                            _wrapLST(i, lstReceived);
                        }
                    }
                    // stKAIA (i == 3) doesn't need wrapping as it doesn't have wrapped version
                    
                    totalDistributed += distributions[i];
                    emit StakingSuccess(i, distributions[i]);
                }
            }
        }
        
        require(totalDistributed > 0, "NSO");
    }

    function _wrapLST(uint256 protocolIndex, uint256 amount) internal {
        require(protocolIndex < 3, "Invalid protocol index for wrapping");
        require(amount > 0, "Amount must be greater than 0");
        
        address lstToken = tokensInfo[protocolIndex].asset;
        address wrappedToken = tokensInfo[protocolIndex].tokenA;
        
        // Check current allowance and only approve if needed
        uint256 currentAllowance = IERC20(lstToken).allowance(address(this), wrappedToken);
        if (currentAllowance < amount) {
            // Reset to 0 first, then approve exact amount needed
            IERC20(lstToken).approve(wrappedToken, 0);
            IERC20(lstToken).approve(wrappedToken, amount);
        }
        
        // Get wrapped balance before
        uint256 wrappedBalanceBefore = IWrapped(wrappedToken).balanceOf(address(this));
        
        // Wrap the LST
        try IWrapped(wrappedToken).wrap(amount) {
            // Verify wrapping was successful
            uint256 wrappedBalanceAfter = IWrapped(wrappedToken).balanceOf(address(this));
            uint256 wrappedReceived = wrappedBalanceAfter - wrappedBalanceBefore;
            require(wrappedReceived > 0, "Wrapping failed - no wrapped tokens received");
            
            emit LSTWrapped(protocolIndex, amount, wrappedReceived);
        } catch Error(string memory reason) {
            emit LSTWrapFailed(protocolIndex, amount, reason);
            // Even if wrapping fails, we continue as we still have the LST
        } catch {
            emit LSTWrapFailed(protocolIndex, amount, "Unknown wrapping error");
            // Even if wrapping fails, we continue as we still have the LST
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
        // Use actual APY values for sorting with safe division
        uint256[4] memory apys;
        for (uint256 i = 0; i < 4; i++) {
            if (lstAPY[i] >= 10) {
                apys[i] = lstAPY[i] / 10;
                // Verify no overflow occurred
                require(apys[i] <= lstAPY[i], "APY division overflow");
            } else {
                apys[i] = 0;
            }
        }
        sorted = [uint256(0), 1, 2, 3];

        // Bubble sort with bounds checking
        for (uint256 i = 0; i < 3; i++) {
            for (uint256 j = 0; j < 3 - i; j++) {
                if (apys[j] > apys[j + 1]) {
                    (apys[j], apys[j + 1]) = (apys[j + 1], apys[j]);
                    (sorted[j], sorted[j + 1]) = (sorted[j + 1], sorted[j]);
                }
            }
        }
    }

    function estimateSwap(uint256 index, uint256 amountOut) internal returns (int256[] memory) {
        // Call SwapContract's estimateSwapGivenOut function
        return swapContract.estimateSwapGivenOut(tokensInfo[index], vault, amountOut);
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
            // stKAIA unstaking logic (no wrapped version)
            uint256 targetAmount = (amt * 110) / 100; // 10% buffer for stKAIA
            uint256 needed;
            unchecked {
                needed = IStKaia(tokensInfo[index].asset).getRatioStakingTokenByNativeToken(targetAmount);
                if (needed > balances[index].balance) needed = balances[index].balance;
            }

            if (needed > 0) {
                SafeERC20.forceApprove(IERC20(tokensInfo[index].asset), tokensInfo[index].handler, needed);
                IStKaia(tokensInfo[index].handler).unstake(BugHole, address(this), needed);

                uint256 kaia = address(this).balance;
                if (kaia > 0) IWKaia(asset()).deposit{value: kaia}();
            }
        } else {
            // For KoKAIA, GCKAIA, stKLAY - we already have wrapped tokens
            // Use estimateSwap to verify GIVEN_OUT swap is possible
            
            uint256 availableWrapped = balances[index].wrapBal;
            
            if (availableWrapped > 0) {
                // Add 3% buffer for slippage
                uint256 amountWithBuffer = (amt * 103) / 100;
                
                // Make sure we don't request more than theoretically possible
                if (amountWithBuffer > balances[index].totalValue) {
                    amountWithBuffer = balances[index].totalValue;
                }
                
                // First estimate the swap to check if we have enough wrapped tokens
                int256[] memory estimatedDeltas = estimateSwap(index, amountWithBuffer);
                
                // Check if the required input amount exceeds our available wrapped balance
                // estimatedDeltas[0] is negative (amount in), so we need to convert to positive
                uint256 requiredInput = estimatedDeltas[0] < 0 ? uint256(-estimatedDeltas[0]) : uint256(estimatedDeltas[0]);
                
                // If we don't have enough wrapped tokens, adjust the output amount
                uint256 actualAmountOut = amountWithBuffer;
                if (requiredInput > availableWrapped) {
                    // Calculate the maximum output we can get with available wrapped tokens
                    // Proportionally reduce the output amount
                    actualAmountOut = (amountWithBuffer * availableWrapped) / requiredInput;
                    
                    // Make sure we at least try to get the minimum required amount
                    if (actualAmountOut < amt) {
                        actualAmountOut = amt;  // Try with original amount without buffer
                    }
                }
                
                // Transfer wrapped tokens to SwapContract
                SafeERC20.safeTransfer(IERC20(tokensInfo[index].tokenA), address(swapContract), availableWrapped);
                
                // Execute GIVEN_OUT swap with adjusted amount
                int256[] memory deltas = swapContract.swapGivenOut(tokensInfo[index], vault, actualAmountOut, availableWrapped);
                emit BatchSwap(deltas[0], deltas[1], deltas[2]);
                
                // Safe absolute value conversion using SafeCast
                uint256 absValue;
                if (deltas[2] >= 0) {
                    absValue = SafeCast.toUint256(deltas[2]);
                } else {
                    // Handle negative values safely
                    if (deltas[2] == type(int256).min) {
                        // Special case: type(int256).min cannot be negated safely
                        revert("Swap delta too negative");
                    } else {
                        absValue = SafeCast.toUint256(-deltas[2]);
                    }
                }
                emit SwapInfo(index, amt, absValue);
            }
        }
    }
}

contract KVaultV2 is ERC4626FeesUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable {
    using Math for uint256;
    address payable public vaultOwner;
    

    mapping(address => bool) public operators;


    event Operator(uint256 indexed, address indexed);
    event APYUpdated(uint256 indexed index, uint256 oldAPY, uint256 newAPY);
    event EmergencyPause(address indexed admin, uint256 timestamp);
    event EmergencyUnpause(address indexed admin, uint256 timestamp);

    function _initDefaultAPY() private {
        lstAPY[0] = 5000;
        lstAPY[1] = 5000;
        lstAPY[2] = 5000;
        lstAPY[3] = 5000;
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
        __ReentrancyGuard_init();
        __Pausable_init();

        vaultOwner = payable(msg.sender);
        operators[msg.sender] = true;
        emergencyAdmin = msg.sender;
        
        swapContract = SwapContract(_swapContract);
        _initTokenInfo();
        _initDefaultAPY();
    }

    receive() external payable {}

    // Override ERC4626 functions to add security modifiers
    function deposit(uint256 assets, address receiver) public virtual override nonReentrant whenNotPaused returns (uint256) {
        return super.deposit(assets, receiver);
    }

    function mint(uint256 shares, address receiver) public virtual override nonReentrant whenNotPaused returns (uint256) {
        return super.mint(shares, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner) public virtual override nonReentrant whenNotPaused returns (uint256) {
        return super.withdraw(assets, receiver, owner);
    }

    function redeem(uint256 shares, address receiver, address owner) public virtual override nonReentrant whenNotPaused returns (uint256) {
        return super.redeem(shares, receiver, owner);
    }



    
    function setAPY(uint256 index, uint256 apy) public onlyOwner {
        require(index < 4, "IPI");
        require(apy <= 10000, "APY");
        
        uint256 oldAPY = lstAPY[index] / 10;
        lstAPY[index] = apy * 10;
        emit APYUpdated(index, oldAPY, apy);
    }

    function getAPY(uint256 index) public view returns (uint256) {
        require(index < 4, "II");
        return lstAPY[index] / 10;
    }
    function setMultipleAPY(uint256[4] calldata apyValues) external onlyOwner {
        for (uint256 i = 0; i < 4; i++) {
            require(apyValues[i] <= 10000, "APY");
            uint256 oldAPY = lstAPY[i] / 10;
            lstAPY[i] = apyValues[i] * 10;
            emit APYUpdated(i, oldAPY, apyValues[i]);
        }
    }

    function getAllAPY() public view returns (uint256[4] memory) {
        uint256[4] memory apys;
        for (uint256 i = 0; i < 4; i++) {
            apys[i] = lstAPY[i] / 10;
        }
        return apys;
    }

    function addOperator(address addr) public onlyOwner {
        operators[addr] = true;
        emit Operator(1, addr);
    }

    
    function emergencyPause() external {
        require(msg.sender == emergencyAdmin || msg.sender == owner(), "NA");
        _pause();
        emit EmergencyPause(msg.sender, block.timestamp);
    }
    function emergencyUnpause() external onlyOwner {
        _unpause();
        emit EmergencyUnpause(msg.sender, block.timestamp);
    }

    function unstake(uint256 index, uint256 amount) public onlyOwner nonReentrant {
        require(index < 4, "II");
        if (index == 0) IKoKaia(tokensInfo[index].handler).unstake(amount);
        else if (index == 1) IGcKaia(tokensInfo[index].handler).unstake(amount);
        else if (index == 2) IStKlay(tokensInfo[index].handler).unstake(amount);
        else IStKaia(tokensInfo[index].handler).unstake(BugHole, msg.sender, amount);
    }

    function claim(uint256 index, address user) public onlyOwner nonReentrant {
        require(index < 4, "II");
        if (index == 0) IKoKaia(tokensInfo[index].handler).claim(user);
        else if (index == 1) {
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
                    (,uint256 withdrawableFrom, WithdrawalRequestState state) = IGcKaia(
                        tokensInfo[index].handler
                    ).withdrawalRequestInfo(ids[i]);
                    if (state == WithdrawalRequestState.Unknown && withdrawableFrom < block.timestamp) {
                        IGcKaia(tokensInfo[index].handler).claim(ids[i]);
                    }
                }
            }
        }
        else if (index == 2) IStKlay(tokensInfo[index].handler).claim(user);
        else if (index == 3) {
            uint256 length = IStKaia(tokensInfo[index].handler)
                .getUnstakeRequestInfoLength(user);
            UnstakeInfo[] memory infos = IStKaia(tokensInfo[index].handler)
                .getUnstakeInfos(
                    user,
                    0,
                    length
                );
            for (uint256 i; i < infos.length; ++i) {
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
