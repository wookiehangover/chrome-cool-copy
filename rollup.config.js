import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/content/index.ts',
  output: {
    file: 'dist/content.js',
    format: 'iife',
    sourcemap: true
  },
  plugins: [
    typescript({
      tsconfig: false,
      compilerOptions: {
        target: 'ES2020',
        module: 'ES2020'
      }
    })
  ]
};

