// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../contracts/ListingFactoryV6.sol";
import "../contracts/MockERC20.sol";
import "./utils/EscrowFixture.sol";

contract FeeOnTransferERC20 is MockERC20 {
    uint256 internal constant FEE_BPS = 500;
    address internal constant FEE_COLLECTOR = address(0xFEE);

    constructor() MockERC20("Fee Token", "FEE", 18) { }

    function _update(address from, address to, uint256 value) internal virtual override {
        if (from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }

        uint256 fee = (value * FEE_BPS) / 10_000;
        uint256 netAmount = value - fee;
        super._update(from, FEE_COLLECTOR, fee);
        super._update(from, to, netAmount);
    }
}

contract ListingFactoryV6Test is EscrowFixture {
    function testCreateListingMintsNFTToEscrow() public view {
        assertEq(factory.ownerOf(tokenId), escrowAddress, "escrow should hold the NFT after creation");
        assertEq(factory.tokenIdToEscrow(tokenId), escrowAddress, "factory should map tokenId to escrow");
        assertEq(factory.getListingCount(), 1, "factory should track one listing");
    }

    function testCancelReopensListingAndAllowsRelist() public {
        _lockAs(BUYER);

        vm.prank(BUYER);
        escrow.cancel();

        assertEq(factory.ownerOf(tokenId), PRODUCER, "producer should regain the NFT after cancel");
        assertEq(uint256(uint8(escrow.getStatusEnum())), uint256(uint8(MilestoneEscrowV6.Status.OPEN)), "status should reopen");
        assertEq(escrow.buyer(), address(0), "buyer should be cleared after cancel");
        assertEq(escrow.cancelCount(), 1, "cancel count should increment");
        assertEq(token.balanceOf(BUYER), TOTAL_AMOUNT * 2, "buyer should receive a full refund");

        _lockAs(SECOND_BUYER);

        assertEq(factory.ownerOf(tokenId), SECOND_BUYER, "relisted NFT should move directly from producer to new buyer");
        assertEq(escrow.buyer(), SECOND_BUYER, "new buyer should be recorded");
        assertEq(factory.tokenIdToEscrow(tokenId), escrowAddress, "escrow address should stay stable across relists");
    }

    function testProducerCannotBypassEscrowAfterCancel() public {
        _lockAs(BUYER);

        vm.prank(BUYER);
        escrow.cancel();

        vm.expectRevert(ListingFactoryV6.TransferRestricted.selector);
        vm.prank(PRODUCER);
        factory.transferFrom(PRODUCER, STRANGER, tokenId);
    }

    function testLockRevertsWhenTokenReceivesLessThanTotalAmount() public {
        FeeOnTransferERC20 feeToken = new FeeOnTransferERC20();
        ListingFactoryV6 feeFactory = new ListingFactoryV6(address(feeToken), "https://example.test");

        vm.prank(PRODUCER);
        (address feeEscrowAddress,) =
            feeFactory.createListing(CATEGORY_CRAFT, "Fee Listing", "Fee listing", TOTAL_AMOUNT, "ipfs://fee");
        MilestoneEscrowV6 feeEscrow = MilestoneEscrowV6(feeEscrowAddress);

        feeToken.mint(BUYER, TOTAL_AMOUNT * 2);
        vm.startPrank(BUYER);
        feeToken.approve(address(feeEscrow), type(uint256).max);
        vm.expectRevert(MilestoneEscrowV6.InsufficientTokenReceived.selector);
        feeEscrow.lock();
        vm.stopPrank();
    }
}
