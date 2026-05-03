// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title MilestoneEscrowV6
 * @notice Per-listing escrow with relisting support and milestone-based exact stablecoin payouts.
 */
contract MilestoneEscrowV6 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint16 private constant BPS_DENOMINATOR = 10_000;
    uint256 public constant LOCK_TIMEOUT = 14 days;
    uint256 public constant FINAL_CONFIRM_TIMEOUT = 14 days;

    enum Status {
        OPEN,
        LOCKED,
        ACTIVE,
        COMPLETED
    }

    struct Milestone {
        uint16 bps;
        bool completed;
    }

    address public immutable factory;
    address public immutable tokenAddress;
    address public immutable producer;
    uint256 public immutable tokenId;
    uint256 public immutable totalAmount;

    address public buyer;
    Status public status;
    string public title;
    string public description;
    string public imageURI;
    Milestone[] public milestones;
    uint256 public releasedAmount;
    uint256 public lockedAt;
    uint256 public finalRequestedAt;
    bytes32 public finalEvidenceHash;
    uint256 public cancelCount;

    mapping(uint256 => bytes32) public evidenceHashes;

    event Locked(address indexed buyer, uint256 amount);
    event Approved(address indexed buyer);
    event Cancelled(address indexed buyer, uint256 refundAmount);
    event Completed(uint256 indexed index, uint256 amount, bytes32 evidenceHash);
    event DeliveryConfirmed(address indexed buyer, uint256 amount);
    event ActivatedAfterTimeout(address indexed caller, uint256 activatedAt);
    event FinalDeliveryRequested(bytes32 evidenceHash, uint256 deadline);
    event FinalizedAfterTimeout(address indexed caller, uint256 amount);

    error Unauthorized();
    error InvalidState();
    error InvalidFactory();
    error InvalidAmount();
    error InvalidToken();
    error InvalidProducer();
    error InvalidMilestoneConfig();
    error InvalidMilestoneIndex();
    error UnexpectedNFT();
    error SelfPurchase();
    error PreviousMilestonesIncomplete();
    error LockTimeoutNotReached();
    error LockTimeoutExpired();
    error FinalConfirmationNotRequested();
    error FinalConfirmationTimeoutNotReached();
    error FinalConfirmationTimeoutExpired();
    error InsufficientTokenReceived();
    error InexactTokenTransfer();
    error InvalidNFTOwner();
    error FinalDeliveryAlreadyRequested();

    constructor(
        address f,
        address t,
        address p,
        uint256 tid,
        string memory _title,
        string memory _desc,
        uint256 amt,
        string memory img
    ) {
        if (f == address(0)) revert InvalidFactory();
        if (t == address(0)) revert InvalidToken();
        if (p == address(0)) revert InvalidProducer();
        if (amt == 0) revert InvalidAmount();

        factory = f;
        tokenAddress = t;
        producer = p;
        tokenId = tid;
        title = _title;
        description = _desc;
        totalAmount = amt;
        imageURI = img;
        status = Status.OPEN;

        uint16[10] memory w = [uint16(200), 300, 400, 500, 600, 650, 700, 750, 900, 5000];
        uint256 totalBps;
        for (uint256 i; i < 10; i++) {
            milestones.push(Milestone(w[i], false));
            totalBps += w[i];
        }
        if (totalBps != BPS_DENOMINATOR) revert InvalidMilestoneConfig();
    }

    function lock() external nonReentrant {
        if (status != Status.OPEN) revert InvalidState();
        if (msg.sender == producer) revert SelfPurchase();
        address currentOwner = IERC721(factory).ownerOf(tokenId);
        if (currentOwner != address(this)) revert InvalidNFTOwner();

        uint256 balanceBefore = IERC20(tokenAddress).balanceOf(address(this));
        IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), totalAmount);
        uint256 receivedAmount = IERC20(tokenAddress).balanceOf(address(this)) - balanceBefore;
        if (receivedAmount != totalAmount) revert InsufficientTokenReceived();

        IERC721(factory).safeTransferFrom(currentOwner, msg.sender, tokenId);

        buyer = msg.sender;
        status = Status.LOCKED;
        lockedAt = block.timestamp;
        finalRequestedAt = 0;
        finalEvidenceHash = bytes32(0);

        emit Locked(msg.sender, totalAmount);
    }

    function approve() external nonReentrant {
        if (msg.sender != buyer) revert Unauthorized();
        if (status != Status.LOCKED) revert InvalidState();
        if (block.timestamp >= lockedAt + LOCK_TIMEOUT) revert LockTimeoutExpired();

        status = Status.ACTIVE;
        emit Approved(msg.sender);
    }

    function cancel() external nonReentrant {
        if (msg.sender != buyer) revert Unauthorized();
        if (status != Status.LOCKED) revert InvalidState();
        if (block.timestamp >= lockedAt + LOCK_TIMEOUT) revert LockTimeoutExpired();

        address currentBuyer = buyer;
        if (IERC721(factory).ownerOf(tokenId) != currentBuyer) revert InvalidNFTOwner();

        buyer = address(0);
        status = Status.OPEN;
        lockedAt = 0;
        finalRequestedAt = 0;
        finalEvidenceHash = bytes32(0);
        cancelCount += 1;

        uint256 refundedAmount = _transferOut(currentBuyer, totalAmount);
        IERC721(factory).safeTransferFrom(currentBuyer, address(this), tokenId);

        emit Cancelled(currentBuyer, refundedAmount);
    }

    function activateAfterTimeout() external nonReentrant {
        if (status != Status.LOCKED) revert InvalidState();
        if (block.timestamp < lockedAt + LOCK_TIMEOUT) revert LockTimeoutNotReached();

        status = Status.ACTIVE;
        emit ActivatedAfterTimeout(msg.sender, block.timestamp);
    }

    function submit(uint256 i, bytes32 _evidenceHash) external nonReentrant {
        if (msg.sender != producer) revert Unauthorized();
        if (status != Status.ACTIVE) revert InvalidState();
        if (i >= milestones.length - 1) revert InvalidMilestoneIndex();
        if (milestones[i].completed) revert InvalidState();
        if (i != _nextIncompleteIndex()) revert InvalidState();

        milestones[i].completed = true;
        evidenceHashes[i] = _evidenceHash;

        uint256 amt = Math.mulDiv(totalAmount, milestones[i].bps, BPS_DENOMINATOR);
        releasedAmount += amt;

        _transferOut(producer, amt);
        emit Completed(i, amt, _evidenceHash);
    }

    function requestFinalDelivery(bytes32 _evidenceHash) external nonReentrant {
        if (msg.sender != producer) revert Unauthorized();
        if (status != Status.ACTIVE) revert InvalidState();
        if (finalRequestedAt != 0) revert FinalDeliveryAlreadyRequested();

        uint256 lastIndex = milestones.length - 1;
        if (milestones[lastIndex].completed) revert InvalidState();
        for (uint256 i = 0; i < lastIndex; i++) {
            if (!milestones[i].completed) revert PreviousMilestonesIncomplete();
        }

        finalRequestedAt = block.timestamp;
        finalEvidenceHash = _evidenceHash;

        emit FinalDeliveryRequested(_evidenceHash, block.timestamp + FINAL_CONFIRM_TIMEOUT);
    }

    function confirmDelivery() external nonReentrant {
        if (msg.sender != buyer) revert Unauthorized();
        if (status != Status.ACTIVE) revert InvalidState();
        if (finalRequestedAt == 0) revert FinalConfirmationNotRequested();
        if (block.timestamp >= finalRequestedAt + FINAL_CONFIRM_TIMEOUT) revert FinalConfirmationTimeoutExpired();

        (uint256 lastIndex, uint256 amt, bytes32 evidenceHash) = _completeFinalMilestone();

        emit Completed(lastIndex, amt, evidenceHash);
        emit DeliveryConfirmed(buyer, amt);
    }

    function finalizeAfterTimeout() external nonReentrant {
        if (status != Status.ACTIVE) revert InvalidState();
        if (finalRequestedAt == 0) revert FinalConfirmationNotRequested();
        if (block.timestamp < finalRequestedAt + FINAL_CONFIRM_TIMEOUT) revert FinalConfirmationTimeoutNotReached();

        (uint256 lastIndex, uint256 amt, bytes32 evidenceHash) = _completeFinalMilestone();

        emit Completed(lastIndex, amt, evidenceHash);
        emit FinalizedAfterTimeout(msg.sender, amt);
    }

    function _nextIncompleteIndex() internal view returns (uint256) {
        for (uint256 j; j < milestones.length; j++) {
            if (!milestones[j].completed) return j;
        }
        return milestones.length;
    }

    function _completeFinalMilestone() internal returns (uint256 lastIndex, uint256 amt, bytes32 evidenceHash) {
        lastIndex = milestones.length - 1;
        if (milestones[lastIndex].completed) revert InvalidState();
        for (uint256 i = 0; i < lastIndex; i++) {
            if (!milestones[i].completed) revert PreviousMilestonesIncomplete();
        }

        evidenceHash = finalEvidenceHash;
        milestones[lastIndex].completed = true;
        evidenceHashes[lastIndex] = evidenceHash;

        amt = totalAmount - releasedAmount;
        releasedAmount = totalAmount;
        status = Status.COMPLETED;
        finalRequestedAt = 0;
        finalEvidenceHash = bytes32(0);

        _transferOut(producer, amt);
    }

    function _transferOut(address recipient, uint256 amount) internal returns (uint256 receivedAmount) {
        IERC20 token = IERC20(tokenAddress);
        uint256 escrowBalanceBefore = token.balanceOf(address(this));
        uint256 recipientBalanceBefore = token.balanceOf(recipient);

        token.safeTransfer(recipient, amount);

        uint256 escrowBalanceAfter = token.balanceOf(address(this));
        uint256 recipientBalanceAfter = token.balanceOf(recipient);
        if (escrowBalanceAfter > escrowBalanceBefore || recipientBalanceAfter < recipientBalanceBefore) {
            revert InexactTokenTransfer();
        }

        uint256 spentAmount = escrowBalanceBefore - escrowBalanceAfter;
        receivedAmount = recipientBalanceAfter - recipientBalanceBefore;
        if (spentAmount != amount || receivedAmount != amount) revert InexactTokenTransfer();
    }

    function getMilestones() external view returns (Milestone[] memory) {
        return milestones;
    }

    function getMilestoneCount() external view returns (uint256) {
        return milestones.length;
    }

    function getProgress() external view returns (uint256 comp, uint256 total) {
        total = milestones.length;
        for (uint256 i; i < total; i++) if (milestones[i].completed) comp++;
    }

    function getStatus() public view returns (string memory) {
        if (status == Status.OPEN) return "open";
        if (status == Status.LOCKED) return "locked";
        if (status == Status.ACTIVE) return "active";
        if (status == Status.COMPLETED) return "completed";
        return "unknown";
    }

    function getStatusEnum() external view returns (Status) {
        return status;
    }

    function getCore()
        external
        view
        returns (address, address, address, address, uint256, uint256, uint256, Status, uint256)
    {
        return (factory, tokenAddress, producer, buyer, tokenId, totalAmount, releasedAmount, status, cancelCount);
    }

    function getMeta() external view returns (string memory, string memory, string memory, string memory) {
        return (title, description, imageURI, getStatus());
    }

    function getEvidenceHash(uint256 i) external view returns (bytes32) {
        if (i >= milestones.length) revert InvalidMilestoneIndex();
        return evidenceHashes[i];
    }

    function nextMilestoneIndex() external view returns (uint256) {
        return _nextIncompleteIndex();
    }

    function remainingAmount() external view returns (uint256) {
        return totalAmount - releasedAmount;
    }

    function onERC721Received(address, address, uint256, bytes calldata) external view returns (bytes4) {
        if (msg.sender != factory) revert UnexpectedNFT();
        return this.onERC721Received.selector;
    }
}
