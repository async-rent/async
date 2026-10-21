import { nitro } from "nitro/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [
    nitro({
      serverEntry: "./src/index.ts",
      noExternals: ["@async-rent/core", "@async-rent/db"],
    }),
  ],
});
