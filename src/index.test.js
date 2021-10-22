/* eslint-env jest */
const VDoc = require('./index')
const encoding = require('lib0/dist/encoding.cjs')

test('set keys', () => {
  const doc = VDoc()

  doc.set('key1', 'data', 1000)
  doc.set('key2', 'data', 1000)

  expect(doc.toJSON()).toEqual({
    key1: 'data',
    key2: 'data'
  })
})

test('uses latest timestamped keys', () => {
  const doc = VDoc()

  doc.set('key3', 'later-data-before', 2000)

  doc.set('key1', 'data', 1000)
  doc.set('key2', 'data', 1000)
  doc.set('key3', 'data', 1000)
  doc.set('key4', null, 1000)

  doc.set('key1', 'later-data', 2000)
  doc.set('key2', 'older-data', 0)

  expect(doc.toJSON()).toEqual({
    key1: 'later-data',
    key2: 'data',
    key3: 'later-data-before'
  })
})

test('remove key', () => {
  const doc = VDoc()
  doc.set('key', 'data', 1000)
  doc.remove('key', 1001)

  expect(doc.toJSON()).toEqual({})
})

test('setting null is the same as removing', () => {
  const doc = VDoc()
  doc.set('key', 'data', 1000)
  doc.set('key', null, 1001)

  expect(doc.toJSON()).toEqual({})
})

test('keep item instead of removing if same timestamp', () => {
  const doc = VDoc()
  doc.set('key', 'data', 1000)
  doc.remove('key', 1000)

  expect(doc.toJSON()).toEqual({ key: 'data' })
})

test('if same timestamp and same client id, just uses latest, edge case', () => {
  const doc = VDoc()
  doc.set('key', 'data', 1000)
  doc.set('key', 'data2', 1000)

  expect(doc.toJSON()).toEqual({ key: 'data2' })
})

test('if same timestamp and different client ids, sort on clientId', () => {
  const doc = VDoc()
  doc.set('key', 'data', 1000, 'a')
  doc.set('key', 'data2', 1000, 'c')
  doc.set('key', 'data3', 1000, 'b')

  expect(doc.toJSON()).toEqual({ key: 'data2' })
})

test('uses latest timestamped keys even when removed', () => {
  const doc = VDoc()

  doc.set('key', 'data', 2000)
  doc.remove('key', 1000)

  expect(doc.toJSON()).toEqual({ key: 'data' })
})

test('remove if removed timestamp is later even if received before', () => {
  const doc = VDoc()

  doc.remove('key', 2000)
  doc.set('key', 'data', 1000)

  expect(doc.toJSON()).toEqual({})
})

test('get diff snapshot after specific timestamp', () => {
  const doc = VDoc()

  doc.set('key', 'data', 1000)
  doc.set('key2', 'data', 1500)
  doc.remove('key', 2000)

  expect(doc.getSnapshotFromTimestamp(1500)).toEqual({
    key2: 'data',
    key: null
  })
})

test('get diff snapshot after specific timestamp, making sure deletes are not included if old', () => {
  const doc = VDoc()

  doc.set('key', 'data', 1000)
  doc.set('key2', 'data', 1500)
  doc.remove('key', 1400)

  expect(doc.toJSON()).toEqual({ key2: 'data' })

  expect(doc.getSnapshotFromTimestamp(1500)).toEqual({
    key2: 'data'
  })
})

test('get diff snapshot encoded as uint8 after specific timestamp', () => {
  const doc = VDoc()

  doc.set('key', 'data', 1000)
  doc.set('key2', 'data', 1500)
  doc.remove('key', 2000)

  const encoder = encoding.createEncoder()
  encoding.writeUint8(encoder, 0)
  encoding.writeVarString(encoder, 'key')
  encoding.writeUint8(encoder, 1)
  encoding.writeVarString(encoder, 'key2')
  encoding.writeVarString(encoder, 'data')

  expect(doc.getEncodedSnapshotFromTimestamp(1500))
    .toEqual(encoding.toUint8Array(encoder))
})
