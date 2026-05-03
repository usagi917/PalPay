// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MilestoneEscrowV6} from "./MilestoneEscrowV6.sol";

/**
 * @title EscrowDeployerV6
 * @notice Isolates escrow creation bytecode from ListingFactory runtime.
 */
contract EscrowDeployerV6 {
    address public immutable factory;

    error Unauthorized();

    constructor() {
        factory = msg.sender;
    }

    function deployEscrow(
        address tokenAddress,
        address producer,
        uint256 tokenId,
        string calldata title,
        string calldata description,
        uint256 totalAmount,
        string calldata imageURI
    ) external returns (address escrow) {
        if (msg.sender != factory) revert Unauthorized();
        escrow = address(
            new MilestoneEscrowV6(
                factory, tokenAddress, producer, tokenId, title, description, totalAmount, imageURI
            )
        );
    }
}
