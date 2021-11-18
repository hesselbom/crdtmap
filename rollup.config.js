import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

export default [
  {
    input: 'src/index.js',
    output: {
      name: 'CrdtMap',
      file: 'dist/crdtmap.cjs',
      format: 'cjs',
      sourcemap: true,
      exports: 'default'
    },
    plugins: [
      resolve({ browser: true }),
      commonjs()
    ]
  },

  // Add .js to work with react-native
  {
    input: 'src/index.js',
    output: {
      name: 'CrdtMap',
      file: 'dist/crdtmap.cjs.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'default'
    },
    plugins: [
      resolve({ browser: true }),
      commonjs()
    ]
  }
]
