import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";

/**
 * Which deployment serves the page, from the Worker's `ENVIRONMENT` var.
 * The Vite dev server on the default config is "local", so it never passes
 * for production.
 */
export const getEnvironment = createServerFn({ method: "GET" }).handler(() =>
  import.meta.env.DEV && env.ENVIRONMENT === "prod" ? "local" : env.ENVIRONMENT,
);
