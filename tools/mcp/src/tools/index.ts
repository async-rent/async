import type { Tool } from "../shared/tools";
import { getProduct } from "./get-product";
import { listCategories } from "./list-categories";
import { listLocations } from "./list-locations";
import { searchProducts } from "./search-products";

export const tools: Tool[] = [listLocations, listCategories, searchProducts, getProduct];
