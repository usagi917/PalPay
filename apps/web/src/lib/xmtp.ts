import {
  Client,
  Conversation,
  DecodedMessage,
  Utils,
  type Signer,
  type Identifier,
  type SafeInboxState,
} from "@xmtp/browser-sdk";

// XMTP environment
const XMTP_ENV = process.env.NEXT_PUBLIC_XMTP_ENV === "production" ? "production" : "dev";

// Database encryption key storage key prefix
const DB_KEY_STORAGE_PREFIX = "xmtp_db_key_";
const CLIENT_CACHE_PREFIX = "xmtp_client_";

const INSTALLATION_LIMIT_ERROR_PATTERNS = [
  /cannot register a new installation/i,
  /already registered \d+\/\d+ installations/i,
];

const INSTALLATION_LIMIT_ERROR_MESSAGE =
  "XMTP接続数が上限(10)に達しています。「他端末の接続を解除」ボタンで復旧してください。";

const clientCache = new Map<string, Promise<Client>>();

export type XmtpErrorKind = "installation_limit";

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
 * Get normalized text from unknown error object
 */
function getErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return String(error);
}

/**
 * Create account identifier for EOA wallet
 */
function toAccountIdentifier(walletAddress: string): Identifier {
  return {
    identifier: walletAddress,
    identifierKind: "Ethereum",
  };
}

/**
 * Create XMTP signer wrapper from wallet address and sign function
 */
function toXmtpSigner(
  walletAddress: string,
  signMessage: (message: string) => Promise<string>
): Signer {
  return {
    type: "EOA",
    getIdentifier: () => toAccountIdentifier(walletAddress),
    signMessage: async (message: string): Promise<Uint8Array> => {
      const signature = await signMessage(message);
      return hexToBytes(signature);
    },
  };
}

function getClientCacheKey(walletAddress: string): string {
  return CLIENT_CACHE_PREFIX + XMTP_ENV + "_" + walletAddress.toLowerCase();
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
  const cacheKey = getClientCacheKey(walletAddress);
  const cachedClientPromise = clientCache.get(cacheKey);
  if (cachedClientPromise) {
    return await cachedClientPromise;
  }

  const signer = toXmtpSigner(walletAddress, signMessage);

  // Get or create persistent encryption key for this wallet
  const dbEncryptionKey = getOrCreateDbEncryptionKey(walletAddress);

  const clientPromise = Client.create(signer, {
    env: XMTP_ENV,
    dbEncryptionKey,
  });

  clientCache.set(cacheKey, clientPromise);

  try {
    return await clientPromise;
  } catch (error) {
    clientCache.delete(cacheKey);
    throw error;
  }
}

/**
 * Clear XMTP client cache for a wallet (used after installation revoke)
 */
export function clearXmtpClientCache(walletAddress: string): void {
  clientCache.delete(getClientCacheKey(walletAddress));
}

/**
 * Detect installation limit errors returned by XMTP
 */
export function isInstallationLimitError(error: unknown): boolean {
  const errorText = getErrorText(error);
  return INSTALLATION_LIMIT_ERROR_PATTERNS.some((pattern) => pattern.test(errorText));
}

/**
 * Get user-friendly error message for known XMTP failures
 */
export function formatXmtpError(error: unknown): string {
  if (isInstallationLimitError(error)) {
    return INSTALLATION_LIMIT_ERROR_MESSAGE;
  }
  return getErrorText(error);
}

/**
 * Resolve inbox state for an Ethereum address using XMTP network
 */
export async function getInboxStateByAddress(
  walletAddress: string
): Promise<SafeInboxState | null> {
  const identifier = toAccountIdentifier(walletAddress);
  const utils = new Utils();

  await utils.init();

  try {
    const inboxId = await utils.getInboxIdForIdentifier(identifier, XMTP_ENV);
    if (!inboxId) {
      return null;
    }

    const inboxStates = await Client.inboxStateFromInboxIds([inboxId], XMTP_ENV);
    return inboxStates[0] ?? null;
  } finally {
    utils.close();
  }
}

export interface RevokeInstallationsResult {
  inboxId: string;
  installationCount: number;
  revokedCount: number;
}

/**
 * Revoke all installations for the wallet inbox using static API
 * This path works even when Client.create fails because installation limit was reached.
 */
export async function revokeAllInstallationsByAddress(
  walletAddress: string,
  signMessage: (message: string) => Promise<string>
): Promise<RevokeInstallationsResult> {
  const inboxState = await getInboxStateByAddress(walletAddress);
  if (!inboxState) {
    throw new Error("XMTP inbox が見つかりません。");
  }

  const installationBytes = inboxState.installations.map((installation) => installation.bytes);
  if (installationBytes.length > 0) {
    const signer = toXmtpSigner(walletAddress, signMessage);
    await Client.revokeInstallations(signer, inboxState.inboxId, installationBytes, XMTP_ENV);
  }

  clearXmtpClientCache(walletAddress);

  return {
    inboxId: inboxState.inboxId,
    installationCount: inboxState.installations.length,
    revokedCount: installationBytes.length,
  };
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
    const direct =
      canMsg.get(address) ??
      canMsg.get(address.toLowerCase()) ??
      canMsg.get(address.toUpperCase());

    if (typeof direct === "boolean") {
      return direct;
    }

    if (canMsg.size === 1) {
      const first = canMsg.values().next().value;
      return typeof first === "boolean" ? first : false;
    }

    return false;
  } catch (error) {
    throw new Error(`XMTP canMessage check failed: ${getErrorText(error)}`);
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
  selfInboxId: string
): XmtpMessage {
  return {
    id: message.id,
    senderAddress: message.senderInboxId || "",
    content: typeof message.content === "string" ? message.content : JSON.stringify(message.content),
    sent: message.sentAtNs ? new Date(Number(message.sentAtNs) / 1_000_000) : new Date(),
    isSelf:
      !!selfInboxId &&
      message.senderInboxId?.toLowerCase() === selfInboxId.toLowerCase(),
  };
}
