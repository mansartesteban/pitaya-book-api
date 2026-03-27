import { db } from "../../../database/index.js"
import { galleries, photos } from "../../../database/schema.js"
import { and, eq, inArray, sql } from "drizzle-orm"
import { signPhotoUrl } from "../../../lib/utils/Photo.js"

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
      })
      .from(galleries)
      .where(
        and(eq(galleries.id, galleryId), eq(galleries.visibility, "PUBLIC"))
      )

    if (!foundGallery) {
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
      .where(eq(galleries.parentGallery, foundGallery.id))

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
      }
      foundGallery.children = childrenGalleries.filter(
        (child) => child.photos.length >= 3
      )
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
        .where(eq(photos.galleryId, foundGallery.id))
      foundGallery.photos = foundPhotos.map((photo) => {
        photo.urls = {
          300: signPhotoUrl(photo, true, 300),
          600: signPhotoUrl(photo, true, 600),
          original: signPhotoUrl(photo, true),
        }
        return photo
      })
    }

    return reply.code(200).send({ success: true, data: foundGallery })
  } catch (err) {
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Une erreur est survenue lors de la récupération des galeries",
    })
  }
}
