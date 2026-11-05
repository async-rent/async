import { RiArrowRightUpLine } from "@remixicon/react";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";

import type { CatalogOverview, CategoryTile } from "../../lib/catalog-overview";
import { ProductImage } from "../product-image";

// A tile is current (aria-current) only when the category filter matches
// exactly; "See all" sets it to undefined, so that must count as a mismatch.
const tileActiveOptions = { exact: true, explicitUndefined: true } as const;

interface CategoryIndexProps {
  overview: CatalogOverview;
  /** Slug of the category the page is filtered to, if any. */
  activeCategory?: string;
}

/** "Shop by category": an all-equipment tile, then one tile per category with its count in the city. */
export function CategoryIndex({ overview, activeCategory }: CategoryIndexProps) {
  return (
    <section
      aria-labelledby="shop-by-category"
      className="mx-auto flex w-full max-w-360 flex-col gap-6 px-5 pb-14 md:px-10 xl:px-20"
    >
      <h2
        id="shop-by-category"
        className="font-heading text-3xl leading-[1.3] tracking-[-0.01em] text-ink"
      >
        Shop by category
      </h2>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <li>
          <Link
            to="/"
            search={(previous) => ({ ...previous, category: undefined })}
            resetScroll={false}
            activeOptions={tileActiveOptions}
            className="group flex flex-col gap-3 rounded-lg outline-none"
          >
            <span className="flex h-34 flex-col justify-between rounded-lg bg-primary p-4 transition-[filter] group-hover:brightness-105 group-focus-visible:ring-3 group-focus-visible:ring-ring/50">
              <span className="flex items-start justify-between">
                <span className="font-mono text-[9px] leading-3 tracking-[0.16em] text-paper/74 uppercase">
                  All equipment
                </span>
                <RiArrowRightUpLine className="size-3.5 text-paper" />
              </span>
              <AllEquipmentMark />
            </span>
            <TileLabel name="See all" count={overview.equipmentCount} />
          </Link>
        </li>
        {overview.categories.map((category) => (
          <li key={category.id}>
            <CategoryLink category={category} active={category.slug === activeCategory} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CategoryLink({ category, active }: { category: CategoryTile; active: boolean }) {
  return (
    <Link
      to="/"
      search={(previous) => ({ ...previous, category: category.slug })}
      resetScroll={false}
      activeOptions={tileActiveOptions}
      className="group flex flex-col gap-3 rounded-lg outline-none"
    >
      <ProductImage
        // Decorative here: the category name already labels the link.
        image={category.image && { ...category.image, alt: "" }}
        className={cn(
          "h-34 rounded-lg p-3 transition-shadow group-focus-visible:ring-3 group-focus-visible:ring-ring/50",
          active && "ring-2 ring-primary ring-offset-2 ring-offset-paper",
        )}
        imageClassName="transition-transform duration-300 ease-out group-hover:scale-[1.04]"
      />
      <TileLabel name={category.name} count={category.count} />
    </Link>
  );
}

function TileLabel({ name, count }: { name: string; count: number }) {
  return (
    <span className="flex items-center justify-between gap-2">
      <span className="text-[15px] leading-4.5 text-ink">{name}</span>
      <span className="font-mono text-[10px] leading-3 text-muted-foreground">{count}</span>
    </span>
  );
}

// The 3 × 3 grid from the design's all-equipment tile.
function AllEquipmentMark() {
  const cells = [0, 12, 24];

  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" className="text-paper">
      {cells.flatMap((y) =>
        cells.map((x) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="8" height="8" rx="2.5" fill="currentColor" />
        )),
      )}
    </svg>
  );
}
