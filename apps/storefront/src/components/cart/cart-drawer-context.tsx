import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface CartDrawerState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CartDrawerContext = createContext<CartDrawerState | null>(null);

/** Whether the cart drawer is open, shared by the header button and every Add button. */
export function CartDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);

  return <CartDrawerContext.Provider value={value}>{children}</CartDrawerContext.Provider>;
}

export function useCartDrawer(): CartDrawerState {
  const state = useContext(CartDrawerContext);
  if (!state) throw new Error("useCartDrawer must be used inside CartDrawerProvider");

  return state;
}
