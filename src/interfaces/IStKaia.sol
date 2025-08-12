// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

struct UnstakeInfo {
    uint256 index;
    uint256 unstakeId;
    address unstakeNode;
    uint256 amount;
    uint256 unstakeTime;
    uint256 claimTime;
    uint8 state;
}

struct NodeInfo {
    uint256 index;
    address payable node;
    bool isActive;
}

interface IStKaia {
    function stake() external payable;
    function unstake(
        address stakeNode,
        address account,
        uint256 amount
    ) external;
    function claim(
        address user,
        uint256 index
    ) external returns (uint8[] memory);
    function getRatioStakingTokenByNativeToken(
        uint256 amount
    ) external view returns (uint256); // stKAIA -> Kaia
    function getRatioNativeTokenByStakingToken(
        uint256 amount
    ) external view returns (uint256); //Kaia -> stKAIA
    function balanceOf(address account) external view returns (uint256);
    function getUnstakeInfos(
        address account,
        uint256 page,
        uint256 count
    ) external view returns (UnstakeInfo[] memory);
    function getNodeList(
        uint256 index
    ) external view returns (NodeInfo[] memory);
    function getUnstakeRequestInfoLength(
        address account
    ) external view returns (uint256);
}
