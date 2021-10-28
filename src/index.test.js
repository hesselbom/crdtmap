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
  const byteArray = VDoc.encodeSnapshot(doc.getSnapshotFromTimestamp(1500))
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
  const byteArray = VDoc.encodeSnapshot(doc.getSnapshotFromTimestamp(0))
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

test('clear all tombstones from timestamp, to clean up', () => {
  const doc = VDoc({ clientId: 'clientId' })

  doc.set('key1', 'data', 1000) // will stay even if older, because it contains data
  doc.set('keyToBeRemoved', 'data', 1000) // will stay
  doc.set('key2', 'data', 1500) // will stay
  doc.remove('keyToBeRemoved', 1400) // will be deleted

  expect(doc.getSnapshotFromTimestamp(0)).toEqual({
    key1: { timestamp: 1000, data: 'data', clientId: 'clientId' },
    key2: { timestamp: 1500, data: 'data', clientId: 'clientId' },
    keyToBeRemoved: { timestamp: 1400, data: null, clientId: 'clientId' }
  })

  doc.clearToTimestamp(1499) // everything deleted before this is removed

  // Both will be added even if after cleared timestamp due to clear only affecting removed keys
  doc.set('key3', 'data', 1000)
  doc.set('key4', 'data', 1499)

  expect(doc.toJSON()).toEqual({
    key1: 'data',
    key2: 'data',
    key3: 'data',
    key4: 'data'
  })

  expect(doc.getSnapshotFromTimestamp(0)).toEqual({
    key1: { timestamp: 1000, data: 'data', clientId: 'clientId' },
    key2: { timestamp: 1500, data: 'data', clientId: 'clientId' },
    key3: { timestamp: 1000, data: 'data', clientId: 'clientId' },
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

test('merge snapshot to document with _clearedToTimestamp', () => {
  const docA = VDoc({ clientId: 'A' })
  docA.set('key1', 'dataA', 1000)
  docA.set('key2', 'dataA', 1500)
  docA.remove('key3', 1400)
  docA.remove('key4', 1500)
  docA.clearToTimestamp(1498)

  const docB = VDoc({ clientId: 'B' })
  docB.set('key1', 'dataB', 1001)
  docB.set('key2', 'dataB', 1499)

  docA.applySnapshot(docB.getSnapshotFromTimestamp(0))

  expect(docA.toJSON()).toEqual({
    key1: 'dataB',
    key2: 'dataA'
  })

  expect(docA.getSnapshotFromTimestamp(0)).toEqual({
    key1: { timestamp: 1001, data: 'dataB', clientId: 'B' },
    key2: { timestamp: 1500, data: 'dataA', clientId: 'A' },
    // key3: { timestamp: 1400, data: null, clientId: 'A' }, // No key3 since it's been cleared
    key4: { timestamp: 1500, data: null, clientId: 'A' }
  })
})

// State vectors are latest stored timestamp from each clientId
describe('state vectors', () => {
  test('get state vectors', () => {
    const doc = VDoc()

    // Empty before any data
    expect(doc.getStateVectors()).toEqual({})

    doc.set('key1', 'dataA', 1000, 'clientA')
    doc.set('key2', 'dataA', 1500, 'clientA')

    // Same key but earlier timestamp, should still be remembered
    doc.set('key2', 'dataB', 1400, 'clientB')

    // Verify snapshot is only clientA
    expect(doc.getSnapshotFromTimestamp(0)).toEqual({
      key1: { timestamp: 1000, data: 'dataA', clientId: 'clientA' },
      key2: { timestamp: 1500, data: 'dataA', clientId: 'clientA' }
    })

    // Get state vectors
    expect(doc.getStateVectors()).toEqual({
      clientA: 1500,
      clientB: 1400
    })
  })

  test('remove old state vectors with clearToTimestamp', () => {
    const doc = VDoc()

    doc.set('key1', 'dataA', 1000, 'clientA')
    doc.set('key1', 'dataB', 1400, 'clientB')

    // Get state vectors
    expect(doc.getStateVectors()).toEqual({
      clientA: 1000,
      clientB: 1400
    })

    // Clear
    doc.clearToTimestamp(1300)

    // Get state vectors with cleared
    expect(doc.getStateVectors()).toEqual({ clientB: 1400 })

    // When adding new key with old timestamp, will be added to state vectors even if previously cleared
    // Clear is just a one time action to clean up
    doc.set('key1', 'dataA', 1100, 'clientA')
    expect(doc.getStateVectors()).toEqual({ clientA: 1100, clientB: 1400 })
  })

  test('encode/decode state vectors', () => {
    const doc = VDoc()

    doc.set('key1', 'dataA', 1000, 'clientA')
    doc.set('key1', 'dataB', 1400, 'clientB')

    const resultStateVectors = doc.getStateVectors()
    const byteArray = VDoc.encodeStateVectors(doc.getStateVectors())
    const decodedStateVectors = VDoc.decodeStateVectors(byteArray)

    // Make sure we get byte array
    expect(byteArray)
      .toBeInstanceOf(Uint8Array)

    // Verify that both state vectors and decoded state vectors are the same
    expect(resultStateVectors).toEqual({
      clientA: 1000,
      clientB: 1400
    })

    expect(decodedStateVectors).toEqual({
      clientA: 1000,
      clientB: 1400
    })
  })

  test('get snapshot from state vectors', () => {
    const doc = VDoc()

    doc.set('key1', 'dataA', 1000, 'clientA')
    doc.set('key1', 'dataB', 1400, 'clientB')
    doc.set('key1', 'dataA', 1300, 'clientA')
    doc.set('key2', 'dataA', 1300, 'clientA')
    doc.set('key3', 'dataA', 1200, 'clientA')

    // Get from both clientA and clientB
    expect(doc.getSnapshotFromStateVectors({
      clientA: 0,
      clientB: 0
    })).toEqual({
      key1: { timestamp: 1400, data: 'dataB', clientId: 'clientB' },
      key2: { timestamp: 1300, data: 'dataA', clientId: 'clientA' },
      key3: { timestamp: 1200, data: 'dataA', clientId: 'clientA' }
    })

    // Get only from clientB because we have latest from clientA
    expect(doc.getSnapshotFromStateVectors({
      clientA: 1500,
      clientB: 0
    })).toEqual({
      key1: { timestamp: 1400, data: 'dataB', clientId: 'clientB' }
    })

    // Get missing from clientA (those after our latest vector, i.e. 1200)
    expect(doc.getSnapshotFromStateVectors({
      clientA: 1200,
      clientB: 1500
    })).toEqual({
      key2: { timestamp: 1300, data: 'dataA', clientId: 'clientA' }
      // Not key3 because we've already seen it (1200)
      // key3: { timestamp: 1200, data: 'dataA', clientId: 'clientA' }
    })

    // Get all because we're missing all state vectors
    expect(doc.getSnapshotFromStateVectors({})).toEqual({
      key1: { timestamp: 1400, data: 'dataB', clientId: 'clientB' },
      key2: { timestamp: 1300, data: 'dataA', clientId: 'clientA' },
      key3: { timestamp: 1200, data: 'dataA', clientId: 'clientA' }
    })
  })
})

test('events', () => {
  const doc = VDoc()
  const onUpdate = jest.fn()
  const onSnapshot = jest.fn()

  // Events after .on()
  doc.on('update', onUpdate)
  doc.on('snapshot', onSnapshot)

  doc.set('key1', 'dataA', 1000, 'clientA')
  doc.remove('key1', 1100, 'clientB')
  doc.clearToTimestamp(0)
  doc.applySnapshot({
    key2: { timestamp: 1500, data: 'dataB', clientId: 'clientB' }
  })

  // No events after .off()
  doc.off('update', onUpdate)
  doc.off('snapshot', onSnapshot)

  doc.set('key1', 'dataA', 1000, 'clientA')
  doc.remove('key1', 1100, 'clientB')
  doc.clearToTimestamp(0)
  doc.applySnapshot({
    key2: { timestamp: 1500, data: 'dataB', clientId: 'clientB' }
  })

  // Event listener should've been called 3 times
  expect(onUpdate.mock.calls).toEqual([
    [{ key: 'key1', data: 'dataA', timestamp: 1000, clientId: 'clientA' }],
    [{ key: 'key1', data: null, timestamp: 1100, clientId: 'clientB' }]
  ])

  // Snapshot should only call snapshot event, not multiple "set"s
  expect(onSnapshot.mock.calls).toEqual([
    [{ key2: { timestamp: 1500, data: 'dataB', clientId: 'clientB' } }]
  ])
})
