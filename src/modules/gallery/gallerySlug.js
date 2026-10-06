import { randomBytes } from "node:crypto"
import slugify from "slugify"

export const slugBase = (title, visibility) => {
  const readable = slugify(title, { strict: true, lower: true })
    .slice(0, 180)
    .replace(/-+$/, "") || "galerie"
  // An unlisted gallery must remain difficult to discover by guessing its title.
  return visibility === "UNLISTED"
    ? `${readable}-${randomBytes(12).toString("hex")}`
    : readable
}
