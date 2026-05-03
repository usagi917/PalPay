// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../contracts/ListingFactoryV6.sol";
import "../contracts/MilestoneEscrowV6.sol";
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

contract OutboundFeeERC20 is MockERC20 {
    uint256 internal constant FEE_BPS = 500;
    address internal constant FEE_COLLECTOR = address(0xFEE);
    address internal feeExemptRecipient;

    constructor() MockERC20("Outbound Fee Token", "OFEE", 18) { }

    function setFeeExemptRecipient(address recipient) external {
        feeExemptRecipient = recipient;
    }

    function _update(address from, address to, uint256 value) internal virtual override {
        if (from == address(0) || to == address(0) || to == feeExemptRecipient) {
            super._update(from, to, value);
            return;
        }

        uint256 fee = (value * FEE_BPS) / 10_000;
        uint256 netAmount = value - fee;
        super._update(from, FEE_COLLECTOR, fee);
        super._update(from, to, netAmount);
    }
}

contract SenderPaidFeeERC20 is MockERC20 {
    uint256 internal constant FEE_BPS = 500;
    address internal constant FEE_COLLECTOR = address(0xFEE);
    address internal feeExemptRecipient;

    constructor() MockERC20("Sender Paid Fee Token", "SPFEE", 18) { }

    function setFeeExemptRecipient(address recipient) external {
        feeExemptRecipient = recipient;
    }

    function _update(address from, address to, uint256 value) internal virtual override {
        if (from == address(0) || to == address(0) || to == feeExemptRecipient) {
            super._update(from, to, value);
            return;
        }

        uint256 fee = (value * FEE_BPS) / 10_000;
        super._update(from, FEE_COLLECTOR, fee);
        super._update(from, to, value);
    }
}

contract NonReceiverProducer {
    function createListing(ListingFactoryV6 factory, string memory title, string memory description, uint256 amount, string memory imageURI)
        external
        returns (address escrow, uint256 tokenId)
    {
        return factory.createListing(title, description, amount, imageURI);
    }
}

contract ListingFactoryV6Test is EscrowFixture {
    function _createOutboundFeeEscrow() internal returns (OutboundFeeERC20 feeToken, MilestoneEscrowV6 feeEscrow) {
        feeToken = new OutboundFeeERC20();
        ListingFactoryV6 feeFactory =
            new ListingFactoryV6(address(feeToken), "https://example.test", address(feeToken), address(usdcToken));

        vm.prank(PRODUCER);
        (address feeEscrowAddress,) =
            feeFactory.createListing("Outbound Fee Listing", "Fee on payout", TOTAL_AMOUNT, "ipfs://outbound-fee");
        feeEscrow = MilestoneEscrowV6(feeEscrowAddress);
        feeToken.setFeeExemptRecipient(feeEscrowAddress);
    }

    function _lockOutboundFeeEscrow(OutboundFeeERC20 feeToken, MilestoneEscrowV6 feeEscrow) internal {
        feeToken.mint(BUYER, TOTAL_AMOUNT * 2);
        vm.startPrank(BUYER);
        feeToken.approve(address(feeEscrow), type(uint256).max);
        feeEscrow.lock();
        vm.stopPrank();
    }

    function testCreateListingMintsNFTToEscrow() public view {
        assertEq(factory.ownerOf(tokenId), escrowAddress, "escrow should hold the NFT after creation");
        assertEq(factory.tokenIdToEscrow(tokenId), escrowAddress, "factory should map tokenId to escrow");
        assertEq(factory.getListingCount(), 1, "factory should track one listing");
    }

    function testConstructorAcceptsJpycAndUsdcFactories() public {
        ListingFactoryV6 jpycFactory = _newFactory(address(token));
        ListingFactoryV6 usdcFactory = _newFactory(address(usdcToken));

        assertEq(jpycFactory.tokenAddress(), address(token), "JPYC factory should use JPYC token");
        assertEq(usdcFactory.tokenAddress(), address(usdcToken), "USDC factory should use USDC token");
    }

    function testConstructorRejectsUnsupportedStablecoin() public {
        MockERC20 unsupported = new MockERC20("Unsupported", "BAD", 18);

        vm.expectRevert(ListingFactoryV6.UnsupportedStablecoin.selector);
        new ListingFactoryV6(address(unsupported), "https://example.test", address(token), address(usdcToken));
    }

    function testCancelReopensListingAndAllowsRelist() public {
        _lockAs(BUYER);

        vm.prank(BUYER);
        escrow.cancel();

        assertEq(factory.ownerOf(tokenId), escrowAddress, "escrow should regain the NFT after cancel");
        assertEq(uint256(uint8(escrow.getStatusEnum())), uint256(uint8(MilestoneEscrowV6.Status.OPEN)), "status should reopen");
        assertEq(escrow.buyer(), address(0), "buyer should be cleared after cancel");
        assertEq(escrow.cancelCount(), 1, "cancel count should increment");
        assertEq(token.balanceOf(BUYER), TOTAL_AMOUNT * 2, "buyer should receive a full refund");

        _lockAs(SECOND_BUYER);

        assertEq(factory.ownerOf(tokenId), SECOND_BUYER, "relisted NFT should move directly from escrow to new buyer");
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
        ListingFactoryV6 feeFactory =
            new ListingFactoryV6(address(feeToken), "https://example.test", address(feeToken), address(usdcToken));

        vm.prank(PRODUCER);
        (address feeEscrowAddress,) =
            feeFactory.createListing("Fee Listing", "Fee listing", TOTAL_AMOUNT, "ipfs://fee");
        MilestoneEscrowV6 feeEscrow = MilestoneEscrowV6(feeEscrowAddress);

        feeToken.mint(BUYER, TOTAL_AMOUNT * 2);
        vm.startPrank(BUYER);
        feeToken.approve(address(feeEscrow), type(uint256).max);
        vm.expectRevert(MilestoneEscrowV6.InsufficientTokenReceived.selector);
        feeEscrow.lock();
        vm.stopPrank();
    }

    function testCancelSucceedsWhenProducerCannotReceiveERC721() public {
        MockERC20 localToken = new MockERC20("Mock Token", "MOCK", 18);
        ListingFactoryV6 localFactory =
            new ListingFactoryV6(address(localToken), "https://example.test", address(localToken), address(usdcToken));
        NonReceiverProducer producerContract = new NonReceiverProducer();

        (address localEscrowAddress, uint256 localTokenId) = producerContract.createListing(
            localFactory, "Contract Producer Listing", "Non receiver producer", TOTAL_AMOUNT, "ipfs://contract-producer"
        );
        MilestoneEscrowV6 localEscrow = MilestoneEscrowV6(localEscrowAddress);

        localToken.mint(BUYER, TOTAL_AMOUNT * 2);
        vm.startPrank(BUYER);
        localToken.approve(address(localEscrow), type(uint256).max);
        localEscrow.lock();
        localEscrow.cancel();
        vm.stopPrank();

        assertEq(localFactory.ownerOf(localTokenId), localEscrowAddress, "escrow should retain custody after cancel");
        assertEq(localToken.balanceOf(BUYER), TOTAL_AMOUNT * 2, "buyer should still receive a full refund");
    }

    function testCancelRevertsWhenTokenShortChangesRefund() public {
        (OutboundFeeERC20 feeToken, MilestoneEscrowV6 feeEscrow) = _createOutboundFeeEscrow();

        _lockOutboundFeeEscrow(feeToken, feeEscrow);

        vm.startPrank(BUYER);
        vm.expectRevert(MilestoneEscrowV6.InexactTokenTransfer.selector);
        feeEscrow.cancel();
        vm.stopPrank();
    }

    function testSubmitRevertsWhenTokenShortChangesProducerPayout() public {
        (OutboundFeeERC20 feeToken, MilestoneEscrowV6 feeEscrow) = _createOutboundFeeEscrow();

        _lockOutboundFeeEscrow(feeToken, feeEscrow);

        vm.prank(BUYER);
        feeEscrow.approve();

        vm.expectRevert(MilestoneEscrowV6.InexactTokenTransfer.selector);
        vm.prank(PRODUCER);
        feeEscrow.submit(0, keccak256("evidence"));
    }

    function testSubmitWorksWithExactToken() public {
        _lockAs(BUYER);
        _approveLockedAsBuyer();

        vm.prank(PRODUCER);
        escrow.submit(0, keccak256("evidence"));

        uint256 firstMilestoneAmount = (TOTAL_AMOUNT * 200) / 10_000;
        assertEq(token.balanceOf(PRODUCER), firstMilestoneAmount, "producer should receive the exact milestone payout");
        assertEq(escrow.releasedAmount(), firstMilestoneAmount, "released amount should track the milestone amount");
        assertEq(escrow.nextMilestoneIndex(), 1, "next milestone should advance");
    }

    function testSubmitRevertsWhenEscrowPaysAdditionalSenderFee() public {
        SenderPaidFeeERC20 feeToken = new SenderPaidFeeERC20();
        ListingFactoryV6 feeFactory =
            new ListingFactoryV6(address(feeToken), "https://example.test", address(feeToken), address(usdcToken));

        vm.prank(PRODUCER);
        (address feeEscrowAddress,) =
            feeFactory.createListing("Sender Fee Listing", "Fee from sender", TOTAL_AMOUNT, "ipfs://sender-fee");
        MilestoneEscrowV6 feeEscrow = MilestoneEscrowV6(feeEscrowAddress);
        feeToken.setFeeExemptRecipient(feeEscrowAddress);

        feeToken.mint(BUYER, TOTAL_AMOUNT * 2);
        vm.startPrank(BUYER);
        feeToken.approve(address(feeEscrow), type(uint256).max);
        feeEscrow.lock();
        feeEscrow.approve();
        vm.stopPrank();

        vm.expectRevert(MilestoneEscrowV6.InexactTokenTransfer.selector);
        vm.prank(PRODUCER);
        feeEscrow.submit(0, keccak256("evidence"));
    }

    function testSubmitHandlesLargeTotalAmountWithoutOverflow() public {
        uint256 largeAmount = (type(uint256).max / 1000) + 1;
        MockERC20 largeToken = new MockERC20("Large Token", "LARGE", 18);
        ListingFactoryV6 largeFactory =
            new ListingFactoryV6(address(largeToken), "https://example.test", address(largeToken), address(usdcToken));

        vm.prank(PRODUCER);
        (address largeEscrowAddress,) =
            largeFactory.createListing("Large Listing", "Large total", largeAmount, "ipfs://large");
        MilestoneEscrowV6 largeEscrow = MilestoneEscrowV6(largeEscrowAddress);

        largeToken.mint(BUYER, largeAmount);
        vm.startPrank(BUYER);
        largeToken.approve(address(largeEscrow), largeAmount);
        largeEscrow.lock();
        largeEscrow.approve();
        vm.stopPrank();

        vm.prank(PRODUCER);
        largeEscrow.submit(0, keccak256("large-evidence"));

        uint256 expectedFirstMilestoneAmount = (largeAmount * 200) / 10_000;
        assertEq(largeEscrow.releasedAmount(), expectedFirstMilestoneAmount, "released amount should use overflow-safe math");
        assertEq(largeToken.balanceOf(PRODUCER), expectedFirstMilestoneAmount, "producer should receive the first milestone");
    }

    function testConfirmDeliveryWorksWithExactToken() public {
        bytes32 finalEvidenceHash = keccak256("final-evidence");

        _lockAs(BUYER);
        _approveLockedAsBuyer();
        _completeNonFinalMilestones();
        _requestFinalDelivery(finalEvidenceHash);

        vm.prank(BUYER);
        escrow.confirmDelivery();

        uint256 lastIndex = escrow.getMilestoneCount() - 1;
        assertEq(uint256(uint8(escrow.getStatusEnum())), uint256(uint8(MilestoneEscrowV6.Status.COMPLETED)), "status should become completed");
        assertEq(token.balanceOf(PRODUCER), TOTAL_AMOUNT, "producer should receive the full amount");
        assertEq(escrow.getEvidenceHash(lastIndex), finalEvidenceHash, "final evidence should be stored");
    }

    function testFinalizeAfterTimeoutWorksWithExactToken() public {
        bytes32 finalEvidenceHash = keccak256("timeout-final-evidence");

        _lockAs(BUYER);
        _approveLockedAsBuyer();
        _completeNonFinalMilestones();
        _requestFinalDelivery(finalEvidenceHash);

        vm.warp(escrow.finalRequestedAt() + escrow.FINAL_CONFIRM_TIMEOUT());

        vm.prank(STRANGER);
        escrow.finalizeAfterTimeout();

        uint256 lastIndex = escrow.getMilestoneCount() - 1;
        assertEq(uint256(uint8(escrow.getStatusEnum())), uint256(uint8(MilestoneEscrowV6.Status.COMPLETED)), "status should become completed");
        assertEq(token.balanceOf(PRODUCER), TOTAL_AMOUNT, "producer should receive the full amount");
        assertEq(escrow.getEvidenceHash(lastIndex), finalEvidenceHash, "final evidence should be stored");
    }
}
