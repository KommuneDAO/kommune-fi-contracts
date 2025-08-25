// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {ERC4626Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IWKaia {
    function deposit() external payable;
    function withdraw(uint256) external;
}

interface IVaultCore {
    function handleDeposit(uint256 amount, address depositor) external returns (bool);
    function handleDepositKAIA() external payable returns (bool);
    function handleWithdraw(uint256 amount, address owner) external returns (uint256);
    function handleRedeem(uint256 shares, address owner) external returns (uint256);
    function totalAssets() external view returns (uint256);
}

/**
 * @title ShareVault
 * @dev ERC-4626 implementation for share management
 * This contract handles all share-related logic (deposit/withdraw/mint/redeem)
 * Actual asset management is delegated to VaultCore
 */
contract ShareVault is ERC4626Upgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;
    
    // Core vault contract that manages actual assets
    address public vaultCore;
    
    // Fee parameters
    uint256 public basisPointsFees;
    address public treasury;
    
    // Deposit tracking
    struct DepositInfo {
        uint256 amount;
        uint256 timestamp;
    }
    mapping(address => DepositInfo) public deposits;
    mapping(address => uint256) public lastDepositBlock;
    uint256 public depositLimit;
    
    // Providers management
    address[] public providers;
    mapping(address => bool) public isProvider;
    
    // Events
    event VaultCoreUpdated(address indexed oldCore, address indexed newCore);
    event FeesUpdated(uint256 basisPoints);
    event TreasuryUpdated(address indexed treasury);
    event ProviderAdded(address indexed provider);
    event ProviderRemoved(address indexed provider);
    event WithdrawWithProvider(address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares, address provider, uint256 providerFee);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev Initialize the ShareVault
     */
    function initialize(
        address _asset,
        address _vaultCore,
        uint256 _basisPointsFees,
        address _treasury
    ) external initializer {
        __ERC20_init("Kommune Vault Kaia", "kvKAIA");
        __ERC4626_init(IERC20(_asset));
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        vaultCore = _vaultCore;
        basisPointsFees = _basisPointsFees;
        treasury = _treasury;
        depositLimit = 100 ether; // Default 100 WKAIA limit
    }
    
    /**
     * @dev Returns total assets managed by VaultCore
     */
    function totalAssets() public view override returns (uint256) {
        if (vaultCore == address(0)) {
            return IERC20(asset()).balanceOf(address(this));
        }
        // Call VaultCore to get total managed assets
        (bool success, bytes memory data) = vaultCore.staticcall(
            abi.encodeWithSignature("getTotalAssets()")
        );
        if (success && data.length > 0) {
            return abi.decode(data, (uint256));
        }
        return IERC20(asset()).balanceOf(address(this));
    }
    
    /**
     * @dev Deposit assets and receive shares (Standard ERC4626 Pattern)
     * User must approve WKAIA to ShareVault first, then call this function
     * This prevents front-running attacks by using standard pull pattern
     */
    function deposit(uint256 assets, address receiver) 
        public 
        virtual 
        override 
        nonReentrant 
        returns (uint256 shares) 
    {
        require(assets > 0, "Zero amount");
        require(deposits[msg.sender].amount + assets <= depositLimit, "Limit exceeded");
        require(block.number > lastDepositBlock[msg.sender], "Same block");
        require(vaultCore != address(0), "VaultCore not set");
        
        // Calculate shares before transfer
        shares = previewDeposit(assets);
        require(shares > 0, "Zero shares");
        
        // Pull WKAIA from user to ShareVault
        IERC20(asset()).transferFrom(msg.sender, address(this), assets);
        
        // Transfer WKAIA to VaultCore
        IERC20(asset()).transfer(vaultCore, assets);
        
        // Update tracking
        lastDepositBlock[msg.sender] = block.number;
        deposits[msg.sender].amount += assets;
        deposits[msg.sender].timestamp = block.timestamp;
        
        // Call VaultCore to handle deposit
        bool success = IVaultCore(vaultCore).handleDeposit(assets, msg.sender);
        require(success, "Core deposit failed");
        
        // Mint shares
        _mint(receiver, shares);
        
        emit Deposit(msg.sender, receiver, assets, shares);
        return shares;
    }
    
    /**
     * @dev Withdraw assets by burning shares (standard ERC4626, no provider)
     */
    function withdraw(uint256 assets, address receiver, address owner)
        public
        virtual
        override
        returns (uint256 shares)
    {
        // Call withdrawWithProvider with address(0) for backward compatibility
        return withdrawWithProvider(assets, receiver, owner, address(0));
    }
    
    /**
     * @dev Withdraw assets with provider fee sharing
     * @param assets Amount of assets to withdraw
     * @param receiver Address to receive the assets
     * @param owner Address of the share owner
     * @param provider Provider address for fee sharing (1/3 of fee goes to provider if valid)
     */
    function withdrawWithProvider(uint256 assets, address receiver, address owner, address provider)
        public
        nonReentrant
        returns (uint256 shares)
    {
        require(assets > 0, "Zero amount");
        
        // Calculate shares needed
        shares = previewWithdraw(assets);
        
        // Check allowance if not owner
        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }
        
        // Calculate fee and net amount
        uint256 feeAmount = 0;
        uint256 netAssets = assets;
        uint256 providerFee = 0;
        uint256 treasuryFee = 0;
        
        if (basisPointsFees > 0 && treasury != address(0)) {
            feeAmount = (assets * basisPointsFees) / 10000;
            netAssets = assets - feeAmount;
            
            // Split fee if provider is valid
            if (provider != address(0) && isProvider[provider]) {
                providerFee = feeAmount / 3;  // 1/3 to provider
                treasuryFee = feeAmount - providerFee;  // 2/3 to treasury
            } else {
                treasuryFee = feeAmount;  // All to treasury
            }
        }
        
        // Request total assets (including fee) from VaultCore
        // VaultCore will send KAIA back to ShareVault
        if (vaultCore != address(0)) {
            uint256 kaiaBefore = address(this).balance;
            
            (bool success,) = vaultCore.call(
                abi.encodeWithSignature("handleWithdraw(uint256,address)", assets, address(this))
            );
            require(success, "Core withdraw failed");
            
            // Check if we received KAIA
            uint256 kaiaReceived = address(this).balance - kaiaBefore;
            require(kaiaReceived == assets, "Incorrect KAIA amount received");
            
            // Transfer fees in KAIA
            if (providerFee > 0) {
                (bool providerSent, ) = provider.call{value: providerFee}("");
                require(providerSent, "Provider fee transfer failed");
            }
            if (treasuryFee > 0) {
                (bool treasurySent, ) = treasury.call{value: treasuryFee}("");
                require(treasurySent, "Treasury fee transfer failed");
            }
            
            // Transfer net amount to receiver in KAIA
            (bool receiverSent, ) = receiver.call{value: netAssets}("");
            require(receiverSent, "KAIA transfer to receiver failed");
        } else {
            // Fallback: transfer WKAIA from this contract (shouldn't happen normally)
            // First unwrap WKAIA to KAIA if we have any
            uint256 wkaiaBalance = IERC20(asset()).balanceOf(address(this));
            if (wkaiaBalance >= assets) {
                IWKaia(asset()).withdraw(assets);
                
                // Transfer fees in KAIA
                if (providerFee > 0) {
                    (bool providerSent, ) = provider.call{value: providerFee}("");
                    require(providerSent, "Provider fee transfer failed");
                }
                if (treasuryFee > 0) {
                    (bool treasurySent, ) = treasury.call{value: treasuryFee}("");
                    require(treasurySent, "Treasury fee transfer failed");
                }
                
                // Transfer net amount to receiver in KAIA
                (bool receiverSent, ) = receiver.call{value: netAssets}("");
                require(receiverSent, "KAIA transfer to receiver failed");
            } else {
                revert("Insufficient balance");
            }
        }
        
        // Burn shares
        _burn(owner, shares);
        
        // Update deposit tracking
        if (deposits[owner].amount >= assets) {
            deposits[owner].amount -= assets;
        } else {
            deposits[owner].amount = 0;
        }
        
        // Emit appropriate event
        if (provider != address(0) && isProvider[provider]) {
            emit WithdrawWithProvider(msg.sender, receiver, owner, assets, shares, provider, providerFee);
        } else {
            emit Withdraw(msg.sender, receiver, owner, assets, shares);
        }
        
        return shares;
    }
    
    /**
     * @dev Mint shares by depositing assets (Direct Deposit Pattern)
     * User must first transfer WKAIA directly to VaultCore, then call this function
     */
    function mint(uint256 shares, address receiver)
        public
        virtual
        override
        nonReentrant
        returns (uint256 assets)
    {
        require(shares > 0, "Zero shares");
        require(vaultCore != address(0), "VaultCore not set");
        
        // Calculate assets needed
        assets = previewMint(shares);
        require(deposits[msg.sender].amount + assets <= depositLimit, "Limit exceeded");
        require(block.number > lastDepositBlock[msg.sender], "Same block");
        
        // Pull WKAIA from user to ShareVault first, then transfer to VaultCore
        // This two-step process may help with WKAIA state sync issues
        IERC20(asset()).transferFrom(msg.sender, address(this), assets);
        IERC20(asset()).transfer(vaultCore, assets);
        
        // Update tracking
        lastDepositBlock[msg.sender] = block.number;
        deposits[msg.sender].amount += assets;
        deposits[msg.sender].timestamp = block.timestamp;
        
        // Notify VaultCore to process the deposit
        (bool success,) = vaultCore.call(
            abi.encodeWithSignature("handleDeposit(uint256,address)", assets, msg.sender)
        );
        require(success, "Core deposit failed");
        
        // Mint shares
        _mint(receiver, shares);
        
        emit Deposit(msg.sender, receiver, assets, shares);
        return assets;
    }
    
    /**
     * @dev Redeem shares for assets (standard ERC4626, no provider)
     */
    function redeem(uint256 shares, address receiver, address owner)
        public
        virtual
        override
        returns (uint256 assets)
    {
        // Call redeemWithProvider with address(0) for backward compatibility
        return redeemWithProvider(shares, receiver, owner, address(0));
    }
    
    /**
     * @dev Redeem shares with provider fee sharing
     * @param shares Amount of shares to redeem
     * @param receiver Address to receive the assets
     * @param owner Address of the share owner
     * @param provider Provider address for fee sharing (1/3 of fee goes to provider if valid)
     */
    function redeemWithProvider(uint256 shares, address receiver, address owner, address provider)
        public
        nonReentrant
        returns (uint256 assets)
    {
        require(shares > 0, "Zero shares");
        
        // Calculate assets to return
        assets = previewRedeem(shares);
        
        // Check allowance if not owner
        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }
        
        // Calculate fee and net amount
        uint256 feeAmount = 0;
        uint256 netAssets = assets;
        uint256 providerFee = 0;
        uint256 treasuryFee = 0;
        
        if (basisPointsFees > 0 && treasury != address(0)) {
            feeAmount = (assets * basisPointsFees) / 10000;
            netAssets = assets - feeAmount;
            
            // Split fee if provider is valid
            if (provider != address(0) && isProvider[provider]) {
                providerFee = feeAmount / 3;  // 1/3 to provider
                treasuryFee = feeAmount - providerFee;  // 2/3 to treasury
            } else {
                treasuryFee = feeAmount;  // All to treasury
            }
        }
        
        // Request total assets (including fee) from VaultCore
        // VaultCore will send KAIA back to ShareVault
        if (vaultCore != address(0)) {
            uint256 kaiaBefore = address(this).balance;
            
            (bool success,) = vaultCore.call(
                abi.encodeWithSignature("handleWithdraw(uint256,address)", assets, address(this))
            );
            require(success, "Core withdraw failed");
            
            // Check if we received KAIA
            uint256 kaiaReceived = address(this).balance - kaiaBefore;
            require(kaiaReceived == assets, "Incorrect KAIA amount received");
            
            // Transfer fees in KAIA
            if (providerFee > 0) {
                (bool providerSent, ) = provider.call{value: providerFee}("");
                require(providerSent, "Provider fee transfer failed");
            }
            if (treasuryFee > 0) {
                (bool treasurySent, ) = treasury.call{value: treasuryFee}("");
                require(treasurySent, "Treasury fee transfer failed");
            }
            
            // Transfer net amount to receiver in KAIA
            (bool receiverSent, ) = receiver.call{value: netAssets}("");
            require(receiverSent, "KAIA transfer to receiver failed");
        } else {
            // Fallback: transfer WKAIA from this contract (shouldn't happen normally)
            // First unwrap WKAIA to KAIA if we have any
            uint256 wkaiaBalance = IERC20(asset()).balanceOf(address(this));
            if (wkaiaBalance >= assets) {
                IWKaia(asset()).withdraw(assets);
                
                // Transfer fees in KAIA
                if (providerFee > 0) {
                    (bool providerSent, ) = provider.call{value: providerFee}("");
                    require(providerSent, "Provider fee transfer failed");
                }
                if (treasuryFee > 0) {
                    (bool treasurySent, ) = treasury.call{value: treasuryFee}("");
                    require(treasurySent, "Treasury fee transfer failed");
                }
                
                // Transfer net amount to receiver in KAIA
                (bool receiverSent, ) = receiver.call{value: netAssets}("");
                require(receiverSent, "KAIA transfer to receiver failed");
            } else {
                revert("Insufficient balance");
            }
        }
        
        // Burn shares
        _burn(owner, shares);
        
        // Update deposit tracking
        if (deposits[owner].amount >= assets) {
            deposits[owner].amount -= assets;
        } else {
            deposits[owner].amount = 0;
        }
        
        // Emit appropriate event
        if (provider != address(0) && isProvider[provider]) {
            emit WithdrawWithProvider(msg.sender, receiver, owner, assets, shares, provider, providerFee);
        } else {
            emit Withdraw(msg.sender, receiver, owner, assets, shares);
        }
        
        return assets;
    }
    
    /**
     * @dev Receive KAIA from VaultCore for withdrawal distribution
     */
    receive() external payable {
        // Only accept KAIA from VaultCore
        require(msg.sender == vaultCore, "Only VaultCore");
        // KAIA will be distributed directly to users/treasury/providers
    }
    
    /**
     * @dev Native KAIA deposit (payable)
     */
    function depositKAIA(address receiver) external payable nonReentrant returns (uint256 shares) {
        require(msg.value > 0, "Zero amount");
        require(deposits[msg.sender].amount + msg.value <= depositLimit, "Limit exceeded");
        require(block.number > lastDepositBlock[msg.sender], "Same block");
        
        uint256 assets = msg.value;
        
        // Calculate shares
        shares = previewDeposit(assets);
        require(shares > 0, "Zero shares");
        
        // Update tracking
        lastDepositBlock[msg.sender] = block.number;
        deposits[msg.sender].amount += assets;
        deposits[msg.sender].timestamp = block.timestamp;
        
        // Send KAIA to VaultCore for management
        if (vaultCore != address(0)) {
            (bool success,) = vaultCore.call{value: assets}(
                abi.encodeWithSignature("handleDepositKAIA()")
            );
            require(success, "Core KAIA deposit failed");
        }
        
        // Mint shares
        _mint(receiver, shares);
        
        emit Deposit(msg.sender, receiver, assets, shares);
        return shares;
    }
    
    // Admin functions
    
    function setVaultCore(address _vaultCore) external onlyOwner {
        require(_vaultCore != address(0), "Invalid address");
        address oldCore = vaultCore;
        vaultCore = _vaultCore;
        emit VaultCoreUpdated(oldCore, _vaultCore);
    }
    
    function setFees(uint256 _basisPointsFees) external onlyOwner {
        require(_basisPointsFees <= 10000, "Invalid fee");
        basisPointsFees = _basisPointsFees;
        emit FeesUpdated(_basisPointsFees);
    }
    
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid address");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }
    
    function setDepositLimit(uint256 _limit) external onlyOwner {
        depositLimit = _limit;
    }
    
    // Provider management functions
    
    /**
     * @dev Add a new provider address
     * @param provider Address to add as provider
     */
    function addProvider(address provider) external onlyOwner {
        require(provider != address(0), "Invalid address");
        require(!isProvider[provider], "Already provider");
        
        providers.push(provider);
        isProvider[provider] = true;
        
        emit ProviderAdded(provider);
    }
    
    /**
     * @dev Remove a provider address
     * @param provider Address to remove from providers
     */
    function removeProvider(address provider) external onlyOwner {
        require(isProvider[provider], "Not a provider");
        
        isProvider[provider] = false;
        
        // Remove from array
        for (uint256 i = 0; i < providers.length; i++) {
            if (providers[i] == provider) {
                providers[i] = providers[providers.length - 1];
                providers.pop();
                break;
            }
        }
        
        emit ProviderRemoved(provider);
    }
    
    /**
     * @dev Get all provider addresses
     * @return Array of provider addresses
     */
    function getProviders() external view returns (address[] memory) {
        return providers;
    }
    
    /**
     * @dev Get number of providers
     * @return Number of providers
     */
    function getProvidersCount() external view returns (uint256) {
        return providers.length;
    }
    
    // Required for UUPS
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}