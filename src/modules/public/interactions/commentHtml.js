import { parseDocument } from "htmlparser2"

const allowed = new Set(["p", "br", "strong", "b", "em", "i", "u", "s", "strike", "ul", "ol", "li", "a"])
const ignored = new Set(["script", "style", "iframe", "object", "svg", "math"])
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char])

function render(node) {
  if (node.type === "text") return { html: escapeHtml(node.data), text: node.data }
  if (ignored.has(node.name)) return { html: "", text: "" }
  const children = (node.children || []).map(render)
  const html = children.map((child) => child.html).join("")
  const text = children.map((child) => child.text).join("")
  if (!allowed.has(node.name)) return { html, text }
  const tag = { b: "strong", i: "em", strike: "s" }[node.name] || node.name
  if (tag === "br") return { html: "<br>", text: `${text}\n` }
  if (tag === "a") {
    try {
      const url = new URL(node.attribs?.href || "")
      if (!["https:", "http:", "mailto:"].includes(url.protocol)) return { html, text }
      return { html: `<a href="${escapeHtml(url.href)}" rel="nofollow noopener noreferrer">${html}</a>`, text }
    } catch { return { html, text } }
  }
  return { html: `<${tag}>${html}</${tag}>`, text }
}

export function sanitizeComment(input) {
  if (!/<[a-z][^>]*>/i.test(String(input ?? ""))) {
    const text = String(input ?? "").trim()
    return { html: escapeHtml(text).replace(/\r?\n/g, "<br>"), text }
  }
  const root = parseDocument(String(input ?? ""), { decodeEntities: true })
  const children = root.children.map(render)
  return { html: children.map((child) => child.html).join(""),
    text: children.map((child) => child.text).join("").trim() }
}

export function prefixReply(content, name) {
  return `<p><strong>@${escapeHtml(name)}</strong></p>${content}`
}
