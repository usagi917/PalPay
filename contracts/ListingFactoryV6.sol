// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MilestoneEscrowV6
 * @notice Per-listing escrow with buyer approval flow and XMTP chat support
 * @dev V6 adds:
 *   - Status enum: OPEN, LOCKED, ACTIVE, COMPLETED, CANCELLED
 *   - approve(): Buyer approves to start milestones
 *   - cancel(): Buyer can cancel with full refund (LOCKED only)
 *   - confirmDelivery(): Buyer confirms final milestone
 *   - Adjusted bps: small first, large last (incentivizes delivery)
 */
contract MilestoneEscrowV6 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status { OPEN, LOCKED, ACTIVE, COMPLETED, CANCELLED }

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

    mapping(uint256 => bytes32) public evidenceHashes;

    event Locked(address indexed buyer, uint256 amount);
    event Approved(address indexed buyer);
    event Cancelled(address indexed buyer, uint256 refundAmount);
    event Completed(uint256 indexed index, uint256 amount, bytes32 evidenceHash);
    event DeliveryConfirmed(address indexed buyer, uint256 amount);

    error Unauthorized();
    error InvalidState();
    error InvalidCategory();
    error InvalidAmount();
    error InvalidToken();
    error SelfPurchase();
    error PreviousMilestonesIncomplete();

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
        if (f == address(0) || t == address(0)) revert InvalidToken();
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

        // V6: Adjusted bps - small first, large last (requires buyer confirmation)
        // wagyu (11 steps): 300,500,500,500,500,500,500,500,700,1500,4000 = 10000
        uint16[11] memory w = [uint16(300), 500, 500, 500, 500, 500, 500, 500, 700, 1500, 4000];
        // sake (5 steps): 1000,1500,1500,2000,4000 = 10000
        uint16[5] memory s = [uint16(1000), 1500, 1500, 2000, 4000];
        // craft (4 steps): 1000,2000,2500,4500 = 10000
        uint16[4] memory c = [uint16(1000), 2000, 2500, 4500];

        if (cat == 0) for (uint i; i < 11; i++) milestones.push(Milestone(w[i], false));
        else if (cat == 1) for (uint i; i < 5; i++) milestones.push(Milestone(s[i], false));
        else for (uint i; i < 4; i++) milestones.push(Milestone(c[i], false));
    }

    /**
     * @notice Buyer purchases the listing
     * @dev Transfers JPYC to escrow and NFT to buyer, status -> LOCKED
     */
    function lock() external nonReentrant {
        if (status != Status.OPEN) revert InvalidState();
        if (msg.sender == producer) revert SelfPurchase();

        buyer = msg.sender;
        status = Status.LOCKED;

        IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), totalAmount);
        IERC721(factory).safeTransferFrom(address(this), msg.sender, tokenId);

        emit Locked(msg.sender, totalAmount);
    }

    /**
     * @notice Buyer approves to start milestones
     * @dev Only buyer, only when LOCKED, status -> ACTIVE
     */
    function approve() external nonReentrant {
        if (msg.sender != buyer) revert Unauthorized();
        if (status != Status.LOCKED) revert InvalidState();

        status = Status.ACTIVE;
        emit Approved(msg.sender);
    }

    /**
     * @notice Buyer cancels the purchase and gets full refund
     * @dev Only buyer, only when LOCKED, returns JPYC and NFT
     */
    function cancel() external nonReentrant {
        if (msg.sender != buyer) revert Unauthorized();
        if (status != Status.LOCKED) revert InvalidState();

        status = Status.CANCELLED;

        // Full refund to buyer
        IERC20(tokenAddress).safeTransfer(buyer, totalAmount);

        // Return NFT to escrow (from buyer)
        IERC721(factory).safeTransferFrom(buyer, address(this), tokenId);

        emit Cancelled(buyer, totalAmount);
    }

    /**
     * @notice Producer submits milestone completion (except last)
     * @dev Only producer, only ACTIVE, must be sequential, last milestone uses confirmDelivery
     */
    function submit(uint256 i, bytes32 _evidenceHash) external nonReentrant {
        if (msg.sender != producer) revert Unauthorized();
        if (status != Status.ACTIVE) revert InvalidState();

        // Cannot submit last milestone - use confirmDelivery instead
        if (i >= milestones.length - 1) revert InvalidState();
        if (milestones[i].completed) revert InvalidState();

        // Must be sequential
        uint256 nextIndex = _nextIncompleteIndex();
        if (i != nextIndex) revert InvalidState();

        milestones[i].completed = true;
        evidenceHashes[i] = _evidenceHash;

        uint256 amt = (totalAmount * milestones[i].bps) / 10000;
        releasedAmount += amt;

        IERC20(tokenAddress).safeTransfer(producer, amt);
        emit Completed(i, amt, _evidenceHash);
    }

    /**
     * @notice Buyer confirms final milestone delivery
     * @dev Only buyer, only ACTIVE, all previous milestones must be complete
     */
    function confirmDelivery(bytes32 _evidenceHash) external nonReentrant {
        if (msg.sender != buyer) revert Unauthorized();
        if (status != Status.ACTIVE) revert InvalidState();

        uint256 lastIndex = milestones.length - 1;
        if (milestones[lastIndex].completed) revert InvalidState();

        // All previous milestones must be complete
        for (uint256 i = 0; i < lastIndex; i++) {
            if (!milestones[i].completed) revert PreviousMilestonesIncomplete();
        }

        milestones[lastIndex].completed = true;
        evidenceHashes[lastIndex] = _evidenceHash;

        // Final payment: remaining balance to avoid rounding errors
        uint256 amt = totalAmount - releasedAmount;
        releasedAmount = totalAmount;

        IERC20(tokenAddress).safeTransfer(producer, amt);

        status = Status.COMPLETED;
        emit Completed(lastIndex, amt, _evidenceHash);
        emit DeliveryConfirmed(buyer, amt);
    }

    function _nextIncompleteIndex() internal view returns (uint256) {
        for (uint256 j; j < milestones.length; j++) {
            if (!milestones[j].completed) return j;
        }
        return milestones.length;
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
        if (status == Status.CANCELLED) return "cancelled";
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
        returns (address, address, address, address, uint256, uint256, uint256, Status)
    {
        return (factory, tokenAddress, producer, buyer, tokenId, totalAmount, releasedAmount, status);
    }

    function getMeta()
        external
        view
        returns (string memory, string memory, string memory, string memory, string memory)
    {
        return (category(), title, description, imageURI, getStatus());
    }

    function getEvidenceHash(uint256 i) external view returns (bytes32) {
        return evidenceHashes[i];
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}

/**
 * @title ListingFactoryV6
 * @notice Factory for creating MilestoneEscrowV6 contracts with approval flow
 */
contract ListingFactoryV6 is ERC721 {
    address public immutable tokenAddress;
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

    constructor(address t, string memory uri) ERC721("MilestoneNFT", "MSNFT") {
        if (t == address(0)) revert InvalidToken();
        tokenAddress = t;
        baseURI = uri;
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
        escrow = address(
            new MilestoneEscrowV6(address(this), tokenAddress, msg.sender, tid, cat, _title, desc, amt, img)
        );
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
