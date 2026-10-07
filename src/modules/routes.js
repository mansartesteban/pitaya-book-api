import accountRoutes from "./account/account.routes.js"
import authRoutes from "./auth/auth.routes.js"
import clientRoutes from "./clients/client.routes.js"
import serviceRoutes from "./service/service.routes.js"
import userRoutes from "./user/user.routes.js"
import mainRoutes from "./main/main.routes.js"
import galleryRoutes from "./gallery/gallery.routes.js"
import publicRoutes from "./public/public.routes.js"
import articleRoutes from "./article/article.routes.js"
import notificationRoutes from "./notifications/notification.routes.js"
import memberRoutes from "./member/member.routes.js"
import memberLibraryRoutes from "./member/memberLibrary.routes.js"

export default async (app) => {
  await app.register(authRoutes, { prefix: "/api/auth" })
  await app.register(userRoutes, { prefix: "/api/users" })
  await app.register(accountRoutes, { prefix: "/api/account" })
  await app.register(serviceRoutes, { prefix: "/api/services" })
  await app.register(clientRoutes, { prefix: "/api/clients" })
  await app.register(mainRoutes, { prefix: "/api" })
  await app.register(galleryRoutes, { prefix: "/api/gallery" })
  await app.register(publicRoutes, { prefix: "/api/public" })
  await app.register(articleRoutes, { prefix: "/api" })
  await app.register(notificationRoutes, { prefix: "/api/notifications" })
  await app.register(memberRoutes, { prefix: "/api/member" })
  await app.register(memberLibraryRoutes, { prefix: "/api/member/library" })
}
