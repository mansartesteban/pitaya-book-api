export const validId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || "")
export function destinationUrl(value) {
  if (typeof value !== "string" || value.length > 2048 || /[\s\\\u0000-\u001f\u007f]/.test(value)) throw new Error("Destination invalide")
  const url = new URL(value, "https://www.pitaya-photo.com")
  if (!((value.startsWith("/") && !value.startsWith("//")) || /^https?:\/\//i.test(value)) || !["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Utilisez un chemin interne ou une URL http(s), sans identifiants")
  if (["pitaya-photo.com", "www.pitaya-photo.com"].includes(url.hostname.replace(/\.$/, "")) && /^\/q(?:\/|$)/i.test(decodeURIComponent(url.pathname))) throw new Error("Un QR ne peut pas pointer vers un autre QR du site")
  return url.href
}
export function qrFields(body) {
  if (!body || typeof body.active !== "boolean") throw new Error("État invalide")
  const result = { active: body.active, destination: destinationUrl(body.destination) }
  for (const key of ["name", "category", "tags", "location", "note"]) {
    if (typeof body[key] !== "string" || body[key].length > (key === "note" ? 5000 : 300)) throw new Error(`Champ ${key} invalide`)
    result[key] = body[key].trim()
  }
  if (!result.name) throw new Error("Nom requis")
  return result
}
