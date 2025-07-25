// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

interface IKoKaia {
    function stake() external payable;
    function unstake(uint256 amount) external;
    function claim(address user) external;
    function increaseTotalStaking(uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}
