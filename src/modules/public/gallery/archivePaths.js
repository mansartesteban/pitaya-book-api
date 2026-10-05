const safeSegment = (value, fallback) =>
  String(value || "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim() || fallback

export const buildArchiveEntries = (rootGalleryId, galleryTree, photos) => {
  const paths = new Map([[rootGalleryId, ""]])
  const folderNames = new Map()

  for (const gallery of galleryTree) {
    if (gallery.id === rootGalleryId) continue
    const parentPath = paths.get(gallery.parentGalleryId)
    if (parentPath === undefined) continue

    const base = safeSegment(gallery.title, "Galerie")
    const key = `${gallery.parentGalleryId}/${base}`
    const count = (folderNames.get(key) || 0) + 1
    folderNames.set(key, count)
    const name = count === 1 ? base : `${base} (${count})`
    paths.set(gallery.id, parentPath ? `${parentPath}/${name}` : name)
  }

  const fileNames = new Map()
  return photos.flatMap((photo) => {
    const folder = paths.get(photo.galleryId)
    if (folder === undefined) return []

    const base = safeSegment(photo.filename, "Photo")
    const extension = safeSegment(photo.extension, "jpg")
    const key = `${photo.galleryId}/${base}.${extension}`
    const count = (fileNames.get(key) || 0) + 1
    fileNames.set(key, count)
    const filename = count === 1
      ? `${base}.${extension}`
      : `${base} (${count}).${extension}`

    return [{ photo, name: folder ? `${folder}/${filename}` : filename }]
  })
}
