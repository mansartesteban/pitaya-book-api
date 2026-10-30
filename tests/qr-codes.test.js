import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import { eq } from 'drizzle-orm'
import { db } from '../src/database/index.js'
import { qrCodes, qrOpenings, users } from '../src/database/schema.js'
import routes from '../src/modules/qr/qr.routes.js'
import { destinationUrl, qrFields } from '../src/modules/qr/qr.validation.js'

test('destinations allow internal paths and web URLs, rejecting unsafe or recursive URLs', () => {
  assert.equal(destinationUrl('/galleries'), 'https://www.pitaya-photo.com/galleries')
  assert.equal(destinationUrl('https://instagram.com/example'), 'https://instagram.com/example')
  for (const value of ['javascript:alert(1)', '//evil.test', '/\\evil.test', 'https://user:pass@example.com', '/q/abc', 'https://pitaya-photo.com/q/abc', 'https://example.com\nLocation:evil']) assert.throws(() => destinationUrl(value), value)
  assert.throws(() => qrFields({ active: true, name: '' }))
})
const local = (() => { try { return ['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname) } catch { return false } })()
test.after(async () => db.$client.end())
test('admin lifecycle, immutable ID, privacy, redirects, independent counts and deactivation', { skip: !local }, async () => {
  const app = Fastify(); app.register(cookie); app.register(jwt, { secret: 'qr-test-secret', cookie: { cookieName: 'access_token', signed: false } }); app.register(routes); await app.ready()
  const suffix = crypto.randomUUID()
  const accounts = await db.insert(users).values([{ email: `qr-admin-${suffix}@example.invalid`, role: 'ADMIN', isActive: true }, { email: `qr-user-${suffix}@example.invalid`, role: 'USER', isActive: true }]).returning()
  const admin = { cookie: `access_token=${app.jwt.sign({ id: accounts[0].id })}` }, user = { cookie: `access_token=${app.jwt.sign({ id: accounts[1].id, role: 'ADMIN' })}` }
  const ids = []
  try {
    assert.equal((await app.inject('/qr-codes')).statusCode, 401)
    assert.equal((await app.inject({ url: '/qr-codes', headers: user })).statusCode, 403)
    const payload = { name: 'Cadre', destination: 'https://instagram.com/example', category: 'Cadre', tags: 'expo', location: 'Salon', note: 'Privé', active: true }
    for (const name of ['Cadre', 'Lightbox']) {
      const response = await app.inject({ method: 'POST', url: '/qr-codes', headers: admin, payload: { ...payload, name } }); assert.equal(response.statusCode, 201, response.body); ids.push(response.json().id)
    }
    const publicUrl = `/public/qr/${ids[0]}`
    const opened = await app.inject(publicUrl); assert.equal(opened.statusCode, 302); assert.equal(opened.headers.location, payload.destination); assert.match(opened.headers['cache-control'], /no-store/); assert.ok(!opened.body.includes('Privé'))
    await app.inject(publicUrl); await app.inject({ method: 'HEAD', url: publicUrl })
    const updated = await app.inject({ method: 'PUT', url: `/qr-codes/${ids[0]}`, headers: admin, payload: { ...payload, id: ids[1], name: 'Cadre renommé', destination: '/galleries' } }); assert.equal(updated.json().id, ids[0])
    assert.equal((await app.inject(publicUrl)).headers.location, 'https://www.pitaya-photo.com/galleries')
    for (const group of ['day', 'week', 'month']) {
      const result = await app.inject({ url: `/qr-codes/stats?from=2020-01-01&to=2020-12-31&group=${group}`, headers: admin }); assert.equal(result.statusCode, 200, result.body)
    }
    const now = new Date(), from = new Date(+now - 86400000).toISOString().slice(0,10), to = new Date(+now + 86400000).toISOString().slice(0,10)
    const stats = (await app.inject({ url: `/qr-codes/stats?from=${from}&to=${to}&id=${ids[0]}`, headers: admin })).json()
    assert.equal(stats.totals.reduce((sum, row) => sum + row.count, 0), 3); assert.equal(stats.events.length, 3); assert.deepEqual(Object.keys(stats.events[0]), ['openedAt'])
    const otherStats = (await app.inject({ url: `/qr-codes/stats?from=${from}&to=${to}&id=${ids[1]}`, headers: admin })).json()
    assert.deepEqual(otherStats.totals, [])
    await app.inject({ method: 'PUT', url: `/qr-codes/${ids[0]}`, headers: admin, payload: { ...payload, active: false } })
    assert.equal((await app.inject(publicUrl)).statusCode, 410)
    assert.equal((await app.inject('/public/qr/invalid')).statusCode, 404)
  } finally {
    for (const id of ids) { await db.delete(qrOpenings).where(eq(qrOpenings.qrId, id)); await db.delete(qrCodes).where(eq(qrCodes.id, id)) }
    for (const account of accounts) await db.delete(users).where(eq(users.id, account.id))
    await app.close()
  }
})
