// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

interface IWKoKaia {
    function wrap(uint256 amount) external;
    function unwrap(uint256 amount) external;
    function getWrappedAmount(uint256 amount) external view returns (uint256);
    function getUnwrappedAmount(uint256 amount) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}
