// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {ERC4626Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IWKaia {
    function withdraw(uint256) external;
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
    
    // Events
    event VaultCoreUpdated(address indexed oldCore, address indexed newCore);
    event FeesUpdated(uint256 basisPoints);
    event TreasuryUpdated(address indexed treasury);
    
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
        
        // Check balances to create state sync delay
        uint256 shareVaultWKAIA = IERC20(asset()).balanceOf(address(this));
        require(shareVaultWKAIA >= assets, "WKAIA not received");
        
        // Convert WKAIA to KAIA in ShareVault to avoid state sync issue
        IWKaia(asset()).withdraw(assets);
        
        // Update tracking
        lastDepositBlock[msg.sender] = block.number;
        deposits[msg.sender].amount += assets;
        deposits[msg.sender].timestamp = block.timestamp;
        
        // Send KAIA to VaultCore instead of WKAIA
        (bool success,) = vaultCore.call{value: assets}(
            abi.encodeWithSignature("handleDepositKAIA()")
        );
        require(success, "Core KAIA deposit failed");
        
        // Mint shares
        _mint(receiver, shares);
        
        emit Deposit(msg.sender, receiver, assets, shares);
        return shares;
    }
    
    /**
     * @dev Withdraw assets by burning shares
     */
    function withdraw(uint256 assets, address receiver, address owner)
        public
        virtual
        override
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
        
        // Request assets from VaultCore
        if (vaultCore != address(0)) {
            (bool success,) = vaultCore.call(
                abi.encodeWithSignature("handleWithdraw(uint256,address)", assets, receiver)
            );
            require(success, "Core withdraw failed");
        } else {
            // Fallback: transfer from this contract
            IERC20(asset()).safeTransfer(receiver, assets);
        }
        
        // Burn shares
        _burn(owner, shares);
        
        // Update deposit tracking
        if (deposits[owner].amount >= assets) {
            deposits[owner].amount -= assets;
        } else {
            deposits[owner].amount = 0;
        }
        
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
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
     * @dev Redeem shares for assets
     */
    function redeem(uint256 shares, address receiver, address owner)
        public
        virtual
        override
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
        
        // Request assets from VaultCore
        if (vaultCore != address(0)) {
            (bool success,) = vaultCore.call(
                abi.encodeWithSignature("handleWithdraw(uint256,address)", assets, receiver)
            );
            require(success, "Core withdraw failed");
        } else {
            // Fallback: transfer from this contract
            IERC20(asset()).safeTransfer(receiver, assets);
        }
        
        // Burn shares
        _burn(owner, shares);
        
        // Update deposit tracking
        if (deposits[owner].amount >= assets) {
            deposits[owner].amount -= assets;
        } else {
            deposits[owner].amount = 0;
        }
        
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
        return assets;
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
    
    // Required for UUPS
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}