import type { Context, Next } from "hono"
import { UserAuth } from "../../auth/user"
import { UserContext } from "../../auth/context"

const PUBLIC_PATHS = ["/auth/", "/doc"]
const PUBLIC_EXTS = new Set([
  ".js", ".css", ".svg", ".png", ".ico", ".jpg", ".jpeg",
  ".woff", ".woff2", ".ttf", ".eot", ".webmanifest", ".json",
  ".map", ".txt", ".html",
])

function isPublicPath(path: string, method: string): boolean {
  // Exact matches
  if (path === "/" || path === "/index.html") return true

  // Prefix matches
  for (const prefix of PUBLIC_PATHS) {
    if (path.startsWith(prefix)) return true
  }

  // Static files: GET requests with known extensions
  if (method === "GET") {
    const lastDot = path.lastIndexOf(".")
    if (lastDot > path.lastIndexOf("/")) {
      const ext = path.slice(lastDot).toLowerCase()
      if (PUBLIC_EXTS.has(ext)) return true
    }
  }

  return false
}

export async function authMiddleware(c: Context, next: Next) {
  const path = c.req.path
  const method = c.req.method

  if (isPublicPath(path, method)) {
    return next()
  }

  const authHeader = c.req.header("Authorization")
  let token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : ""

  // EventSource cannot set custom headers, so also support token in query param
  if (!token) {
    token = c.req.query("token") || ""
  }

  const payload = UserAuth.verifyToken(token)
  if (!payload) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  return UserContext.provide(
    {
      userId: payload.sub,
      username: payload.username,
      role: payload.role,
    },
    next,
  )
}
