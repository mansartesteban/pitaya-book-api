import galleryRoutes from "./gallery/gallery.routes.js"
import reminderPreferencesRoutes from "./reminders/reminderPreferences.routes.js"

export default async function publicRoutes(app) {
  await app.register(galleryRoutes, { prefix: "/gallery" })
  await app.register(reminderPreferencesRoutes, { prefix: "/reminders" })
}
