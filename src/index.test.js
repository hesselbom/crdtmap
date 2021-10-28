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

test('verify that clientId is a uint', () => {
  const doc = VDoc()

  expect(doc.clientId).toBeGreaterThanOrEqual(0)
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
  doc.set('key', 'data', 1000, 1) // clientId = 1
  doc.set('key', 'data2', 1000, 3) // clientId = 3
  doc.set('key', 'data3', 1000, 2) // clientId = 2

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
  const doc = VDoc({ clientId: 1 })
  const then = Date.now()

  doc.set('key', 'data')

  // Test if timestamp is later than the first Date.now() we got
  expect(doc.getSnapshotFromTimestamp(0).key.timestamp).toBeGreaterThanOrEqual(then)
})

test('get diff snapshot after specific timestamp', () => {
  const doc = VDoc({ clientId: 1 })

  doc.set('key', 'data', 1000)
  doc.set('key2', 'data', 1500)
  doc.remove('key', 2000)

  expect(doc.getSnapshotFromTimestamp(1500)).toEqual({
    key2: { timestamp: 1500, data: 'data', clientId: 1 },
    key: { timestamp: 2000, data: null, clientId: 1 }
  })
})

test('get diff snapshot after specific timestamp, making sure deletes are not included if old', () => {
  const doc = VDoc({ clientId: 1 })

  doc.set('key', 'data', 1000)
  doc.set('key2', 'data', 1500)
  doc.remove('key', 1400)

  expect(doc.toJSON()).toEqual({ key2: 'data' })

  expect(doc.getSnapshotFromTimestamp(1500)).toEqual({
    key2: { timestamp: 1500, data: 'data', clientId: 1 }
  })
})

test('get diff snapshot encoded as uint8 after specific timestamp, and decode', () => {
  const doc = VDoc({ clientId: 1 })

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
    key2: { timestamp: 1635257645564, data: 'data', clientId: 1 },
    key: { timestamp: 2000, data: null, clientId: 1 }
  })

  expect(decodedSnapshot).toEqual({
    key2: { timestamp: 1635257645564, data: 'data', clientId: 1 },
    key: { timestamp: 2000, data: null, clientId: 1 }
  })
})

test('handle encode/decode of various types', () => {
  const doc = VDoc({ clientId: 1 })

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
    string: { timestamp: 1000, data: 'data', clientId: 1 },
    number: { timestamp: 1000, data: 10, clientId: 1 },
    boolean: { timestamp: 1000, data: true, clientId: 1 },
    object: { timestamp: 1000, data: { foo: 'bar' }, clientId: 1 }
  })

  expect(decodedSnapshot).toEqual({
    string: { timestamp: 1000, data: 'data', clientId: 1 },
    number: { timestamp: 1000, data: 10, clientId: 1 },
    boolean: { timestamp: 1000, data: true, clientId: 1 },
    object: { timestamp: 1000, data: { foo: 'bar' }, clientId: 1 }
  })
})

test('clear all tombstones from timestamp, to clean up', () => {
  const doc = VDoc({ clientId: 1 })

  doc.set('key1', 'data', 1000) // will stay even if older, because it contains data
  doc.set('keyToBeRemoved', 'data', 1000) // will stay
  doc.set('key2', 'data', 1500) // will stay
  doc.remove('keyToBeRemoved', 1400) // will be deleted

  expect(doc.getSnapshotFromTimestamp(0)).toEqual({
    key1: { timestamp: 1000, data: 'data', clientId: 1 },
    key2: { timestamp: 1500, data: 'data', clientId: 1 },
    keyToBeRemoved: { timestamp: 1400, data: null, clientId: 1 }
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
    key1: { timestamp: 1000, data: 'data', clientId: 1 },
    key2: { timestamp: 1500, data: 'data', clientId: 1 },
    key3: { timestamp: 1000, data: 'data', clientId: 1 },
    key4: { timestamp: 1499, data: 'data', clientId: 1 }
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
  const docA = VDoc({ clientId: 1 })
  docA.set('key1', 'dataA', 1000)
  docA.set('key2', 'dataA', 1500)
  docA.remove('key3', 1400)
  docA.remove('key4', 1500)
  docA.clearToTimestamp(1498)

  const docB = VDoc({ clientId: 2 })
  docB.set('key1', 'dataB', 1001)
  docB.set('key2', 'dataB', 1499)

  docA.applySnapshot(docB.getSnapshotFromTimestamp(0))

  expect(docA.toJSON()).toEqual({
    key1: 'dataB',
    key2: 'dataA'
  })

  expect(docA.getSnapshotFromTimestamp(0)).toEqual({
    key1: { timestamp: 1001, data: 'dataB', clientId: 2 },
    key2: { timestamp: 1500, data: 'dataA', clientId: 1 },
    // key3: { timestamp: 1400, data: null, clientId: 1 }, // No key3 since it's been cleared
    key4: { timestamp: 1500, data: null, clientId: 1 }
  })
})

// State vectors are latest stored timestamp from each clientId
describe('state vectors', () => {
  test('get state vectors', () => {
    const doc = VDoc()

    // Empty before any data
    expect(doc.getStateVectors()).toEqual({})

    doc.set('key1', 'dataA', 1000, 1)
    doc.set('key2', 'dataA', 1500, 1)

    // Same key but earlier timestamp, should still be remembered
    doc.set('key2', 'dataB', 1400, 2)

    // Verify snapshot is only client 1
    expect(doc.getSnapshotFromTimestamp(0)).toEqual({
      key1: { timestamp: 1000, data: 'dataA', clientId: 1 },
      key2: { timestamp: 1500, data: 'dataA', clientId: 1 }
    })

    // Get state vectors
    expect(doc.getStateVectors()).toEqual({
      1: 1500,
      2: 1400
    })
  })

  test('remove old state vectors with clearToTimestamp', () => {
    const doc = VDoc()

    doc.set('key1', 'dataA', 1000, 1)
    doc.set('key1', 'dataB', 1400, 2)

    // Get state vectors
    expect(doc.getStateVectors()).toEqual({
      1: 1000,
      2: 1400
    })

    // Clear
    doc.clearToTimestamp(1300)

    // Get state vectors with cleared
    expect(doc.getStateVectors()).toEqual({ 2: 1400 })

    // When adding new key with old timestamp, will be added to state vectors even if previously cleared
    // Clear is just a one time action to clean up
    doc.set('key1', 'dataA', 1100, 1)
    expect(doc.getStateVectors()).toEqual({ 1: 1100, 2: 1400 })
  })

  test('encode/decode state vectors', () => {
    const doc = VDoc()

    doc.set('key1', 'dataA', 1000, 1)
    doc.set('key1', 'dataB', 1400, 2)

    const resultStateVectors = doc.getStateVectors()
    const byteArray = VDoc.encodeStateVectors(doc.getStateVectors())
    const decodedStateVectors = VDoc.decodeStateVectors(byteArray)

    // Make sure we get byte array
    expect(byteArray)
      .toBeInstanceOf(Uint8Array)

    // Verify that both state vectors and decoded state vectors are the same
    expect(resultStateVectors).toEqual({
      1: 1000,
      2: 1400
    })

    expect(decodedStateVectors).toEqual({
      1: 1000,
      2: 1400
    })
  })

  test('get snapshot from state vectors', () => {
    const doc = VDoc()

    doc.set('key1', 'dataA', 1000, 1)
    doc.set('key1', 'dataB', 1400, 2)
    doc.set('key1', 'dataA', 1300, 1)
    doc.set('key2', 'dataA', 1300, 1)
    doc.set('key3', 'dataA', 1200, 1)

    // Get from both client 1 and client 2
    expect(doc.getSnapshotFromStateVectors({
      1: 0,
      2: 0
    })).toEqual({
      key1: { timestamp: 1400, data: 'dataB', clientId: 2 },
      key2: { timestamp: 1300, data: 'dataA', clientId: 1 },
      key3: { timestamp: 1200, data: 'dataA', clientId: 1 }
    })

    // Get only from client 2 because we have latest from client 1
    expect(doc.getSnapshotFromStateVectors({
      1: 1500,
      2: 0
    })).toEqual({
      key1: { timestamp: 1400, data: 'dataB', clientId: 2 }
    })

    // Get missing from client 1 (those after our latest vector, i.e. 1200)
    expect(doc.getSnapshotFromStateVectors({
      1: 1200,
      2: 1500
    })).toEqual({
      key2: { timestamp: 1300, data: 'dataA', clientId: 1 }
      // Not key3 because we've already seen it (1200)
      // key3: { timestamp: 1200, data: 'dataA', clientId: 1 }
    })

    // Get all because we're missing all state vectors
    expect(doc.getSnapshotFromStateVectors({})).toEqual({
      key1: { timestamp: 1400, data: 'dataB', clientId: 2 },
      key2: { timestamp: 1300, data: 'dataA', clientId: 1 },
      key3: { timestamp: 1200, data: 'dataA', clientId: 1 }
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

  doc.set('key1', 'dataA', 1000, 1)
  doc.remove('key1', 1100, 2)
  doc.clearToTimestamp(0)
  doc.applySnapshot({
    key2: { timestamp: 1500, data: 'dataB', clientId: 2 }
  })

  // No events after .off()
  doc.off('update', onUpdate)
  doc.off('snapshot', onSnapshot)

  doc.set('key1', 'dataA', 1000, 1)
  doc.remove('key1', 1100, 2)
  doc.clearToTimestamp(0)
  doc.applySnapshot({
    key2: { timestamp: 1500, data: 'dataB', clientId: 2 }
  })

  // Event listener should've been called 3 times
  expect(onUpdate.mock.calls).toEqual([
    [{ key1: { timestamp: 1000, data: 'dataA', clientId: 1 } }],
    [{ key1: { timestamp: 1100, data: null, clientId: 2 } }]
  ])

  // Snapshot should only call snapshot event, not multiple "set"s
  expect(onSnapshot.mock.calls).toEqual([
    [{ key2: { timestamp: 1500, data: 'dataB', clientId: 2 } }]
  ])
})
