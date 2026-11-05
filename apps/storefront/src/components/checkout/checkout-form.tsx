import { Alert, AlertDescription } from "@async-rent/ui/components/alert";
import { Badge } from "@async-rent/ui/components/badge";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@async-rent/ui/components/field";
import { Input } from "@async-rent/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@async-rent/ui/components/radio-group";
import { ToggleGroup, ToggleGroupItem } from "@async-rent/ui/components/toggle-group";
import { RiInformationLine, RiLockLine } from "@remixicon/react";
import { cn } from "cn";
import { useId, useState, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { z } from "zod";

import { useRentalPlan } from "../../hooks/use-rental-plan";
import {
  checkoutDetailsSchema,
  deliveryDayOptions,
  type CheckoutDetailsInput,
  type CheckoutField,
} from "../../lib/checkout";
import { formatDeliveryDate, latestDeliveryDate } from "../../lib/rental-plan";

const fieldLabel =
  "font-mono text-[9.5px] font-normal tracking-[0.12em] text-muted-foreground uppercase";

const fields = [
  "email",
  "whatsapp",
  "line1",
  "city",
  "postcode",
] as const satisfies ReadonlyArray<CheckoutField>;

type FieldErrors = Partial<Record<CheckoutField, string>>;

interface CheckoutFormProps {
  id: string;
  /** What the fields start with; the visitor can change them until the order is placed. */
  defaults: Partial<CheckoutDetailsInput>;
  /**
   * The placed order's delivery day. Once set, the form shows the order as
   * placed and only its payment can be retried.
   */
  placedDeliveryDate?: string;
  /** The details to place the order with, or `undefined` to pay the placed one. */
  onSubmit: (details: CheckoutDetailsInput | undefined) => void;
}

/**
 * Contact, delivery and payment. The submit button lives in the order summary
 * and targets this form by `id`.
 */
export function CheckoutForm({ id, defaults, placedDeliveryDate, onSubmit }: CheckoutFormProps) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const locked = placedDeliveryDate !== undefined;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (locked) {
      onSubmit(undefined);
      return;
    }

    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(
      fields.map((name) => {
        const value = form.get(name);
        return [name, typeof value === "string" ? value : ""];
      }),
    );
    const parsed = checkoutDetailsSchema.safeParse(values);

    if (!parsed.success) {
      const { fieldErrors } = z.flattenError(parsed.error);
      const next: FieldErrors = {};
      for (const name of fields) next[name] = fieldErrors[name]?.[0];
      setErrors(next);

      const first = fields.find((name) => next[name]);
      if (first) {
        const input = event.currentTarget.elements.namedItem(first);
        if (input instanceof HTMLElement) input.focus();
      }
      return;
    }

    setErrors({});
    onSubmit(parsed.data);
  }

  // Editing a field clears its message until the next submit.
  const clearError = (name: CheckoutField) =>
    setErrors((current) => (current[name] ? { ...current, [name]: undefined } : current));

  const fieldProps = (name: CheckoutField) => ({
    name,
    error: errors[name],
    onChange: () => clearError(name),
  });

  return (
    <form id={id} noValidate onSubmit={handleSubmit} className="flex flex-col gap-10">
      <fieldset disabled={locked} className="flex min-w-0 flex-col gap-10">
        <Section number="01" title="Contact" aside="For delivery updates only">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              {...fieldProps("email")}
              label="Email"
              type="email"
              autoComplete="email"
              defaultValue={defaults.email}
            />
            <TextField
              {...fieldProps("whatsapp")}
              label="WhatsApp"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+62 812 3456 7890"
              defaultValue={defaults.whatsapp}
            />
          </div>
        </Section>

        <Section number="02" title="Delivery" aside="Free setup included">
          <FieldGroup className="gap-4">
            <TextField
              {...fieldProps("line1")}
              label="Address"
              autoComplete="address-line1"
              placeholder="Street, number, villa or building"
              defaultValue={defaults.line1}
            />
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
              <TextField
                {...fieldProps("city")}
                label="City"
                autoComplete="address-level2"
                defaultValue={defaults.city}
              />
              <TextField
                {...fieldProps("postcode")}
                label="Postcode"
                autoComplete="postal-code"
                defaultValue={defaults.postcode}
              />
            </div>
            {placedDeliveryDate ? (
              <PlacedDeliveryDay date={placedDeliveryDate} />
            ) : (
              <DeliveryDays />
            )}
          </FieldGroup>
        </Section>
      </fieldset>

      <Section
        number="03"
        title="Payment"
        aside="PayPal only"
        asideClassName="font-mono text-[9.5px] tracking-[0.12em] uppercase"
      >
        <div className="flex flex-col gap-2.5">
          <RadioGroup value="paypal" aria-label="Payment method">
            <FieldLabel htmlFor="checkout-paypal" className="w-full">
              <Field orientation="horizontal" className="items-center gap-4 px-4 py-3.5">
                <RadioGroupItem value="paypal" id="checkout-paypal" />
                <Badge variant="soft" className="font-normal">
                  PayPal
                </Badge>
                <FieldContent className="gap-0.5">
                  <FieldTitle className="text-[13px] font-normal">PayPal</FieldTitle>
                  <FieldDescription className="text-[11px]">
                    You'll be redirected to PayPal to complete your payment.
                  </FieldDescription>
                </FieldContent>
                <span className="hidden shrink-0 items-center gap-1 font-mono text-[9px] tracking-[0.12em] text-muted-foreground uppercase sm:flex">
                  <RiLockLine className="size-3" />
                  Secure
                </span>
              </Field>
            </FieldLabel>
          </RadioGroup>

          <Alert role="note" className="border-none bg-fog px-4 py-4">
            <RiInformationLine className="text-primary" />
            <AlertDescription className="text-[11px]">
              PayPal is the only payment method available right now. No card details are stored by
              Async.
            </AlertDescription>
          </Alert>
        </div>
      </Section>

      <p className="-mt-4 text-[11px] text-muted-foreground">
        By placing this order you agree to the <span className="text-foreground">rental terms</span>{" "}
        and delivery policy.
      </p>
    </form>
  );
}

interface SectionProps {
  number: string;
  title: string;
  aside: string;
  asideClassName?: string;
  children: ReactNode;
}

function Section({ number, title, aside, asideClassName, children }: SectionProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-4 border-b pb-2.5">
        <h2 id={headingId} className="font-mono text-[10px] tracking-[0.12em] uppercase">
          {number} — {title}
        </h2>
        <p className={cn("text-[11px] text-muted-foreground", asideClassName)}>{aside}</p>
      </div>
      {children}
    </section>
  );
}

interface TextFieldProps extends Omit<ComponentProps<"input">, "name"> {
  name: CheckoutField;
  label: string;
  error: string | undefined;
}

function TextField({ name, label, error, className, ...props }: TextFieldProps) {
  const inputId = `checkout-${name}`;
  const errorId = `${inputId}-error`;

  return (
    <Field data-invalid={error ? true : undefined} className="gap-2">
      <FieldLabel htmlFor={inputId} className={fieldLabel}>
        {label}
      </FieldLabel>
      <Input
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn("h-11 px-3.5", className)}
        {...props}
      />
      <FieldError id={errorId} className="text-xs">
        {error}
      </FieldError>
    </Field>
  );
}

/**
 * The planned delivery day and the next two the courier runs. Picking one
 * updates the plan, so the cart and the order summary show the same day.
 */
function DeliveryDays() {
  const { location, plan, setDeliveryDate } = useRentalPlan();
  const latest = latestDeliveryDate(location, new Date());

  // The days stay put while the visitor picks among them; a day chosen
  // elsewhere (the cart's calendar) starts a new set.
  const [firstDay, setFirstDay] = useState(plan.deliveryDate);
  let days = deliveryDayOptions(firstDay, latest);
  if (!days.includes(plan.deliveryDate)) {
    setFirstDay(plan.deliveryDate);
    days = deliveryDayOptions(plan.deliveryDate, latest);
  }

  return (
    <DeliveryDayToggles
      days={days}
      value={plan.deliveryDate}
      onChange={(day) => setDeliveryDate(day)}
    />
  );
}

/** The day a placed order is delivered on; it can no longer change. */
function PlacedDeliveryDay({ date }: { date: string }) {
  return <DeliveryDayToggles days={[date]} value={date} disabled />;
}

interface DeliveryDayTogglesProps {
  days: string[];
  value: string;
  disabled?: boolean;
  onChange?: (day: string) => void;
}

function DeliveryDayToggles({ days, value, disabled, onChange }: DeliveryDayTogglesProps) {
  const labelId = useId();

  return (
    <Field className="gap-2 pt-1">
      <p id={labelId} className={fieldLabel}>
        Preferred delivery
      </p>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <ToggleGroup
          aria-labelledby={labelId}
          variant="outline"
          className="flex-wrap"
          disabled={disabled}
          value={[value]}
          onValueChange={(next) => {
            // Clicking the picked day again keeps it rather than leaving none.
            const [day] = next;
            if (day) onChange?.(day);
          }}
        >
          {days.map((day) => (
            <ToggleGroupItem
              key={day}
              value={day}
              className="h-9 px-3.5 text-[12.5px] font-normal aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90"
            >
              {formatDeliveryDate(day)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-[11px] text-muted-foreground">We'll WhatsApp before arrival.</p>
      </div>
    </Field>
  );
}
