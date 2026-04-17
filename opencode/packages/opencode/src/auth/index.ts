import path from "path"
import { Global } from "../global"
import fs from "fs/promises"
import z from "zod"
import { getOrCreateMasterKey, maybeEncrypt, maybeDecrypt } from "./crypto"

export const OAUTH_DUMMY_KEY = "opencode-oauth-dummy-key"

export namespace Auth {
  export const Oauth = z
    .object({
      type: z.literal("oauth"),
      refresh: z.string(),
      access: z.string(),
      expires: z.number(),
      accountId: z.string().optional(),
      enterpriseUrl: z.string().optional(),
    })
    .meta({ ref: "OAuth" })

  export const Api = z
    .object({
      type: z.literal("api"),
      key: z.string(),
    })
    .meta({ ref: "ApiAuth" })

  export const WellKnown = z
    .object({
      type: z.literal("wellknown"),
      key: z.string(),
      token: z.string(),
    })
    .meta({ ref: "WellKnownAuth" })

  export const Info = z.discriminatedUnion("type", [Oauth, Api, WellKnown]).meta({ ref: "Auth" })
  export type Info = z.infer<typeof Info>

  export const ImportResult = z
    .object({
      sourceFound: z.boolean(),
      imported: z.array(z.string()),
      skippedExisting: z.array(z.string()),
      skippedInvalid: z.array(z.string()),
      totalSource: z.number(),
    })
    .meta({ ref: "AuthImportResult" })
  export type ImportResult = z.infer<typeof ImportResult>

  // Fields that should be encrypted at rest
  const SENSITIVE_FIELDS: Record<string, string[]> = {
    api: ["key"],
    oauth: ["access", "refresh"],
    wellknown: ["token"],
  }

  // Get auth file path - TopViewbot custom path takes priority
  function getAuthFilePath(): string {
    if (process.env.TOPVIEWBOT_AUTH_PATH) {
      return process.env.TOPVIEWBOT_AUTH_PATH
    }
    return path.join(Global.Path.data, "auth.json")
  }

  function getOpencodeAuthFilePath(): string {
    return path.join(Global.Path.data, "auth.json")
  }

  /** Decrypt sensitive fields in an auth entry */
  function decryptEntry(entry: Record<string, unknown>, key: Buffer): Record<string, unknown> {
    const type = entry.type as string
    const fields = SENSITIVE_FIELDS[type]
    if (!fields) return entry

    const decrypted = { ...entry }
    for (const field of fields) {
      if (field in decrypted) {
        decrypted[field] = maybeDecrypt(decrypted[field], key)
      }
    }
    return decrypted
  }

  /** Encrypt sensitive fields in an auth entry */
  function encryptEntry(entry: Record<string, unknown>, key: Buffer): Record<string, unknown> {
    const type = entry.type as string
    const fields = SENSITIVE_FIELDS[type]
    if (!fields) return entry

    const encrypted = { ...entry }
    for (const field of fields) {
      if (field in encrypted) {
        encrypted[field] = maybeEncrypt(encrypted[field], key)
      }
    }
    return encrypted
  }

  // Helper to load auth from a file
  async function loadAuthFile(filePath: string): Promise<Record<string, Info>> {
    const file = Bun.file(filePath)
    const raw = await file.json().catch(() => ({}) as Record<string, unknown>)

    let key: Buffer | undefined
    try {
      key = await getOrCreateMasterKey(filePath)
    } catch {
      // If key cannot be loaded/created, proceed without decryption
    }

    return Object.entries(raw).reduce(
      (acc, [providerID, value]) => {
        const entry = key && typeof value === "object" && value !== null
          ? decryptEntry(value as Record<string, unknown>, key)
          : (value as Record<string, unknown>)
        const parsed = Info.safeParse(entry)
        if (!parsed.success) return acc
        acc[providerID] = parsed.data
        return acc
      },
      {} as Record<string, Info>,
    )
  }

  export async function get(providerID: string) {
    const auth = await all()
    return auth[providerID]
  }

  export async function all(): Promise<Record<string, Info>> {
    return loadAuthFile(getAuthFilePath())
  }

  export async function set(key: string, info: Info) {
    const filePath = getAuthFilePath()
    const dir = path.dirname(filePath)

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true })

    // Load current data from TopViewbot auth file only (not merged)
    const file = Bun.file(filePath)
    const currentData = await file.json().catch(() => ({}) as Record<string, unknown>)

    const masterKey = await getOrCreateMasterKey(filePath).catch(() => undefined)

    const data = Object.entries(currentData).reduce(
      (acc, [k, value]) => {
        const entry = masterKey && typeof value === "object" && value !== null
          ? decryptEntry(value as Record<string, unknown>, masterKey)
          : (value as Record<string, unknown>)
        const parsed = Info.safeParse(entry)
        if (!parsed.success) return acc
        acc[k] = parsed.data
        return acc
      },
      {} as Record<string, Info>,
    )

    // Merge and encrypt before writing
    const merged: Record<string, Info> = { ...data, [key]: info }
    const encryptedPayload: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(merged)) {
      const raw = Info.parse(v)
      encryptedPayload[k] = masterKey ? encryptEntry(raw as unknown as Record<string, unknown>, masterKey) : raw
    }

    await Bun.write(file, JSON.stringify(encryptedPayload, null, 2))
    await fs.chmod(filePath, 0o600)
  }

  export async function remove(key: string) {
    const filePath = getAuthFilePath()
    const file = Bun.file(filePath)

    // Load current data from TopViewbot auth file only
    const currentData = await file.json().catch(() => ({}) as Record<string, unknown>)

    const masterKey = await getOrCreateMasterKey(filePath).catch(() => undefined)

    const data = Object.entries(currentData).reduce(
      (acc, [k, value]) => {
        const entry = masterKey && typeof value === "object" && value !== null
          ? decryptEntry(value as Record<string, unknown>, masterKey)
          : (value as Record<string, unknown>)
        const parsed = Info.safeParse(entry)
        if (!parsed.success) return acc
        acc[k] = parsed.data
        return acc
      },
      {} as Record<string, Info>,
    )

    delete data[key]

    // Encrypt before writing back
    const encryptedPayload: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(data)) {
      const raw = Info.parse(v)
      encryptedPayload[k] = masterKey ? encryptEntry(raw as unknown as Record<string, unknown>, masterKey) : raw
    }

    await Bun.write(file, JSON.stringify(encryptedPayload, null, 2))
    await fs.chmod(filePath, 0o600)
  }

  export async function importFromOpencode(): Promise<ImportResult> {
    const sourcePath = getOpencodeAuthFilePath()
    const sourceFile = Bun.file(sourcePath)

    if (!(await sourceFile.exists())) {
      return {
        sourceFound: false,
        imported: [],
        skippedExisting: [],
        skippedInvalid: [],
        totalSource: 0,
      }
    }

    const raw = await sourceFile.json()
    const sourceEntries = typeof raw === "object" && raw !== null ? Object.entries(raw) : []
    const current = await all()

    const imported: string[] = []
    const skippedExisting: string[] = []
    const skippedInvalid: string[] = []

    for (const [providerID, value] of sourceEntries) {
      const parsed = Info.safeParse(value)
      if (!parsed.success) {
        skippedInvalid.push(providerID)
        continue
      }
      if (providerID in current) {
        skippedExisting.push(providerID)
        continue
      }

      await set(providerID, parsed.data)
      current[providerID] = parsed.data
      imported.push(providerID)
    }

    return {
      sourceFound: true,
      imported,
      skippedExisting,
      skippedInvalid,
      totalSource: sourceEntries.length,
    }
  }
}
