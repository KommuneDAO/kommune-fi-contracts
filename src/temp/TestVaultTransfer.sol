// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TestVaultTransfer {
    using SafeERC20 for IERC20;
    
    event TransferAttempt(address token, address to, uint256 amount);
    event TransferSuccess(address token, address to, uint256 amount);
    event TransferFailed(address token, string reason);
    
    function testSafeTransfer(address token, address to, uint256 amount) external {
        emit TransferAttempt(token, to, amount);
        
        try IERC20(token).transfer(to, amount) returns (bool success) {
            if (success) {
                emit TransferSuccess(token, to, amount);
            } else {
                emit TransferFailed(token, "Transfer returned false");
            }
        } catch Error(string memory reason) {
            emit TransferFailed(token, reason);
        } catch {
            emit TransferFailed(token, "Unknown error");
        }
    }
    
    function testSafeTransferUsingSafeERC20(address token, address to, uint256 amount) external {
        emit TransferAttempt(token, to, amount);
        
        // This is exactly what VaultCore does
        IERC20(token).safeTransfer(to, amount);
        
        emit TransferSuccess(token, to, amount);
    }
    
    function checkBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}