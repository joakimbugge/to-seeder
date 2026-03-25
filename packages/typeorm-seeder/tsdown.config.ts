import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  platform: 'node',
  tsconfig: './tsconfig.build.json',
  dts: true,
  clean: true,
  outDir: 'dist',
  sourcemap: true,
})
