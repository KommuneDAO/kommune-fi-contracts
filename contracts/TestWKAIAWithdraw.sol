// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

interface IWKaia {
    function withdraw(uint256) external;
    function balanceOf(address) external view returns (uint256);
}

contract TestWKAIAWithdraw {
    address public wkaia;
    
    constructor(address _wkaia) {
        wkaia = _wkaia;
    }
    
    function testWithdraw(uint256 amount) external {
        IWKaia(wkaia).withdraw(amount);
    }
    
    function getWKAIABalance() external view returns (uint256) {
        return IWKaia(wkaia).balanceOf(address(this));
    }
    
    receive() external payable {}
}