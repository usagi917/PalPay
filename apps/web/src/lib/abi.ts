// ListingFactory ABI (ERC721 + Factory functions)
export const FACTORY_ABI = [
  // Events
  {
    type: "event",
    name: "ListingCreated",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "escrow", type: "address", indexed: true },
      { name: "producer", type: "address", indexed: true },
      { name: "categoryType", type: "uint8", indexed: false },
      { name: "totalAmount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
  // Read functions
  {
    type: "function",
    name: "tokenAddress",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "listings",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenIdToEscrow",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getListings",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getListingCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenURI",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  // Write functions
  {
    type: "function",
    name: "createListing",
    inputs: [
      { name: "categoryType", type: "uint8" },
      { name: "title", type: "string" },
      { name: "description", type: "string" },
      { name: "totalAmount", type: "uint256" },
      { name: "imageURI", type: "string" },
    ],
    outputs: [
      { name: "escrow", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
] as const;

// MilestoneEscrowV6 ABI (per-listing escrow with buyer approval flow)
export const ESCROW_ABI = [
  // Events
  {
    type: "event",
    name: "Locked",
    inputs: [
      { name: "buyer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  // V6: Approved event
  {
    type: "event",
    name: "Approved",
    inputs: [
      { name: "buyer", type: "address", indexed: true },
    ],
  },
  // V6: Cancelled event (buyer cancels with refund)
  {
    type: "event",
    name: "Cancelled",
    inputs: [
      { name: "buyer", type: "address", indexed: true },
      { name: "refundAmount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Completed",
    inputs: [
      { name: "index", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "evidenceHash", type: "bytes32", indexed: false },
    ],
  },
  // V6: DeliveryConfirmed event
  {
    type: "event",
    name: "DeliveryConfirmed",
    inputs: [
      { name: "buyer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  // Read functions
  {
    type: "function",
    name: "factory",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenAddress",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "producer",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "buyer",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalAmount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "releasedAmount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  // V6: status enum (OPEN=0, LOCKED=1, ACTIVE=2, COMPLETED=3, CANCELLED=4)
  {
    type: "function",
    name: "status",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getStatusEnum",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "category",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "title",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "description",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "imageURI",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "categoryType",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "milestones",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [
      { name: "bps", type: "uint16" },
      { name: "completed", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMilestones",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "bps", type: "uint16" },
          { name: "completed", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMilestoneCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getProgress",
    inputs: [],
    outputs: [
      { name: "completed", type: "uint256" },
      { name: "total", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getStatus",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCore",
    inputs: [],
    outputs: [
      { name: "factory", type: "address" },
      { name: "tokenAddress", type: "address" },
      { name: "producer", type: "address" },
      { name: "buyer", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "totalAmount", type: "uint256" },
      { name: "releasedAmount", type: "uint256" },
      { name: "status", type: "uint8" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMeta",
    inputs: [],
    outputs: [
      { name: "category", type: "string" },
      { name: "title", type: "string" },
      { name: "description", type: "string" },
      { name: "imageURI", type: "string" },
      { name: "status", type: "string" },
    ],
    stateMutability: "view",
  },
  // Write functions
  {
    type: "function",
    name: "lock",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // V6: approve function (buyer approves to start milestones)
  {
    type: "function",
    name: "approve",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // V6: cancel function (buyer cancels with full refund, LOCKED only)
  {
    type: "function",
    name: "cancel",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // V6: confirmDelivery function (buyer confirms final milestone)
  {
    type: "function",
    name: "confirmDelivery",
    inputs: [
      { name: "evidenceHash", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "submit",
    inputs: [
      { name: "index", type: "uint256" },
      { name: "evidenceHash", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getEvidenceHash",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "evidenceHashes",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;
