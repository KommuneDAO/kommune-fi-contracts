// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TestSafeTransfer {
    using SafeERC20 for IERC20;
    
    function testTransfer(address token, address to, uint256 amount) external {
        // This is exactly what VaultCore tries to do
        IERC20(token).safeTransfer(to, amount);
    }
    
    function testTransferWithCheck(address token, address to, uint256 amount) external returns (bool) {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance >= amount, "Insufficient balance");
        
        IERC20(token).safeTransfer(to, amount);
        return true;
    }
}