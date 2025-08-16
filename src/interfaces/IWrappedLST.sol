// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title IWrappedLST
 * @dev Interface for wrapped LST tokens (wKoKAIA, wGCKAIA, wstKLAY)
 */
interface IWrappedLST {
    function wrap(uint256 amount) external returns (uint256);
    function unwrap(uint256 amount) external returns (uint256);
    function getWrappedAmount(uint256 amount) external view returns (uint256);
    function getUnwrappedAmount(uint256 amount) external view returns (uint256);
}