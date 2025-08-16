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

/**
 * @title VaultCore
 * @dev Core vault logic for managing LST assets
 * This contract handles staking, swapping, and asset management
 * Share management is handled by ShareVault
 */
contract VaultCore is OwnableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;
    
    // ShareVault contract that manages shares
    address public shareVault;
    
    // Asset addresses
    address public wkaia; // WKAIA address
    address public balancerVault;
    
    // Helper contracts
    address public swapContract;
    address public claimManager;
    
    // LST configuration
    mapping(uint256 => TokenInfo) public tokensInfo;
    mapping(uint256 => uint256) public lstAPY;
    
    // Investment parameters
    uint256 public investRatio; // How much to stake vs keep liquid (basis points)
    uint256 public slippage; // Slippage tolerance for swaps
    
    // Events
    event AssetsDeposited(uint256 amount);
    event AssetsWithdrawn(uint256 amount, address recipient);
    event KAIADeposited(uint256 amount);
    event StakeExecuted(uint256 amount);
    event SwapExecuted(uint256 index, uint256 amountIn, uint256 amountOut);
    event DirectDepositFrom(address indexed depositor, uint256 amount);
    
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
            0xA1338309658D3Da331C747518d0bb414031F22fd,
            0x999999999939Ba65AbB254339eEc0b2A0daC80E9,
            0xF80F2b22932fCEC6189b9153aA18662b15CC9C00,
            0x42952B873ed6f7f0A7E4992E2a9818E3A9001995
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
     */
    function _initTestnet() private {
        address[4] memory handlers = [
            0xb15782EFbC2034E366670599F3997f94c7333FF9,
            0xe4c732f651B39169648A22F159b815d8499F996c,
            0x28B13a88E72a2c8d6E93C28dD39125705d78E75F,
            0x4C0d434C7DD74491A52375163a7b724ED387d0b6
        ];
        address[4] memory assets = [
            0xb15782EFbC2034E366670599F3997f94c7333FF9,
            0x4EC04F4D46D7e34EBf0C3932B65068168FDcE7f6,
            0x524dCFf07BFF606225A4FA76AFA55D705B052004,
            0x45886b01276c45Fe337d3758b94DD8D7F3951d97
        ];
        address[4] memory tokenAs = [
            0x9a93e2fcDEBE43d0f8205D1cd255D709B7598317,
            0x324353670B23b16DFacBDE169Cd8ebF8C8bf6601,
            0x474B49DF463E528223F244670e332fE82742e1aA,
            0x45886b01276c45Fe337d3758b94DD8D7F3951d97
        ];
        
        // Correct pool IDs from KommuneVaultV2 _initTestnet()
        bytes32 pool1_wKoKAIA = 0x8193fe745f2784b1f55e51f71145d2b8b0739b8100020000000000000000000e;
        bytes32 pool2_wKoKAIA = 0x0c5da2fa11fc2d7eee16c06740072e3c5e1bb4a7000200000000000000000001;
        bytes32 pool1_other = 0x7a665fb838477cbf719f5f34af4b7c1faebb7112000100000000000000000014;
        bytes32 pool2_other = 0x0c5da2fa11fc2d7eee16c06740072e3c5e1bb4a7000200000000000000000001;
        
        // Set correct pools for each LST
        // wKoKAIA (index 0) uses different pool1 but same tokenB as others
        tokensInfo[0] = TokenInfo(
            handlers[0], 
            assets[0], 
            tokenAs[0], 
            0x985acD34f36D91768aD4b0cB295Aa919A7ABDb27, 
            wkaia, 
            pool1_wKoKAIA, 
            pool2_wKoKAIA
        );
        
        // wGCKAIA, wstKLAY, stKAIA (indices 1-3) use the same pools
        for (uint256 i = 1; i < 4; i++) {
            tokensInfo[i] = TokenInfo(
                handlers[i], 
                assets[i], 
                tokenAs[i], 
                0x985acD34f36D91768aD4b0cB295Aa919A7ABDb27, 
                wkaia, 
                pool1_other, 
                pool2_other
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
        total += IERC20(wkaia).balanceOf(address(this));
        
        // Add LST balances (converted to WKAIA value)
        for (uint256 i = 0; i < 4; i++) {
            uint256 lstBalance = 0;
            
            if (i < 3) {
                // For LSTs with separate wrapped versions (index 0-2)
                // Count both unwrapped and wrapped balances
                lstBalance = IERC20(tokensInfo[i].asset).balanceOf(address(this));
                uint256 wrappedBalance = IERC20(tokensInfo[i].tokenA).balanceOf(address(this));
                lstBalance += wrappedBalance;
            } else {
                // For stKAIA (index 3), asset and tokenA are the same
                // Only count once to avoid duplication
                lstBalance = IERC20(tokensInfo[i].asset).balanceOf(address(this));
            }
            
            // For now, assume 1:1 ratio for LST to KAIA/WKAIA
            // In production, this should use actual exchange rates from oracles or pools
            total += lstBalance;
        }
        
        return total;
    }
    
    /**
     * @dev Handle direct deposit where WKAIA is already in VaultCore
     * This avoids the ShareVault -> VaultCore transfer and state sync issues
     * @param amount Amount of WKAIA already received
     * @param depositor The address of the original depositor
     */
    function handleDirectDeposit(uint256 amount, address depositor) public returns (bool) {
        require(msg.sender == shareVault, "Only ShareVault");
        require(amount > 0, "Zero amount");
        
        // WKAIA is already here, just verify balance
        uint256 wkaiaBalance = IERC20(wkaia).balanceOf(address(this));
        require(wkaiaBalance >= amount, "Insufficient WKAIA");
        
        // Calculate amount to stake
        uint256 amountToStake = (amount * investRatio) / 10000;
        
        if (amountToStake > 0) {
            // Direct balance check - no transfer just happened, state should be stable
            require(wkaiaBalance >= amountToStake, "Insufficient WKAIA for stake");
            
            // Unwrap WKAIA to KAIA for staking
            IWKaia(wkaia).withdraw(amountToStake);
            
            // Distribute to LSTs based on APY
            _distributToLSTs(amountToStake);
            
            emit StakeExecuted(amountToStake);
        }
        
        emit AssetsDeposited(amount);
        emit DirectDepositFrom(depositor, amount);
        return true;
    }
    
    /**
     * @dev Handle deposit from ShareVault (deprecated - use handleDirectDeposit)
     * Kept for backward compatibility but redirects to handleDirectDeposit
     */
    function handleDeposit(uint256 amount) external returns (bool) {
        require(msg.sender == shareVault, "Only ShareVault");
        // Redirect to handleDirectDeposit with msg.sender as depositor
        return handleDirectDeposit(amount, msg.sender);
    }
    
    /**
     * @dev Handle native KAIA deposit from ShareVault
     */
    function handleDepositKAIA() external payable returns (bool) {
        require(msg.sender == shareVault, "Only ShareVault");
        require(msg.value > 0, "Zero amount");
        
        uint256 amount = msg.value;
        
        // Calculate amount to stake
        uint256 amountToStake = (amount * investRatio) / 10000;
        uint256 amountToWrap = amount - amountToStake;
        
        if (amountToStake > 0) {
            // Distribute to LSTs based on APY
            _distributToLSTs(amountToStake);
            
            emit StakeExecuted(amountToStake);
        }
        
        // Wrap remaining KAIA to WKAIA
        if (amountToWrap > 0) {
            IWKaia(wkaia).deposit{value: amountToWrap}();
        }
        
        emit KAIADeposited(amount);
        return true;
    }
    
    /**
     * @dev Handle withdrawal request from ShareVault
     */
    function handleWithdraw(uint256 amount, address recipient) external returns (bool) {
        require(msg.sender == shareVault, "Only ShareVault");
        require(amount > 0, "Zero amount");
        
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
            require(wkaiaBalance >= amount, "Insufficient WKAIA after swaps");
            
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
        require(totalAPY > 0, "No APY set");
        
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
            require(success, "stKAIA stake failed");
        } else {
            // Other protocols - use stake() and wrap
            (bool success,) = info.handler.call{value: amount}(
                abi.encodeWithSignature("stake()")
            );
            require(success, "LST stake failed");
            
            // Get the LST balance
            uint256 lstBalance = IERC20(info.asset).balanceOf(address(this));
            
            if (lstBalance > 0 && index < 3) {
                // Wrap the LST tokens
                IERC20(info.asset).approve(info.tokenA, lstBalance);
                (success,) = info.tokenA.call(
                    abi.encodeWithSignature("wrap(uint256)", lstBalance)
                );
                require(success, "Wrap failed");
            }
        }
    }
    
    
    // Admin functions
    
    function setShareVault(address _shareVault) external onlyOwner {
        require(_shareVault != address(0), "Invalid address");
        shareVault = _shareVault;
    }
    
    /**
     * @dev Update token information - can be called after upgrade
     */
    function updateTokenInfo() external onlyOwner {
        _initTokenInfo();
    }
    
    
    function setSwapContract(address _swapContract) external onlyOwner {
        require(_swapContract != address(0), "Invalid address");
        swapContract = _swapContract;
    }
    
    function setInvestRatio(uint256 _investRatio) external onlyOwner {
        require(_investRatio <= 10000, "Invalid ratio");
        investRatio = _investRatio;
    }
    
    function setAPY(uint256 index, uint256 apy) external onlyOwner {
        require(index < 4, "Invalid index");
        lstAPY[index] = apy;
    }
    
    function setClaimManager(address _claimManager) external onlyOwner {
        require(_claimManager != address(0), "Invalid address");
        claimManager = _claimManager;
    }
    
    /**
     * @dev Unstake LST tokens for future claim
     * Requires 7 days waiting period before claim
     * Uses delegatecall to ClaimManager to reduce contract size
     */
    function unstake(address user, uint256 lstIndex, uint256 amount) external onlyOwner {
        require(claimManager != address(0), "ClaimManager not set");
        require(lstIndex < 4, "Invalid LST index");
        require(amount > 0, "Amount must be positive");
        
        // Ensure we have enough LST balance
        TokenInfo memory info = tokensInfo[lstIndex];
        uint256 balance = lstIndex == 3 ? 
            IERC20(info.asset).balanceOf(address(this)) :
            IERC20(info.tokenA).balanceOf(address(this));
        require(balance >= amount, "Insufficient LST balance");
        
        // Unwrap if needed (for non-stKAIA)
        if (lstIndex < 3) {
            (bool success,) = info.tokenA.call(
                abi.encodeWithSignature("unwrap(uint256)", amount)
            );
            require(success, "Unwrap failed");
        }
        
        // Execute unstake via delegatecall
        (bool success, bytes memory data) = claimManager.delegatecall(
            abi.encodeWithSignature("executeUnstake(address,uint256,uint256)", user, lstIndex, amount)
        );
        require(success, "Unstake execution failed");
    }
    
    /**
     * @dev Claim unstaked assets after 7 days
     * Uses delegatecall to ClaimManager
     */
    function claim(address user, uint256 lstIndex) external returns (uint256) {
        require(claimManager != address(0), "ClaimManager not set");
        require(lstIndex < 4, "Invalid LST index");
        
        // Execute claim via delegatecall
        (bool success, bytes memory data) = claimManager.delegatecall(
            abi.encodeWithSignature("executeClaim(address,uint256)", user, lstIndex)
        );
        require(success, "Claim execution failed");
        
        uint256 claimedAmount = abi.decode(data, (uint256));
        
        // Wrap the claimed KAIA to WKAIA
        if (claimedAmount > 0 && address(this).balance >= claimedAmount) {
            IWKaia(wkaia).deposit{value: claimedAmount}();
            IERC20(wkaia).safeTransfer(user, claimedAmount);
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
    
    // Required for UUPS
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    
    // Receive function to accept KAIA
    receive() external payable {}
}