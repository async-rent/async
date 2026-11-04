import { Separator } from "@async-rent/ui/components/separator";
import { RiArrowRightUpLine } from "@remixicon/react";

import { cities } from "../lib/cities";
import { Logo } from "./logo";

/** A footer entry. Entries without `href` have no page yet and render as text. */
interface FooterLink {
  label: string;
  href?: string;
}

const columns: ReadonlyArray<{ title: string; links: ReadonlyArray<FooterLink> }> = [
  {
    title: "Rent",
    links: [
      { label: "All equipment" },
      { label: "Bundles" },
      { label: "Desks" },
      { label: "Chairs" },
      { label: "Monitors" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "How renting works" },
      { label: "Delivery & setup" },
      { label: "Returns" },
      { label: "Rental terms" },
      { label: "FAQ" },
    ],
  },
  {
    title: "Places",
    links: cities.map((city) => ({ label: city.name })),
  },
  {
    title: "Contact",
    links: [
      { label: "hello@async.rent", href: "mailto:hello@async.rent" },
      { label: "WhatsApp" },
      { label: "Instagram" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-ink text-paper">
      <div className="mx-auto flex w-full max-w-360 flex-col px-5 pt-14 pb-6 md:px-10 xl:px-20">
        <div className="flex flex-col justify-between gap-12 lg:flex-row lg:gap-20">
          <div className="flex w-full max-w-85 shrink-0 flex-col gap-4">
            <Logo className="h-9 w-auto self-start" />
            <p className="text-xs leading-[1.2] text-paper/78">Your comfy setup, everywhere!</p>
          </div>

          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-x-14 gap-y-10 pt-1 sm:grid-cols-4 lg:flex"
          >
            {columns.map((column) => (
              <div
                key={column.title}
                className="flex flex-col gap-2.25 lg:w-33 lg:shrink-0 lg:nth-2:w-37.5 lg:nth-3:w-32 lg:nth-4:w-42"
              >
                <h2 className="pb-1 font-mono text-[9px] leading-3 tracking-[0.16em] text-paper/42 uppercase">
                  {column.title}
                </h2>
                <ul className="flex flex-col gap-2.25">
                  {column.links.map((link) => (
                    <li key={link.label} className="text-[13px] leading-4 text-paper/82">
                      {link.href ? (
                        <a
                          href={link.href}
                          className="text-paper transition-colors hover:text-signal"
                        >
                          {link.label}
                        </a>
                      ) : (
                        link.label
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <Separator className="mt-11 bg-paper/14" />

        <div className="flex items-center justify-between gap-4 pt-5 font-mono text-[9px] leading-3 tracking-widest uppercase">
          <p className="text-paper/40">© {new Date().getFullYear()} Async.</p>
          <ul className="flex items-center gap-5">
            <li className="text-paper/55">Privacy</li>
            <li className="text-paper/55">Terms</li>
            <li className="flex items-center gap-1">
              Instagram
              <RiArrowRightUpLine aria-hidden className="size-2.5" />
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
