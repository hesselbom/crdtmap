import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

export default [
  {
    input: 'src/index.js',
    output: {
      name: 'V',
      file: 'dist/vjs.cjs',
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
