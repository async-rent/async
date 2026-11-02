import type { Tool } from "../shared/tools";
import { cancelRental } from "./cancel-rental";
import { confirmPayment } from "./confirm-payment";
import { getProduct } from "./get-product";
import { getRental } from "./get-rental";
import { listCategories } from "./list-categories";
import { listLocations } from "./list-locations";
import { listPayments } from "./list-payments";
import { quoteRental } from "./quote-rental";
import { rent } from "./rent";
import { searchProducts } from "./search-products";
import { startPayment } from "./start-payment";

export const tools: Tool[] = [
  listLocations,
  listCategories,
  searchProducts,
  getProduct,
  quoteRental,
  rent,
  getRental,
  cancelRental,
  startPayment,
  confirmPayment,
  listPayments,
];
