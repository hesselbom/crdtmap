// Similar to a LWW-Element-Set but being a key-value store instead of just unique keys.
// Latest key update is always used, with some conflict resolution when timestamp is equal

const cuid = require('cuid')
const encoding = require('lib0/dist/encoding.cjs')

function VDoc () {
  const map = new Map()
  const localClientId = cuid()

  return {
    clientId: localClientId,
    set: function (key, data, timestamp, updateClientId) {
      const clientId = updateClientId || localClientId
      const existing = map.get(key)

      if (!existing) {
        map.set(key, { timestamp, data, clientId })
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
        }
        return
      }

      if (timestamp >= existing.timestamp) {
        map.set(key, { timestamp, data, clientId })
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
          obj[key] = value.data
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
          } else {
            encoding.writeUint8(encoder, 1)
            encoding.writeVarString(encoder, key)
            encoding.writeVarString(encoder, value.data)
          }
        }
      })

      return encoding.toUint8Array(encoder)
    }
  }
}

module.exports = VDoc
