// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../contracts/ListingFactoryV6.sol";
import "../../contracts/MockERC20.sol";
import "./TestBase.sol";

abstract contract EscrowTestBase is TestBase {
    address internal constant producer = address(0xA11CE);
    address internal constant buyer = address(0xB0B);
    address internal constant buyer2 = address(0xB0B2);
    address internal constant outsider = address(0xCAFE);

    uint256 internal constant TOTAL_AMOUNT = 1_000_000_000;

    MockERC20 internal token;
    ListingFactoryV6 internal factory;
    MilestoneEscrowV6 internal escrow;
    uint256 internal tokenId;

    function setUp() public virtual {
        token = new MockERC20("Mock JPYC", "MJPYC", 6);
        factory = new ListingFactoryV6(address(token), "https://example.com");
        (escrow, tokenId) = _createListing(factory, token, producer, 2, TOTAL_AMOUNT);

        _mintAndApprove(token, buyer, address(escrow), TOTAL_AMOUNT * 10);
        _mintAndApprove(token, buyer2, address(escrow), TOTAL_AMOUNT * 10);
    }

    function _createListing(ListingFactoryV6 factory_, MockERC20, address producer_, uint8 cat, uint256 amount)
        internal
        returns (MilestoneEscrowV6 escrow_, uint256 tokenId_)
    {
        vm.prank(producer_);
        (address escrowAddress, uint256 createdTokenId) =
            factory_.createListing(cat, "Listing", "Description", amount, "ipfs://image");
        return (MilestoneEscrowV6(escrowAddress), createdTokenId);
    }

    function _mintAndApprove(MockERC20 token_, address user, address spender, uint256 amount) internal {
        token_.mint(user, amount);
        vm.prank(user);
        token_.approve(spender, type(uint256).max);
    }

    function _lock(address buyer_) internal {
        vm.prank(buyer_);
        escrow.lock();
    }

    function _lockAndApprove(address buyer_) internal {
        _lock(buyer_);
        vm.prank(buyer_);
        escrow.approve();
    }

    function _completeIntermediateMilestones() internal {
        uint256 lastIndex = escrow.getMilestoneCount() - 1;
        for (uint256 i; i < lastIndex; i++) {
            vm.prank(producer);
            escrow.submit(i, keccak256(abi.encodePacked("evidence", i)));
        }
    }
}
