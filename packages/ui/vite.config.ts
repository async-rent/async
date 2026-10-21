import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/components/*.tsx", "src/hooks/*.ts"],
    dts: {
      generator: "tsgo",
    },
    // The package is consumed as source (tsx + css), so exports are hand-written
    // in package.json. vp pack must not regenerate them.
    exports: false,
  },
});
