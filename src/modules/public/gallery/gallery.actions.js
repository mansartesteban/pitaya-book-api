import { db } from "../../../database/index.js"
import { galleries, photos } from "../../../database/schema.js"
import { and, eq, inArray, not, sql } from "drizzle-orm"
import { signPhotoUrl } from "../../../lib/utils/Photo.js"
import bcrypt from "bcrypt"

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
        parentGallery: galleries.parentGallery,
      })
      .from(galleries)
      .leftJoin(photos, eq(photos.galleryId, galleries.id))
      .where(eq(galleries.visibility, "PUBLIC"))
      .groupBy(galleries.id)

    for (let foundGallery of foundGalleries) {
      const foundPhotos = await db
        .select({
          extension: photos.extension,
          id: photos.id,
          galleryId: photos.galleryId,
        })
        .from(photos)
        .where(eq(photos.galleryId, foundGallery.id))
        .limit(3)

      foundGallery.photos = foundPhotos.map((photo) => {
        photo.urls = {
          300: signPhotoUrl(photo, true, 300),
          600: signPhotoUrl(photo, true, 600),
          original: signPhotoUrl(photo, true),
        }
        return photo
      })
    }

    const map = new Map()

    const filteredGalleries = foundGalleries.filter((g) => {
      return (
        g.photos.length > 2 ||
        foundGalleries.map((gal) => gal.parentGallery).includes(g.id)
      )
    })

    // indexation
    for (const g of filteredGalleries) {
      map.set(g.id, { ...g, children: [] })
    }

    const roots = []

    for (const g of map.values()) {
      if (g.parentGallery && map.has(g.parentGallery)) {
        if (g.photos.length) {
          map.get(g.parentGallery).children.push(g)
        }
      } else {
        roots.push(g)
      }
    }

    return reply.code(200).send({
      success: true,
      data: roots,
    })
  } catch (err) {
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
        parentGallery: galleries.parentGallery,
        visibility: galleries.visibility,
      })
      .from(galleries)
      .where(and(eq(galleries.id, galleryId)))

    if (foundGallery.visibility === "PRIVATE") {
      const cookie = request.cookies[`gallery_${foundGallery.id}`]

      if (cookie !== "1") {
        reply.code(200).send({ success: true, data: foundGallery })
      } else {
        return getPublicGallery(foundGallery, request, reply)
      }
    }

    return getPublicGallery(foundGallery, request, reply)
  } catch (err) {
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Une erreur est survenue lors de la récupération des galeries",
    })
  }
}

export const getPrivateGallery = async (request, reply) => {
  try {
    const { galleryId } = request.validated.params
    const { password } = request.validated.body

    const [foundGallery] = await db
      .select({
        id: galleries.id,
        name: galleries.name,
        title: galleries.title,
        description: galleries.description,
        password: galleries.password,
        visibility: galleries.visibility,
        parentGallery: galleries.parentGallery,
      })
      .from(galleries)
      .where(and(eq(galleries.id, galleryId)))

    if (foundGallery.visibility === "PRIVATE") {
      if (!foundGallery.password) {
        return reply.code(401).send({
          success: false,
          message: "Cette galerie ne peut pas être vue",
        })
      } else {
        if (foundGallery.password !== password) {
          return reply
            .code(401)
            .send({ success: false, message: "Mot de passe incorrect" })
        } else {
          reply.setCookie(`gallery_${foundGallery.id}`, "1", {
            path: "/",
            maxAge: 60 * 60 * 24,
            httpOnly: true,
            sameSite: "lax",
          })
          return getPublicGallery(foundGallery, request, reply)
        }
      }
    } else {
      return getPublicGallery(foundGallery, request, reply)
    }
  } catch (err) {
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Une erreur est survenue lors de la récupération des galeries",
    })
  }
}

const getPublicGallery = async (gallery, request, reply) => {
  if (!gallery) {
    return reply
      .code(404)
      .send({ success: false, message: "Aucune galerie trouvée" })
  }

  const childrenGalleries = await db
    .select({
      id: galleries.id,
      name: galleries.name,
      title: galleries.title,
      description: galleries.description,
    })
    .from(galleries)
    .where(eq(galleries.parentGallery, gallery.id))

  if (childrenGalleries.length > 0) {
    for (let childrenGallery of childrenGalleries) {
      const foundPhotos = await db
        .select({
          id: photos.id,
          width: photos.width,
          height: photos.height,
          ratio: photos.ratio,
          galleryId: photos.galleryId,
          extension: photos.extension,
        })
        .from(photos)
        .where(eq(photos.galleryId, childrenGallery.id))

      childrenGallery.photos = foundPhotos.map((photo) => {
        photo.urls = {
          300: signPhotoUrl(photo, true, 300),
          600: signPhotoUrl(photo, true, 600),
          original: signPhotoUrl(photo, true),
        }
        return photo
      })

      if (childrenGallery.photos.length === 0) {
        const subsubGalleries = await db
          .select({ id: galleries.id })
          .from(galleries)
          .where(eq(galleries.parentGallery, childrenGallery.id))
        if (subsubGalleries) {
          const foundSubPhotos = await db
            .select({
              id: photos.id,
              width: photos.width,
              height: photos.height,
              ratio: photos.ratio,
              galleryId: photos.galleryId,
              extension: photos.extension,
            })
            .from(photos)
            .where(
              inArray(
                photos.galleryId,
                subsubGalleries.map((s) => s.id)
              )
            )
            .limit(3)
          childrenGallery.photos = foundSubPhotos.map((photo) => {
            photo.urls = {
              300: signPhotoUrl(photo, true, 300),
              600: signPhotoUrl(photo, true, 600),
              original: signPhotoUrl(photo, true),
            }
            return photo
          })
        }
      }
    }
    gallery.children = childrenGalleries
    // .filter(
    //   (child) => child.photos.length >= 3
    // )
  } else {
    const foundPhotos = await db
      .select({
        id: photos.id,
        width: photos.width,
        height: photos.height,
        ratio: photos.ratio,
        galleryId: photos.galleryId,
        extension: photos.extension,
      })
      .from(photos)
      .where(
        and(eq(photos.galleryId, gallery.id), eq(photos.isCoverPhoto, false))
      )

    gallery.photos = foundPhotos.map((photo) => {
      photo.urls = {
        300: signPhotoUrl(photo, true, 300),
        600: signPhotoUrl(photo, true, 600),
        original: signPhotoUrl(photo, true),
      }
      return photo
    })
  }

  let current = gallery

  while (current.parentGallery) {
    console.log("in hilw", current.parentGallery)
    const [parent] = await db
      .select({
        id: galleries.id,
        parentGallery: galleries.parentGallery,
        description: galleries.description,
        title: galleries.title,
      })
      .from(galleries)
      .where(eq(galleries.id, current.parentGallery))
      .limit(1)

    if (!parent) break

    current = parent
  }
  let rootGallery = current

  const [coverPhoto] = await db
    .select({
      id: photos.id,
      width: photos.width,
      height: photos.height,
      ratio: photos.ratio,
      galleryId: photos.galleryId,
      extension: photos.extension,
    })
    .from(photos)
    .where(
      and(eq(photos.galleryId, rootGallery.id), eq(photos.isCoverPhoto, true))
    )
    .limit(1)

  if (coverPhoto) {
    gallery.coverPhoto = {
      ...coverPhoto,
      urls: {
        300: signPhotoUrl(coverPhoto, true, 300),
        600: signPhotoUrl(coverPhoto, true, 600),
        original: signPhotoUrl(coverPhoto, true),
      },
    }
  }

  if (gallery.id !== rootGallery.id) {
    gallery.subtitle = gallery.title
    gallery.title = rootGallery.title
  }

  return reply.code(200).send({ success: true, data: gallery })
}
