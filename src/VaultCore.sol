// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IWKaia} from "./interfaces/IWKaia.sol";
import {TokenInfo} from "./interfaces/ITokenInfo.sol";
import {SwapContract} from "./SwapContract.sol";
import {IBalancerVault, IAsset} from "./interfaces/IBalancerVault.sol";
import {IBalancerVaultExtended} from "./interfaces/IBalancerVaultExtended.sol";
import {IWrappedLST} from "./interfaces/IWrappedLST.sol";
import {IKoKaia} from "./interfaces/IKoKaia.sol";
import {SharedStorage} from "./SharedStorage.sol";
import {LPCalculations} from "./libraries/LPCalculations.sol";

/**
 * @title VaultCore
 * @dev Core vault logic for managing LST assets
 * This contract handles staking, swapping, and asset management
 * Share management is handled by ShareVault
 * 
 * CRITICAL: Inherits from SharedStorage to ensure identical storage layout with ClaimManager
 * for safe delegatecall operations.
 */
contract VaultCore is SharedStorage, OwnableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;
    
    // All storage variables are inherited from SharedStorage
    // DO NOT add any storage variables here - add them to SharedStorage instead
    
    // Events
    event AssetsDeposited(uint256 amount);
    event AssetsWithdrawn(uint256 amount, address recipient);
    event KAIADeposited(uint256 amount);
    event StakeExecuted(uint256 amount);
    event SwapExecuted(uint256 index, uint256 amountIn, uint256 amountOut);
    event DirectDepositFrom(address indexed depositor, uint256 amount);
    event WrappedUnstake(address indexed user, uint256 indexed lstIndex, uint256 amount);
    event Claimed(address indexed user, uint256 indexed lstIndex, uint256 amount);
    event LiquidityAdded(uint256 indexed lstIndex, uint256 tokenAmount, uint256 lpReceived);
    event LiquidityRemoved(uint256 indexed lstIndex, uint256 lpAmount, uint256 tokenReceived);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev Initialize VaultCore
     */
    function initialize(
        address _wkaia,
        address _balancerVault,
        address _swapContract,
        uint256 _investRatio
    ) external initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        
        wkaia = _wkaia;
        balancerVault = _balancerVault;
        swapContract = _swapContract;
        investRatio = _investRatio;
        slippage = 1000; // 10% default slippage
        
        // Set default ratios - no LP creation initially
        // Can be changed later via setInvestmentRatios
        balancedRatio = 0;    // 0% of LSTs go to pool1
        aggressiveRatio = 0;  // 0% of LSTs go to pool2
        
        _initTokenInfo();
    }
    
    /**
     * @dev Initialize token information for LSTs based on chain ID
     */
    function _initTokenInfo() private {
        uint256 chainId = block.chainid;
        
        if (chainId == 8217) {
            // Mainnet (Kaia/Klaytn)
            _initMainnet();
        } else if (chainId == 1001) {
            // Testnet (Kairos)
            _initTestnet();
        } else {
            revert("Unsupported chain");
        }
    }
    
    /**
     * @dev Initialize token information for mainnet
     */
    function _initMainnet() private {
        address[4] memory handlers = [
            0xA1338309658D3Da331C747518d0bb414031F22fd,
            0x999999999939Ba65AbB254339eEc0b2A0daC80E9,
            0xF80F2b22932fCEC6189b9153aA18662b15CC9C00,
            0x42952B873ed6f7f0A7E4992E2a9818E3A9001995
        ];
        address[4] memory assets = [
            0xA1338309658D3Da331C747518d0bb414031F22fd, // KoKAIA - Kommune Dao
            0x999999999939Ba65AbB254339eEc0b2A0daC80E9, // GCKAIA - SwapScanner
            0xF80F2b22932fCEC6189b9153aA18662b15CC9C00, // stKLAY - Kracker Labs
            0x42952B873ed6f7f0A7E4992E2a9818E3A9001995  // stKAIA - Lair Finance
        ];
        address[4] memory tokenAs = [
            0xdEC2Cc84f0a37Ef917f63212FE8ba7494b0E4B15,
            0xa9999999c3D05Fb75cE7230e0D22F5625527d583,
            0x031fB2854029885E1D46b394c8B7881c8ec6AD63,
            0x42952B873ed6f7f0A7E4992E2a9818E3A9001995
        ];
        address tokenB = 0xA006e8dF6A3CBc66D4D707C97A9FDAf026096487;
        address tokenC = wkaia; // Use the initialized WKAIA address
        bytes32 pool1 = 0xa006e8df6a3cbc66d4d707c97a9fdaf026096487000000000000000000000000;
        bytes32 pool2 = 0x17f3eda2bf1aa1e7983906e675ac9a2ab6bc57de000000000000000000000001;
        
        for (uint256 i = 0; i < 4; i++) {
            tokensInfo[i] = TokenInfo(handlers[i], assets[i], tokenAs[i], tokenB, tokenC, pool1, pool2);
        }
    }
    
    /**
     * @dev Initialize token information for testnet (Kairos)
     * Simplified structure - all LSTs use the same pools and tokenB
     */
    function _initTestnet() private {
        address[4] memory handlers = [
            0xb15782EFbC2034E366670599F3997f94c7333FF9,
            0xe4c732f651B39169648A22F159b815d8499F996c,
            0x28B13a88E72a2c8d6E93C28dD39125705d78E75F,
            0x4C0d434C7DD74491A52375163a7b724ED387d0b6
        ];
        address[4] memory assets = [
            0xb15782EFbC2034E366670599F3997f94c7333FF9, // KoKAIA - Kommune DAO
            0x4EC04F4D46D7e34EBf0C3932B65068168FDcE7f6, // GCKAIA - SwapScanner
            0x524dCFf07BFF606225A4FA76AFA55D705B052004, // stKLAY - Kracker Labs
            0x45886b01276c45Fe337d3758b94DD8D7F3951d97  // stKAIA - Lair Finance
        ];
        address[4] memory tokenAs = [
            0x9a93e2fcDEBE43d0f8205D1cd255D709B7598317,
            0x324353670B23b16DFacBDE169Cd8ebF8C8bf6601,
            0x474B49DF463E528223F244670e332fE82742e1aA,
            0x45886b01276c45Fe337d3758b94DD8D7F3951d97
        ];
        
        // Simplified structure - same pools and tokenB for all LSTs
        bytes32 pool1 = 0xcc163330e85c34788840773e32917e2f51878b95000000000000000000000015;
        bytes32 pool2 = 0x6634d606f477a7fb14159839a9b7ad9ad4295436000000000000000000000016;
        address tokenB = 0xCC163330E85C34788840773E32917E2F51878B95; // Common intermediate token
        
        // Set the same pools for all LSTs
        for (uint256 i = 0; i < 4; i++) {
            tokensInfo[i] = TokenInfo(
                handlers[i], 
                assets[i], 
                tokenAs[i], 
                tokenB,     // Same tokenB for all
                wkaia,      // tokenC is always WKAIA
                pool1,      // Same pool1 for all
                pool2       // Same pool2 for all
            );
        }
    }
    
    /**
     * @dev Get total assets managed by this vault
     */
    function getTotalAssets() external view returns (uint256 total) {
        // Native KAIA balance
        total = address(this).balance;
        
        // WKAIA balance
        if (wkaia != address(0)) {
            total += IERC20(wkaia).balanceOf(address(this));
        }
        
        // Add LST balances (simplified to avoid revert)
        for (uint256 i = 0; i < 4; i++) {
            // Skip if token info not initialized
            if (tokensInfo[i].handler == address(0)) {
                continue;
            }
            
            uint256 lstBalance = 0;
            
            // Get unwrapped amount from wrapped token balance (tokenA) - except stKAIA (no wrapped token)
            if (i < 3 && tokensInfo[i].tokenA != address(0)) {
                try IERC20(tokensInfo[i].tokenA).balanceOf(address(this)) returns (uint256 balance) {
                    // The exchange rate between unwrapped and wrapped LST is not 1. (Not 1 vs. 1)
                    // wKoKAIA , wsdKLAY
                    if (i == 0 || i == 2) lstBalance += IWrappedLST(tokensInfo[i].tokenA).getUnwrappedAmount(balance);
                    // GCKAIA
                    else lstBalance += IWrappedLST(tokensInfo[i].tokenA).getGCKLAYByWGCKLAY(balance);
                } catch {
                    // Skip if balance call fails
                }
            }
            
            // For LSTs
            try IERC20(tokensInfo[i].asset).balanceOf(address(this)) returns (uint256 balance) {
                lstBalance += balance;
            } catch {
                // Skip if balance call fails
            }
            
            // LP tokens are handled separately after the loop
            
            // Add to total (1:1 ratio assumed for now)
            total += lstBalance;
        }
        
        // Add LP token value (all LSTs share same BPT at index 0)
        if (lpBalance > 0 && lpToken != address(0)) {
            uint256 lpValue = _calculateLPTokenValue(0, lpBalance);
            total += lpValue;
        }
        
        return total;
    }
    
    /**
     * @dev Handle deposit from ShareVault (Standard ERC4626 pattern)
     * ShareVault transfers WKAIA here, then calls this function
     * @param amount Amount of WKAIA transferred
     * @param depositor The address of the original depositor
     */
    function handleDeposit(uint256 amount, address depositor) external returns (bool) {
        if (msg.sender != shareVault) revert("E1");
        if (amount == 0) revert("E2");
        
        // Verify WKAIA was received
        uint256 wkaiaBalance = IERC20(wkaia).balanceOf(address(this));
        if (wkaiaBalance < amount) revert("E4");
        
        // Calculate total amount to invest based on investRatio
        uint256 amountToInvest = (amount * investRatio) / 10000;
        
        if (amountToInvest > 0) {
            if (wkaiaBalance < amountToInvest) revert("E5");
            
            // Unwrap WKAIA to KAIA for investment
            IWKaia(wkaia).withdraw(amountToInvest);
            
            // First invest all to get LSTs
            _processInvestment(amountToInvest);  // false = don't add to pool yet
            
            // Then add portion of LSTs to pools if configured
            if (balancedRatio > 0) {
                _addLSTsToPool1(balancedRatio);
            }
            
            if (aggressiveRatio > 0) {
                _investMEV(aggressiveRatio);
            }
            
            emit StakeExecuted(amountToInvest);
        }
        
        emit AssetsDeposited(amount);
        return true;
    }
    
    /**
     * @dev Handle native KAIA deposit from ShareVault
     */
    function handleDepositKAIA() external payable returns (bool) {
        if (msg.sender != shareVault) revert("E1");
        if (msg.value == 0) revert("E2");
        
        uint256 kaiaAmount = msg.value;
        
        // Calculate amount to invest (e.g., 90% of deposit)
        uint256 amountToInvest = (kaiaAmount * investRatio) / 10000;
        
        if (amountToInvest > 0) {
            // First invest all to get LSTs
            _processInvestment(amountToInvest);  // false = don't add to pool yet
            
            // Then add portion of LSTs to pools if configured
            if (balancedRatio > 0) {
                _addLSTsToPool1(balancedRatio);
            }
            
            if (aggressiveRatio > 0) {
                _investMEV(aggressiveRatio);
            }
            
            emit StakeExecuted(amountToInvest);
        }
        
        // Wrap remaining KAIA to WKAIA for liquidity
        uint256 remainingAmount = kaiaAmount - amountToInvest;
        if (remainingAmount > 0) {
            IWKaia(wkaia).deposit{value: remainingAmount}();
        }
        
        emit KAIADeposited(kaiaAmount);
        return true;
    }
    
    /**
     * @dev Handle withdrawal request from ShareVault
     */
    function handleWithdraw(uint256 amount, address recipient) external returns (bool) {
        if (msg.sender != shareVault) revert("E1");
        if (amount == 0) revert("E2");
        
        // Check WKAIA balance
        uint256 wkaiaBalance = IERC20(wkaia).balanceOf(address(this));
        
        if (wkaiaBalance >= amount) {
            // Direct transfer if we have enough WKAIA
            IERC20(wkaia).safeTransfer(recipient, amount);
        } else {
            // Need to swap LSTs to WKAIA
            uint256 needed = amount - wkaiaBalance;
            
            // Try to get WKAIA from LSTs via swap
            for (uint256 i = 0; i < 4 && needed > 0; i++) {
                TokenInfo memory info = tokensInfo[i];
                
                // Get available token balance for swap
                uint256 availableBalance = IERC20(info.tokenA).balanceOf(address(this));
                address tokenToSwap = info.tokenA;
                
                // Now swap if we have available tokens
                if (availableBalance > 0) {
                    // Calculate desired WKAIA output with slippage buffer (like KommuneVaultV2)
                    uint256 targetWKAIA = (needed * 110) / 100; // 10% buffer for slippage tolerance
                    
                    // Transfer the token to SwapContract
                    IERC20(tokenToSwap).safeTransfer(swapContract, availableBalance);
                    
                    // Get WKAIA balance before swap
                    uint256 wkaiaBefore = IERC20(wkaia).balanceOf(address(this));
                    
                    // Execute swap with conservative target to prevent input amount overflow
                    try SwapContract(swapContract).swapGivenOut(
                        info,
                        balancerVault,
                        targetWKAIA,    // WKAIA target with 10% buffer
                        availableBalance // Maximum LST input available
                    ) returns (int256[] memory deltas) {
                        // Calculate actual WKAIA received
                        uint256 wkaiaAfter = IERC20(wkaia).balanceOf(address(this));
                        uint256 wkaiaReceived = wkaiaAfter - wkaiaBefore;
                        
                        // Retrieve any unused LST from SwapContract
                        uint256 remainingLST = IERC20(tokenToSwap).balanceOf(swapContract);
                        if (remainingLST > 0) {
                            try SwapContract(swapContract).rescueToken(tokenToSwap, remainingLST) {
                                // Successfully retrieved unused tokens
                            } catch {
                                // If rescue fails, tokens remain in SwapContract
                                // This shouldn't happen with proper SwapContract implementation
                            }
                        }
                        
                        needed = needed > wkaiaReceived ? needed - wkaiaReceived : 0;
                        emit SwapExecuted(i, availableBalance - remainingLST, wkaiaReceived);
                    } catch (bytes memory reason) {
                        // If swap fails, try to retrieve the LST
                        try SwapContract(swapContract).rescueToken(tokenToSwap, availableBalance) {
                            // Retrieved the LST back
                        } catch {
                            // LST stuck in SwapContract
                        }
                        
                        // For debugging: check if it's a specific error we can handle
                        if (reason.length > 0) {
                            // Could add specific error handling here
                            // For now, continue to next LST
                        }
                    }
                }
            }
            
            // Transfer all available WKAIA
            wkaiaBalance = IERC20(wkaia).balanceOf(address(this));
            
            // If we still don't have enough after swaps, revert
            if (wkaiaBalance < amount) revert("E6");
            
            IERC20(wkaia).safeTransfer(recipient, amount);
        }
        
        emit AssetsWithdrawn(amount, recipient);
        return true;
    }
    
    /**
     * @dev Distribute KAIA to LSTs based on APY
     */
    function _distributToLSTs(uint256 amount) private {
        uint256 totalAPY = lstAPY[0] + lstAPY[1] + lstAPY[2] + lstAPY[3];
        if (totalAPY == 0) revert("E7");
        
        uint256 remaining = amount;
        
        for (uint256 i = 0; i < 4; i++) {
            if (lstAPY[i] > 0) {
                uint256 share = (amount * lstAPY[i]) / totalAPY;
                if (i == 3) {
                    share = remaining; // Last one gets the remainder
                }
                
                if (share > 0) {
                    _stakeToProtocol(i, share);
                    remaining -= share;
                }
            }
        }
    }
    
    /**
     * @dev Stake KAIA to specific protocol
     */
    function _stakeToProtocol(uint256 index, uint256 amount) private {
        TokenInfo memory info = tokensInfo[index];
        
        if (index == 3) {
            // stKAIA - use stake() function
            (bool success,) = info.handler.call{value: amount}(
                abi.encodeWithSignature("stake()")
            );
            if (!success) revert("E8");
        } else {
            // Other protocols - use stake() and wrap
            (bool success,) = info.handler.call{value: amount}(
                abi.encodeWithSignature("stake()")
            );
            if (!success) revert("E9");
            
            // Get the LST balance
            uint256 lstBalance = IERC20(info.asset).balanceOf(address(this));
            
            if (lstBalance > 0 && index < 3) {
                // Wrap the LST tokens
                IERC20(info.asset).approve(info.tokenA, lstBalance);
                (success,) = info.tokenA.call(
                    abi.encodeWithSignature("wrap(uint256)", lstBalance)
                );
                if (!success) revert("E10");
            }
        }
    }
    
    /**
     * @dev Process investment based on strategy (internal helper)
     * @param kaiaAmount Amount of KAIA to invest
     */
    function _processInvestment(uint256 kaiaAmount) private {
        // Distribute KAIA to LSTs based on APY
        _distributToLSTs(kaiaAmount);
    }
    
    /**
     * @dev Add portion of all LSTs to pool1 in a single transaction
     * @param ratio Percentage of LSTs to add (in basis points, e.g., 5000 = 50%)
     */
    function _addLSTsToPool1(uint256 ratio) private {
        // Based on tx analysis, the pool expects these tokens in sorted order:
        // [0]: 0x324353670B23b16DFacBDE169Cd8ebF8C8bf6601 (wGCKAIA)
        // [1]: 0x45886b01276c45Fe337d3758b94DD8D7F3951d97 (stKAIA)
        // [2]: 0x474B49DF463E528223F244670e332fE82742e1aA (wstKLAY)
        // [3]: 0x9a93e2fcDEBE43d0f8205D1cd255D709B7598317 (wKoKAIA)
        // [4]: 0xCC163330E85C34788840773E32917E2F51878B95 (BPT/tokenB - amount is 0)
        
        // Prepare arrays for joinPool
        IAsset[] memory assets = new IAsset[](5);
        uint256[] memory maxAmountsIn = new uint256[](5);
        bool hasLiquidity = false;
        
        // Set assets in the exact order from the transaction
        assets[0] = IAsset(tokensInfo[1].tokenA); // wGCKAIA (LST index 1)
        assets[1] = IAsset(tokensInfo[3].tokenA); // stKAIA  (LST index 3)
        assets[2] = IAsset(tokensInfo[2].tokenA); // wstKLAY (LST index 2)
        assets[3] = IAsset(tokensInfo[0].tokenA); // wKoKAIA (LST index 0)
        assets[4] = IAsset(tokensInfo[0].tokenB); // BPT/tokenB
        
        // Calculate and set amounts for each LST
        uint256[4] memory lstBalances;
        for (uint256 i = 0; i < 4; i++) {
            lstBalances[i] = IERC20(tokensInfo[i].tokenA).balanceOf(address(this));
        }
        
        // Set maxAmountsIn in the correct order
        if (lstBalances[1] > 0 && lstAPY[1] > 0) { // wGCKAIA
            maxAmountsIn[0] = (lstBalances[1] * ratio) / 10000;
            if (maxAmountsIn[0] > 0) {
                hasLiquidity = true;
                IERC20(tokensInfo[1].tokenA).approve(balancerVault, maxAmountsIn[0]);
            }
        }
        
        if (lstBalances[3] > 0 && lstAPY[3] > 0) { // stKAIA
            maxAmountsIn[1] = (lstBalances[3] * ratio) / 10000;
            if (maxAmountsIn[1] > 0) {
                hasLiquidity = true;
                IERC20(tokensInfo[3].tokenA).approve(balancerVault, maxAmountsIn[1]);
            }
        }
        
        if (lstBalances[2] > 0 && lstAPY[2] > 0) { // wstKLAY
            maxAmountsIn[2] = (lstBalances[2] * ratio) / 10000;
            if (maxAmountsIn[2] > 0) {
                hasLiquidity = true;
                IERC20(tokensInfo[2].tokenA).approve(balancerVault, maxAmountsIn[2]);
            }
        }
        
        if (lstBalances[0] > 0 && lstAPY[0] > 0) { // wKoKAIA
            maxAmountsIn[3] = (lstBalances[0] * ratio) / 10000;
            if (maxAmountsIn[3] > 0) {
                hasLiquidity = true;
                IERC20(tokensInfo[0].tokenA).approve(balancerVault, maxAmountsIn[3]);
            }
        }
        
        maxAmountsIn[4] = 0; // BPT - always 0
        
        // Only proceed if we have liquidity to add
        if (hasLiquidity) {
            // Use pool1 from tokensInfo[0] (all LSTs use same pool1 now)
            bytes32 poolId = tokensInfo[0].pool1;
            
            // Prepare JoinPoolRequest
            // userData needs only the first 4 amounts (LSTs), not the BPT
            uint256[] memory amountsForUserData = new uint256[](4);
            amountsForUserData[0] = maxAmountsIn[0]; // wGCKAIA
            amountsForUserData[1] = maxAmountsIn[1]; // stKAIA
            amountsForUserData[2] = maxAmountsIn[2]; // wstKLAY
            amountsForUserData[3] = maxAmountsIn[3]; // wKoKAIA
            
            IBalancerVaultExtended.JoinPoolRequest memory request = IBalancerVaultExtended.JoinPoolRequest({
                assets: assets,
                maxAmountsIn: maxAmountsIn,
                userData: abi.encode(1, amountsForUserData, 0), // JOIN_KIND_EXACT_TOKENS_IN_FOR_BPT_OUT = 1
                fromInternalBalance: false
            });
            
            // Get BPT balance before joinPool
            uint256 bptBefore = IERC20(tokensInfo[0].tokenB).balanceOf(address(this));
            
            // Join the pool and receive LP tokens
            IBalancerVaultExtended(balancerVault).joinPool(
                poolId,
                address(this), // sender
                address(this), // recipient
                request
            );
            
            // Get BPT balance after joinPool and calculate received amount
            uint256 bptAfter = IERC20(tokensInfo[0].tokenB).balanceOf(address(this));
            uint256 bptReceived = bptAfter - bptBefore;
            
            // Store LP token info (all LSTs share the same pool and BPT)
            if (bptReceived > 0) {
                lpToken = tokensInfo[0].tokenB; // Store BPT address
                lpBalance = bptAfter; // Store total BPT balance
                
                // Emit event with total LST amount and BPT received
                uint256 totalLSTAmount = maxAmountsIn[0] + maxAmountsIn[1] + maxAmountsIn[2] + maxAmountsIn[3];
                emit LiquidityAdded(0, totalLSTAmount, bptReceived);
            }
        }
    }
    
    /**
     * @dev Add portion of LSTs to pool2 for aggressive LP tokens (future)
     * @param ratio Percentage of LSTs to add (in basis points)
     */
    function _investMEV(uint256 ratio) private {
        // Future implementation for pool2
        // For now, keep LSTs as is
    }
    
    
    // Admin functions
    
    function setShareVault(address _shareVault) external onlyOwner {
        if (_shareVault == address(0)) revert("E11");
        shareVault = _shareVault;
    }
    
    /**
     * @dev Update token information - can be called after upgrade
     */
    function updateTokenInfo() external onlyOwner {
        _initTokenInfo();
    }
    
    
    function setSwapContract(address _swapContract) external onlyOwner {
        if (_swapContract == address(0)) revert("E11");
        swapContract = _swapContract;
    }
    
    function setInvestRatio(uint256 _investRatio) external onlyOwner {
        if (_investRatio > 10000) revert("E12");
        investRatio = _investRatio;
    }
    
    function setAPY(uint256 index, uint256 apy) external onlyOwner {
        if (index >= 4) revert("E3");
        lstAPY[index] = apy;
    }
    
    function setClaimManager(address _claimManager) external onlyOwner {
        if (_claimManager == address(0)) revert("E11");
        claimManager = _claimManager;
    }
    
    /**
     * @dev Set investment strategy ratios
     * @param _investRatio How much of deposits go to LST staking (e.g., 9000 = 90%)
     * @param _balancedRatio % of LSTs to add to pool1 (e.g., 5000 = 50%)
     * @param _aggressiveRatio % of LSTs to add to pool2 (e.g., 5000 = 50%)
     */
    function setInvestmentRatios(
        uint256 _investRatio,
        uint256 _balancedRatio,
        uint256 _aggressiveRatio
    ) external onlyOwner {
        if (_investRatio > 10000) revert("E12");
        if (_balancedRatio + _aggressiveRatio > 10000) revert("E13");
        
        investRatio = _investRatio;
        balancedRatio = _balancedRatio;
        aggressiveRatio = _aggressiveRatio;
    }
    
    
    /**
     * @dev Unwrap wrapped LST tokens (e.g., wKoKAIA to KoKAIA)
     * Required before unstaking for some protocols
     */
    function unwrapLST(uint256 lstIndex, uint256 amount) external onlyOwner returns (uint256) {
        if (lstIndex >= 3) revert("E14");
        if (amount == 0) revert("E2");
        
        TokenInfo memory info = tokensInfo[lstIndex];
        uint256 wrappedBalance = IERC20(info.tokenA).balanceOf(address(this));
        if (wrappedBalance < amount) revert("E15");
        
        // Use interface call instead of low-level call
        // This properly handles the return value and success status
        uint256 unwrappedAmount = IWrappedLST(info.tokenA).unwrap(amount);
        
        // Verify we received the KoKAIA/GcKAIA/stKLAY
        if (unwrappedAmount == 0) revert("E16");
        
        return unwrappedAmount;
    }
    
    /**
     * @dev Unstake wrapped LST tokens (wKoKAIA, wGcKAIA, wstKLAY)
     * For KoKAIA: Uses wKoKAIA directly without unwrapping
     * For others: Uses delegatecall to ClaimManager
     */
    function unstakeWrapped(address user, uint256 lstIndex, uint256 amount) external onlyOwner {
        if (lstIndex >= 3) revert("E14");
        if (amount == 0) revert("E2");
        if (user == address(0)) revert("E11");
        
        TokenInfo memory info = tokensInfo[lstIndex];
        
        // Check we have enough wrapped token balance
        uint256 wrappedBalance = IERC20(info.tokenA).balanceOf(address(this));
        if (wrappedBalance < amount) revert("E15");
        
        if (lstIndex == 0) {
            // For wKoKAIA: handler (KoKAIA contract) can process wKoKAIA unstake
            // Approve handler to spend our wKoKAIA
            IERC20(info.tokenA).approve(info.handler, amount);
            
            // Call unstake on KoKAIA handler with wKoKAIA approved
            // The handler will handle wKoKAIA and create unstake request
            IKoKaia(info.handler).unstake(amount);
            
            emit WrappedUnstake(user, lstIndex, amount);
        } else {
            // For wGcKAIA and wstKLAY, use ClaimManager
            if (claimManager == address(0)) revert("E17");
            (bool success, ) = claimManager.delegatecall(
                abi.encodeWithSignature("executeUnstakeWrapped(address,uint256,uint256)", user, lstIndex, amount)
            );
            if (!success) revert("E18");
        }
    }
    
    /**
     * @dev Unstake LST tokens for future claim
     * Requires 7 days waiting period before claim (10 min on testnet)
     * All LST unstakes are handled through ClaimManager via delegatecall
     */
    function unstake(address user, uint256 lstIndex, uint256 amount) external onlyOwner {
        if (lstIndex >= 4) revert("E3");
        if (amount == 0) revert("E2");
        if (user == address(0)) revert("E11");
        
        // Ensure we have enough LST balance
        TokenInfo memory info = tokensInfo[lstIndex];
        uint256 balance = IERC20(info.asset).balanceOf(address(this));
        if (balance < amount) revert("E19");
        
        // All LSTs including KoKAIA use ClaimManager via delegatecall
        require(claimManager != address(0), "ClaimManager not set");
        (bool success, bytes memory data) = claimManager.delegatecall(
            abi.encodeWithSignature("executeUnstake(address,uint256,uint256)", user, lstIndex, amount)
        );
        if (!success) revert("E20");
    }
    
    /**
     * @dev Claim unstaked assets after 7 days
     * Uses delegatecall to ClaimManager
     */
    function claim(address user, uint256 lstIndex) external onlyOwner returns (uint256) {
        require(claimManager != address(0), "ClaimManager not set");
        if (lstIndex >= 4) revert("E3");
        
        // Execute claim via delegatecall
        (bool success, bytes memory data) = claimManager.delegatecall(
            abi.encodeWithSignature("executeClaim(address,uint256)", user, lstIndex)
        );
        if (!success) revert("E21");
        
        uint256 claimedAmount = abi.decode(data, (uint256));
        
        // Wrap the claimed KAIA to WKAIA and keep it in VaultCore
        if (claimedAmount > 0 && address(this).balance >= claimedAmount) {
            IWKaia(wkaia).deposit{value: claimedAmount}();
            // WKAIA stays in VaultCore for protocol use
            emit Claimed(user, lstIndex, claimedAmount);
        }
        
        return claimedAmount;
    }
    
    /**
     * @dev Check if claim is ready for a user
     */
    function isClaimReady(address user, uint256 lstIndex) external view returns (bool) {
        require(claimManager != address(0), "ClaimManager not set");
        
        (bool success, bytes memory data) = claimManager.staticcall(
            abi.encodeWithSignature("isClaimReady(address,uint256)", user, lstIndex)
        );
        
        if (!success) return false;
        return abi.decode(data, (bool));
    }
    
    /**
     * @dev Get time until claim is ready
     */
    function getTimeUntilClaim(address user, uint256 lstIndex) external view returns (uint256) {
        require(claimManager != address(0), "ClaimManager not set");
        
        (bool success, bytes memory data) = claimManager.staticcall(
            abi.encodeWithSignature("getTimeUntilClaim(address,uint256)", user, lstIndex)
        );
        
        if (!success) return type(uint256).max;
        return abi.decode(data, (uint256));
    }
    
    /**
     * @dev Remove liquidity from Balancer pool (owner only)
     * @param lstIndex Index of the LST (0-3)
     * @param lpAmount Amount of LP tokens to remove
     */
    function removeLiquidity(uint256 lstIndex, uint256 lpAmount) external onlyOwner {
        if (lstIndex >= 4) revert("E3");
        if (lpAmount == 0) revert("E2");
        // All BPT is stored at index 0 since all LSTs share the same pool
        if (lpBalance < lpAmount) revert("E22");
        
        // Use same assets array as joinPool (5 tokens)
        IAsset[] memory assets = new IAsset[](5);
        assets[0] = IAsset(tokensInfo[1].tokenA); // wGCKAIA
        assets[1] = IAsset(tokensInfo[3].tokenA); // stKAIA
        assets[2] = IAsset(tokensInfo[2].tokenA); // wstKLAY
        assets[3] = IAsset(tokensInfo[0].tokenA); // wKoKAIA
        assets[4] = IAsset(tokensInfo[0].tokenB); // BPT
        
        // Minimum amounts out (0 = accept any amount)
        uint256[] memory minAmountsOut = new uint256[](5);
        // All zeros - accept any amount
        
        // Encode userData for EXACT_BPT_IN_FOR_ONE_TOKEN_OUT
        // ExitKind = 0, bptAmountIn, exitTokenIndex
        // We exit to the token that matches lstIndex
        uint256 exitTokenIndex;
        if (lstIndex == 0) exitTokenIndex = 3;      // wKoKAIA is at index 3
        else if (lstIndex == 1) exitTokenIndex = 0;  // wGCKAIA is at index 0
        else if (lstIndex == 2) exitTokenIndex = 2;  // wstKLAY is at index 2
        else exitTokenIndex = 1;                     // stKAIA is at index 1
        
        bytes memory userData = abi.encode(0, lpAmount, exitTokenIndex);
        
        // Approve BPT tokens for burning
        IERC20(tokensInfo[0].tokenB).approve(balancerVault, lpAmount);
        
        // Track balances before exit
        uint256[4] memory tokensBefore;
        for (uint256 i = 0; i < 4; i++) {
            tokensBefore[i] = IERC20(tokensInfo[i].tokenA).balanceOf(address(this));
        }
        
        // Exit the pool
        IBalancerVaultExtended.ExitPoolRequest memory request = IBalancerVaultExtended.ExitPoolRequest({
            assets: assets,
            minAmountsOut: minAmountsOut,
            userData: userData,
            toInternalBalance: false
        });
        
        IBalancerVaultExtended(balancerVault).exitPool(
            tokensInfo[0].pool1,  // Use pool1 from tokensInfo[0]
            address(this),
            payable(address(this)),
            request
        );
        
        // Calculate tokens received for the specific LST
        uint256 tokenAfter = IERC20(tokensInfo[lstIndex].tokenA).balanceOf(address(this));
        uint256 totalReceived = tokenAfter - tokensBefore[lstIndex];
        
        // Update LP balance
        // Update total BPT balance at index 0
        lpBalance -= lpAmount;
        
        emit LiquidityRemoved(lstIndex, lpAmount, totalReceived);
    }
    
    /**
     * @dev Helper function to find LP token from pool tokens
     * Note: For Balancer pools, tokenB IS the BPT (LP token)
     */
    function _findLPToken(
        address[] memory poolTokens,
        address tokenA,
        address tokenB
    ) private pure returns (address) {
        // For our setup, tokenB is actually the BPT (LP token)
        // So we just return tokenB directly
        return tokenB;
    }
    
    /**
     * @dev Calculate the underlying LST value of LP tokens
     * This calculates how much wrapped LST tokens would be received if LP tokens were removed
     * For Balancer Composable Stable Pools, we need to use circulating supply
     * @param lstIndex Index of the LST (0-3)
     * @param lpAmount Amount of LP tokens to value
     * @return underlyingAmount Amount of wrapped LST tokens the LP represents
     */
    function _calculateLPTokenValue(uint256 lstIndex, uint256 lpAmount) private view returns (uint256) {
        return LPCalculations.calculateLPTokenValue(
            lpAmount,
            lpToken,
            balancerVault,
            tokensInfo[lstIndex]
        );
    }
    
    /**
     * @dev Get the calculated underlying value of LP tokens for a specific LST
     * External view function for transparency
     * @param lstIndex Index of the LST (0-3)
     * @return underlyingValue Amount of wrapped LST the LP tokens represent
     */
    function getLPTokenValue(uint256 lstIndex) external view returns (uint256) {
        if (lstIndex >= 4) revert("E3");
        // All LSTs share the same pool and BPT
        return _calculateLPTokenValue(lstIndex, lpBalance);
    }
    
    /**
     * @dev Calculate the underlying value of a specific amount of LP tokens
     * External view function for transparency
     * @param lstIndex Index of the LST (0-3)
     * @param lpAmount Amount of LP tokens to value
     * @return underlyingValue Amount of wrapped LST the LP tokens represent
     */
    function calculateLPTokenValue(uint256 lstIndex, uint256 lpAmount) external view returns (uint256) {
        if (lstIndex >= 4) revert("E3");
        return _calculateLPTokenValue(lstIndex, lpAmount);
    }
    
    // ========== ASSET BALANCE FUNCTIONS ==========
    
    /**
     * @dev Get all vault asset balances
     * Returns arrays with 14 elements:
     * [0] KAIA, [1] WKAIA, [2-8] LST tokens, [9-12] BPT amounts, [13] BPT total value
     * @return balances Array of all asset balances
     */
    function getVaultAssets() external view returns (uint256[14] memory balances) {
        // [0] Native KAIA
        balances[0] = address(this).balance;
        
        // [1] WKAIA
        balances[1] = wkaia != address(0) ? IERC20(wkaia).balanceOf(address(this)) : 0;
        
        // [2-3] LST 0: KoKAIA / wKoKAIA
        if (tokensInfo[0].handler != address(0)) {
            balances[2] = IERC20(tokensInfo[0].asset).balanceOf(address(this));  // KoKAIA
            balances[3] = IERC20(tokensInfo[0].tokenA).balanceOf(address(this)); // wKoKAIA
        }
        
        // [4-5] LST 1: GCKAIA / wGCKAIA
        if (tokensInfo[1].handler != address(0)) {
            balances[4] = IERC20(tokensInfo[1].asset).balanceOf(address(this));  // GCKAIA
            balances[5] = IERC20(tokensInfo[1].tokenA).balanceOf(address(this)); // wGCKAIA
        }
        
        // [6-7] LST 2: stKLAY / wstKLAY
        if (tokensInfo[2].handler != address(0)) {
            balances[6] = IERC20(tokensInfo[2].asset).balanceOf(address(this));  // stKLAY
            balances[7] = IERC20(tokensInfo[2].tokenA).balanceOf(address(this)); // wstKLAY
        }
        
        // [8] LST 3: stKAIA
        if (tokensInfo[3].handler != address(0)) {
            balances[8] = IERC20(tokensInfo[3].asset).balanceOf(address(this));  // stKAIA
        }
        
        // [9] Total BPT balance (all LSTs share same pool)
        balances[9] = lpBalance;   // Total BPT
        
        // [10] BPT underlying value in WKAIA
        if (lpBalance > 0) {
            balances[10] = _calculateLPTokenValue(0, lpBalance);
        }
        
        // [11-13] Reserved for future use
        balances[11] = 0;
        balances[12] = 0;
        balances[13] = 0;
        
        return balances;
    }
    
    /**
     * @dev Get asset names for the getVaultAssets return values
     * @return names Array of asset names corresponding to balance indices
     */
    function getAssetNames() external pure returns (string[14] memory names) {
        names[0] = "KAIA";
        names[1] = "WKAIA";
        names[2] = "KoKAIA";
        names[3] = "wKoKAIA";
        names[4] = "GCKAIA";
        names[5] = "wGCKAIA";
        names[6] = "stKLAY";
        names[7] = "wstKLAY";
        names[8] = "stKAIA";
        names[9] = "BPT_Total";
        names[10] = "BPT_Value";
        names[11] = "Reserved";
        names[12] = "Reserved";
        names[13] = "Reserved";
        return names;
    }
    
    // ========== LP GETTER FUNCTIONS ==========
    
    

    // Required for UUPS
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    
    // Receive function to accept KAIA
    receive() external payable {}
}