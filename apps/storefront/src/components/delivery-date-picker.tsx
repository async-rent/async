import { Calendar } from "@async-rent/ui/components/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@async-rent/ui/components/popover";
import { useState, type ReactElement, type ReactNode } from "react";

import { useRentalPlan } from "../hooks/use-rental-plan";
import { earliestDeliveryDate, fromCalendarDate, toCalendarDate } from "../lib/rental-plan";

interface DeliveryCalendarProps {
  /** Called after the visitor picks a day. */
  onPicked?: () => void;
}

/** A month calendar bound to the plan's delivery date; days before the city's first slot are disabled. */
export function DeliveryCalendar({ onPicked }: DeliveryCalendarProps) {
  const { location, plan, setDeliveryDate } = useRentalPlan();
  const selected = toCalendarDate(plan.deliveryDate);

  return (
    <Calendar
      mode="single"
      required
      selected={selected}
      defaultMonth={selected}
      disabled={{ before: toCalendarDate(earliestDeliveryDate(location, new Date())) }}
      onSelect={(date) => {
        setDeliveryDate(fromCalendarDate(date));
        onPicked?.();
      }}
    />
  );
}

interface DeliveryDatePickerProps {
  /** The trigger element; it receives the popover's open/close behaviour. */
  render: ReactElement;
  children: ReactNode;
  align?: "start" | "center" | "end";
}

/** Opens the delivery calendar from any trigger and closes once a day is picked. */
export function DeliveryDatePicker({ render, children, align = "start" }: DeliveryDatePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={render}>{children}</PopoverTrigger>
      <PopoverContent align={align} sideOffset={8} className="w-auto p-0">
        <DeliveryCalendar onPicked={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
