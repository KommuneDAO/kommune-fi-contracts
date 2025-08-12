// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

interface IWrapped {
    function wrap(uint256 amount) external;
    function unwrap(uint256 amount) external;
    function getWrappedAmount(uint256 amount) external view returns (uint256);
    function getUnwrappedAmount(uint256 amount) external view returns (uint256);
    function getGCKLAYByWGCKLAY(uint256 amount) external view returns (uint256);
    function getWGCKLAYByGCKLAY(uint256 amount) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}
