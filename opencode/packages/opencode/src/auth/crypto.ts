import crypto from "crypto"
import path from "path"
import fs from "fs/promises"

const ALGORITHM = "aes-256-gcm"
const KEY_LENGTH = 32
const IV_LENGTH = 16
const TAG_LENGTH = 16
const PREFIX = "enc:"

/**
 * Get or create a master encryption key.
 * The key is stored next to the auth file with 0o600 permissions.
 */
export async function getOrCreateMasterKey(authFilePath: string): Promise<Buffer> {
  const keyPath = path.join(path.dirname(authFilePath), ".master.key")

  try {
    const key = await fs.readFile(keyPath)
    if (key.length === KEY_LENGTH) return key
    // Invalid key length, regenerate
  } catch {
    // File doesn't exist, create new key
  }

  const key = crypto.randomBytes(KEY_LENGTH)
  await fs.mkdir(path.dirname(keyPath), { recursive: true })
  await fs.writeFile(keyPath, key)
  await fs.chmod(keyPath, 0o600)
  return key
}

/**
 * Encrypt a plaintext string.
 * Returns `enc:<base64>` format.
 */
export function encrypt(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  const payload = Buffer.concat([iv, tag, encrypted])
  return PREFIX + payload.toString("base64")
}

/**
 * Decrypt an encrypted string.
 * Accepts `enc:<base64>` format. Returns the original plaintext.
 * Throws if decryption fails (tampered data or wrong key).
 */
export function decrypt(ciphertext: string, key: Buffer): string {
  if (!ciphertext.startsWith(PREFIX)) {
    throw new Error("Invalid encrypted format: missing enc: prefix")
  }

  const payload = Buffer.from(ciphertext.slice(PREFIX.length), "base64")
  if (payload.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Invalid encrypted payload: too short")
  }

  const iv = payload.subarray(0, IV_LENGTH)
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const encrypted = payload.subarray(IV_LENGTH + TAG_LENGTH)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final("utf8")
}

/**
 * Check if a value is already encrypted.
 */
export function isEncrypted(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(PREFIX)
}

/**
 * Encrypt a field if it's a string and not already encrypted.
 */
export function maybeEncrypt(value: unknown, key: Buffer): unknown {
  if (typeof value === "string" && value.length > 0 && !isEncrypted(value)) {
    return encrypt(value, key)
  }
  return value
}

/**
 * Decrypt a field if it's encrypted. Returns plain string.
 * If decryption fails, returns the original value (graceful fallback for migration errors).
 */
export function maybeDecrypt(value: unknown, key: Buffer): unknown {
  if (typeof value === "string" && isEncrypted(value)) {
    try {
      return decrypt(value, key)
    } catch {
      // If decryption fails, return as-is (could be corrupted or wrong key)
      return value
    }
  }
  return value
}
