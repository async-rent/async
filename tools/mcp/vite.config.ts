import { cloudflare } from "@cloudflare/vite-plugin";

import { defineConfig, lazyPlugins } from "vite-plus";
import { widgets } from "./vite.widgets.config";

export default defineConfig({
  plugins: lazyPlugins(() => [widgets(), cloudflare()]),
});
