/* eslint-env jest */
const VDoc = require('./index')

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

test('if timestamp is missing, use Date.now()', () => {
  const doc = VDoc({ clientId: 'clientId' })
  const then = Date.now()

  doc.set('key', 'data')

  // Test if timestamp is later than the first Date.now() we got
  expect(doc.getSnapshotFromTimestamp(0).key.timestamp).toBeGreaterThanOrEqual(then)
})

test('get diff snapshot after specific timestamp', () => {
  const doc = VDoc({ clientId: 'clientId' })

  doc.set('key', 'data', 1000)
  doc.set('key2', 'data', 1500)
  doc.remove('key', 2000)

  expect(doc.getSnapshotFromTimestamp(1500)).toEqual({
    key2: { timestamp: 1500, data: 'data', clientId: 'clientId' },
    key: { timestamp: 2000, data: null, clientId: 'clientId' }
  })
})

test('get diff snapshot after specific timestamp, making sure deletes are not included if old', () => {
  const doc = VDoc({ clientId: 'clientId' })

  doc.set('key', 'data', 1000)
  doc.set('key2', 'data', 1500)
  doc.remove('key', 1400)

  expect(doc.toJSON()).toEqual({ key2: 'data' })

  expect(doc.getSnapshotFromTimestamp(1500)).toEqual({
    key2: { timestamp: 1500, data: 'data', clientId: 'clientId' }
  })
})

test('get diff snapshot encoded as uint8 after specific timestamp, and decode', () => {
  const doc = VDoc({ clientId: 'clientId' })

  doc.set('key', 'data', 1000)
  doc.set('key2', 'data', 1635257645564)
  doc.remove('key', 2000)

  const resultSnapshot = doc.getSnapshotFromTimestamp(1500)
  const byteArray = doc.getEncodedSnapshotFromTimestamp(1500)
  const decodedSnapshot = VDoc.decodeSnapshot(byteArray)

  // Make sure we get byte array
  expect(byteArray)
    .toBeInstanceOf(Uint8Array)

  // Verify that both snapshot and decoded snapshot are the same
  expect(resultSnapshot).toEqual({
    key2: { timestamp: 1635257645564, data: 'data', clientId: 'clientId' },
    key: { timestamp: 2000, data: null, clientId: 'clientId' }
  })

  expect(decodedSnapshot).toEqual({
    key2: { timestamp: 1635257645564, data: 'data', clientId: 'clientId' },
    key: { timestamp: 2000, data: null, clientId: 'clientId' }
  })
})

test('handle encode/decode of various types', () => {
  const doc = VDoc({ clientId: 'clientId' })

  doc.set('string', 'data', 1000)
  doc.set('number', 10, 1000)
  doc.set('boolean', true, 1000)
  doc.set('object', { foo: 'bar' }, 1000)

  const resultSnapshot = doc.getSnapshotFromTimestamp(0)
  const byteArray = doc.getEncodedSnapshotFromTimestamp(0)
  const decodedSnapshot = VDoc.decodeSnapshot(byteArray)

  // Make sure we get byte array
  expect(byteArray)
    .toBeInstanceOf(Uint8Array)

  // Verify that both snapshot and decoded snapshot are the same
  expect(resultSnapshot).toEqual({
    string: { timestamp: 1000, data: 'data', clientId: 'clientId' },
    number: { timestamp: 1000, data: 10, clientId: 'clientId' },
    boolean: { timestamp: 1000, data: true, clientId: 'clientId' },
    object: { timestamp: 1000, data: { foo: 'bar' }, clientId: 'clientId' }
  })

  expect(decodedSnapshot).toEqual({
    string: { timestamp: 1000, data: 'data', clientId: 'clientId' },
    number: { timestamp: 1000, data: 10, clientId: 'clientId' },
    boolean: { timestamp: 1000, data: true, clientId: 'clientId' },
    object: { timestamp: 1000, data: { foo: 'bar' }, clientId: 'clientId' }
  })
})

test('clear all data from timestamp, to clean up', () => {
  const doc = VDoc({ clientId: 'clientId' })

  doc.set('key1', 'data', 1000) // will be cleared
  doc.set('key2', 'data', 1500) // will stay

  doc.clearFromTimestamp(1499, 1500) // everything before this is removed

  doc.set('key3', 'data', 1000) // will not be added at all
  doc.set('key4', 'data', 1499) // will be added because it's precisely at timestamp clear

  expect(doc.toJSON()).toEqual({
    _clearedFromTimestamp: 1499,
    key2: 'data',
    key4: 'data'
  })

  expect(doc.getSnapshotFromTimestamp(0)).toEqual({
    _clearedFromTimestamp: { timestamp: 1500, data: 1499, clientId: 'clientId' },
    key2: { timestamp: 1500, data: 'data', clientId: 'clientId' },
    key4: { timestamp: 1499, data: 'data', clientId: 'clientId' }
  })
})

test('merge snapshot to document', () => {
  const docA = VDoc()
  docA.set('key1', 'dataA', 1000)
  docA.set('key2', 'dataA', 1500)

  const docB = VDoc()
  docB.set('key1', 'dataB', 1001)
  docB.set('key2', 'dataB', 1499)

  docA.applySnapshot(docB.getSnapshotFromTimestamp(0))

  expect(docA.toJSON()).toEqual({
    key1: 'dataB',
    key2: 'dataA'
  })
})

test('merge snapshot to document with _clearedFromTimestamp', () => {
  const docA = VDoc()
  docA.set('key1', 'dataA', 1000)
  docA.set('key2', 'dataA', 1500)
  docA.clearFromTimestamp(1498)

  const docB = VDoc()
  docB.set('key1', 'dataB', 1001)
  docB.set('key2', 'dataB', 1499)

  docA.applySnapshot(docB.getSnapshotFromTimestamp(0))

  expect(docA.toJSON()).toEqual({
    _clearedFromTimestamp: 1498,
    // No key1 since it's cleared
    key2: 'dataA'
  })
})
