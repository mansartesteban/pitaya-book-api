import test from "node:test"
import assert from "node:assert/strict"
import { sanitizeComment, prefixReply } from "../src/modules/public/interactions/commentHtml.js"

test("comment formatting keeps supported marks and drops executable content", () => {
  const comment = sanitizeComment('<p>Salut <strong>toi</strong> <a href="javascript:alert(1)" onclick="alert(2)">lien</a></p><script>alert(3)</script>')
  assert.equal(comment.html, "<p>Salut <strong>toi</strong> lien</p>")
  assert.equal(comment.text, "Salut toi lien")
  assert.equal(sanitizeComment('<p><a href="https://example.com">Site</a></p>').html,
    '<p><a href="https://example.com/" rel="nofollow noopener noreferrer">Site</a></p>')
  assert.equal(prefixReply("<p>Merci</p>", '<img src=x>'), '<p><strong>@&lt;img src=x&gt;</strong></p><p>Merci</p>')
})
