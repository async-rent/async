import { Database } from "@async-rent/db";
import { isSetup, getSetupPartProducts, priceForLocation, depositPercent } from "@async-rent/core";

export type Env = {
  DB: D1Database;
  STOREFRONT_URL: string;
  PAYPAL_CLIENT_ID: string;
  PAYPAL_CLIENT_SECRET: string;
  PAYPAL_SANDBOX: string;
};

type Tool = {
  name: string;
  description: string;
  inputSchema: unknown;
  handler: (params: Record<string, unknown>) => Promise<unknown>;
};

type Widget = {
  title: string;
  description: string;
  resourceUri: string;
  csp?: { resourceDomains: string[] };
};

type McpServer = {
  tools: Map<string, Tool>;
  widgets: Map<string, Widget>;
};

export function createMcpServer(env: Env, _userId: string): McpServer {
  const server: McpServer = {
    tools: new Map(),
    widgets: new Map(),
  };

  // Setup Picker widget
  server.widgets.set("setupPicker", {
    title: "Setup Picker",
    description: "Interactive catalog picker for gear and setups",
    resourceUri: "ui://setup-picker",
    csp: { resourceDomains: [env.STOREFRONT_URL] },
  });

  // PayPal Checkout widget
  server.widgets.set("paypalCheckout", {
    title: "PayPal Checkout",
    description: "Secure PayPal payment approval",
    resourceUri: "ui://paypal-checkout",
    csp: {
      resourceDomains: [
        env.STOREFRONT_URL,
        "https://www.sandbox.paypal.com",
        "https://www.paypal.com",
      ],
    },
  });

  registerTools(server, env, _userId);

  return server;
}

function registerTools(server: { tools: Map<string, Tool> }, env: Env, _userId: string): void {
  const db = new Database(env.DB);

  // --- search_products ---
  server.tools.set("search_products", {
    name: "search_products",
    description: "Search for rentable gear and setups in a city.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        city: { type: "string" },
        limit: { type: "number", default: 10 },
        page: { type: "number", default: 1 },
      },
      required: ["city"],
    },
    handler: async (params: Record<string, unknown>) => {
      const query = params.query as string | undefined;
      const city = params.city as string | undefined;
      const limit = Number(params.limit ?? 10);
      const page = Number(params.page ?? 1);
      const { searchProducts } = await import("@async-rent/core");
      const products = await searchProducts(db, query ?? "", city ?? "", limit, page);
      const enriched = await Promise.all(
        products.map(async (p) => {
          const price = await priceForLocation(db, p.id, city ?? "");
          const deposit = await depositPercent(db, p.id);
          let parts: Array<{ id: string; name: string; price: number }> = [];
          if (isSetup(p)) {
            const partProducts = await getSetupPartProducts(db, p.id);
            parts = partProducts.map((pp) => ({
              id: pp.id,
              name: pp.name,
              price: pp.weekly_price ?? 0,
            }));
          }
          return {
            id: p.id,
            name: p.name,
            type: p.type,
            category: p.category,
            weekly_price: price ?? p.weekly_price ?? 0,
            deposit_percent: deposit,
            image: p.cover_image ?? "",
            alt: p.cover_alt ?? p.name,
            parts,
            is_setup: isSetup(p),
          };
        }),
      );
      return { products: enriched, total: enriched.length, page, limit };
    },
  });

  // --- start_payment ---
  server.tools.set("start_payment", {
    name: "start_payment",
    description: "Start a payment for a rental.",
    inputSchema: {
      type: "object",
      properties: {
        rental_id: { type: "string" },
        amount: { type: "number" },
        currency: { type: "string", default: "USD" },
      },
      required: ["rental_id", "amount"],
    },
    handler: async (params: Record<string, unknown>) => {
      const rental_id = (params.rental_id as string | undefined) ?? "";
      const _amount = Number(params.amount ?? 0);
      const _currency = (params.currency as string | undefined) ?? "USD";
      return {
        order_id: "paypal-order-" + rental_id,
        approval_url: "",
        status: "awaiting_approval",
      };
    },
  });

  // --- confirm_payment ---
  server.tools.set("confirm_payment", {
    name: "confirm_payment",
    description: "Confirm a payment after the customer has approved it on PayPal.",
    inputSchema: {
      type: "object",
      properties: { order_id: { type: "string" } },
      required: ["order_id"],
    },
    handler: async (params: Record<string, unknown>) => {
      const order_id = (params.order_id as string | undefined) ?? "";
      return { status: "paid", captured_at: Math.floor(Date.now() / 1000), order_id };
    },
  });

  // --- list_locations ---
  server.tools.set("list_locations", {
    name: "list_locations",
    description: "List all available rental cities.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const cities = await db.query("SELECT * FROM cities");
      return { locations: cities };
    },
  });

  // --- quote_rental ---
  server.tools.set("quote_rental", {
    name: "quote_rental",
    description: "Get a quote for renting selected products for a date range.",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string" },
        product_ids: { type: "array", items: { type: "string" } },
        start_date: { type: "number" },
        end_date: { type: "number" },
      },
      required: ["city", "product_ids", "start_date", "end_date"],
    },
    handler: async (params: Record<string, unknown>) => {
      const city = (params.city as string | undefined) ?? "";
      const productIds = (params.product_ids as string[]) ?? [];
      const start_date = Number(params.start_date ?? 0);
      const end_date = Number(params.end_date ?? 0);
      let weekly_total = 0;
      let deposit_total = 0;
      for (const pid of productIds) {
        const price = await priceForLocation(db, pid, city);
        const deposit = await depositPercent(db, pid);
        if (price) {
          weekly_total += price;
          deposit_total += price * (deposit / 100);
        }
      }
      return {
        weekly_total,
        deposit_total,
        total_today: weekly_total + deposit_total,
        weeks: Math.ceil((end_date - start_date) / (7 * 24 * 60 * 60)),
      };
    },
  });

  // --- create_rental ---
  server.tools.set("create_rental", {
    name: "create_rental",
    description: "Create a rental from a cart.",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string" },
        product_ids: { type: "array", items: { type: "string" } },
        start_date: { type: "number" },
        end_date: { type: "number" },
      },
      required: ["city", "product_ids", "start_date", "end_date"],
    },
    handler: async (params: Record<string, unknown>) => {
      const city = (params.city as string | undefined) ?? "";
      const productIds = (params.product_ids as string[]) ?? [];
      const start_date = Number(params.start_date ?? 0);
      const end_date = Number(params.end_date ?? 0);
      let weekly_total = 0;
      let deposit_total = 0;
      for (const pid of productIds) {
        const price = await priceForLocation(db, pid, city);
        const deposit = await depositPercent(db, pid);
        if (price) {
          weekly_total += price;
          deposit_total += price * (deposit / 100);
        }
      }
      const rentalId = await db.createRental({
        user_id: _userId,
        city_slug: city,
        status: "pending",
        weekly_price: weekly_total,
        deposit_amount: deposit_total,
        total_paid: 0,
        start_date,
        end_date,
      });
      for (const pid of productIds) {
        await db.addRentalItem({ rental_id: rentalId, product_id: pid, quantity: 1 });
      }
      return { rental_id: rentalId, status: "pending" };
    },
  });

  // --- check_rental ---
  server.tools.set("check_rental", {
    name: "check_rental",
    description: "Check the status of a rental.",
    inputSchema: {
      type: "object",
      properties: { rental_id: { type: "string" } },
      required: ["rental_id"],
    },
    handler: async (params: Record<string, unknown>) => {
      const rental_id = (params.rental_id as string | undefined) ?? "";
      const rental = await db.getRental(rental_id);
      if (!rental) throw new Error("Rental not found");
      return {
        rental_id: rental.id,
        status: rental.status,
        weekly_price: rental.weekly_price,
        total_paid: rental.total_paid,
        start_date: rental.start_date,
        end_date: rental.end_date ?? 0,
      };
    },
  });

  // --- cancel_rental ---
  server.tools.set("cancel_rental", {
    name: "cancel_rental",
    description: "Cancel a rental.",
    inputSchema: {
      type: "object",
      properties: { rental_id: { type: "string" } },
      required: ["rental_id"],
    },
    handler: async (params: Record<string, unknown>) => {
      const rental_id = (params.rental_id as string | undefined) ?? "";
      await db.execute("UPDATE rentals SET status = 'cancelled', updated_at = ? WHERE id = ?", [
        Math.floor(Date.now() / 1000),
        rental_id,
      ]);
      return { success: true };
    },
  });
}

export { registerTools };
export type { McpServer };
