import * as BunnyStorageSDK from "@bunny.net/storage-sdk"
import { db } from "@db"
import { galleries, photos } from "../../database/schema"
import { and, eq, inArray, sql } from "drizzle-orm"
import slugify from "slugify"
import crypto from "node:crypto"
import archiver from "archiver"
import sharp from "sharp"
import { pipeline } from "node:stream/promises"

const storageZone = BunnyStorageSDK.zone.connect_with_accesskey(
  BunnyStorageSDK.regions.StorageRegion.Falkenstein,
  process.env.BUNNY_STORAGE_ZONE,
  process.env.BUNNY_FTP_PASSWORD
)

const visibilities = {
  "-1": "HIDDEN",
  0: "PRIVATE",
  1: "UNLISTED",
  2: "PUBLIC",
}

export const getAllGalleries = async (request, reply) => {
  try {
    const foundGalleries = await db
      .select({
        id: galleries.id,
        name: galleries.name,
        title: galleries.title,
        description: galleries.description,
        visibility: galleries.visibility,
        serviceId: galleries.serviceId,
        photoCount: sql`count(${photos.id})`.as("photoCount"),
        totalSize: sql`coalesce(sum(${photos.size}), 0)`.as("totalSize"),
        parentGallery: galleries.parentGallery,
      })
      .from(galleries)
      .leftJoin(photos, eq(photos.galleryId, galleries.id))
      .where(eq(galleries.ownerUserId, request.user.id))
      .groupBy(galleries.id)

    foundGalleries.forEach((foundGallery) => {
      foundGallery.visibility = parseInt(
        Object.entries(visibilities).find(
          ([key, v]) => v === foundGallery.visibility
        )[0]
      )
    })

    for (let gallery of foundGalleries) {
      if (gallery.parentGallery) {
        const [parentGallery] = await db
          .select({
            id: galleries.id,
            name: galleries.name,
            title: galleries.title,
          })
          .from(galleries)
          .where(
            and(
              eq(galleries.id, gallery.parentGallery),
              eq(galleries.ownerUserId, request.user.id)
            )
          )
        if (parentGallery) {
          gallery.parentGallery = parentGallery
        }
      }

      const childrenGalleries = await db
        .select({
          id: galleries.id,
          name: galleries.name,
          title: galleries.title,
        })
        .from(galleries)
        .where(
          and(
            eq(galleries.ownerUserId, request.user.id),
            eq(galleries.parentGallery, gallery.id)
          )
        )

      gallery.children = childrenGalleries
    }

    return reply.code(200).send({ success: true, data: foundGalleries })
  } catch (err) {
    console.error("err", err)
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Une erreur est survenue lors de la récupération des galeries",
    })
  }
}

export const getOneGallery = async (request, reply) => {
  try {
    const { galleryId } = request.validated.params
    const [foundGallery] = await db
      .select({
        id: galleries.id,
        name: galleries.name,
        title: galleries.title,
        description: galleries.description,
        visibility: galleries.visibility,
        serviceId: galleries.serviceId,
        parentGallery: galleries.parentGallery,
      })
      .from(galleries)
      .where(
        and(
          eq(galleries.id, galleryId),
          eq(galleries.ownerUserId, request.user.id)
        )
      )
    if (!foundGallery) {
      return reply
        .code(404)
        .send({ success: false, message: "Galerie introuvable" })
    }

    if (foundGallery.parentGallery) {
      const [parentGallery] = await db
        .select({
          id: galleries.id,
          name: galleries.name,
          title: galleries.title,
        })
        .from(galleries)
        .where(
          and(
            eq(galleries.id, foundGallery.parentGallery),
            eq(galleries.ownerUserId, request.user.id)
          )
        )
      if (parentGallery) {
        foundGallery.parentGallery = parentGallery

        const childrenGalleries = await db
          .select({
            id: galleries.id,
            name: galleries.name,
            title: galleries.title,
          })
          .from(galleries)
          .where(
            and(
              eq(galleries.ownerUserId, request.user.id),
              eq(galleries.parentGallery, parentGallery.id)
            )
          )

        foundGallery.parentGallery.children = childrenGalleries
      }
    }

    const childrenGalleries = await db
      .select({
        id: galleries.id,
        name: galleries.name,
        title: galleries.title,
      })
      .from(galleries)
      .where(
        and(
          eq(galleries.ownerUserId, request.user.id),
          eq(galleries.parentGallery, foundGallery.id)
        )
      )

    foundGallery.children = childrenGalleries

    const descendants = await db.execute(sql`
      WITH RECURSIVE descendants AS (
        SELECT id, parent_gallery_id
        FROM galleries
        WHERE id = ${galleryId}
    
        UNION ALL
    
        SELECT g.id, g.parent_gallery_id
        FROM galleries g
        INNER JOIN descendants d ON g.parent_gallery_id = d.id
      )
      SELECT id FROM descendants;
    `)
    foundGallery.downRelations = descendants.map((d) => d.id)

    const ancestors = await db.execute(sql`
      WITH RECURSIVE ancestors AS (
        SELECT id, parent_gallery_id
        FROM galleries
        WHERE id = ${galleryId}

        UNION ALL

        SELECT g.id, g.parent_gallery_id
        FROM galleries g
        INNER JOIN ancestors a ON g.id = a.parent_gallery_id
      )
      SELECT id FROM ancestors;
    `)
    foundGallery.upRelations = ancestors.map((d) => d.id)

    const galleryPhotos = await db
      .select({
        id: photos.id,
        name: photos.name,
        url: photos.url,
        size: photos.size,
        filename: photos.filename,
        extension: photos.extension,
        ratio: photos.ratio,
        width: photos.width,
        height: photos.height,
      })
      .from(photos)
      .where(eq(photos.galleryId, galleryId))

    foundGallery.visibility = parseInt(
      Object.entries(visibilities).find(
        ([key, v]) => v === foundGallery.visibility
      )[0]
    )

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
      photo.filename = [photo.filename, photo.extension].join(".")
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
      message: "Une erreur est survenue lors de la récupération de la galerie",
    })
  }
}

export const createGallery = async (request, reply) => {
  try {
    const name = slugify(request.validated.body.title, {
      strict: true,
      lower: true,
    })
    const [createdGallery] = await db
      .insert(galleries)
      .values({
        name: name,
        title: request.validated.body.title,
        visibility: visibilities[request.validated.body.visibility],
        description: request.validated.body.description,
        ownerUserId: request.user.id,
      })
      .returning({
        id: galleries.id,
      })

    return reply
      .code(201)
      .send({ success: true, data: createdGallery, message: "Galerie créée" })
  } catch (err) {
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Une erreur est survenue lors de la création de la galerie",
    })
  }
}
export const updateGallery = async (request, reply) => {
  try {
    const { title, visibility, description, parentGalleryId } =
      request.validated.body

    const name = slugify(title, {
      strict: true,
      lower: true,
    })
    const [updatedGallery] = await db
      .update(galleries)
      .set({
        name: name,
        title: title,
        visibility: visibilities[visibility],
        description: description,
        parentGallery: parentGalleryId,
      })
      .where(eq(galleries.id, request.validated.params.galleryId))
      .returning({
        name: galleries.name,
        title: galleries.title,
        visibility: galleries.visibility,
        description: galleries.description,
      })

    return reply.code(200).send({
      success: true,
      data: updatedGallery,
      message: "Galerie modifiée",
    })
  } catch (err) {
    console.error("err", err)
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Une erreur est survenue lors de la modification de la galerie",
    })
  }
}
export const addParentGallery = async (request, reply) => {
  try {
    const { parentGalleryId } = request.validated.body
    const { galleryId } = request.validated.params

    await db
      .update(galleries)
      .set({
        parentGallery: parentGalleryId,
      })
      .where(eq(galleries.id, galleryId))

    return reply.code(200).send({
      success: true,
      message: "Galerie principale ajoutée",
    })
  } catch (err) {
    console.error("err", err)
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Une erreur est survenue lors de la modification de la galerie",
    })
  }
}
export const removeParentGallery = async (request, reply) => {
  try {
    const { galleryId } = request.validated.params

    await db
      .update(galleries)
      .set({
        parentGallery: null,
      })
      .where(eq(galleries.id, galleryId))

    return reply.code(200).send({
      success: true,
      message: "Galerie principale retirée",
    })
  } catch (err) {
    console.error("err", err)
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Une erreur est survenue lors de la modification de la galerie",
    })
  }
}
export const deleteGallery = async (request, reply) => {
  try {
    const { galleryId } = request.validated.params

    await BunnyStorageSDK.file.removeDirectory(storageZone, "/" + galleryId)

    await db
      .update(galleries)
      .set({ parentGallery: null })
      .where(eq(galleries.parentGallery, galleryId))
    await db.delete(photos).where(eq(photos.galleryId, galleryId))
    await db.delete(galleries).where(eq(galleries.id, galleryId))

    return reply.code(200).send({ success: true, message: "Galerie supprimée" })
  } catch (err) {
    console.error("err", err)
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Une erreur est survenue lors de la suppression de la galerie",
    })
  }
}

export const uploadPhoto = async (request, reply) => {
  try {
    const part = await request.file()
    const chunks = []
    for await (const chunk of part.file) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)

    const metadata = await sharp(buffer).metadata()

    const { galleryId } = request.validated.params

    const [foundGallery] = await db
      .select({
        id: galleries.id,
      })
      .from(galleries)
      .where(
        and(
          eq(galleries.id, galleryId),
          eq(galleries.ownerUserId, request.user.id)
        )
      )

    if (!foundGallery) {
      return reply
        .code(404)
        .send({ success: false, message: "Aucune galerie correspondante" })
    }

    if (!part) {
      return reply
        .code(400)
        .send({ success: false, message: "Aucun fichier reçu" })
    }
    let photoId = crypto.randomUUID()

    let splittedFilename = part.filename.split(".")
    let extension = splittedFilename.splice(-1)
    let filename = splittedFilename.join(".")
    let uploadName = [photoId, extension].join(".")

    const response = await BunnyStorageSDK.file.upload(
      storageZone,
      `/${foundGallery.id}/${uploadName}`,
      buffer
    )

    if (!response) {
      return reply.code(500).send({
        success: false,
        message: "Une erreur est survenue lors du téléchargement de l'image",
      })
    }
    const [insertedPhoto] = await db
      .insert(photos)
      .values({
        galleryId: galleryId,
        name: uploadName,
        size: part.file.bytesRead,
        width: metadata.width,
        height: metadata.height,
        ratio: metadata.width / metadata.height,
        extension: extension,
        filename: filename,
        url: `/${foundGallery.id}/${uploadName}`,
      })
      .returning({
        name: photos.name,
        url: photos.url,
        extension: photos.extension,
        filename: photos.filename,
        width: photos.width,
        height: photos.height,
        ratio: photos.ratio,
        size: photos.size,
      })

    let securityKey = process.env.BUNNY_AUTH_URL_TOKEN
    let expires = Math.round(Date.now() / 1000) + 5

    var hashableBase = securityKey + insertedPhoto.url + expires
    let md5String = crypto
      .createHash("md5")
      .update(hashableBase)
      .digest("binary")
    let token = Buffer.from(md5String, "binary").toString("base64")
    token = token.replace(/\+/g, "-").replace(/\//g, "_").replace(/\=/g, "")

    insertedPhoto.url =
      process.env.PHOTO_CDN_URI +
      insertedPhoto.url +
      "?token=" +
      token +
      "&expires=" +
      expires
    insertedPhoto.filename = [
      insertedPhoto.filename,
      insertedPhoto.extension,
    ].join(".")

    return reply.code(200).send({ success: true, data: insertedPhoto })
  } catch (err) {
    console.error("err", err)
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Une erreur est survenue lors de l'neovie de la photo",
    })
  }
}

export const deletePhoto = async (request, reply) => {
  try {
    const { photoId, galleryId } = request.validated.params
    const [foundPhoto] = await db
      .select({ url: photos.url })
      .from(photos)
      .where(and(eq(photos.id, photoId), eq(photos.galleryId, galleryId)))

    if (!foundPhoto) {
      return reply
        .code(404)
        .send({ success: false, message: "La photo est introuvable" })
    }

    const deleted = await BunnyStorageSDK.file.remove(
      storageZone,
      foundPhoto.url
    )
    if (deleted) {
      await db
        .delete(photos)
        .where(and(eq(photos.id, photoId), eq(photos.galleryId, galleryId)))

      return reply.code(200).send({ success: true, message: "Photo supprimée" })
    } else {
      return reply.code(500).send({
        success: false,
        message: "Impossible de supprimer cette photo",
      })
    }
  } catch (err) {
    console.error("err", err)
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Une erreur est survenue lors de la suppression de la photo",
    })
  }
}
export const deleteMultiplePhotos = async (request, reply) => {
  try {
    const { photosToDelete } = request.validated.body
    const { galleryId } = request.validated.params

    const foundPhotos = await db
      .select({ id: photos.id, url: photos.url })
      .from(photos)
      .where(
        and(inArray(photos.id, photosToDelete), eq(photos.galleryId, galleryId))
      )

    let deletedPhotos = []
    for (let photo of foundPhotos) {
      const deleted = await BunnyStorageSDK.file.remove(storageZone, photo.url)
      if (deleted) {
        deletedPhotos.push(photo)
      }
    }

    await db.delete(photos).where(
      and(
        inArray(
          photos.id,
          deletedPhotos.map((p) => p.id)
        ),
        eq(photos.galleryId, galleryId)
      )
    )

    return reply.code(200).send({
      success: true,
      message: `${deletedPhotos.length} photos supprimées`,
      data: deletedPhotos,
    })
  } catch (err) {
    console.error("err", err)
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Une erreur est survenue lors de la suppression des photos",
    })
  }
}
export const updatePhoto = async (request, reply) => {
  try {
  } catch (err) {
    console.error("err", err)
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Une erreur est survenue lors de la modification de la photo",
    })
  }
}
export const downloadPhoto = async (request, reply) => {
  try {
    const { photoId, galleryId } = request.validated.params
    const [foundPhoto] = await db
      .select({
        filename: photos.filename,
        extension: photos.extension,
        url: photos.url,
      })
      .from(photos)
      .where(and(eq(photos.id, photoId), eq(photos.galleryId, galleryId)))

    const { stream, response, length } = await BunnyStorageSDK.file.download(
      storageZone,
      foundPhoto.url
    )

    reply
      .header("Content-Type", response.headers.get("content-type"))
      .header("Content-Length", length)
      .header(
        "Content-Disposition",
        `attachment; filename="${[foundPhoto.filename, foundPhoto.extension].join(".")}"`
      )

    return reply.send(stream)
  } catch (err) {
    console.error("err", err)
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Une erreur est survenue lors du téléchargement de la photo",
    })
  }
}
export const downloadMultiplePhotos = async (request, reply) => {
  try {
    // const { galleryId } = request.validated.params
    // const { photosIds } = request.validated.body
    // const foundPhotos = await db
    //   .select({ id: photos.id, url: photos.url, filename: photos.filename })
    //   .from(photos)
    //   .where(
    //     and(eq(photos.galleryId, galleryId), inArray(photos.id, photosIds))
    //   )

    // set headers
    // --- Création du zip ---
    const archive = archiver("zip", { zlib: { level: 9 } })

    reply.raw.setHeader("Access-Control-Allow-Origin", "http://localhost:5173")
    reply.raw.setHeader("Access-Control-Allow-Credentials", "true")
    reply.raw.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,DELETE,PATCH,OPTIONS"
    )
    reply.raw.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With"
    )
    reply.raw.setHeader("Content-Type", "application/zip")
    reply.raw.setHeader(
      "Content-Disposition",
      `attachment; filename="gallery.zip"`
    )

    // Ajout d'un fichier de test
    archive.append(Buffer.from("hello world"), { name: "test.txt" })

    // Finalisation + envoi avec pipeline promisifié
    await pipeline(archive, reply.raw) // attend que tout soit streamé avant de finir

    await archive.finalize() // kick-off la finalisation
    // for (const photo of foundPhotos) {
    //   const { stream: bunnyStream } = await BunnyStorageSDK.file.download(
    //     storageZone,
    //     photo.url
    //   )

    //   const reader = bunnyStream.getReader()
    //   const chunks = []

    //   while (true) {
    //     const { done, value } = await reader.read()
    //     if (done) break
    //     chunks.push(Buffer.from(value))
    //   }

    //   const buffer = Buffer.concat(chunks)

    //   archive.append(buffer, { name: photo.filename })
    // }

    // await archive.finalize()
    // reply.raw.setHeader("Access-Control-Allow-Origin", "http://localhost:5173")
    // reply.raw.setHeader("Access-Control-Allow-Credentials", "true")
    // reply.raw.setHeader(
    //   "Access-Control-Allow-Methods",
    //   "GET,POST,PUT,DELETE,PATCH,OPTIONS"
    // )
    // reply.raw.setHeader(
    //   "Access-Control-Allow-Headers",
    //   "Content-Type, Authorization, X-Requested-With"
    // )
    // reply.raw.setHeader("Content-Type", "application/zip")
    // reply.raw.setHeader(
    //   "Content-Disposition",
    //   `attachment; filename="gallery.zip"`
    // )

    // const archive = archiver("zip")

    // archive.on("drain", () => {
    //   console.log("Drained adding a file to zip")
    // })
    // archive.on("warning", (e) => {
    //   console.log(`Warning while adding a file to zip: ${e.message}`)
    // })
    // archive.on("finish", () => {
    //   console.log("Finish adding a file to zip")
    // })
    // archive.on("close", () => {
    //   console.log("closing zip")
    // })
    // archive.on("data", (data) => {
    //   console.log("on data")
    // })
    // archive.on("entry", (data) => {
    //   console.log("on entry")
    // })
    // archive.on("error", (err) => {
    //   console.error("Archiver error", err)
    //   reply.raw.end() // ferme proprement le flux
    // })
    // archive.pipe(reply.raw) // envoie direct au client

    // // téléchargement et ajout dans le ZIP
    // for (const photo of foundPhotos) {
    //   const file = await BunnyStorageSDK.file.download(storageZone, photo.url)

    //   console.log("file", file)
    //   const { stream: bunnyStream } = file
    //   const reader = bunnyStream.getReader()
    //   const chunks = []

    //   while (true) {
    //     const { done, value } = await reader.read()
    //     if (done) break
    //     chunks.push(Buffer.from(value))
    //   }

    //   const buffer = Buffer.concat(chunks)

    //   console.log("buffer size", buffer.length) // 👉 DOIT être > 0

    //   archive.append(buffer, { name: photo.filename })
    // }

    // archive.finalize()
  } catch (err) {
    console.error("err", err)
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Une erreur est survenue lors de la modification de la photo",
    })
  }
}
