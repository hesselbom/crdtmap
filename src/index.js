// Similar to a LWW-Element-Set but being a key-value store instead of just unique keys.
// Latest key update is always used, with some conflict resolution when timestamp is equal

const cuid = require('cuid')
const { setIfUndefined } = require('lib0/dist/map.cjs')
const set = require('lib0/dist/set.cjs')
const encoding = require('lib0/dist/encoding.cjs')
const decoding = require('lib0/dist/decoding.cjs')

function VDoc (options) {
  const map = new Map()
  const stateVectors = new Map()
  const observers = new Map()
  const localClientId = (options && options.clientId) || cuid()

  const clearToTimestamp = (timestamp) => {
    // Clear old removed/tombstoned data
    for (const [key, value] of map.entries()) {
      if (value.data === null && value.timestamp < timestamp) {
        map.delete(key)
      }
    }

    // Clear old state vectors
    for (const [key, vector] of stateVectors.entries()) {
      if (vector < timestamp) {
        stateVectors.delete(key)
      }
    }
  }

  return {
    clientId: localClientId,
    on: function (name, callback) {
      setIfUndefined(observers, name, set.create).add(callback)
    },
    off: function (name, callback) {
      const nameObservers = observers.get(name)
      if (nameObservers != null) {
        nameObservers.delete(callback)
        if (nameObservers.size === 0) {
          observers.delete(name)
        }
      }
    },
    emit: function (name, args) {
      // copy all listeners to an array first to make sure that no event is emitted to listeners that are subscribed while the event handler is called.
      return Array.from((observers.get(name) || new Map()).values()).forEach(f => f(...args))
    },
    set: function (key, data, timestamp, clientId, emitEvents = true) {
      const existing = map.get(key)

      clientId = clientId == null ? localClientId : clientId
      timestamp = timestamp == null ? Date.now() : timestamp

      // Update client state vector
      stateVectors.set(clientId, Math.max(stateVectors.get(clientId) || 0, timestamp))

      if (!existing) {
        map.set(key, { timestamp, data, clientId })
        if (emitEvents) this.emit('update', [{ key, data, timestamp, clientId }])
        return
      }

      // Conflict resolution when removing with same timestamp
      if (data === null && timestamp === existing.timestamp) {
        return
      }

      // Conflict resolution when adding with same timestamp but different clients
      if (timestamp === existing.timestamp && clientId !== existing.clientId) {
        if (clientId > existing.clientId) {
          map.set(key, { timestamp, data, clientId })
          if (emitEvents) this.emit('update', [{ key, data, timestamp, clientId }])
        }
        return
      }

      if (timestamp >= existing.timestamp) {
        map.set(key, { timestamp, data, clientId })
        if (emitEvents) this.emit('update', [{ key, data, timestamp, clientId }])
      }
    },
    remove: function (key, timestamp, clientId) {
      this.set(key, null, timestamp, clientId)
    },

    // Clear old tombstoned data up to timestamp
    // Will also clear old clientId vectors to make up space
    // Warning! This is potentially dangerous, make sure all data has been synced up to this timestamp
    clearToTimestamp,
    applySnapshot: function (snapshot) {
      for (const [key, value] of Object.entries(snapshot)) {
        this.set(key, value.data, value.timestamp, value.clientId, false)
      }
      this.emit('snapshot', [snapshot])
    },
    toJSON: function () {
      const obj = {}

      map.forEach((value, key) => {
        if (value.data !== null) {
          obj[key] = value.data
        }
      })

      return obj
    },
    getSnapshotFromTimestamp: function (timestamp) {
      const obj = {}

      map.forEach((value, key) => {
        if (value.timestamp >= timestamp) {
          obj[key] = value
        }
      })

      return obj
    },
    getSnapshotFromStateVectors: function (stateVectors) {
      const obj = {}

      map.forEach((value, key) => {
        const vector = stateVectors[value.clientId]
        if (!vector || value.timestamp > vector) {
          obj[key] = value
        }
      })

      return obj
    },
    getStateVectors: function () {
      return Object.fromEntries(stateVectors)
    }
  }
}

VDoc.encodeSnapshot = function encodeSnapshot (snapshot) {
  const encoder = encoding.createEncoder()

  for (const [key, value] of Object.entries(snapshot)) {
    if (value.data === null) {
      encoding.writeUint8(encoder, 0)
      encoding.writeVarString(encoder, key)
      encoding.writeFloat64(encoder, value.timestamp)
      encoding.writeVarString(encoder, value.clientId)
    } else {
      encoding.writeUint8(encoder, 1)
      encoding.writeVarString(encoder, key)
      encoding.writeFloat64(encoder, value.timestamp)
      encoding.writeVarString(encoder, value.clientId)
      encoding.writeAny(encoder, value.data)
    }
  }

  return encoding.toUint8Array(encoder)
}

VDoc.decodeSnapshot = function decodeSnapshot (byteArray) {
  const decoder = decoding.createDecoder(byteArray)
  const snapshot = {}

  while (decoder.pos < decoder.arr.length) {
    const hasData = decoding.readUint8(decoder) === 1
    const key = decoding.readVarString(decoder)

    const object = {
      timestamp: decoding.readFloat64(decoder),
      clientId: decoding.readVarString(decoder)
    }

    if (hasData) {
      object.data = decoding.readAny(decoder)
    } else {
      object.data = null
    }

    snapshot[key] = object
  }

  return snapshot
}

VDoc.encodeStateVectors = function encodeStateVectors (stateVectors) {
  const encoder = encoding.createEncoder()

  for (const [key, vector] of Object.entries(stateVectors)) {
    encoding.writeVarString(encoder, key)
    encoding.writeFloat64(encoder, vector)
  }

  return encoding.toUint8Array(encoder)
}

VDoc.decodeStateVectors = function decodeStateVectors (byteArray) {
  const decoder = decoding.createDecoder(byteArray)
  const stateVectors = {}

  while (decoder.pos < decoder.arr.length) {
    const key = decoding.readVarString(decoder)
    const vector = decoding.readFloat64(decoder)

    stateVectors[key] = vector
  }

  return stateVectors
}

module.exports = VDoc
