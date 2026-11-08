import { URL, fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

import { build, defineConfig, type Plugin } from "vite-plus";

/** One folder per widget under src/widgets, each with an index.html entry. */
const widgetNames = ["setup-picker", "paypal-checkout"] as const;

type WidgetName = (typeof widgetNames)[number];

const widgetsRoot = fileURLToPath(new URL("./src/widgets", import.meta.url));

/** Each widget builds to `<name>/index.html` here, which the Worker imports with `?raw`. */
export const widgetsOutDir = fileURLToPath(new URL("./dist/widgets", import.meta.url));

// The host's iframe CSP blocks scripts and styles fetched from elsewhere, so each
// widget is built into one HTML file with its JS and CSS inlined.
async function buildWidget(name: WidgetName): Promise<void> {
  await build({
    configFile: false,
    root: widgetsRoot,
    logLevel: "warn",
    plugins: [react(), tailwindcss(), viteSingleFile({ removeViteModuleLoader: true })],
    build: {
      outDir: widgetsOutDir,
      emptyOutDir: false,
      rolldownOptions: { input: `${widgetsRoot}/${name}/index.html` },
    },
  });
}

/**
 * Builds every widget into `dist/widgets/<name>/index.html` once, before the Worker
 * modules that import them load, for both `vp build` and `vp dev`.
 */
export function widgets(): Plugin {
  let built: Promise<void> | undefined;
  const buildAll = () => {
    built ??= widgetNames.reduce<Promise<void>>(
      (previous, name) => previous.then(() => buildWidget(name)),
      Promise.resolve(),
    );
    return built;
  };

  return {
    name: "async:widgets",
    enforce: "pre",
    buildStart: buildAll,
    // A Worker module can load before buildStart settles; hold its widget import until then.
    async load(id) {
      if (id.startsWith(widgetsOutDir)) await buildAll();
      return null;
    },
  };
}

/** `vp run dev:widgets`: the widgets and a fake host page at /dev/, in a normal browser tab. */
export default defineConfig({
  root: widgetsRoot,
  plugins: [react(), tailwindcss()],
});
