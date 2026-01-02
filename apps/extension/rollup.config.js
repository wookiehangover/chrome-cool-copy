import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import copy from "rollup-plugin-copy";
import css from "rollup-plugin-import-css";
import nodePolyfills from "rollup-plugin-polyfill-node";

// Shared TypeScript config
const tsConfig = {
  tsconfig: false,
  compilerOptions: {
    target: "ESNext",
    module: "ESNext",
  },
  exclude: ["apps/**/*", "node_modules/**/*"],
};

// Shared plugins for bundles that need node resolution
const nodePlugins = [resolve(), commonjs()];

export default [
  // Content script - IIFE for immediate execution
  {
    input: "src/content/index.ts",
    output: {
      file: "dist/content.js",
      format: "iife",
      sourcemap: true,
    },
    plugins: [css(), typescript(tsConfig)],
  },

  // Database service - ES module
  {
    input: "src/services/database.ts",
    output: {
      file: "dist/services/database.js",
      format: "es",
      sourcemap: true,
    },
    plugins: [...nodePlugins, typescript(tsConfig)],
  },

  // Local clips storage service - ES module
  {
    input: "src/services/local-clips.ts",
    output: {
      file: "dist/services/local-clips.js",
      format: "es",
      sourcemap: true,
    },
    plugins: [typescript(tsConfig)],
  },

  // Clips sync service - ES module
  {
    input: "src/services/clips-sync.ts",
    output: {
      file: "dist/services/clips-sync.js",
      format: "es",
      sourcemap: true,
    },
    plugins: [...nodePlugins, typescript(tsConfig)],
  },

  // Background service worker - ES module with node polyfills
  {
    input: "src/background.ts",
    output: {
      file: "dist/background.js",
      format: "es",
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: [nodePolyfills(), ...nodePlugins, typescript(tsConfig)],
  },

  // Popup page - IIFE
  {
    input: "src/pages/popup/popup.ts",
    output: {
      file: "dist/pages/popup.js",
      format: "iife",
      sourcemap: true,
    },
    plugins: [typescript(tsConfig)],
  },

  // Clipped pages - ES module
  {
    input: "src/pages/clipped-pages/clipped-pages.ts",
    output: {
      file: "dist/pages/clipped-pages.js",
      format: "es",
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: [...nodePlugins, typescript(tsConfig)],
  },

  // Clip viewer - ES module
  {
    input: "src/pages/clip-viewer/clip-viewer.ts",
    output: {
      file: "dist/pages/clip-viewer.js",
      format: "es",
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: [...nodePlugins, typescript(tsConfig)],
  },

  // Settings page - ES module with static asset copying
  {
    input: "src/pages/settings/settings.ts",
    output: {
      file: "dist/pages/settings.js",
      format: "es",
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: [
      ...nodePlugins,
      typescript(tsConfig),
      copy({
        targets: [
          // HTML files
          { src: "src/pages/popup/popup.html", dest: "dist/pages" },
          { src: "src/pages/clipped-pages/clipped-pages.html", dest: "dist/pages" },
          { src: "src/pages/clip-viewer/clip-viewer.html", dest: "dist/pages" },
          { src: "src/pages/settings/settings.html", dest: "dist/pages" },
          // CSS files
          { src: "src/pages/popup/popup.css", dest: "dist/pages" },
          { src: "src/pages/clipped-pages/clipped-pages.css", dest: "dist/pages" },
          { src: "src/pages/clip-viewer/clip-viewer.css", dest: "dist/pages" },
          { src: "src/pages/settings/settings.css", dest: "dist/pages" },
          { src: "src/styles.css", dest: "dist" },
          // Vendor files
          { src: "vendor/*", dest: "dist/vendor" },
          // Icons
          { src: "icons/*", dest: "dist/icons" },
          // Manifest
          { src: "manifest.json", dest: "dist" },
        ],
      }),
    ],
  },
];
