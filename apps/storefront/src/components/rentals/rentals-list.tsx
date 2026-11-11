import { buttonVariants } from "@async-rent/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@async-rent/ui/components/empty";
import { Skeleton } from "@async-rent/ui/components/skeleton";
import { RiArrowLeftSLine, RiArrowRightLine, RiArrowRightSLine } from "@remixicon/react";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";

import { formatDeliveryDate } from "../../lib/rental-plan";
import { gearLabel, type RentalListItem, type RentalListPage } from "../../lib/rentals";
import { ProductImage } from "../product-image";
import { RentalStatusBadge } from "./rental-status";

const eyebrow = "font-mono text-[9.5px] tracking-[0.12em] text-muted-foreground uppercase";

// One grid for the column heads and every row, so the columns line up.
const rowGrid =
  "grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-4 lg:grid-cols-[56px_minmax(0,1fr)_150px_140px_130px_90px_16px] lg:gap-x-6";

/** The customer's rentals, newest first, each opening its own page. */
export function RentalsList({ page }: { page: RentalListPage }) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <div aria-hidden className={cn(rowGrid, "hidden px-4 pb-3 lg:grid", eyebrow)}>
          <span className="col-span-2">Rental</span>
          <span>City</span>
          <span>Status</span>
          <span>Next charge</span>
          <span>Weeks paid</span>
        </div>
        <ul className="flex flex-col border-t">
          {page.items.map((rental) => (
            <RentalRow key={rental.number} rental={rental} />
          ))}
        </ul>
      </div>
      {page.pageCount > 1 && <RentalsPagination page={page.page} pageCount={page.pageCount} />}
    </div>
  );
}

function RentalRow({ rental }: { rental: RentalListItem }) {
  const [first] = rental.lines;
  const label = "text-[10px] text-muted-foreground lg:sr-only";

  return (
    <li className="border-b">
      <Link
        to="/rentals/$number"
        params={{ number: rental.number }}
        className={cn(
          rowGrid,
          "group rounded-lg px-4 py-5 transition-colors duration-200 outline-none hover:bg-fog focus-visible:ring-[3px] focus-visible:ring-ring/50",
        )}
      >
        <ProductImage
          image={first?.image}
          className="size-14 rounded-lg lg:order-1"
          imageClassName="p-1.5 transition-transform duration-300 ease-out motion-safe:group-hover:scale-[1.03]"
        />
        <div className="flex min-w-0 flex-col gap-1 lg:order-2">
          <p className="font-mono text-[13px] tracking-[0.02em]">{rental.number}</p>
          <p className="truncate text-sm text-muted-foreground">{gearLabel(rental.lines)}</p>
        </div>
        <div className="justify-self-end lg:order-4 lg:justify-self-start">
          <span className="sr-only">Status </span>
          <RentalStatusBadge status={rental.status} />
        </div>
        <dl className="col-span-3 grid grid-cols-3 gap-4 text-sm lg:contents">
          <div className="flex flex-col gap-1 lg:order-3">
            <dt className={label}>City</dt>
            <dd className="truncate">{rental.city ?? "—"}</dd>
          </div>
          <div className="flex flex-col gap-1 lg:order-5">
            <dt className={label}>Next charge</dt>
            <dd className={cn(!rental.nextChargeDate && "text-muted-foreground")}>
              {rental.nextChargeDate ? formatDeliveryDate(rental.nextChargeDate) : "None"}
            </dd>
          </div>
          <div className="flex flex-col gap-1 lg:order-6">
            <dt className={label}>Weeks paid</dt>
            <dd className="font-mono">{rental.weeksPaid}</dd>
          </div>
        </dl>
        <RiArrowRightLine
          aria-hidden
          className="hidden size-4 text-muted-foreground transition-transform duration-200 group-hover:text-foreground motion-safe:group-hover:translate-x-0.5 lg:order-7 lg:block"
        />
      </Link>
    </li>
  );
}

interface RentalsPaginationProps {
  page: number;
  pageCount: number;
}

function RentalsPagination({ page, pageCount }: RentalsPaginationProps) {
  const link = buttonVariants({ variant: "outline" });
  const disabled = cn(link, "pointer-events-none opacity-50");

  return (
    <nav aria-label="Rental pages" className="flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link
          to="/rentals"
          search={{ page: page > 2 ? page - 1 : undefined }}
          className={link}
          rel="prev"
        >
          <RiArrowLeftSLine data-icon="inline-start" />
          Newer
        </Link>
      ) : (
        <span aria-disabled className={disabled}>
          <RiArrowLeftSLine data-icon="inline-start" />
          Newer
        </span>
      )}
      <p className="text-sm text-muted-foreground">
        Page {page} of {pageCount}
      </p>
      {page < pageCount ? (
        <Link to="/rentals" search={{ page: page + 1 }} className={link} rel="next">
          Older
          <RiArrowRightSLine data-icon="inline-end" />
        </Link>
      ) : (
        <span aria-disabled className={disabled}>
          Older
          <RiArrowRightSLine data-icon="inline-end" />
        </span>
      )}
    </nav>
  );
}

/** No rentals on the account yet. */
export function NoRentals() {
  return (
    <Empty className="min-h-100 border-t">
      <EmptyHeader>
        <EmptyTitle className="font-heading text-2xl font-normal">No rentals yet</EmptyTitle>
        <EmptyDescription>
          Once you check out, each rental shows here with its delivery, payments and weekly billing.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link to="/" className={buttonVariants()}>
          Browse equipment
        </Link>
      </EmptyContent>
    </Empty>
  );
}

/** A page number past the last page. */
export function PastLastPage() {
  return (
    <Empty className="min-h-100 border-t">
      <EmptyHeader>
        <EmptyTitle className="font-heading text-2xl font-normal">
          No rentals on this page
        </EmptyTitle>
        <EmptyDescription>Your rentals start on the first page.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link to="/rentals" className={buttonVariants({ variant: "outline" })}>
          Go to the first page
        </Link>
      </EmptyContent>
    </Empty>
  );
}

/** While the list loads: the rows' shape, empty. */
export function RentalsListSkeleton() {
  return (
    <ul aria-busy="true" aria-label="Loading your rentals" className="flex flex-col border-t">
      {[0, 1, 2].map((row) => (
        <li key={row} className={cn(rowGrid, "border-b px-4 py-5")}>
          <Skeleton className="size-14 rounded-lg" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
          <Skeleton className="h-5 w-20 rounded-4xl" />
        </li>
      ))}
    </ul>
  );
}
