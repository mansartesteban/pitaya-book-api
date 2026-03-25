import crypto from "node:crypto"

const thumbnailSizes = [300, 600]

const getClosestSize = (size) => {
  if (!size) return undefined

  for (let i = 0; i < thumbnailSizes.length; i++) {
    if (size <= thumbnailSizes[i]) {
      return thumbnailSizes[i]
    }
  }

  return undefined
}

export const signPhotoUrl = (photo, signed = true, thumbnail = null) => {
  if (!photo.galleryId || !photo.id) {
    return null
  }

  let closestThumbnailSize = getClosestSize(thumbnail)
  closestThumbnailSize = closestThumbnailSize
    ? `/thumbnails-${closestThumbnailSize}`
    : ""
  let photoUrl = `/${photo.galleryId}${closestThumbnailSize}/${photo.id}.${photo.extension}`

  if (signed) {
    let securityKey = process.env.BUNNY_AUTH_URL_TOKEN
    let expires = Math.round(Date.now() / 1000) + 60

    var hashableBase = securityKey + photoUrl + expires
    let md5String = crypto
      .createHash("md5")
      .update(hashableBase)
      .digest("binary")
    let token = Buffer.from(md5String, "binary").toString("base64")
    token = token.replace(/\+/g, "-").replace(/\//g, "_").replace(/\=/g, "")
    return (
      process.env.PHOTO_CDN_URI +
      photoUrl +
      "?token=" +
      token +
      "&expires=" +
      expires
    )
  }

  return photoUrl
}
