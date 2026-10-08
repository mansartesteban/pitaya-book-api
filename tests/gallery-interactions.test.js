import test from "node:test"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import Fastify from "fastify"
import fastifyCookie from "@fastify/cookie"
import fastifyJwt from "@fastify/jwt"
import fastifyMultipart from "@fastify/multipart"
import sharp from "sharp"
import { eq } from "drizzle-orm"
import { db } from "../src/database/index.js"
import { companies, companyContacts, galleries, galleryInteractions, galleryManagerGrants, galleryUserManagerGrants, photos, users } from "../src/database/schema.js"
import interactionRoutes from "../src/modules/public/interactions/interaction.routes.js"
import memberRoutes from "../src/modules/member/member.routes.js"
import memberLibraryRoutes from "../src/modules/member/memberLibrary.routes.js"
import userRoutes from "../src/modules/user/user.routes.js"
import notificationRoutes from "../src/modules/notifications/notification.routes.js"
import accountRoutes from "../src/modules/account/account.routes.js"
import { verifyEmail } from "../src/modules/auth/auth.actions.js"
import { avatarPathFromUrl, removeAvatar } from "../src/modules/account/avatarStorage.js"

const localDatabase = (() => {
  try { return ["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname) }
  catch { return false }
})()

test.after(async () => { await db.$client.end() })

test("confirmed comments can be moderated without exposing hidden comments", { skip: !localDatabase }, async () => {
  const app = Fastify()
  app.register(fastifyCookie)
  app.register(fastifyJwt, { secret: process.env.JWT_SECRET, cookie: { cookieName: "access_token", signed: false } })
  app.register(fastifyMultipart)
  app.register(interactionRoutes, { prefix: "/api/public/interactions" })
  app.register(memberRoutes, { prefix: "/api/member" })
  app.register(memberLibraryRoutes, { prefix: "/api/member/library" })
  app.register(userRoutes, { prefix: "/api/users" })
  app.register(notificationRoutes, { prefix: "/api/notifications" })
  app.register(accountRoutes, { prefix: "/api/account" })
  app.post("/api/auth/verify-email", verifyEmail)
  const [account] = await db.insert(users).values({ email: `test-${crypto.randomUUID()}@example.invalid`,
    firstname: "Test", lastname: "User", role: "USER", emailConfirmed: true }).returning({ id: users.id })
  const [gallery] = await db.insert(galleries).values({ name: "integration-test", title: "Integration test",
    slug: `integration-${crypto.randomUUID()}`, visibility: "PUBLIC", ownerUserId: account.id }).returning({ id: galleries.id })
  let companyId = null
  let memberId = null
  let uploadedAvatarPath = null
  try {
    assert.match(gallery.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    await app.ready()
    const token = app.jwt.sign({ id: account.id, role: "USER" })
    const cookie = `access_token=${token}`
    if (process.env.RUN_BUNNY_TESTS === "1") {
    const avatarJpeg = await sharp({ create: { width: 16, height: 16, channels: 3,
      background: { r: 100, g: 120, b: 140 } } }).jpeg().toBuffer()
    const boundary = "avatar-test-boundary"
    const avatarBody = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="avatar.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      avatarJpeg, Buffer.from(`\r\n--${boundary}--\r\n`)])
    const avatarResponse = await app.inject({ method: "POST", url: "/api/account/avatar", headers: {
      cookie, "content-type": `multipart/form-data; boundary=${boundary}` }, payload: avatarBody })
    assert.equal(avatarResponse.statusCode, 200, avatarResponse.body)
    assert.match(avatarResponse.json().data.avatar, /\/api\/account\/avatar-file\/[0-9a-f-]+\/[0-9a-f-]+\.webp$/i)
    uploadedAvatarPath = avatarPathFromUrl(avatarResponse.json().data.avatar)
    const profileResponse = await app.inject({ method: "GET", url: "/api/users/me", headers: { cookie } })
    assert.equal(profileResponse.json().data.avatar, avatarResponse.json().data.avatar)
    }
    const post = await app.inject({ method: "POST", url: `/api/public/interactions/${gallery.id}`,
      headers: { cookie }, payload: { kind: "COMMENT", content: "Test comment" } })
    assert.equal(post.statusCode, 201, post.body)
    const commentId = post.json().data.id
    const before = await app.inject({ method: "GET", url: `/api/public/interactions/${gallery.id}` })
    assert.equal(before.json().data.length, 1)
    const hide = await app.inject({ method: "PATCH", url: `/api/member/galleries/${gallery.id}/comments/${commentId}/visibility`,
      headers: { cookie }, payload: { hidden: true } })
    assert.equal(hide.statusCode, 200, hide.body)
    const after = await app.inject({ method: "GET", url: `/api/public/interactions/${gallery.id}` })
    assert.equal(after.json().data.length, 0)

    const guestPost = await app.inject({ method: "POST", url: `/api/public/interactions/${gallery.id}`,
      payload: { kind: "COMMENT", content: "Guest denied", email: "guest@example.invalid", name: "Guest" } })
    assert.equal(guestPost.statusCode, 401)
    const guestReaction = await app.inject({ method: "POST", url: `/api/public/interactions/${gallery.id}`,
      payload: { kind: "REACTION", reaction: "LOVE", email: "guest@example.invalid", name: "Guest" } })
    assert.equal(guestReaction.statusCode, 401)
    const [child] = await db.insert(galleries).values({ name: "child", title: "Child",
      slug: `child-${crypto.randomUUID()}`, visibility: "PUBLIC", ownerUserId: account.id,
      parentGallery: gallery.id }).returning({ id: galleries.id })
    await db.update(galleries).set({ allowComments: false, allowReactions: false }).where(eq(galleries.id, gallery.id))
    const deniedComment = await app.inject({ method: "POST", url: `/api/public/interactions/${child.id}`,
      headers: { cookie }, payload: { kind: "COMMENT", content: "Should be blocked" } })
    assert.equal(deniedComment.statusCode, 403, deniedComment.body)
    const deniedReaction = await app.inject({ method: "POST", url: `/api/public/interactions/${child.id}`,
      headers: { cookie }, payload: { kind: "REACTION", reaction: "LOVE" } })
    assert.equal(deniedReaction.statusCode, 403, deniedReaction.body)
    await db.update(galleries).set({ allowComments: true, allowReactions: true }).where(eq(galleries.id, gallery.id))
    const allowedComment = await app.inject({ method: "POST", url: `/api/public/interactions/${child.id}`,
      headers: { cookie }, payload: { kind: "COMMENT", content: "Allowed" } })
    assert.equal(allowedComment.statusCode, 201, allowedComment.body)

    const [photo] = await db.insert(photos).values({ galleryId: gallery.id, extension: "jpg", url: "unused",
      size: 1, width: 1, height: 1, ratio: "1" }).returning({ id: photos.id })
    const visiblePhoto = await app.inject({ method: "GET", url: `/api/public/interactions/${gallery.id}?photoId=${photo.id}` })
    assert.equal(visiblePhoto.statusCode, 200)
    const hidden = await app.inject({ method: "PATCH", url: `/api/member/galleries/${gallery.id}/photos/${photo.id}/visibility`,
      headers: { cookie }, payload: { hidden: true } })
    assert.equal(hidden.statusCode, 200, hidden.body)
    const hiddenPhoto = await app.inject({ method: "GET", url: `/api/public/interactions/${gallery.id}?photoId=${photo.id}` })
    assert.equal(hiddenPhoto.statusCode, 404)

    const memberEmail = `member-${crypto.randomUUID()}@example.invalid`
    const [member] = await db.insert(users).values({ email: memberEmail, role: "USER", emailConfirmed: true })
      .returning({ id: users.id })
    memberId = member.id
    const [company] = await db.insert(companies).values({ name: "Test company", userId: account.id })
      .returning({ id: companies.id })
    companyId = company.id
    const [contact] = await db.insert(companyContacts).values({ companyId, firstname: "Test", lastname: "Member", email: memberEmail })
      .returning({ id: companyContacts.id })
    await db.update(galleries).set({ clientCompanyId: companyId }).where(eq(galleries.id, gallery.id))
    await db.insert(galleryManagerGrants).values({ galleryId: gallery.id, contactId: contact.id, grantedByUserId: account.id })
    const memberCookie = `access_token=${app.jwt.sign({ id: member.id, role: "USER" })}`
    const managed = await app.inject({ method: "GET", url: "/api/users/me/managed-galleries", headers: { cookie: memberCookie } })
    assert.equal(managed.statusCode, 200, managed.body)
    assert.equal(managed.json().data[0].id, gallery.id)
    const [childPhoto] = await db.insert(photos).values({ galleryId: child.id, extension: "jpg", url: "unused",
      size: 1, width: 1, height: 1, ratio: "1" }).returning({ id: photos.id })
    const photoComment = await app.inject({ method: "POST", url: `/api/public/interactions/${child.id}`,
      headers: { cookie }, payload: { kind: "COMMENT", photoId: childPhoto.id, content: "Child photo comment" } })
    assert.equal(photoComment.statusCode, 201, photoComment.body)
    const tree = await app.inject({ method: "GET", url: `/api/member/galleries/${gallery.id}/tree`, headers: { cookie: memberCookie } })
    assert.equal(tree.statusCode, 200, tree.body)
    assert.equal(tree.json().data.children[0].id, child.id)
    assert.equal(tree.json().data.children[0].comments.some((item) => item.id === allowedComment.json().data.id), true)
    assert.equal(tree.json().data.children[0].photos[0].comments[0].id, photoComment.json().data.id)
    const hideChildPhoto = await app.inject({ method: "PATCH", url: `/api/member/galleries/${child.id}/photos/${childPhoto.id}/visibility`,
      headers: { cookie: memberCookie }, payload: { hidden: true } })
    assert.equal(hideChildPhoto.statusCode, 200, hideChildPhoto.body)
    const hideChildComment = await app.inject({ method: "PATCH", url: `/api/member/galleries/${child.id}/comments/${photoComment.json().data.id}/visibility`,
      headers: { cookie: memberCookie }, payload: { hidden: true } })
    assert.equal(hideChildComment.statusCode, 200, hideChildComment.body)
    const unhide = await app.inject({ method: "PATCH", url: `/api/member/galleries/${gallery.id}/photos/${photo.id}/visibility`,
      headers: { cookie: memberCookie }, payload: { hidden: false } })
    assert.equal(unhide.statusCode, 200, unhide.body)

    const favorite = await app.inject({ method: "PUT", url: `/api/member/library/photos/${photo.id}`, headers: { cookie: memberCookie } })
    assert.equal(favorite.statusCode, 200, favorite.body)
    const selectionResponse = await app.inject({ method: "POST", url: "/api/member/library/selections", headers: { cookie: memberCookie },
      payload: { name: "My selection" } })
    assert.equal(selectionResponse.statusCode, 201, selectionResponse.body)
    const selectionId = selectionResponse.json().data.id
    const add = await app.inject({ method: "PUT", url: `/api/member/library/selections/${selectionId}/photos/${photo.id}`,
      headers: { cookie: memberCookie } })
    assert.equal(add.statusCode, 200, add.body)
    const selected = await app.inject({ method: "GET", url: `/api/member/library/selections/${selectionId}`, headers: { cookie: memberCookie } })
    assert.equal(selected.json().data.photos.length, 1)
    const library = await app.inject({ method: "GET", url: "/api/member/library", headers: { cookie: memberCookie } })
    assert.equal(library.statusCode, 200, library.body)
    const summary = library.json().data.selections.find((item) => item.id === selectionId)
    assert.equal(summary.photoCount, 1)
    assert.ok(summary.thumbnailUrl)
    const favoriteGallery = await app.inject({ method: "PUT", url: `/api/member/library/galleries/${gallery.id}`, headers: { cookie: memberCookie } })
    assert.equal(favoriteGallery.statusCode, 200, favoriteGallery.body)
    const libraryWithGallery = await app.inject({ method: "GET", url: "/api/member/library", headers: { cookie: memberCookie } })
    const favoriteSummary = libraryWithGallery.json().data.galleries.find((item) => item.id === gallery.id)
    assert.equal(favoriteSummary.photoCount, 1)
    assert.ok(favoriteSummary.thumbnailUrl)
    assert.ok(favoriteSummary.createdAt)
    const selectedLibrary = await app.inject({ method: "GET", url: `/api/member/library?photoId=${photo.id}`, headers: { cookie: memberCookie } })
    assert.equal(selectedLibrary.json().data.selections.find((item) => item.id === selectionId).containsPhoto, true)
    const removeFromSelection = await app.inject({ method: "DELETE", url: `/api/member/library/selections/${selectionId}/photos/${photo.id}`,
      headers: { cookie: memberCookie } })
    assert.equal(removeFromSelection.statusCode, 200, removeFromSelection.body)
    const unselectedLibrary = await app.inject({ method: "GET", url: `/api/member/library?photoId=${photo.id}`, headers: { cookie: memberCookie } })
    assert.equal(unselectedLibrary.json().data.selections.find((item) => item.id === selectionId).containsPhoto, false)
    await app.inject({ method: "PUT", url: `/api/member/library/selections/${selectionId}/photos/${photo.id}`, headers: { cookie: memberCookie } })
    const layout = { columns: 4, rows: 6, widgets: [
      { id: "selections", x: 0, y: 0, width: 2, height: 3 },
      { id: "galleries", x: 2, y: 0, width: 2, height: 2 },
      { id: "photos", x: 0, y: 3, width: 4, height: 3 },
    ] }
    const saveLayout = await app.inject({ method: "PUT", url: "/api/users/me/library-layout",
      headers: { cookie: memberCookie }, payload: layout })
    assert.equal(saveLayout.statusCode, 200, saveLayout.body)
    const restoredLayout = await app.inject({ method: "GET", url: "/api/users/me/library-layout", headers: { cookie: memberCookie } })
    assert.deepEqual(restoredLayout.json().data, layout)
    const managedLayout = { columns: 4, rows: 5, widgets: [
      { id: "managed", x: 0, y: 0, width: 2, height: 3 },
      { id: "upcoming", x: 2, y: 0, width: 2, height: 2 },
    ] }
    const savedManagedLayout = await app.inject({ method: "PUT", url: "/api/users/me/managed-galleries-layout",
      headers: { cookie: memberCookie }, payload: managedLayout })
    assert.equal(savedManagedLayout.statusCode, 200, savedManagedLayout.body)
    const restoredManagedLayout = await app.inject({ method: "GET", url: "/api/users/me/managed-galleries-layout", headers: { cookie: memberCookie } })
    assert.deepEqual(restoredManagedLayout.json().data, managedLayout)
    await app.inject({ method: "PATCH", url: `/api/member/galleries/${gallery.id}/photos/${photo.id}/visibility`,
      headers: { cookie: memberCookie }, payload: { hidden: true } })
    const hiddenSelection = await app.inject({ method: "GET", url: `/api/member/library/selections/${selectionId}`, headers: { cookie: memberCookie } })
    assert.equal(hiddenSelection.json().data.photos.length, 0)
    await db.update(galleries).set({ clientCompanyId: null }).where(eq(galleries.id, gallery.id))
    await db.insert(galleryUserManagerGrants).values({ galleryId: gallery.id, userId: member.id, grantedByUserId: account.id })
    const directlyManaged = await app.inject({ method: "GET", url: "/api/users/me/managed-galleries", headers: { cookie: memberCookie } })
    assert.equal(directlyManaged.json().data.some((item) => item.id === gallery.id), true)
    const directStats = await app.inject({ method: "GET", url: `/api/member/galleries/${gallery.id}/stats`, headers: { cookie: memberCookie } })
    assert.equal(directStats.statusCode, 200, directStats.body)
  } finally {
    await app.close()
    await db.delete(galleries).where(eq(galleries.id, gallery.id))
    if (companyId) await db.delete(companies).where(eq(companies.id, companyId))
    if (memberId) await db.delete(users).where(eq(users.id, memberId))
    await db.delete(users).where(eq(users.id, account.id))
    if (uploadedAvatarPath) await removeAvatar(uploadedAvatarPath)
  }
})
