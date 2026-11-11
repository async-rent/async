import type { Payment, RentalStatus } from "@async-rent/core";
import { Badge } from "@async-rent/ui/components/badge";
import type { ComponentProps } from "react";

import { paymentStatusLabels, rentalStatusLabels } from "../../lib/rentals";

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

const rentalStatusVariants: Record<RentalStatus, BadgeVariant> = {
  pending_payment: "secondary",
  confirmed: "soft",
  active: "default",
  completed: "outline",
  cancelled: "outline",
};

const paymentStatusVariants: Record<Payment["status"], BadgeVariant> = {
  pending: "secondary",
  authorized: "secondary",
  succeeded: "soft",
  failed: "destructive",
  refunded: "outline",
};

export function RentalStatusBadge({ status }: { status: RentalStatus }) {
  return <Badge variant={rentalStatusVariants[status]}>{rentalStatusLabels[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: Payment["status"] }) {
  return <Badge variant={paymentStatusVariants[status]}>{paymentStatusLabels[status]}</Badge>;
}
