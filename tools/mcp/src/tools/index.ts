import { listLocations } from "./list-locations";
import type { Tool } from "./tool";

export type { Tool, ToolContext } from "./tool";

export const tools: Tool[] = [listLocations];
