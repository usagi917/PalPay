// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../contracts/ListingFactoryV6.sol";
import "../../contracts/MockERC20.sol";
import "./TestBase.sol";

abstract contract EscrowFixture is TestBase {
    uint8 internal constant CATEGORY_CRAFT = 2;
    uint256 internal constant TOTAL_AMOUNT = 1_000 ether;

    address internal constant PRODUCER = address(0xA11CE);
    address internal constant BUYER = address(0xB0B);
    address internal constant SECOND_BUYER = address(0xB0B2);
    address internal constant STRANGER = address(0xCAFE);

    MockERC20 internal token;
    ListingFactoryV6 internal factory;
    MilestoneEscrowV6 internal escrow;
    address internal escrowAddress;
    uint256 internal tokenId;

    function setUp() public virtual {
        token = new MockERC20("Mock Token", "MOCK", 18);
        factory = new ListingFactoryV6(address(token), "https://example.test");

        vm.prank(PRODUCER);
        (escrowAddress, tokenId) =
            factory.createListing(CATEGORY_CRAFT, "Craft Listing", "Fixture listing", TOTAL_AMOUNT, "ipfs://image");
        escrow = MilestoneEscrowV6(escrowAddress);
    }

    function _mintAndApprove(address user, uint256 amount) internal {
        token.mint(user, amount);
        vm.prank(user);
        token.approve(address(escrow), type(uint256).max);
    }

    function _lockAs(address user) internal {
        _mintAndApprove(user, TOTAL_AMOUNT * 2);
        vm.prank(user);
        escrow.lock();
    }

    function _approveLockedAsBuyer() internal {
        vm.prank(BUYER);
        escrow.approve();
    }

    function _completeNonFinalMilestones() internal {
        uint256 lastIndex = escrow.getMilestoneCount() - 1;
        vm.startPrank(PRODUCER);
        for (uint256 i = 0; i < lastIndex; i++) {
            escrow.submit(i, keccak256(abi.encodePacked("evidence-", i)));
        }
        vm.stopPrank();
    }

    function _requestFinalDelivery(bytes32 evidenceHash) internal {
        vm.prank(PRODUCER);
        escrow.requestFinalDelivery(evidenceHash);
    }
}
