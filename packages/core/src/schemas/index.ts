/**
 * Async domain schemas.
 *
 * Catalog truth: Product, Category, ProductOffering, Location.
 * Transaction truth: Cart → Rental → Payment/BillingSchedule, Delivery,
 * InventoryUnit/Reservation.
 * Supporting: Customer, Address, Promotion, Notification and RentalPolicy.
 *
 * Prices are authored in USD. A ProductOffering either carries an explicit
 * local price or falls back to USD → local conversion (see currency.ts).
 *
 * Shared primitives live in individual files under `src/utils/`,
 * intentionally outside this schema barrel.
 */
export * from "./pricing";
export * from "./currency";
export * from "./media";
export * from "./category";
export * from "./policy";
export * from "./location";
export * from "./customer";
export * from "./address";
export * from "./product";
export * from "./product-offering";
export * from "./catalog";
export * from "./payment";
export * from "./cart";
export * from "./rental";
export * from "./delivery";
export * from "./inventory";
export * from "./promotion";
export * from "./notification";
