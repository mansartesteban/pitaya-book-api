import accountRoutes from "./account/account.routes"
import authRoutes from "./auth/auth.routes"
import clientRoutes from "./clients/client.routes"
import serviceRoutes from "./service/service.routes"
import userRoutes from "./user/user.routes"
import mainRoutes from "./main/main.routes"
import galleryRoutes from "./gallery/gallery.routes"
import publicRoutes from "./public/public.routes"

export default async (app) => {
  await app.register(authRoutes, { prefix: "/api/auth" })
  await app.register(userRoutes, { prefix: "/api/users" })
  await app.register(accountRoutes, { prefix: "/api/account" })
  await app.register(serviceRoutes, { prefix: "/api/services" })
  await app.register(clientRoutes, { prefix: "/api/clients" })
  await app.register(mainRoutes, { prefix: "/api" })
  await app.register(galleryRoutes, { prefix: "/api/gallery" })
  await app.register(publicRoutes, { prefix: "/api/public" })
}
