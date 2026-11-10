export interface Product {
  id: string;
  name: string;
  type: "gear" | "setup" | "other";
  category: string;
  cover_image?: string | null;
  cover_alt?: string | null;
  weekly_price?: number;
  is_rentable: boolean;
  created_at: number;
  updated_at: number;
}

export interface City {
  slug: string;
  name: string;
  factor: number;
  currency: string;
}

export interface Setup {
  id: string;
  name: string;
  description?: string | null;
  category: string;
}

export interface SetupPart {
  setup_id: string;
  product_id: string;
  quantity: number;
}

export interface LocationPrice {
  product_id: string;
  city_slug: string;
  weekly_price: number;
}

export interface DepositRule {
  product_id: string;
  percentage: number;
}

export interface CartItem {
  product_id: string;
  quantity: number;
}

export interface Rental {
  id: string;
  user_id: string;
  city_slug: string;
  status: "pending" | "active" | "cancelled" | "returned" | "completed";
  weekly_price: number;
  deposit_amount: number;
  total_paid: number;
  start_date: number;
  end_date?: number | null;
  created_at: number;
  updated_at: number;
}

export interface RentalItem {
  rental_id: string;
  product_id: string;
  quantity: number;
}

export interface PaymentRecord {
  id: string;
  rental_id: string;
  provider: string;
  order_id: string;
  status: "awaiting_approval" | "approved" | "paid" | "failed" | "refunded";
  amount: number;
  currency: string;
  approval_url?: string | null;
  payer_id?: string | null;
  captured_at?: number | null;
  created_at: number;
}
