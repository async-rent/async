import type { D1Database } from "@cloudflare/workers-types";
import type { Product, Setup, SetupPart, Rental, RentalItem, PaymentRecord } from "./schema.js";

export class Database {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const prepared = this.db.prepare(sql);
    const result = await (params ? prepared.bind(...params) : prepared).all();
    return (result.results as T[]) ?? [];
  }

  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const prepared = this.db.prepare(sql);
    const result = await (params ? prepared.bind(...params) : prepared).first();
    return result as T | null;
  }

  async execute(sql: string, params?: any[]): Promise<{ changes: number }> {
    const prepared = this.db.prepare(sql);
    const result = await (params ? prepared.bind(...params) : prepared).run();
    return { changes: result.meta?.changes ?? 0 };
  }

  // Product queries
  async findProduct(id: string): Promise<Product | null> {
    return this.queryOne<Product>("SELECT * FROM products WHERE id = ?", [id]);
  }

  async searchProducts(query: string, citySlug: string, limit = 10, page = 1): Promise<Product[]> {
    const offset = (page - 1) * limit;
    const pattern = `%${query}%`;
    const sql = `
      SELECT p.*, lp.weekly_price
      FROM products p
      LEFT JOIN location_prices lp ON lp.product_id = p.id AND lp.city_slug = ?
      WHERE p.is_rentable = 1
        AND (p.name LIKE ? OR p.category LIKE ? OR p.type LIKE ?)
      ORDER BY CASE WHEN p.type = 'setup' THEN 0 ELSE 1 END, p.name
      LIMIT ? OFFSET ?`;
    return this.query<Product>(sql, [citySlug, pattern, pattern, pattern, limit, offset]);
  }

  async listSetupsByCategory(category: string, citySlug: string): Promise<Product[]> {
    const sql = `
      SELECT p.*, lp.weekly_price
      FROM products p
      LEFT JOIN location_prices lp ON lp.product_id = p.id AND lp.city_slug = ?
      WHERE p.type = 'setup' AND p.category = ? AND p.is_rentable = 1
      ORDER BY p.name`;
    return this.query<Product>(sql, [citySlug, category]);
  }

  // Setup queries
  async findSetup(setupId: string): Promise<Setup | null> {
    return this.queryOne<Setup>("SELECT * FROM setups WHERE id = ?", [setupId]);
  }

  async getSetupParts(setupId: string): Promise<SetupPart[]> {
    return this.query<SetupPart>("SELECT * FROM setup_parts WHERE setup_id = ?", [setupId]);
  }

  async getSetupPartProducts(setupId: string): Promise<Product[]> {
    return this.query<Product>(
      `SELECT p.* FROM products p
       INNER JOIN setup_parts sp ON sp.product_id = p.id
       WHERE sp.setup_id = ?
       ORDER BY p.name`,
      [setupId],
    );
  }

  // Location prices
  async getPrice(productId: string, citySlug: string): Promise<number | null> {
    const row = await this.queryOne<{ weekly_price: number }>(
      "SELECT weekly_price FROM location_prices WHERE product_id = ? AND city_slug = ?",
      [productId, citySlug],
    );
    return row?.weekly_price ?? null;
  }

  // Deposits
  async getDepositPercent(productId: string): Promise<number> {
    const row = await this.queryOne<{ percentage: number }>(
      "SELECT percentage FROM deposit_rules WHERE product_id = ?",
      [productId],
    );
    return row?.percentage ?? 25;
  }

  // Rentals
  async createRental(rental: Omit<Rental, "id" | "created_at" | "updated_at">): Promise<string> {
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const sql = `
      INSERT INTO rentals (id, user_id, city_slug, status, weekly_price, deposit_amount, total_paid, start_date, end_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    await this.execute(sql, [
      id,
      rental.user_id,
      rental.city_slug,
      rental.status,
      rental.weekly_price,
      rental.deposit_amount,
      rental.total_paid,
      rental.start_date,
      rental.end_date,
      now,
      now,
    ]);
    return id;
  }

  async getRental(id: string): Promise<Rental | null> {
    return this.queryOne<Rental>("SELECT * FROM rentals WHERE id = ?", [id]);
  }

  async addRentalItem(item: Omit<RentalItem, "_id">): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO rental_items (rental_id, product_id, quantity)
      VALUES (?, ?, ?)`;
    await this.execute(sql, [item.rental_id, item.product_id, item.quantity]);
  }

  // Payments
  async createPayment(payment: Omit<PaymentRecord, "id" | "created_at">): Promise<string> {
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const sql = `
      INSERT INTO payments (id, rental_id, provider, order_id, status, amount, currency, approval_url, payer_id, captured_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    await this.execute(sql, [
      id,
      payment.rental_id,
      payment.provider,
      payment.order_id,
      payment.status,
      payment.amount,
      payment.currency,
      payment.approval_url ?? null,
      payment.payer_id ?? null,
      payment.captured_at ?? null,
      now,
    ]);
    return id;
  }

  async updatePaymentStatus(
    id: string,
    status: PaymentRecord["status"],
    capturedAt?: number,
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.execute(
      "UPDATE payments SET status = ?, captured_at = COALESCE(?, captured_at) WHERE id = ?",
      [status, capturedAt ?? now, id],
    );
  }

  async getPaymentByOrderId(orderId: string): Promise<PaymentRecord | null> {
    return this.queryOne<PaymentRecord>("SELECT * FROM payments WHERE order_id = ?", [orderId]);
  }
}
