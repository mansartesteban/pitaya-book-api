import galleryRoutes from "./gallery/gallery.routes.js"
import reminderPreferencesRoutes from "./reminders/reminderPreferences.routes.js"
import interactionRoutes from "./interactions/interaction.routes.js"
import galleryStatsRoutes from "./gallery/galleryStats.routes.js"

export default async function publicRoutes(app) {
  await app.register(galleryRoutes, { prefix: "/gallery" })
  await app.register(reminderPreferencesRoutes, { prefix: "/reminders" })
  await app.register(interactionRoutes, { prefix: "/interactions" })
  await app.register(galleryStatsRoutes, { prefix: "/gallery-stats" })
}
