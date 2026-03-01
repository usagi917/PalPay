import { randomUUID } from "crypto";

type NonceRecord = {
  nonce: string;
  expiresAt: number;
  used: boolean;
};

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const g = globalThis as unknown as {
  __agentNonceStore?: Map<string, NonceRecord>;
  __agentRateLimitStore?: Map<string, RateLimitRecord>;
};
const nonceStore = (g.__agentNonceStore ??= new Map<string, NonceRecord>());
const rateLimitStore = (g.__agentRateLimitStore ??= new Map<string, RateLimitRecord>());

const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

export function isValidSessionId(sessionId: string): boolean {
  return SESSION_ID_PATTERN.test(sessionId);
}

function pruneNonces(now = Date.now()) {
  for (const [key, record] of nonceStore.entries()) {
    if (record.expiresAt <= now) {
      nonceStore.delete(key);
    }
  }
}

function pruneRateLimits(now = Date.now()) {
  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

export function issueNonce(sessionId: string, ttlMs: number): { nonce: string; expiresAt: number } {
  pruneNonces();
  const existing = nonceStore.get(sessionId);
  if (existing && !existing.used && existing.expiresAt > Date.now()) {
    return { nonce: existing.nonce, expiresAt: existing.expiresAt };
  }
  const nonce = randomUUID();
  const expiresAt = Date.now() + ttlMs;
  nonceStore.set(sessionId, { nonce, expiresAt, used: false });
  return { nonce, expiresAt };
}

export function consumeNonce(sessionId: string, nonce: string): boolean {
  const record = nonceStore.get(sessionId);
  if (!record) {
    return false;
  }
  if (record.expiresAt <= Date.now()) {
    nonceStore.delete(sessionId);
    return false;
  }
  if (record.used) {
    return false;
  }
  if (record.nonce !== nonce) {
    return false;
  }
  record.used = true;
  return true;
}

export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  pruneRateLimits();
  const now = Date.now();
  const record = rateLimitStore.get(key);
  if (!record || record.resetAt <= now) {
    const resetAt = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: Math.max(0, max - 1), resetAt };
  }
  if (record.count >= max) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }
  record.count += 1;
  return { allowed: true, remaining: Math.max(0, max - record.count), resetAt: record.resetAt };
}
