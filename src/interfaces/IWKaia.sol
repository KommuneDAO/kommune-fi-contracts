// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

interface IWKaia {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function getSharesByKlay(uint256 amount) external view returns (uint256);
    function getKlayByShares(uint256 amount) external view returns (uint256);
}
