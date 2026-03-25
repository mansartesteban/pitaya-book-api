import accountRoutes from "./account/account.routes.js"
import authRoutes from "./auth/auth.routes.js"
import clientRoutes from "./clients/client.routes.js"
import serviceRoutes from "./service/service.routes.js"
import userRoutes from "./user/user.routes.js"
import mainRoutes from "./main/main.routes.js"
import galleryRoutes from "./gallery/gallery.routes.js"
import publicRoutes from "./public/public.routes.js"

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
