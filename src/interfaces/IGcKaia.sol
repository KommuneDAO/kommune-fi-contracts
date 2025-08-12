// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

enum WithdrawalRequestState {
    Unknown,
    Transferred,
    Cancelled
}

interface IGcKaia {
    function stake() external payable;
    function unstake(uint256 amount) external;
    function unstakeAll() external;
    function claim(uint256 claimCheckTokenId) external;
    function balanceOf(address account) external view returns (uint256);
    function withdrawalRequestInfo(
        uint256 withdrawalRequestId
    )
        external
        view
        returns (
            uint256 amount,
            uint256 withdrawableFrom,
            WithdrawalRequestState state
        );
    function withdrawalRequestTTL() external view returns (uint256);
}
