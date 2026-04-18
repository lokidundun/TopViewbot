import { Hono, type Context } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import { UserAuth } from "../../auth/user"
import { errors } from "../error"

const log = console

const LoginRequest = z.object({
  username: z.string().min(2).max(32),
  password: z.string().min(6),
})

const RegisterRequest = z.object({
  username: z.string().min(2).max(32),
  password: z.string().min(6),
  displayName: z.string().max(64).optional(),
  inviteCode: z.string().optional(),
})

const ChangePasswordRequest = z.object({
  oldPassword: z.string().min(6),
  newPassword: z.string().min(6),
})

export function AuthRoutes() {
  const app = new Hono()

  return app
    .post(
      "/register",
      describeRoute({
        summary: "Register new user",
        description: "Create a new user account. The first registered user becomes admin.",
        operationId: "auth.register",
        requestBody: {
          content: {
            "application/json": {
              schema: resolver(RegisterRequest),
            },
          },
        },
        responses: {
          200: {
            description: "User registered successfully",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    success: z.literal(true),
                    user: z.object({
                      id: z.string(),
                      username: z.string(),
                      displayName: z.string().optional(),
                      role: z.string(),
                    }),
                  }),
                ),
              },
            },
          },
          400: {
            description: "Registration failed",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    success: z.literal(false),
                    error: z.string(),
                  }),
                ),
              },
            },
          },
        },
      }),
      validator("json", RegisterRequest),
      async (c) => {
        const body = c.req.valid("json")
        const result = await UserAuth.register(body.username, body.password, body.displayName, body.inviteCode)
        if (!result.success) {
          return c.json({ success: false, error: result.error }, 400)
        }
        return c.json({ success: true, user: result.user })
      },
    )
    .post(
      "/login",
      describeRoute({
        summary: "Login",
        description: "Authenticate with username and password to receive a JWT token.",
        operationId: "auth.login",
        requestBody: {
          content: {
            "application/json": {
              schema: resolver(LoginRequest),
            },
          },
        },
        responses: {
          200: {
            description: "Login successful",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    success: z.literal(true),
                    token: z.string(),
                    user: z.object({
                      id: z.string(),
                      username: z.string(),
                      displayName: z.string().optional(),
                      role: z.string(),
                    }),
                  }),
                ),
              },
            },
          },
          401: {
            description: "Invalid credentials",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    success: z.literal(false),
                    error: z.string(),
                  }),
                ),
              },
            },
          },
        },
      }),
      validator("json", LoginRequest),
      async (c) => {
        const body = c.req.valid("json")
        const result = await UserAuth.login(body.username, body.password)
        if (!result.success) {
          return c.json({ success: false, error: result.error }, 401)
        }
        return c.json({ success: true, token: result.token, user: result.user })
      },
    )
    .post(
      "/verify",
      describeRoute({
        summary: "Verify token",
        description: "Check if the provided JWT token is valid.",
        operationId: "auth.verify",
        requestBody: {
          content: {
            "application/json": {
              schema: resolver(z.object({ token: z.string() })),
            },
          },
        },
        responses: {
          200: {
            description: "Token verification result",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    valid: z.boolean(),
                    user: z
                      .object({
                        id: z.string(),
                        username: z.string(),
                        role: z.string(),
                      })
                      .optional(),
                  }),
                ),
              },
            },
          },
        },
      }),
      validator("json", z.object({ token: z.string() })),
      async (c) => {
        const { token } = c.req.valid("json")
        const payload = UserAuth.verifyToken(token)
        if (!payload) {
          return c.json({ valid: false })
        }
        const user = await UserAuth.getUserByUsername(payload.username)
        if (!user) {
          return c.json({ valid: false })
        }
        return c.json({
          valid: true,
          user: { id: user.id, username: user.username, role: user.role },
        })
      },
    )
    .post(
      "/change-password",
      describeRoute({
        summary: "Change password",
        description: "Change the current user's password.",
        operationId: "auth.changePassword",
        requestBody: {
          content: {
            "application/json": {
              schema: resolver(ChangePasswordRequest),
            },
          },
        },
        responses: {
          200: {
            description: "Password changed",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    success: z.boolean(),
                    error: z.string().optional(),
                  }),
                ),
              },
            },
          },
          ...errors(401),
        },
      }),
      validator("json", ChangePasswordRequest),
      async (c) => {
        const body = c.req.valid("json")
        // Extract user from Authorization header
        const authHeader = c.req.header("Authorization")
        const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : ""
        const payload = UserAuth.verifyToken(token)
        if (!payload) {
          return c.json({ success: false, error: "Unauthorized" }, 401)
        }
        const result = await UserAuth.changePassword(payload.username, body.oldPassword, body.newPassword)
        return c.json(result)
      },
    )
    .get(
      "/users",
      describeRoute({
        summary: "List users",
        description: "List all registered users. Admin only.",
        operationId: "auth.listUsers",
        responses: {
          200: {
            description: "List of users",
            content: {
              "application/json": {
                schema: resolver(
                  z.array(
                    z.object({
                      id: z.string(),
                      username: z.string(),
                      displayName: z.string().optional(),
                      role: z.string(),
                      createdAt: z.number(),
                    }),
                  ),
                ),
              },
            },
          },
          ...errors(401),
        },
      }),
      async (c) => {
        const authHeader = c.req.header("Authorization")
        const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : ""
        const payload = UserAuth.verifyToken(token)
        if (!payload || payload.role !== "admin") {
          return c.json({ error: "Forbidden" }, 403)
        }
        const users = await UserAuth.listUsers()
        return c.json(users)
      },
    )
}
