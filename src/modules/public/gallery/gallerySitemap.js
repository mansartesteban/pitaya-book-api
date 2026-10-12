// Only galleries reachable through an entirely public ancestry belong in SEO.
export function publicGallerySitemapRows(rows) {
  const byId = new Map(rows.map((row) => [row.id, row]))

  function isPublicBranch(gallery) {
    const visited = new Set()
    let current = gallery
    while (current) {
      if (current.visibility !== 'PUBLIC' || visited.has(current.id)) return false
      visited.add(current.id)
      if (!current.parentGallery) return true
      current = byId.get(current.parentGallery)
    }
    return false
  }

  return rows.filter(isPublicBranch).map(({ slug, visibility }) => ({ slug, visibility }))
}
