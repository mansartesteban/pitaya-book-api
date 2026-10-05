import { db } from "../../../database/index.js"
import { galleries, photos } from "../../../database/schema.js"
import { and, eq, inArray, not, sql } from "drizzle-orm"
import { signPhotoUrl } from "../../../lib/utils/Photo.js"
import * as BunnyStorageSDK from "@bunny.net/storage-sdk"
import bcrypt from "bcrypt"
import { Readable } from "node:stream"
import slugify from "slugify"
import path from "node:path"
import fs from "node:fs"
import { canDownloadGallery, canDownloadPhoto, galleryAccessToken, isGalleryUnlocked } from "./downloadAccess.js"
import { buildArchiveEntries } from "./archivePaths.js"
import { writeGalleryArchive } from "./archiveWriter.js"

const storageZone = BunnyStorageSDK.zone.connect_with_accesskey(
  BunnyStorageSDK.regions.StorageRegion.Falkenstein,
  process.env.BUNNY_STORAGE_ZONE,
  process.env.BUNNY_FTP_PASSWORD
)

export const getAllGalleries = async (request, reply) => {
  try {
    // Récupère toutes les galeries pour reconstruire l'arbre
    const allGalleries = await db
      .select({
        id: galleries.id,
        parentGallery: galleries.parentGallery,
        visibility: galleries.visibility,
      })
      .from(galleries)

    const galleryMap = new Map(allGalleries.map((g) => [g.id, g]))

    // Vérifie récursivement toute la chaîne des parents
    function hasOnlyPublicParents(galleryId) {
      let current = galleryMap.get(galleryId)

      while (current?.parentGallery) {
        const parent = galleryMap.get(current.parentGallery)

        if (!parent) return false

        if (parent.visibility !== "PUBLIC") {
          return false
        }

        current = parent
      }

      return true
    }

    // Galeries publiques à afficher
    const foundGalleries = await db
      .select({
        id: galleries.id,
        name: galleries.name,
        createdAt: galleries.createdAt,
        title: galleries.title,
        coverPhotoId: galleries.coverPhotoId,
        description: galleries.description,
        visibility: galleries.visibility,
        photoCount: sql`count(${photos.id})`.as("photoCount"),
        parentGallery: galleries.parentGallery,
      })
      .from(galleries)
      .leftJoin(photos, eq(photos.galleryId, galleries.id))
      .where(eq(galleries.visibility, "PUBLIC"))
      .groupBy(galleries.id)

    // Récupération de toutes les photos en une requête
    const foundPhotos = await db
      .select({
        extension: photos.extension,
        id: photos.id,
        galleryId: photos.galleryId,
      })
      .from(photos)

    // Groupe les photos par galerie (max 3)
    const photosByGallery = new Map()

    for (const photo of foundPhotos) {
      if (!photosByGallery.has(photo.galleryId)) {
        photosByGallery.set(photo.galleryId, [])
      }

      const galleryPhotos = photosByGallery.get(photo.galleryId)

      if (galleryPhotos.length < 3) {
        galleryPhotos.push({
          ...photo,
          urls: {
            300: signPhotoUrl(photo, true, 300),
            600: signPhotoUrl(photo, true, 600),
            original: signPhotoUrl(photo, true),
          },
        })
      }
    }

    // Ajoute les photos aux galeries
    for (const gallery of foundGalleries) {
      gallery.photos = photosByGallery.get(gallery.id) ?? []

      gallery.coverPhoto = gallery.photos.find(
        (photo) => photo.id === gallery.coverPhotoId
      )

      gallery.photos = gallery.photos.filter(
        (photo) => photo.id !== gallery.coverPhotoId
      )
    }

    const parentIds = new Set(
      foundGalleries.map((g) => g.parentGallery).filter(Boolean)
    )

    // Filtrage
    const filteredGalleries = foundGalleries.filter(
      (g) =>
        hasOnlyPublicParents(g.id) &&
        (g.photos.length > 2 || parentIds.has(g.id))
    )

    // Construction arbre
    const map = new Map()

    for (const g of filteredGalleries) {
      map.set(g.id, {
        ...g,
        children: [],
      })
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
        downloadable: galleries.downloadable,
      })
      .from(galleries)
      .where(and(eq(galleries.id, galleryId)))

    if (!foundGallery) {
      return reply.code(404).send({ success: false, message: "Aucune galerie trouvée" })
    }

    if (foundGallery.visibility === "PRIVATE") {
      if (!isGalleryUnlocked(foundGallery, request)) {
        return reply.code(200).send({ success: true, data: foundGallery })
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
        downloadable: galleries.downloadable,
        parentGallery: galleries.parentGallery,
      })
      .from(galleries)
      .where(and(eq(galleries.id, galleryId)))

    if (!foundGallery) {
      return reply.code(404).send({ success: false, message: "Aucune galerie trouvée" })
    }

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
          reply.setCookie(`gallery_${foundGallery.id}`, galleryAccessToken(foundGallery.id), {
            path: "/",
            maxAge: 60 * 60 * 24,
            httpOnly: true,
            sameSite: "lax",
          })
          const { password: galleryPassword, ...publicGallery } = foundGallery
          return getPublicGallery(publicGallery, request, reply)
        }
      }
    } else {
      const { password: galleryPassword, ...publicGallery } = foundGallery
      return getPublicGallery(publicGallery, request, reply)
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
    .where(
      and(
        eq(galleries.parentGallery, gallery.id),
        eq(galleries.visibility, "PUBLIC")
      )
    )

  if (childrenGalleries.length > 0) {
    for (let childrenGallery of childrenGalleries) {
      const foundPhotos = await db
        .select({
          id: photos.id,
          width: photos.width,
          height: photos.height,
          ratio: photos.ratio,
          size: photos.size,
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
          .where(
            and(
              eq(galleries.parentGallery, childrenGallery.id),
              eq(galleries.visibility, "PUBLIC")
            )
          )
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
    gallery.children = childrenGalleries.filter(
      (child) => child.photos.length >= 3
    )
  } else {
    const foundPhotos = await db
      .select({
        id: photos.id,
        width: photos.width,
        height: photos.height,
        size: photos.size,
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

export const prepareDownloadPrivateGallery = async (request, reply) => {
  const { galleryId } = request.validated.params

  const [gallery] = await db
    .select({
      id: galleries.id,
      title: galleries.title,
      visibility: galleries.visibility,
      downloadable: galleries.downloadable,
    })
    .from(galleries)
    .where(eq(galleries.id, galleryId))

  if (!gallery) {
    return reply.code(404).send({ error: "Gallery not found" })
  }

  if (!canDownloadGallery(gallery, request)) {
    return reply.code(403).send({ success: false, message: "Téléchargement non autorisé" })
  }

  const zipPath = path.join(process.cwd(), "tmp", `${gallery.id}.zip`)

  try {
    await buildZip(zipPath, galleryId)
  } catch (error) {
    request.log.error(error)
    return reply.code(502).send({
      success: false,
      message: "Impossible de préparer le téléchargement pour le moment. Réessayez plus tard.",
    })
  }

  return reply
    .code(200)
    .send({ success: true, message: "Gallery ready for download" })
}

export const downloadPrivateGallery = async (request, reply) => {
  const { galleryId } = request.validated.params

  const [gallery] = await db
    .select({
      id: galleries.id,
      title: galleries.title,
      visibility: galleries.visibility,
      downloadable: galleries.downloadable,
    })
    .from(galleries)
    .where(eq(galleries.id, galleryId))

  if (!gallery) {
    return reply.code(404).send({ success: false, message: "Aucune galerie trouvée" })
  }

  if (!canDownloadGallery(gallery, request)) {
    return reply.code(403).send({ success: false, message: "Téléchargement non autorisé" })
  }

  const filename = slugify(gallery.title, {
    lower: true,
    strict: true,
  })

  const zipPath = path.join(process.cwd(), "tmp", `${gallery.id}.zip`)
  if (!fs.existsSync(zipPath)) {
    return reply.code(404).send({ success: false, message: "Téléchargement à préparer" })
  }
  const stat = fs.statSync(zipPath)

  reply
    .header("Content-Type", "application/zip")
    .header("Content-Disposition", `attachment; filename="${filename}.zip"`)
    .header("Content-Length", stat.size)

  const stream = fs.createReadStream(zipPath)

  return reply.send(stream)
}

export const downloadPublicPhoto = async (request, reply) => {
  try {
    const { galleryId, photoId } = request.validated.params
    const [gallery] = await db
      .select({
        id: galleries.id,
        visibility: galleries.visibility,
        downloadable: galleries.downloadable,
      })
      .from(galleries)
      .where(eq(galleries.id, galleryId))

    if (!gallery) return reply.code(404).send({ success: false, message: "Galerie introuvable" })
    if (!canDownloadPhoto(gallery, request)) {
      return reply.code(403).send({ success: false, message: "Téléchargement non autorisé" })
    }

    const [photo] = await db
      .select({
        id: photos.id,
        galleryId: photos.galleryId,
        filename: photos.filename,
        extension: photos.extension,
        url: photos.url,
      })
      .from(photos)
      .where(and(eq(photos.id, photoId), eq(photos.galleryId, galleryId)))

    if (!photo) return reply.code(404).send({ success: false, message: "Photo introuvable" })

    const response = await fetch(signPhotoUrl(photo, true))
    if (!response.ok || !response.body) throw new Error(`Photo CDN: ${response.status}`)

    const base = slugify(photo.filename || "photo", { lower: false, strict: true }) || "photo"
    const extension = photo.extension.replace(/[^a-zA-Z0-9]/g, "") || "jpg"
    const filename = `${base}.${extension}`

    reply.header("Content-Type", response.headers.get("content-type") || "application/octet-stream")
    reply.header("Content-Disposition", `attachment; filename="${filename}"`)
    const length = response.headers.get("content-length")
    if (length) reply.header("Content-Length", length)
    return reply.send(Readable.fromWeb(response.body))
  } catch (error) {
    request.log.error(error)
    return reply.code(502).send({ success: false, message: "Photo indisponible" })
  }
}

export async function buildZip(zipPath, galleryId) {
  const galleryTree = await db.execute(sql`
    WITH RECURSIVE tree AS (
      SELECT id, title, parent_gallery_id, 0 AS depth, ARRAY[id] AS visited
      FROM pitaya.galleries
      WHERE id = ${galleryId}

      UNION ALL

      SELECT child.id, child.title, child.parent_gallery_id,
        tree.depth + 1, tree.visited || child.id
      FROM pitaya.galleries child
      JOIN tree ON child.parent_gallery_id = tree.id
      WHERE child.visibility = 'PUBLIC' AND NOT child.id = ANY(tree.visited)
    )
    SELECT id, title, parent_gallery_id AS "parentGalleryId"
    FROM tree
    ORDER BY depth, title, id
  `)

  const foundPhotos = await db
    .select({
      id: photos.id,
      filename: photos.filename,
      galleryId: photos.galleryId,
      extension: photos.extension,
      url: photos.url,
    })
    .from(photos)
    .where(inArray(photos.galleryId, galleryTree.map((gallery) => gallery.id)))

  const entries = buildArchiveEntries(galleryId, galleryTree, foundPhotos)
  await writeGalleryArchive(zipPath, entries, async (photo) => {
    const { stream } = await BunnyStorageSDK.file.download(storageZone, photo.url)
    return stream
  })
}
