// The demo's script: every string on screen and every cue, in one place. Times are seconds at 60 fps (t()).
// Strings come from the product: packages/db/seed.sql (names, taglines, Bali prices and deposits), tools/mcp
// (tool titles), packages/payment (PayPal), the storefront's checkout and confirmation copy.
export const FPS = 60;
export const W = 1920;
export const H = 1080;
export const t = (s: number) => Math.round(s * FPS);

/** The case: a nomad just landed in Canggu, two weeks, a cozy desk at the villa. Today is Thu, 5 Nov 2026. */
export const PROMPT = "I need a cozy work setup in Bali for 2 weeks. I'm staying at Villa Lumbung in Canggu.";
export const CHAT_TITLE = 'Cozy work setup in Bali';
export const CHAT_URL = 'claude.ai/chat/3f9c1e27-58b4-4d6a-9e1c-7a2d0b5c4e81';
export const USER = { name: 'Lucky', plan: 'Free', initial: 'L' };
export const GREETING = 'Evening thoughts';
export const MODEL = { name: 'Sonnet 5.5', effort: 'Medium', mode: 'Manual' };

export const RENTAL = 'AR-2026-CG8T4M';
export const DELIVERY = { day: 'Fri, 6 Nov', place: 'Villa Lumbung, Canggu', city: 'Bali, Indonesia' };

export type Setup = { id: string; name: string; tagline: string; weekly: number; deposit: number; badge?: string; images: string[] };
// Bali prices = base prices (seed.sql city factor 1.0), USD per week.
export const SETUPS: Setup[] = [
  { id: 'prd_setup_full', name: 'The full setup', tagline: 'The whole desk, delivered and assembled', weekly: 25, deposit: 400, badge: 'Best value', images: ['setup-full-1.jpg'] },
  { id: 'prd_setup_focus', name: 'The focus setup', tagline: 'Desk, keyboard and mouse, ready to write', weekly: 15, deposit: 250, images: ['smartdesk-pro-1.jpg', 'low-profile-keyboard-1.jpg', 'mx-master-3s-1.jpg'] },
  { id: 'prd_setup_studio', name: 'The studio setup', tagline: 'Camera-first kit for people on video', weekly: 21, deposit: 350, images: ['studio-display-27-1.jpg', 'studio-webcam-4k-1.jpg', 'usb-c-hub-1.jpg'] },
];
export type Addon = { id: string; name: string; tagline: string; weekly: number; deposit: number; image: string };
export const ADDONS: Addon[] = [
  { id: 'prd_arc_floor_lamp', name: 'Arc Floor Lamp', tagline: 'Dimmable, warm white', weekly: 3, deposit: 30, image: 'arc-floor-lamp-1.jpg' },
  { id: 'prd_mx_master_3s', name: 'MX Master 3S', tagline: 'Silent-click mouse', weekly: 2, deposit: 30, image: 'mx-master-3s-1.jpg' },
  { id: 'prd_laptop_riser', name: 'Laptop Riser', tagline: 'Aluminum, six heights', weekly: 2, deposit: 20, image: 'laptop-riser-1.jpg' },
];
export const DELIVERY_FEE = 10; // loc_bali delivery_fee 1000
export const WEEKS = ['1 week', '2 weeks', '4 weeks'];

// What the user picks: the full setup, the lamp and the mouse, two weeks.
export const PICK = { setup: 0, addons: [0, 1], weeks: 1 };
export const WEEKLY = SETUPS[0].weekly + ADDONS[0].weekly + ADDONS[1].weekly; // 30
export const DEPOSIT = SETUPS[0].deposit + ADDONS[0].deposit + ADDONS[1].deposit; // 460
export const DUE = WEEKLY + DEPOSIT + DELIVERY_FEE; // 500 = first week + deposit + delivery (pricing.ts)

export const LINES = {
  promise: 'Rent your setup in',
  partner: 'Claude',
  tagline: 'Your comfy setup, everywhere!',
  url: 'async.rent',
};

export const SAY = {
  a: "I'll check what Async rents in Canggu for two weeks.",
  b: 'Three setups fit, each delivered and assembled within 24 hours. The full setup is the coziest pick for a villa room. Choose one and add what you like:',
  appMsg: `The full setup with the ${ADDONS[0].name} and ${ADDONS[1].name}, for 2 weeks from ${DELIVERY.day}.`,
  c: `Your rental ${RENTAL} is reserved. Pay the first week, the refundable deposit and delivery with PayPal:`,
  d: `You're all set. Your setup arrives on ${DELIVERY.day} at Villa Lumbung, assembled and ready to work. The next charge is $${WEEKLY} on Fri, 13 Nov for your last week, and the $${DEPOSIT} deposit comes back after pickup.`,
};

/** Tool calls, as tools/mcp registers them (title shown, name for reference). */
export const TOOLS = {
  locations: { title: 'List locations', name: 'list_locations' },
  search: { title: 'Search products', name: 'search_products' },
  quote: { title: 'Quote rental', name: 'quote_rental' },
  rent: { title: 'Rent', name: 'rent' },
  confirm: { title: 'Confirm payment', name: 'confirm_payment' },
};

// ---- Cues (absolute frames) -----------------------------------------------------------------------------------
export const CUE = {
  // the opening: the wordmark, the promise, a blur into the macro prompt
  mark: t(0.15),
  promise: t(0.85),
  introOut: t(2.15),
  macro: t(2.3), // the composer at macro scale, caret blinking
  typeStart: t(2.6),
  typeEnd: t(6.4),
  pullBack: t(4.3), // the camera leaves the caret and opens onto the whole page
  cursorIn: t(6.5),
  send: t(7.25),
  chat: t(7.35), // the page becomes the chat
  sayA: t(8.25),
  tool1: t(9.15),
  tool1Done: t(9.7),
  tool2: t(9.75),
  tool2Done: t(10.75),
  sayB: t(10.85),
  app1: t(12.6), // the Async picker mounts
  pickSetup: t(14.55),
  pickLamp: t(15.65),
  pickMouse: t(16.55),
  continue: t(17.6),
  appMsg: t(17.9),
  tool3: t(18.55),
  tool3Done: t(19.3),
  tool4: t(19.35),
  tool4Done: t(20.1),
  sayC: t(20.2),
  app2: t(21.35), // the checkout mounts
  pay: t(24.2), // the PayPal press
  paid: t(25.2), // loading -> payment approved
  tool5: t(26.4),
  tool5Done: t(27.2),
  sayD: t(27.3),
  sayDEnd: t(30.6),
  endFly: t(32.4), // the paid check leaves the chat and becomes the wordmark's dot
  endWord: t(33.35),
  endTag: t(33.95),
  endUrl: t(34.35),
  end: t(37.5),
};
export const TOTAL = CUE.end;
