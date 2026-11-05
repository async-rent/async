import { Separator } from "@async-rent/ui/components/separator";
import { RiCheckLine } from "@remixicon/react";
import { Fragment } from "react";

const stepLabel = "font-mono text-[10px] tracking-[0.12em] uppercase";

const steps = [
  { id: "cart", label: "Cart" },
  { id: "checkout", label: "Checkout" },
  { id: "confirmed", label: "Confirmed" },
] as const;

interface CheckoutStepsProps {
  /** The step the visitor is on. The steps after it stay hidden until reached. */
  current: "checkout" | "confirmed";
  freeDelivery?: boolean;
}

/** How far through checkout the visitor is: the steps done, then the current one. */
export function CheckoutSteps({ current, freeDelivery = false }: CheckoutStepsProps) {
  const shown = steps.slice(0, steps.findIndex((step) => step.id === current) + 1);

  return (
    <nav aria-label="Checkout steps" className="flex items-center justify-between gap-4">
      <ol className="flex items-center gap-3">
        {shown.map((step, index) => (
          <Fragment key={step.id}>
            {index > 0 && (
              <li aria-hidden className="w-7">
                <Separator />
              </li>
            )}
            {step.id === current ? (
              <li aria-current="step" className="flex items-center gap-2 text-primary">
                <span className="flex size-4 items-center justify-center rounded-full bg-primary">
                  <span className="size-1.5 rounded-full bg-primary-foreground" />
                </span>
                <span className={stepLabel}>{step.label}</span>
              </li>
            ) : (
              <li className="flex items-center gap-2 text-muted-foreground">
                <span className="flex size-4 items-center justify-center rounded-full bg-fog text-foreground">
                  <RiCheckLine className="size-2.5" />
                </span>
                <span className={stepLabel}>{step.label}</span>
              </li>
            )}
          </Fragment>
        ))}
      </ol>
      {freeDelivery && (
        <p className="flex items-center gap-2 text-muted-foreground">
          <span aria-hidden className="size-1.5 rounded-full bg-primary" />
          <span className={stepLabel}>Free delivery</span>
        </p>
      )}
    </nav>
  );
}
