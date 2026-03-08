// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../contracts/ListingFactoryV6.sol";
import "./utils/EscrowFixture.sol";

contract MilestoneEscrowV6Test is EscrowFixture {
    function testApproveBeforeLockTimeoutMovesToActive() public {
        _lockAs(BUYER);

        vm.warp(escrow.lockedAt() + escrow.LOCK_TIMEOUT() - 1);
        vm.prank(BUYER);
        escrow.approve();

        assertEq(uint256(uint8(escrow.getStatusEnum())), uint256(uint8(MilestoneEscrowV6.Status.ACTIVE)), "status should become active");
    }

    function testCancelBeforeLockTimeoutRefundsBuyer() public {
        _lockAs(BUYER);

        vm.warp(escrow.lockedAt() + escrow.LOCK_TIMEOUT() - 1);
        vm.prank(BUYER);
        escrow.cancel();

        assertEq(uint256(uint8(escrow.getStatusEnum())), uint256(uint8(MilestoneEscrowV6.Status.OPEN)), "status should reopen");
        assertEq(factory.ownerOf(tokenId), PRODUCER, "producer should recover the NFT");
        assertEq(token.balanceOf(BUYER), TOTAL_AMOUNT * 2, "buyer should be fully refunded");
    }

    function testApproveAndCancelFailAtExactLockDeadlineButActivateSucceeds() public {
        _lockAs(BUYER);

        uint256 deadline = escrow.lockedAt() + escrow.LOCK_TIMEOUT();
        vm.warp(deadline);

        vm.expectRevert(MilestoneEscrowV6.LockTimeoutExpired.selector);
        vm.prank(BUYER);
        escrow.approve();

        vm.expectRevert(MilestoneEscrowV6.LockTimeoutExpired.selector);
        vm.prank(BUYER);
        escrow.cancel();

        vm.prank(STRANGER);
        escrow.activateAfterTimeout();

        assertEq(uint256(uint8(escrow.getStatusEnum())), uint256(uint8(MilestoneEscrowV6.Status.ACTIVE)), "timeout activation should succeed at deadline");
    }

    function testActivateAfterTimeoutBeforeDeadlineReverts() public {
        _lockAs(BUYER);

        vm.expectRevert(MilestoneEscrowV6.LockTimeoutNotReached.selector);
        vm.prank(STRANGER);
        escrow.activateAfterTimeout();
    }

    function testRequestFinalDeliveryRequiresCompletedPreviousMilestones() public {
        _lockAs(BUYER);
        _approveLockedAsBuyer();

        vm.expectRevert(MilestoneEscrowV6.PreviousMilestonesIncomplete.selector);
        vm.prank(PRODUCER);
        escrow.requestFinalDelivery(keccak256("final"));
    }

    function testRequestFinalDeliveryCannotBeCalledTwice() public {
        _lockAs(BUYER);
        _approveLockedAsBuyer();
        _completeNonFinalMilestones();

        _requestFinalDelivery(keccak256("final"));

        vm.expectRevert(MilestoneEscrowV6.FinalDeliveryAlreadyRequested.selector);
        vm.prank(PRODUCER);
        escrow.requestFinalDelivery(keccak256("final-2"));
    }

    function testConfirmDeliveryRequiresRequestedFinalDelivery() public {
        _lockAs(BUYER);
        _approveLockedAsBuyer();
        _completeNonFinalMilestones();

        vm.expectRevert(MilestoneEscrowV6.FinalConfirmationNotRequested.selector);
        vm.prank(BUYER);
        escrow.confirmDelivery();
    }

    function testConfirmDeliveryCompletesFinalMilestoneBeforeTimeout() public {
        bytes32 finalEvidenceHash = keccak256("final-evidence");

        _lockAs(BUYER);
        _approveLockedAsBuyer();
        _completeNonFinalMilestones();
        _requestFinalDelivery(finalEvidenceHash);

        vm.warp(escrow.finalRequestedAt() + escrow.FINAL_CONFIRM_TIMEOUT() - 1);
        vm.prank(BUYER);
        escrow.confirmDelivery();

        uint256 lastIndex = escrow.getMilestoneCount() - 1;
        assertEq(uint256(uint8(escrow.getStatusEnum())), uint256(uint8(MilestoneEscrowV6.Status.COMPLETED)), "status should become completed");
        assertEq(token.balanceOf(PRODUCER), TOTAL_AMOUNT, "producer should receive the full amount");
        assertEq(escrow.releasedAmount(), TOTAL_AMOUNT, "released amount should equal total");
        assertEq(escrow.getEvidenceHash(lastIndex), finalEvidenceHash, "final evidence hash should be stored");
        assertEq(escrow.finalRequestedAt(), 0, "final request timestamp should reset");
        assertEq(escrow.finalEvidenceHash(), bytes32(0), "final evidence hash should clear after completion");
    }

    function testFinalizeAfterTimeoutCompletesListingAtExactDeadline() public {
        bytes32 finalEvidenceHash = keccak256("timeout-final");

        _lockAs(BUYER);
        _approveLockedAsBuyer();
        _completeNonFinalMilestones();
        _requestFinalDelivery(finalEvidenceHash);

        uint256 deadline = escrow.finalRequestedAt() + escrow.FINAL_CONFIRM_TIMEOUT();
        vm.warp(deadline);

        vm.expectRevert(MilestoneEscrowV6.FinalConfirmationTimeoutExpired.selector);
        vm.prank(BUYER);
        escrow.confirmDelivery();

        vm.prank(STRANGER);
        escrow.finalizeAfterTimeout();

        uint256 lastIndex = escrow.getMilestoneCount() - 1;
        assertEq(uint256(uint8(escrow.getStatusEnum())), uint256(uint8(MilestoneEscrowV6.Status.COMPLETED)), "timeout finalize should complete the listing");
        assertEq(token.balanceOf(PRODUCER), TOTAL_AMOUNT, "producer should receive the full amount after timeout");
        assertEq(escrow.getEvidenceHash(lastIndex), finalEvidenceHash, "stored evidence should match the producer request");
    }

    function testGetCoreIncludesCancelCount() public {
        _lockAs(BUYER);

        vm.prank(BUYER);
        escrow.cancel();

        (
            address coreFactory,
            address coreToken,
            address coreProducer,
            address coreBuyer,
            uint256 coreTokenId,
            uint256 coreTotalAmount,
            uint256 coreReleasedAmount,
            MilestoneEscrowV6.Status coreStatus,
            uint256 coreCancelCount
        ) = escrow.getCore();

        assertEq(coreFactory, address(factory), "core factory should match");
        assertEq(coreToken, address(token), "core token should match");
        assertEq(coreProducer, PRODUCER, "core producer should match");
        assertEq(coreBuyer, address(0), "core buyer should clear after cancel");
        assertEq(coreTokenId, tokenId, "core tokenId should stay stable");
        assertEq(coreTotalAmount, TOTAL_AMOUNT, "core total amount should match");
        assertEq(coreReleasedAmount, 0, "core released amount should remain zero");
        assertEq(uint256(uint8(coreStatus)), uint256(uint8(MilestoneEscrowV6.Status.OPEN)), "core status should reopen");
        assertEq(coreCancelCount, 1, "core cancel count should include history");
    }
}
