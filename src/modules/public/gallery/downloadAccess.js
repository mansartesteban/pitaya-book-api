import { createHmac, timingSafeEqual } from "node:crypto"

export const galleryAccessToken = (galleryId) =>
  createHmac("sha256", process.env.JWT_SECRET).update(galleryId).digest("hex")

export const isGalleryUnlocked = (gallery, request) => {
  const token = request.cookies?.[`gallery_${gallery.id}`]
  const expected = galleryAccessToken(gallery.id)
  return typeof token === "string" &&
    token.length === expected.length &&
    timingSafeEqual(Buffer.from(token), Buffer.from(expected))
}

export const canDownloadGallery = (gallery, request) => {
  if (!gallery?.downloadable) return false
  if (gallery.visibility === "PUBLIC" || gallery.visibility === "UNLISTED") return true
  return gallery.visibility === "PRIVATE" && isGalleryUnlocked(gallery, request)
}

export const canDownloadPhoto = (gallery, request) => {
  if (gallery?.visibility === "PUBLIC" || gallery?.visibility === "UNLISTED") return true
  return gallery?.visibility === "PRIVATE" && isGalleryUnlocked(gallery, request)
}
