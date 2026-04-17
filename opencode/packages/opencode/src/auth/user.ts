import path from "path"
import fs from "fs/promises"
import crypto from "crypto"
import z from "zod"
import { Global } from "../global"

const JWT_SECRET_ENV = "TOPVIEWBOT_JWT_SECRET"
const JWT_ALGORITHM = "HS256"
const JWT_EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60 // 7 days

const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string().optional(),
  passwordHash: z.string(),
  role: z.enum(["admin", "user"]).default("user"),
  createdAt: z.number(),
  updatedAt: z.number(),
})
export type User = z.infer<typeof UserSchema>

const UsersFileSchema = z.record(z.string(), UserSchema)
type UsersFile = z.infer<typeof UsersFileSchema>

function getUsersFilePath(): string {
  return path.join(Global.Path.data, "users.json")
}

function getJwtSecret(): string {
  const env = process.env[JWT_SECRET_ENV]
  if (env) return env
  // Fallback: generate a stable secret from a fixed key + data dir path
  // This means secret survives restarts but is not configurable
  return crypto
    .createHmac("sha256", "topviewbot-default-secret")
    .update(Global.Path.data)
    .digest("hex")
}

async function loadUsers(): Promise<UsersFile> {
  const filePath = getUsersFilePath()
  try {
    const raw = await Bun.file(filePath).json()
    const parsed = UsersFileSchema.safeParse(raw)
    return parsed.success ? parsed.data : {}
  } catch {
    return {}
  }
}

async function saveUsers(users: UsersFile): Promise<void> {
  const filePath = getUsersFilePath()
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await Bun.write(filePath, JSON.stringify(users, null, 2))
  await fs.chmod(filePath, 0o600)
}

// Simple JWT implementation using Node.js crypto
function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

function base64UrlDecode(str: string): Buffer {
  const padding = "=".repeat((4 - (str.length % 4)) % 4)
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + padding, "base64")
}

function signJwt(payload: Record<string, unknown>): string {
  const header = { alg: JWT_ALGORITHM, typ: "JWT" }
  const now = Math.floor(Date.now() / 1000)
  const body = { ...payload, iat: now, exp: now + JWT_EXPIRES_IN_SECONDS }

  const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)))
  const bodyB64 = base64UrlEncode(Buffer.from(JSON.stringify(body)))
  const signingInput = `${headerB64}.${bodyB64}`

  const signature = crypto.createHmac("sha256", getJwtSecret()).update(signingInput).digest()
  const sigB64 = base64UrlEncode(signature)

  return `${signingInput}.${sigB64}`
}

function verifyJwt(token: string): Record<string, unknown> | null {
  const parts = token.split(".")
  if (parts.length !== 3) return null

  const [headerB64, bodyB64, sigB64] = parts
  const signingInput = `${headerB64}.${bodyB64}`

  const expectedSig = crypto.createHmac("sha256", getJwtSecret()).update(signingInput).digest()
  const actualSig = base64UrlDecode(sigB64)

  if (!crypto.timingSafeEqual(expectedSig, actualSig)) return null

  try {
    const body = JSON.parse(base64UrlDecode(bodyB64).toString("utf8"))
    const now = Math.floor(Date.now() / 1000)
    if (body.exp && body.exp < now) return null
    return body as Record<string, unknown>
  } catch {
    return null
  }
}

export namespace UserAuth {
  export async function register(username: string, password: string, displayName?: string): Promise<{ success: false; error: string } | { success: true; user: Omit<User, "passwordHash"> }> {
    const normalized = username.trim().toLowerCase()
    if (!normalized || normalized.length < 2 || normalized.length > 32) {
      return { success: false, error: "Username must be 2-32 characters" }
    }
    if (!password || password.length < 6) {
      return { success: false, error: "Password must be at least 6 characters" }
    }

    const users = await loadUsers()
    if (users[normalized]) {
      return { success: false, error: "Username already exists" }
    }

    const passwordHash = await Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 })
    const now = Date.now()
    const user: User = {
      id: crypto.randomUUID(),
      username: normalized,
      displayName: displayName || normalized,
      passwordHash,
      role: Object.keys(users).length === 0 ? "admin" : "user", // first user is admin
      createdAt: now,
      updatedAt: now,
    }

    users[normalized] = user
    await saveUsers(users)

    const { passwordHash: _, ...safeUser } = user
    return { success: true, user: safeUser }
  }

  export async function login(username: string, password: string): Promise<{ success: false; error: string } | { success: true; token: string; user: Omit<User, "passwordHash"> }> {
    const normalized = username.trim().toLowerCase()
    const users = await loadUsers()
    const user = users[normalized]
    if (!user) {
      return { success: false, error: "Invalid username or password" }
    }

    const valid = await Bun.password.verify(password, user.passwordHash)
    if (!valid) {
      return { success: false, error: "Invalid username or password" }
    }

    const token = signJwt({ sub: user.id, username: user.username, role: user.role })
    const { passwordHash: _, ...safeUser } = user
    return { success: true, token, user: safeUser }
  }

  export function verifyToken(token: string): { sub: string; username: string; role: string } | null {
    const payload = verifyJwt(token)
    if (!payload) return null
    if (typeof payload.sub !== "string" || typeof payload.username !== "string" || typeof payload.role !== "string") {
      return null
    }
    return { sub: payload.sub, username: payload.username, role: payload.role }
  }

  export async function getUserByUsername(username: string): Promise<Omit<User, "passwordHash"> | null> {
    const users = await loadUsers()
    const user = users[username.trim().toLowerCase()]
    if (!user) return null
    const { passwordHash: _, ...safeUser } = user
    return safeUser
  }

  export async function listUsers(): Promise<Omit<User, "passwordHash">[]> {
    const users = await loadUsers()
    return Object.values(users).map(({ passwordHash: _, ...safeUser }) => safeUser)
  }

  export async function changePassword(username: string, oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: "New password must be at least 6 characters" }
    }

    const normalized = username.trim().toLowerCase()
    const users = await loadUsers()
    const user = users[normalized]
    if (!user) {
      return { success: false, error: "User not found" }
    }

    const valid = await Bun.password.verify(oldPassword, user.passwordHash)
    if (!valid) {
      return { success: false, error: "Current password is incorrect" }
    }

    user.passwordHash = await Bun.password.hash(newPassword, { algorithm: "bcrypt", cost: 10 })
    user.updatedAt = Date.now()
    await saveUsers(users)
    return { success: true }
  }
}
