// Similar to a LWW-Element-Set but being a key-value store instead of just unique keys.
// Latest key update is always used, with some conflict resolution when timestamp is equal

const cuid = require('cuid')
const encoding = require('lib0/dist/encoding.cjs')
const decoding = require('lib0/dist/decoding.cjs')

function VDoc (options) {
  const map = new Map()
  const localClientId = (options && options.clientId) || cuid()

  const clearFromTimestamp = (timestamp) => {
    for (const [key, value] of map.entries()) {
      if (value.timestamp < timestamp) {
        map.delete(key)
      }
    }
  }

  return {
    clientId: localClientId,
    set: function (key, data, timestamp, clientId) {
      const existing = map.get(key)
      const clearedFromTimestamp = map.get('_clearedFromTimestamp')

      clientId = clientId == null ? localClientId : clientId
      timestamp = timestamp == null ? Date.now() : timestamp

      // Check if timestamp is before cleared timestamp
      if (clearedFromTimestamp && timestamp < clearedFromTimestamp.data) {
        return
      }

      if (!existing) {
        map.set(key, { timestamp, data, clientId })

        // Clear all data prior to this timestamp
        if (key === '_clearedFromTimestamp') {
          clearFromTimestamp(data)
        }

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

          // Clear all data prior to this timestamp
          if (key === '_clearedFromTimestamp') {
            clearFromTimestamp(data)
          }
        }
        return
      }

      if (timestamp >= existing.timestamp) {
        map.set(key, { timestamp, data, clientId })

        // Clear all data prior to this timestamp
        if (key === '_clearedFromTimestamp') {
          clearFromTimestamp(data)
        }
      }
    },
    remove: function (key, timestamp, clientId) {
      this.set(key, null, timestamp, clientId)
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
    getEncodedSnapshotFromTimestamp: function (timestamp) {
      const encoder = encoding.createEncoder()

      map.forEach((value, key) => {
        if (value.timestamp >= timestamp) {
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
      })

      return encoding.toUint8Array(encoder)
    },
    clearFromTimestamp: function (fromTimestamp, timestamp, updateClientId) {
      this.set('_clearedFromTimestamp', fromTimestamp, timestamp, updateClientId)
    },
    applySnapshot: function (snapshot) {
      for (const [key, value] of Object.entries(snapshot)) {
        this.set(key, value.data, value.timestamp, value.clientId)
      }
    }
  }
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

module.exports = VDoc
