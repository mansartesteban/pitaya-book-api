import assert from 'node:assert/strict'
import test from 'node:test'
import { publicGallerySitemapRows } from '../src/modules/public/gallery/gallerySitemap.js'

test('only galleries with an entirely public ancestry appear in the sitemap', () => {
  const rows = [
    { id: 'root', slug: 'root', visibility: 'PUBLIC', parentGallery: null },
    { id: 'child', slug: 'child', visibility: 'PUBLIC', parentGallery: 'root' },
    { id: 'grandchild', slug: 'grandchild', visibility: 'PUBLIC', parentGallery: 'child' },
    { id: 'private', slug: 'private', visibility: 'PRIVATE', parentGallery: 'root' },
    { id: 'private-child', slug: 'private-child', visibility: 'PUBLIC', parentGallery: 'private' },
    { id: 'unlisted', slug: 'unlisted', visibility: 'UNLISTED', parentGallery: null },
    { id: 'unlisted-child', slug: 'unlisted-child', visibility: 'PUBLIC', parentGallery: 'unlisted' },
    { id: 'orphan', slug: 'orphan', visibility: 'PUBLIC', parentGallery: 'missing' },
    { id: 'cycle-a', slug: 'cycle-a', visibility: 'PUBLIC', parentGallery: 'cycle-b' },
    { id: 'cycle-b', slug: 'cycle-b', visibility: 'PUBLIC', parentGallery: 'cycle-a' },
  ]

  assert.deepEqual(publicGallerySitemapRows(rows), [
    { slug: 'root', visibility: 'PUBLIC' },
    { slug: 'child', visibility: 'PUBLIC' },
    { slug: 'grandchild', visibility: 'PUBLIC' },
  ])
})
