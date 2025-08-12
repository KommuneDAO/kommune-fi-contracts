// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IWrapped} from "./interfaces/IWrapped.sol";

contract TestWrapContract {
    address public owner;
    
    constructor() {
        owner = msg.sender;
    }
    
    function testWrapFunction(
        address stKLAYAddress,
        address wstKLAYAddress,
        uint256 amount
    ) external returns (bool success, string memory errorMessage) {
        try this.performWrap(stKLAYAddress, wstKLAYAddress, amount) {
            return (true, "");
        } catch Error(string memory reason) {
            return (false, reason);
        } catch (bytes memory) {
            return (false, "Unknown error");
        }
    }
    
    function performWrap(
        address stKLAYAddress,
        address wstKLAYAddress,
        uint256 amount
    ) external {
        require(msg.sender == address(this), "Only self-call allowed");
        
        // Exactly mimic what KVaultV2 does:
        // 1. Reset approve to 0
        IERC20(stKLAYAddress).approve(wstKLAYAddress, 0);
        
        // 2. Approve the amount
        IERC20(stKLAYAddress).approve(wstKLAYAddress, amount);
        
        // 3. Call wrap function
        IWrapped(wstKLAYAddress).wrap(amount);
    }
    
    function directWrap(
        address stKLAYAddress,
        address wstKLAYAddress,
        uint256 amount
    ) external {
        // Direct approach without try/catch
        IERC20(stKLAYAddress).approve(wstKLAYAddress, 0);
        IERC20(stKLAYAddress).approve(wstKLAYAddress, amount);
        IWrapped(wstKLAYAddress).wrap(amount);
    }
    
    function checkBalances(
        address stKLAYAddress,
        address wstKLAYAddress
    ) external view returns (uint256 stKLAYBalance, uint256 wstKLAYBalance) {
        return (
            IERC20(stKLAYAddress).balanceOf(address(this)),
            IERC20(wstKLAYAddress).balanceOf(address(this))
        );
    }
    
    function checkAllowance(
        address stKLAYAddress,
        address wstKLAYAddress
    ) external view returns (uint256 allowance) {
        return IERC20(stKLAYAddress).allowance(address(this), wstKLAYAddress);
    }
    
    // Emergency function to withdraw tokens
    function withdraw(address token, uint256 amount) external {
        require(msg.sender == owner, "Only owner");
        IERC20(token).transfer(owner, amount);
    }
}