// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

interface IWKoKaia {
    function wrap(uint256 amount) external;
    function unwrap(uint256 amount) external;
}
