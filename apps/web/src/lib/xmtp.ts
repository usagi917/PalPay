import { Client, Conversation, DecodedMessage, type Signer, type Identifier } from "@xmtp/browser-sdk";

// XMTP environment
const XMTP_ENV = process.env.NEXT_PUBLIC_XMTP_ENV === "production" ? "production" : "dev";

// Database encryption key storage key prefix
const DB_KEY_STORAGE_PREFIX = "xmtp_db_key_";

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Get or create database encryption key for an address
 * This ensures message history persists across sessions
 */
function getOrCreateDbEncryptionKey(address: string): Uint8Array {
  const storageKey = DB_KEY_STORAGE_PREFIX + address.toLowerCase();

  // Try to retrieve existing key
  const storedKey = localStorage.getItem(storageKey);
  if (storedKey) {
    return hexToBytes(storedKey);
  }

  // Generate new 32-byte random key
  const newKey = crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(storageKey, bytesToHex(newKey));
  return newKey;
}

/**
 * Create XMTP client for the current wallet
 * V3 uses EOA signer with getIdentifier pattern
 */
export async function createXmtpClient(
  walletAddress: string,
  signMessage: (message: string) => Promise<string>
): Promise<Client> {
  // Create account identifier for EOA
  const accountIdentifier: Identifier = {
    identifier: walletAddress,
    identifierKind: "Ethereum",
  };

  // Create a signer object compatible with XMTP V3 browser SDK
  const signer: Signer = {
    type: "EOA",
    getIdentifier: () => accountIdentifier,
    signMessage: async (message: string): Promise<Uint8Array> => {
      const signature = await signMessage(message);
      return hexToBytes(signature);
    },
  };

  // Get or create persistent encryption key for this wallet
  const dbEncryptionKey = getOrCreateDbEncryptionKey(walletAddress);

  return await Client.create(signer, {
    env: XMTP_ENV,
    dbEncryptionKey,
  });
}

/**
 * Get or create a DM conversation with peer
 * Uses Identifier-based API for V3 compatibility
 */
export async function getEscrowConversation(
  client: Client,
  peerAddress: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _escrowAddress: string // Reserved for future context/filtering
): Promise<Conversation> {
  // Create peer identifier
  const peerIdentifier: Identifier = {
    identifier: peerAddress,
    identifierKind: "Ethereum",
  };

  // Get peer's inbox ID first
  const peerInboxId = await client.findInboxIdByIdentifier(peerIdentifier);

  if (peerInboxId) {
    // Check existing DMs for this peer
    const dms = await client.conversations.listDms();
    for (const dm of dms) {
      const dmPeerInboxId = await dm.peerInboxId();
      if (dmPeerInboxId === peerInboxId) {
        return dm;
      }
    }
  }

  // Create new DM conversation using identifier
  return await client.conversations.newDmWithIdentifier(peerIdentifier);
}

/**
 * Check if an address can receive XMTP messages
 */
export async function canMessage(client: Client, address: string): Promise<boolean> {
  try {
    const identifier: Identifier = {
      identifier: address,
      identifierKind: "Ethereum",
    };
    const canMsg = await client.canMessage([identifier]);
    return canMsg.get(address.toLowerCase()) ?? false;
  } catch {
    return false;
  }
}

/**
 * Message type for UI
 */
export interface XmtpMessage {
  id: string;
  senderAddress: string;
  content: string;
  sent: Date;
  isSelf: boolean;
}

/**
 * Check if message is a regular text message (not system/metadata)
 */
export function isTextMessage(message: DecodedMessage): boolean {
  return typeof message.content === "string" && message.content.length > 0;
}

/**
 * Convert XMTP message to UI format
 */
export function formatMessage(
  message: DecodedMessage,
  selfAddress: string
): XmtpMessage {
  return {
    id: message.id,
    senderAddress: message.senderInboxId || "",
    content: typeof message.content === "string" ? message.content : JSON.stringify(message.content),
    sent: message.sentAtNs ? new Date(Number(message.sentAtNs) / 1_000_000) : new Date(),
    isSelf: message.senderInboxId?.toLowerCase() === selfAddress.toLowerCase(),
  };
}
