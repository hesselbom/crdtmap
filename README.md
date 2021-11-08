# CrdtMap

Inspired by [yjs](https://github.com/yjs/yjs) and the CRDT-variant LWW-Element-Set, this is a simple key-value map that can sync between different clients by letting latest timestamp always win.

Key is always a string but value could be anything as long as it's just primitive values.
