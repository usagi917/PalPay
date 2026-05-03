// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {EscrowDeployerV6} from "./EscrowDeployerV6.sol";

/**
 * @title ListingFactoryV6
 * @notice Factory for one allowed stablecoin. Deploy JPYC and USDC factories separately.
 */
contract ListingFactoryV6 is ERC721 {
    address public immutable tokenAddress;
    address public immutable jpycTokenAddress;
    address public immutable usdcTokenAddress;
    address public immutable escrowDeployer;
    address[] public listings;
    mapping(uint256 => address) public tokenIdToEscrow;
    uint256 private _nextTokenId;
    string public baseURI;

    event ListingCreated(
        uint256 indexed tokenId,
        address indexed escrow,
        address indexed producer,
        uint256 totalAmount
    );

    error InvalidToken();
    error InvalidAmount();
    error UnsupportedStablecoin();
    error TransferRestricted();

    constructor(address t, string memory uri, address jpyc, address usdc) ERC721("MilestoneNFT", "MSNFT") {
        if (t == address(0) || jpyc == address(0) || usdc == address(0)) revert InvalidToken();
        if (t != jpyc && t != usdc) revert UnsupportedStablecoin();

        tokenAddress = t;
        jpycTokenAddress = jpyc;
        usdcTokenAddress = usdc;
        baseURI = uri;
        escrowDeployer = address(new EscrowDeployerV6());
    }

    function createListing(
        string calldata _title,
        string calldata desc,
        uint256 amt,
        string calldata img
    ) external returns (address escrow, uint256 tid) {
        if (amt == 0) revert InvalidAmount();

        tid = _nextTokenId++;
        escrow =
            EscrowDeployerV6(escrowDeployer).deployEscrow(tokenAddress, msg.sender, tid, _title, desc, amt, img);
        listings.push(escrow);
        tokenIdToEscrow[tid] = escrow;
        _safeMint(escrow, tid);

        emit ListingCreated(tid, escrow, msg.sender, amt);
    }

    function getListings() external view returns (address[] memory) {
        return listings;
    }

    function getListingCount() external view returns (uint256) {
        return listings.length;
    }

    function tokenURI(uint256 tid) public view override returns (string memory) {
        _requireOwned(tid);
        return string.concat(baseURI, "/api/nft/", _toString(tid), "?factoryAddress=", _addressToString(address(this)));
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            address escrow = tokenIdToEscrow[tokenId];
            if (auth != escrow) revert TransferRestricted();
        }
        return super._update(to, tokenId, auth);
    }

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

    function _addressToString(address account) internal pure returns (string memory) {
        bytes20 value = bytes20(account);
        bytes16 symbols = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i; i < 20; i++) {
            str[2 + i * 2] = symbols[uint8(value[i] >> 4)];
            str[3 + i * 2] = symbols[uint8(value[i] & 0x0f)];
        }
        return string(str);
    }
}
