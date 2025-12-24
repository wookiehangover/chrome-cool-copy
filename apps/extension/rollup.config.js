import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import copy from "rollup-plugin-copy";
import css from "rollup-plugin-import-css";
import nodePolyfills from 'rollup-plugin-polyfill-node';

export default [
  {
    input: "src/content/index.ts",
    output: {
      file: "dist/content.js",
      format: "iife",
      sourcemap: true,
    },
    plugins: [
      css(),
      typescript({
        tsconfig: false,
        compilerOptions: {
          target: "ESNext",
          module: "ESNext",
        },
        exclude: ["apps/**/*", "node_modules/**/*"],
      }),
    ],
  },
  {
    input: "src/services/database.ts",
    output: {
      file: "dist/services/database.js",
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
        exclude: ["apps/**/*", "node_modules/**/*"],
      }),
    ],
  },
  {
    input: "src/background.ts",
    output: {
      file: "dist/background.js",
      format: "es",
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: [
      nodePolyfills(),
      resolve(),
      commonjs(),
      typescript({
        tsconfig: false,
        compilerOptions: {
          target: "ESNext",
          module: "ESNext",
        },
        exclude: ["apps/**/*", "node_modules/**/*"],
      }),
    ],
  },
  {
    input: "src/pages/popup/popup.ts",
    output: {
      file: "dist/pages/popup.js",
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
        exclude: ["apps/**/*", "node_modules/**/*"],
      }),
    ],
  },
  {
    input: "src/pages/clipped-pages/clipped-pages.ts",
    output: {
      file: "dist/pages/clipped-pages.js",
      format: "es",
      sourcemap: true,
      inlineDynamicImports: true,
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
        exclude: ["apps/**/*", "node_modules/**/*"],
      }),
    ],
  },
  {
    input: "src/pages/settings/settings.ts",
    output: {
      file: "dist/pages/settings.js",
      format: "es",
      sourcemap: true,
      inlineDynamicImports: true,
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
        exclude: ["apps/**/*", "node_modules/**/*"],
      }),
      copy({
        targets: [
          // Copy HTML files
          { src: "src/pages/popup/popup.html", dest: "dist/pages" },
          { src: "src/pages/clipped-pages/clipped-pages.html", dest: "dist/pages" },
          { src: "src/pages/settings/settings.html", dest: "dist/pages" },
          // Copy CSS files
          { src: "src/pages/popup/popup.css", dest: "dist/pages" },
          { src: "src/pages/clipped-pages/clipped-pages.css", dest: "dist/pages" },
          { src: "src/pages/settings/settings.css", dest: "dist/pages" },
          { src: "src/styles.css", dest: "dist" },
          // Copy vendor files
          { src: "vendor/*", dest: "dist/vendor" },
          // Copy icons
          { src: "icons/*", dest: "dist/icons" },
          // Copy manifest
          { src: "manifest.json", dest: "dist" },
        ],
      }),
    ],
  },
];
