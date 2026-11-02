import type { Tool } from "../shared/tools";
import { cancelRental } from "./cancel-rental";
import { createRental } from "./create-rental";
import { getProduct } from "./get-product";
import { getRental } from "./get-rental";
import { listCategories } from "./list-categories";
import { listLocations } from "./list-locations";
import { quoteRental } from "./quote-rental";
import { searchProducts } from "./search-products";

export const tools: Tool[] = [
  listLocations,
  listCategories,
  searchProducts,
  getProduct,
  quoteRental,
  createRental,
  getRental,
  cancelRental,
];
