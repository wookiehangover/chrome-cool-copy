import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

export default [
  {
    input: "src/content/index.ts",
    output: {
      file: "dist/content.js",
      format: "iife",
      sourcemap: true,
    },
    plugins: [
      typescript({
        tsconfig: false,
        compilerOptions: {
          target: "ESNext",
          module: "ESNext",
        },
      }),
    ],
  },
  {
    input: "src/services/database.ts",
    output: {
      file: "dist/database.js",
      format: "es",
      sourcemap: true,
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: false,
        compilerOptions: {
          target: "ESNext",
          module: "ESNext",
        },
      }),
    ],
  },
  {
    input: "src/background.ts",
    output: {
      file: "dist/background.js",
      format: "es",
      sourcemap: true,
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: false,
        compilerOptions: {
          target: "ESNext",
          module: "ESNext",
        },
      }),
    ],
  },
];
