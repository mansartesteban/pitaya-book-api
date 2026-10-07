import { db } from "../../database/index.js"
import { sql } from "drizzle-orm"

/** Apply due transitions before gallery reads, including direct public links. */
export async function applyGalleryExpirations() {
  await db.execute(sql`
    UPDATE pitaya.galleries
    SET visibility = CASE WHEN visibility = 'PUBLIC' THEN 'UNLISTED'::pitaya.gallery_visibility
                          ELSE 'HIDDEN'::pitaya.gallery_visibility END,
        expiration_applied = true
    WHERE expires_at IS NOT NULL
      AND parent_gallery_id IS NULL
      AND expires_at <= now()
      AND expiration_applied = false
      AND visibility IN ('PUBLIC', 'UNLISTED', 'PRIVATE')
  `)
}
