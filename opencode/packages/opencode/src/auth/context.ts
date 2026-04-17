import { Context } from "../util/context"

export interface UserContextValue {
  userId: string
  username: string
  role: string
}

export const UserContext = Context.create<UserContextValue>("user")
