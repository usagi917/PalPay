// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MilestoneEscrowV6
 * @notice Per-listing escrow with relisting support and milestone-based payouts
 */
contract MilestoneEscrowV6 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint16 private constant BPS_DENOMINATOR = 10_000;
    uint256 public constant LOCK_TIMEOUT = 14 days;
    uint256 public constant FINAL_CONFIRM_TIMEOUT = 14 days;

    enum Status { OPEN, LOCKED, ACTIVE, COMPLETED }

    struct Milestone {
        uint16 bps;
        bool completed;
    }

    address public immutable factory;
    address public immutable tokenAddress;
    address public immutable producer;
    uint256 public immutable tokenId;
    uint256 public immutable totalAmount;
    uint8 public immutable categoryType;

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
    error InvalidCategory();
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
        uint8 cat,
        string memory _title,
        string memory _desc,
        uint256 amt,
        string memory img
    ) {
        if (cat > 2) revert InvalidCategory();
        if (f == address(0)) revert InvalidFactory();
        if (t == address(0)) revert InvalidToken();
        if (p == address(0)) revert InvalidProducer();
        if (amt == 0) revert InvalidAmount();

        factory = f;
        tokenAddress = t;
        producer = p;
        tokenId = tid;
        categoryType = cat;
        title = _title;
        description = _desc;
        totalAmount = amt;
        imageURI = img;
        status = Status.OPEN;

        // Adjusted bps: small first, large last (requires buyer confirmation)
        // wagyu (10 steps): 200,300,400,500,600,650,700,750,900,5000 = 10000
        uint16[10] memory w = [uint16(200), 300, 400, 500, 600, 650, 700, 750, 900, 5000];
        // sake (5 steps): 1000,1500,1500,2000,4000 = 10000
        uint16[5] memory s = [uint16(1000), 1500, 1500, 2000, 4000];
        // craft (4 steps): 1000,2000,2500,4500 = 10000
        uint16[4] memory c = [uint16(1000), 2000, 2500, 4500];

        uint256 totalBps;
        if (cat == 0) {
            for (uint256 i; i < 10; i++) {
                milestones.push(Milestone(w[i], false));
                totalBps += w[i];
            }
        } else if (cat == 1) {
            for (uint256 i; i < 5; i++) {
                milestones.push(Milestone(s[i], false));
                totalBps += s[i];
            }
        } else {
            for (uint256 i; i < 4; i++) {
                milestones.push(Milestone(c[i], false));
                totalBps += c[i];
            }
        }
        if (totalBps != BPS_DENOMINATOR) revert InvalidMilestoneConfig();
    }

    /**
     * @notice Buyer purchases the listing
     * @dev Transfers the full token amount to escrow, then moves the NFT to the buyer.
     *      Open listings always keep the NFT in escrow custody.
     */
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

    /**
     * @notice Buyer approves to start milestones
     * @dev Only buyer, only when LOCKED, status -> ACTIVE
     */
    function approve() external nonReentrant {
        if (msg.sender != buyer) revert Unauthorized();
        if (status != Status.LOCKED) revert InvalidState();
        if (block.timestamp >= lockedAt + LOCK_TIMEOUT) revert LockTimeoutExpired();

        status = Status.ACTIVE;
        emit Approved(msg.sender);
    }

    /**
     * @notice Buyer cancels the purchase and gets full refund
     * @dev Only buyer, only when LOCKED, returns funds and restores escrow custody of the NFT
     */
    function cancel() external nonReentrant {
        if (msg.sender != buyer) revert Unauthorized();
        if (status != Status.LOCKED) revert InvalidState();
        if (block.timestamp >= lockedAt + LOCK_TIMEOUT) revert LockTimeoutExpired();

        address currentBuyer = buyer;
        if (IERC721(factory).ownerOf(tokenId) != currentBuyer) revert InvalidNFTOwner();

        // Effects first (CEI pattern)
        buyer = address(0);
        status = Status.OPEN;
        lockedAt = 0;
        finalRequestedAt = 0;
        finalEvidenceHash = bytes32(0);
        cancelCount += 1;

        // Interactions last
        _safeTransferExact(currentBuyer, totalAmount);
        IERC721(factory).safeTransferFrom(currentBuyer, address(this), tokenId);

        emit Cancelled(currentBuyer, totalAmount);
    }

    function activateAfterTimeout() external nonReentrant {
        if (status != Status.LOCKED) revert InvalidState();
        if (block.timestamp < lockedAt + LOCK_TIMEOUT) revert LockTimeoutNotReached();

        status = Status.ACTIVE;
        emit ActivatedAfterTimeout(msg.sender, block.timestamp);
    }

    /**
     * @notice Producer submits milestone completion (except last)
     * @dev Only producer, only ACTIVE, must be sequential, last milestone uses requestFinalDelivery
     */
    function submit(uint256 i, bytes32 _evidenceHash) external nonReentrant {
        if (msg.sender != producer) revert Unauthorized();
        if (status != Status.ACTIVE) revert InvalidState();

        // Cannot submit last milestone - use requestFinalDelivery() then confirmDelivery()
        if (i >= milestones.length - 1) revert InvalidMilestoneIndex();
        if (milestones[i].completed) revert InvalidState();

        // Must be sequential
        uint256 nextIndex = _nextIncompleteIndex();
        if (i != nextIndex) revert InvalidState();

        milestones[i].completed = true;
        evidenceHashes[i] = _evidenceHash;

        uint256 amt = (totalAmount * milestones[i].bps) / BPS_DENOMINATOR;
        releasedAmount += amt;

        _safeTransferExact(producer, amt);
        emit Completed(i, amt, _evidenceHash);
    }

    /**
     * @notice Producer requests final delivery confirmation
     */
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

    /**
     * @notice Buyer confirms final milestone delivery
     * @dev Only buyer, only ACTIVE, only after requestFinalDelivery(), before timeout expiry
     */
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

        _safeTransferExact(producer, amt);
    }

    function _safeTransferExact(address recipient, uint256 amount) internal {
        uint256 balanceBefore = IERC20(tokenAddress).balanceOf(recipient);
        IERC20(tokenAddress).safeTransfer(recipient, amount);
        uint256 receivedAmount = IERC20(tokenAddress).balanceOf(recipient) - balanceBefore;
        if (receivedAmount < amount) revert InexactTokenTransfer();
    }

    // View functions
    function getMilestones() external view returns (Milestone[] memory) {
        return milestones;
    }

    function getMilestoneCount() external view returns (uint256) {
        return milestones.length;
    }

    function getProgress() external view returns (uint256 comp, uint256 total) {
        total = milestones.length;
        for (uint i; i < total; i++) if (milestones[i].completed) comp++;
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

    function category() public view returns (string memory) {
        if (categoryType == 0) return "wagyu";
        if (categoryType == 1) return "sake";
        if (categoryType == 2) return "craft";
        return "other";
    }

    function getCore()
        external
        view
        returns (address, address, address, address, uint256, uint256, uint256, Status, uint256)
    {
        return (factory, tokenAddress, producer, buyer, tokenId, totalAmount, releasedAmount, status, cancelCount);
    }

    function getMeta()
        external
        view
        returns (string memory, string memory, string memory, string memory, string memory)
    {
        return (category(), title, description, imageURI, getStatus());
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

/**
 * @title EscrowDeployerV6
 * @notice Isolates escrow creation bytecode from ListingFactory runtime
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
        uint8 categoryType,
        string calldata title,
        string calldata description,
        uint256 totalAmount,
        string calldata imageURI
    ) external returns (address escrow) {
        if (msg.sender != factory) revert Unauthorized();
        escrow = address(
            new MilestoneEscrowV6(
                factory, tokenAddress, producer, tokenId, categoryType, title, description, totalAmount, imageURI
            )
        );
    }
}

/**
 * @title ListingFactoryV6
 * @notice Factory for creating MilestoneEscrowV6 contracts with approval flow
 */
contract ListingFactoryV6 is ERC721 {
    address public immutable tokenAddress;
    address public immutable escrowDeployer;
    address[] public listings;
    mapping(uint256 => address) public tokenIdToEscrow;
    uint256 private _nextTokenId;
    string public baseURI;

    event ListingCreated(
        uint256 indexed tokenId,
        address indexed escrow,
        address indexed producer,
        uint8 categoryType,
        uint256 totalAmount
    );

    error InvalidCategory();
    error InvalidToken();
    error InvalidAmount();
    error TransferRestricted();

    constructor(address t, string memory uri) ERC721("MilestoneNFT", "MSNFT") {
        if (t == address(0)) revert InvalidToken();
        tokenAddress = t;
        baseURI = uri;
        escrowDeployer = address(new EscrowDeployerV6());
    }

    function createListing(
        uint8 cat,
        string calldata _title,
        string calldata desc,
        uint256 amt,
        string calldata img
    ) external returns (address escrow, uint256 tid) {
        if (cat > 2) revert InvalidCategory();
        if (amt == 0) revert InvalidAmount();

        tid = _nextTokenId++;
        escrow =
            EscrowDeployerV6(escrowDeployer).deployEscrow(tokenAddress, msg.sender, tid, cat, _title, desc, amt, img);
        listings.push(escrow);
        tokenIdToEscrow[tid] = escrow;
        _safeMint(escrow, tid);

        emit ListingCreated(tid, escrow, msg.sender, cat, amt);
    }

    function getListings() external view returns (address[] memory) {
        return listings;
    }

    function getListingCount() external view returns (uint256) {
        return listings.length;
    }

    function tokenURI(uint256 tid) public view override returns (string memory) {
        _requireOwned(tid);
        return string.concat(baseURI, "/api/nft/", _toString(tid));
    }

    /**
     * @dev Restrict secondary transfers to escrow-driven moves only.
     * Allowed flows:
     *  - mint: 0x0 -> escrow
     *  - lock / relock: escrow -> buyer
     *  - cancel: buyer -> escrow
     */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            address escrow = tokenIdToEscrow[tokenId];
            if (auth != escrow) revert TransferRestricted();
        }
        return super._update(to, tokenId, auth);
    }

    /**
     * @dev Allow each escrow contract to move only its corresponding NFT.
     * This enables lock()/cancel() flows without a separate owner approval transaction.
     */
    function _isAuthorized(address owner, address spender, uint256 tokenId) internal view override returns (bool) {
        address escrow = tokenIdToEscrow[tokenId];
        if (owner != address(0) && escrow != address(0) && spender == escrow) {
            return true;
        }
        return super._isAuthorized(owner, spender, tokenId);
    }

    function _toString(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 t = v;
        uint256 d;
        while (t != 0) {
            d++;
            t /= 10;
        }
        bytes memory b = new bytes(d);
        while (v != 0) {
            b[--d] = bytes1(uint8(48 + (v % 10)));
            v /= 10;
        }
        return string(b);
    }
}
