// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IWKaia} from "./interfaces/IWKaia.sol";
import {TokenInfo} from "./interfaces/ITokenInfo.sol";
import {SwapContract} from "./SwapContract.sol";

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
     * @dev Initialize token information for LSTs
     */
    function _initTokenInfo() private {
        // wKoKAIA
        tokensInfo[0] = TokenInfo({
            handler: 0xb15782EFbC2034E366670599F3997f94c7333FF9,
            asset: 0xb15782EFbC2034E366670599F3997f94c7333FF9,
            tokenA: 0x9a93e2fcDEBE43d0f8205D1cd255D709B7598317,
            tokenB: 0x063832EDC4bB4824F82Cf132caB0409A1aE5b9C2,
            tokenC: wkaia,
            pool1: 0xf3aeb0301583043f039a05e1cf9bb963ba073d2d000200000000000000000020,
            pool2: 0x6c40af5831fd18e5e1f0d8f88d5f4b7e7c18f15c000200000000000000000018
        });
        
        // wGCKAIA
        tokensInfo[1] = TokenInfo({
            handler: 0xe4c732f651B39169648A22F159b815d8499F996c,
            asset: 0x4EC04F4D46D7e34EBf0C3932B65068168FDcE7f6,
            tokenA: 0x324353670B23b16DFacBDE169Cd8ebF8C8bf6601,
            tokenB: 0x063832EDC4bB4824F82Cf132caB0409A1aE5b9C2,
            tokenC: wkaia,
            pool1: 0xaa1581670e3e7f3538cd79ac3527e9e1f5bc392a00020000000000000000001f,
            pool2: 0x6c40af5831fd18e5e1f0d8f88d5f4b7e7c18f15c000200000000000000000018
        });
        
        // wstKLAY
        tokensInfo[2] = TokenInfo({
            handler: 0x28B13a88E72a2c8d6E93C28dD39125705d78E75F,
            asset: 0x524dCFf07BFF606225A4FA76AFA55D705B052004,
            tokenA: 0x474B49DF463E528223F244670e332fE82742e1aA,
            tokenB: 0xd9e497BC1b8cdD9EfD1b5fc8A652E47492d963A7,
            tokenC: wkaia,
            pool1: 0x5bd53c95bc067cc9966c858dcf8e77c59cfcf35300020000000000000000001b,
            pool2: 0x087a7c88c25c616c19e8e1ecbdd4b1fc1f15e17e00020000000000000000001c
        });
        
        // stKAIA
        tokensInfo[3] = TokenInfo({
            handler: 0x4C0d434C7DD74491A52375163a7b724ED387d0b6,
            asset: 0x45886b01276c45Fe337d3758b94DD8D7F3951d97,
            tokenA: 0x45886b01276c45Fe337d3758b94DD8D7F3951d97,
            tokenB: 0x063832EDC4bB4824F82Cf132caB0409A1aE5b9C2,
            tokenC: wkaia,
            pool1: 0x6c11e0c969bbecb0e96afee7c09e1f0df37088a500020000000000000000001e,
            pool2: 0x6c40af5831fd18e5e1f0d8f88d5f4b7e7c18f15c000200000000000000000018
        });
    }
    
    /**
     * @dev Get total assets managed by this vault
     */
    function getTotalAssets() external view returns (uint256 total) {
        // WKAIA balance
        total = IERC20(wkaia).balanceOf(address(this));
        
        // Add LST balances (converted to WKAIA value)
        for (uint256 i = 0; i < 4; i++) {
            uint256 lstBalance = IERC20(tokensInfo[i].asset).balanceOf(address(this));
            if (i < 3) {
                // For wrapped versions
                uint256 wrappedBalance = IERC20(tokensInfo[i].tokenA).balanceOf(address(this));
                lstBalance += wrappedBalance;
            }
            // TODO: Convert LST to WKAIA value using price oracles or pool ratios
            total += lstBalance;
        }
        
        return total;
    }
    
    /**
     * @dev Handle deposit from ShareVault
     */
    function handleDeposit(uint256 amount) external returns (bool) {
        require(msg.sender == shareVault, "Only ShareVault");
        
        // Check WKAIA balance
        uint256 wkaiaBalance = IERC20(wkaia).balanceOf(address(this));
        require(wkaiaBalance >= amount, "Insufficient WKAIA");
        
        // Calculate amount to stake
        uint256 amountToStake = (amount * investRatio) / 10000;
        
        if (amountToStake > 0) {
            // Ensure we have enough WKAIA to withdraw
            require(wkaiaBalance >= amountToStake, "Insufficient WKAIA for stake");
            
            // Unwrap WKAIA to KAIA for staking
            IWKaia(wkaia).withdraw(amountToStake);
            
            // Distribute to LSTs based on APY
            _distributToLSTs(amountToStake);
            
            emit StakeExecuted(amountToStake);
        }
        
        emit AssetsDeposited(amount);
        return true;
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
                uint256 lstBalance = IERC20(tokensInfo[i].tokenA).balanceOf(address(this));
                if (lstBalance > 0) {
                    uint256 toSwap = lstBalance < needed ? lstBalance : needed;
                    
                    // Transfer to SwapContract
                    IERC20(tokensInfo[i].tokenA).safeTransfer(swapContract, toSwap);
                    
                    // Execute swap
                    SwapContract(swapContract).swapGivenOut(
                        tokensInfo[i],
                        balancerVault,
                        toSwap,
                        toSwap
                    );
                    
                    needed -= toSwap;
                    emit SwapExecuted(i, toSwap, toSwap);
                }
            }
            
            // Transfer all available WKAIA
            wkaiaBalance = IERC20(wkaia).balanceOf(address(this));
            uint256 toTransfer = wkaiaBalance < amount ? wkaiaBalance : amount;
            IERC20(wkaia).safeTransfer(recipient, toTransfer);
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
    
    // Required for UUPS
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    
    // Receive function to accept KAIA
    receive() external payable {}
}