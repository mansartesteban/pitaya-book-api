import { db } from "@db"
import { galleries, photos } from "../../../database/schema"
import { and, eq, sql } from "drizzle-orm"
import crypto from "node:crypto"

export const getAllGalleries = async (request, reply) => {
  try {
    const foundGalleries = await db
      .select({
        id: galleries.id,
        name: galleries.name,
        title: galleries.title,
        description: galleries.description,
        visibility: galleries.visibility,
        photoCount: sql`count(${photos.id})`.as("photoCount"),
      })
      .from(galleries)
      .leftJoin(photos, eq(photos.galleryId, galleries.id))
      .where(eq(galleries.visibility, "PUBLIC"))
      .groupBy(galleries.id)

    console.log("found", foundGalleries)
    for (let foundGallery of foundGalleries) {
      const foundPhotos = await db
        .select({ url: photos.url })
        .from(photos)
        .where(eq(photos.galleryId, foundGallery.id))
        .limit(3)

      let securityKey = process.env.BUNNY_AUTH_URL_TOKEN
      let expires = Math.round(Date.now() / 1000) + 5

      foundGallery.photos = foundPhotos.map((photo) => {
        var hashableBase = securityKey + photo.url + expires
        let md5String = crypto
          .createHash("md5")
          .update(hashableBase)
          .digest("binary")
        let token = Buffer.from(md5String, "binary").toString("base64")
        token = token.replace(/\+/g, "-").replace(/\//g, "_").replace(/\=/g, "")

        photo.url =
          process.env.PHOTO_CDN_URI +
          photo.url +
          "?token=" +
          token +
          "&expires=" +
          expires
        return photo
      })
    }

    return reply.code(200).send({
      success: true,
      data: foundGalleries.filter((g) => g.photos.length > 2),
    })
  } catch (err) {
    console.error("err", err)
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Une erreur est survenue lors de la récupération des galeries",
    })
  }
}

export const getGallery = async (request, reply) => {
  try {
    const { galleryId } = request.validated.params
    const [foundGallery] = await db
      .select({
        id: galleries.id,
        name: galleries.name,
        title: galleries.title,
        description: galleries.description,
      })
      .from(galleries)
      .where(
        and(eq(galleries.id, galleryId), eq(galleries.visibility, "PUBLIC"))
      )

    const galleryPhotos = await db
      .select({
        id: photos.id,
        url: photos.url,
        width: photos.width,
        height: photos.height,
        ratio: photos.ratio,
      })
      .from(photos)
      .where(eq(photos.galleryId, galleryId))

    let securityKey = process.env.BUNNY_AUTH_URL_TOKEN
    let expires = Math.round(Date.now() / 1000) + 5

    foundGallery.photos = galleryPhotos.map((photo) => {
      var hashableBase = securityKey + photo.url + expires
      let md5String = crypto
        .createHash("md5")
        .update(hashableBase)
        .digest("binary")
      let token = Buffer.from(md5String, "binary").toString("base64")
      token = token.replace(/\+/g, "-").replace(/\//g, "_").replace(/\=/g, "")

      photo.url =
        process.env.PHOTO_CDN_URI +
        photo.url +
        "?token=" +
        token +
        "&expires=" +
        expires
      return photo
    })

    // const subfolderFiles = await BunnyStorageSDK.file.list(
    //   storageZone,
    //   "/my-folder",
    // );

    return reply.code(200).send({ success: true, data: foundGallery })
  } catch (err) {
    console.error("err", err)
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Une erreur est survenue lors de la récupération des galeries",
    })
  }
}
