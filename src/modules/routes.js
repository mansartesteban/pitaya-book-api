import accountRoutes from "./account/account.routes"
import authRoutes from "./auth/auth.routes"
import userRoutes from "./user/user.routes"

export default async (app) => {
  await app.register(authRoutes, { prefix: "/api/auth" })
  await app.register(userRoutes, { prefix: "/api/users" })
  await app.register(accountRoutes, { prefix: "/api/account" })
}
