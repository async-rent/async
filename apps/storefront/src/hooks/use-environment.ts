import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { getEnvironment } from "../server/environment";

/** The deployment serving the page. The root route loads it once; it never changes. */
export const environmentQueryOptions = queryOptions({
  queryKey: ["environment"],
  queryFn: () => getEnvironment(),
  staleTime: Number.POSITIVE_INFINITY,
});

const environmentLabels = {
  local: "Local mode",
  dev: "Development mode",
  staging: "Staging mode",
} as const;

/** The badge for a deployment that is not production; `undefined` on production. */
export function useEnvironmentLabel(): string | undefined {
  const { data: environment } = useSuspenseQuery(environmentQueryOptions);
  return environment === "prod" ? undefined : environmentLabels[environment];
}
