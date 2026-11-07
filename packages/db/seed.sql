-- Seed data for the Async catalog (issue #5).
--
-- Populates the four launch cities, the gear categories, 28 gear products
-- plus the three ready-made setups shown in the Storefront design (full /
-- focus / studio) — 31 product rows in total — with real specs, highlights,
-- photos and 124 weekly per-city prices.
--
-- Amounts are minor units (cents, USD), matching `product_prices`.
--
-- This seed bypasses migration tracking by design. Run it after the schema
-- migrations (#23) against the one shared D1 database via the root wrangler
-- config:
--
--   vp exec wrangler d1 execute async-rent --local  --file=packages/db/seed.sql
--   vp exec wrangler d1 execute async-rent --remote --file=packages/db/seed.sql
--
-- The script is idempotent and safe to re-run once carts or rentals exist:
-- every row it writes — parents and children alike — is upserted, never
-- deleted, so `ON DELETE RESTRICT` foreign keys (carts, rentals, products,
-- categories) never fire, and rows added outside this seed survive a
-- re-run untouched. The one caveat: if a row is retracted *from this file*,
-- its stale copy lingers in the database — clear the affected table or the
-- database before re-seeding in that case. It never touches carts,
-- rentals, payments or billing agreements.
--
-- No explicit BEGIN/COMMIT: D1's remote import path runs the whole file in
-- one transaction, and locally wrangler replays it through `db.batch()`,
-- which is transactional too — an explicit wrapper would only break the
-- remote import. Photo paths are root-relative placeholders until the R2
-- public-base convention is pinned down before launch.

-- ---------------------------------------------------------------------------
-- Locations: the four launch cities. Upserted, never deleted — carts hold
-- `ON DELETE RESTRICT` foreign keys to locations.
-- ---------------------------------------------------------------------------

-- The currency and the delivery fee belong to the city: every price in a city
-- is in that city's currency, and an order pays delivery once.
INSERT INTO locations (id, slug, name, country, timezone, description, currency, delivery_fee, status) VALUES
  ('loc_bali',       'bali',       'Bali',       'Indonesia', 'Asia/Makassar',     'Canggu and Ubud workspaces a scooter ride from the beach.',        'USD', 1000, 'active'),
  ('loc_chiang_mai', 'chiang-mai', 'Chiang Mai', 'Thailand',  'Asia/Chiang_Mai',   'Nimman and Old City desks with mountain air and fast fiber.',      'USD', 1000, 'active'),
  ('loc_da_nang',    'da-nang',    'Da Nang',    'Vietnam',   'Asia/Ho_Chi_Minh',  'Beachside setups between the Han River and My Khe beach.',         'USD', 1000, 'active'),
  ('loc_lisbon',     'lisbon',     'Lisbon',     'Portugal',  'Europe/Lisbon',     'Alfama to Parque das Nações setups with Atlantic light.',          'USD', 1500, 'active')
ON CONFLICT (id) DO UPDATE SET
  slug         = excluded.slug,
  name         = excluded.name,
  country      = excluded.country,
  timezone     = excluded.timezone,
  description  = excluded.description,
  currency     = excluded.currency,
  delivery_fee = excluded.delivery_fee,
  status       = excluded.status,
  updated_at   = unixepoch() * 1000;

-- ---------------------------------------------------------------------------
-- Categories. Counts match the storefront design: 4 desks, 5 chairs,
-- 6 monitors, 6 lighting, 7 accessories — 28 products — plus 3 setups.
-- Upserted, never deleted — products hold `ON DELETE RESTRICT` foreign keys
-- to categories.
-- ---------------------------------------------------------------------------

INSERT INTO categories (id, slug, name, description, sort_order) VALUES
  ('cat_setups',      'setups',      'Setups',      'Ready-made desks delivered and assembled in one go.',     0),
  ('cat_desks',       'desks',       'Desks',       'Standing and fixed desks for every room size.',           1),
  ('cat_chairs',      'chairs',      'Chairs',      'Ergonomic seating that survives eight-hour days.',        2),
  ('cat_monitors',    'monitors',    'Monitors',    '4K, ultrawide and portable displays with USB-C power.',   3),
  ('cat_lighting',    'lighting',    'Lighting',    'Key lights, lamps and ambience for calls and focus.',     4),
  ('cat_accessories', 'accessories', 'Accessories', 'Keyboards, pointers, hubs and the small stuff that matters.', 5)
ON CONFLICT (id) DO UPDATE SET
  slug        = excluded.slug,
  name        = excluded.name,
  description = excluded.description,
  sort_order  = excluded.sort_order,
  updated_at  = unixepoch() * 1000;

-- ---------------------------------------------------------------------------
-- Products. Upserted, never deleted — cart_items and rental_items hold
-- `ON DELETE RESTRICT` foreign keys to products.
-- ---------------------------------------------------------------------------

INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status) VALUES
  -- Desks (4)
  ('prd_smartdesk_pro',      'smartdesk-pro',        'SmartDesk Pro',          'Electric standing desk with memory presets',    'A dual-motor standing desk that moves from sitting to standing in seconds. Four memory presets, a quiet motor and a cable tray keep long sessions comfortable and tidy.',            'cat_desks',       'Most rented', 1, 'active'),
  ('prd_smartdesk_compact',  'smartdesk-compact',    'SmartDesk Compact',      'Manual standing desk for small rooms',          'A crank-driven standing desk sized for studio apartments and villa corners. Solid feet, no wobble, no outlet needed.',                                                              'cat_desks',       NULL,           0, 'active'),
  ('prd_oak_writing_desk',   'oak-writing-desk',     'Oak Writing Desk',       'Solid oak fixed-height desk',                   'A simple solid-oak writing desk with two cable grommets. Fixed height, warm wood, zero setup noise.',                                                                                'cat_desks',       NULL,           0, 'active'),
  ('prd_corner_l_desk',      'corner-l-desk',        'Corner L-Desk',          'L-shaped desk for full command centers',        'An L-shaped corner desk with a 140 cm main wing. Fits dual-monitor rigs and the rest of the setup without crowding.',                                                                'cat_desks',       NULL,           0, 'active'),
  -- Chairs (5)
  ('prd_ergonomic_task_chair','ergonomic-task-chair','Ergonomic Task Chair',    'Mesh-back chair with 4D armrests',              'A breathable mesh task chair with adjustable lumbar support, 4D armrests and a reclining back. The chair most of our customers renew week after week.',                              'cat_chairs',      'Most rented', 1, 'active'),
  ('prd_lumbar_pro_chair',   'lumbar-pro-chair',     'Lumbar Pro Chair',       'Full ergonomic chair with headrest',            'A fully loaded ergonomic chair: dynamic lumbar support, adjustable headrest, seat-depth slider and smooth casters for hard floors.',                                                 'cat_chairs',      NULL,           0, 'active'),
  ('prd_light_travel_chair', 'light-travel-chair',   'Light Travel Chair',     '6 kg foldable task chair',                      'A surprisingly supportive task chair that folds into a travel bag. For short stays and shared villas where space is tight.',                                                          'cat_chairs',      NULL,           0, 'active'),
  ('prd_saddle_stool',       'saddle-stool',         'Saddle Stool',           'Open-hip seating for active sitters',           'A saddle stool that keeps your hips open and your back upright. A favorite for standing-desk users who alternate posture.',                                                          'cat_chairs',      NULL,           0, 'active'),
  ('prd_kneeling_chair',     'kneeling-chair',       'Kneeling Chair',         'Posture chair without a backrest',              'A kneeling chair that tilts your pelvis and takes pressure off the lower back. Odd at first, loved by week two.',                                                                     'cat_chairs',      NULL,           0, 'active'),
  -- Monitors (6)
  ('prd_ultrasharp_27_4k',   'ultrasharp-27-4k',     'UltraSharp 27" 4K',      '27-inch 4K IPS with 90 W USB-C',                'A 27-inch 4K IPS display with factory-calibrated color and a single USB-C cable that powers your laptop at 90 W while it drives the screen.',                                         'cat_monitors',    'Most rented', 1, 'active'),
  ('prd_studio_display_27',  'studio-display-27',    'Studio Display 27"',     '5K display with built-in 12 MP camera',         'A 27-inch 5K display with studio-grade speakers and a 12 MP center-stage camera. The centerpiece of the studio setup.',                                                               'cat_monitors',    'New',          0, 'active'),
  ('prd_portable_15_oled',   'portable-15-oled',     'Portable 15" OLED',      '15.6-inch OLED travel display',                 'A 15.6-inch 1080p OLED panel that runs off a single USB-C port and slips into a laptop sleeve. Second-screen work from anywhere.',                                                    'cat_monitors',    NULL,           0, 'active'),
  ('prd_ultrawide_34',       'ultrawide-34',         'UltraWide 34"',          '34-inch curved ultrawide QHD',                  'A 34-inch curved ultrawide with a 100 Hz refresh rate. Timeline editing, spreadsheets and split-screen calls without a second monitor.',                                             'cat_monitors',    NULL,           0, 'active'),
  ('prd_standard_24',        'standard-24',          'Standard 24" IPS',       '24-inch 1080p everyday display',                'A reliable 24-inch 1080p IPS display with a height-adjustable stand. The sensible choice for a second screen.',                                                                       'cat_monitors',    NULL,           0, 'active'),
  ('prd_27_1440_ips',        '27-1440-ips',          '27" 1440p IPS',          '27-inch QHD IPS display',                       'A 27-inch 1440p IPS display with thin bezels and a flicker-free panel. Sharp enough for long writing sessions.',                                                                       'cat_monitors',    NULL,           0, 'active'),
  -- Lighting (6)
  ('prd_arc_floor_lamp',     'arc-floor-lamp',       'Arc Floor Lamp',         'Dimmable arc lamp in warm white',               'A tall arc floor lamp that reaches over any desk without a clamp. Dimmable from bright work light to warm evening glow.',                                                             'cat_lighting',    NULL,           1, 'active'),
  ('prd_desk_lamp',          'desk-lamp',            'Desk Lamp',              'Clamp-on lamp with adjustable arm',             'A clamp-on desk lamp with a weighted arm and three color temperatures. Clamps to desks up to 6 cm thick.',                                                                             'cat_lighting',    NULL,           0, 'active'),
  ('prd_ring_light_12',      'ring-light-12',        'Ring Light 12"',         '12-inch ring light with desk mount',            'A 12-inch ring light with a desk clamp and stepless brightness. Even, flattering light for calls in the evening hours.',                                                              'cat_lighting',    NULL,           0, 'active'),
  ('prd_led_strip_light',    'led-strip-light',      'LED Strip Light',        '5 m ambient strip with warm preset',            'A 5-meter addressable LED strip with a warm-white preset that flatters wood rooms instead of turning them into a spaceship.',                                                         'cat_lighting',    NULL,           0, 'active'),
  ('prd_clip_reading_light', 'clip-reading-light',   'Clip Reading Light',     'Small clip light for late pages',               'A palm-sized clip light for reading rigs and bunk-bed desks. Warm and cool modes, USB-C rechargeable.',                                                                                'cat_lighting',    NULL,           0, 'active'),
  ('prd_smart_bulb_kit',     'smart-bulb-kit',       'Smart Bulb Kit',         'Two smart bulbs with scene presets',            'Two smart bulbs and a simple scene remote. Set a daylight scene for work and a candle scene for the evening without touching an app.',                                                'cat_lighting',    NULL,           0, 'active'),
  -- Accessories (7)
  ('prd_low_profile_keyboard','low-profile-keyboard','Low-Profile Keyboard',   'Wireless full-size keyboard',                   'A wireless full-size low-profile keyboard with quiet scissor switches and a three-device Bluetooth toggle.',                                                                          'cat_accessories', NULL,           0, 'active'),
  ('prd_mx_master_3s',       'mx-master-3s',         'MX Master 3S',           '8K DPI silent-click productivity mouse',        'The productivity mouse: 8K DPI tracking, silent clicks, a MagSpeed scroll wheel and per-app button mapping across three devices.',                                                    'cat_accessories', NULL,           0, 'active'),
  ('prd_usb_c_hub',          'usb-c-hub',            'USB-C Hub',              'USB-C 100 W passthrough, 7-in-1',               'A seven-in-one USB-C hub with 100 W passthrough, dual 4K HDMI out, gigabit ethernet and SD/microSD. One cable to rule the desk.',                                                     'cat_accessories', NULL,           0, 'active'),
  ('prd_monitor_riser',      'monitor-riser',        'Monitor Riser',          'Tempered-glass riser, 27" capacity',            'A tempered-glass monitor riser that lifts any display to eye level and swallows a keyboard underneath when you stand.',                                                               'cat_accessories', NULL,           0, 'active'),
  ('prd_studio_webcam_4k',   'studio-webcam-4k',     'Studio Webcam 4K',       '4K webcam with auto-framing',                   'A 4K webcam with auto-framing, on-device exposure and a privacy shutter. Mounts on any monitor or the included tripod.',                                                              'cat_accessories', NULL,           0, 'active'),
  ('prd_power_strip_727',    'power-strip-727',      'Power Strip 727',        '6 outlets, surge protected',                    'A surge-protected power strip with six outlets, two USB-A and two USB-C ports. Long enough to reach any villa outlet.',                                                               'cat_accessories', NULL,           0, 'active'),
  ('prd_laptop_riser',       'laptop-riser',         'Laptop Riser',           'Aluminum adjustable laptop stand',              'A foldable aluminum laptop stand with six height steps and silicone pads. Packs flat for island-hopping.',                                                                            'cat_accessories', NULL,           0, 'active'),
  -- Setups (3): the ready-made desks shown in the Storefront design.
  ('prd_setup_full',         'setup-full',           'The full setup',         'The whole desk, delivered and assembled',       'Everything you need on day one: the SmartDesk Pro, the Ergonomic Task Chair and the UltraSharp 27" 4K. We deliver, assemble and take the packaging with us.',                          'cat_setups',      'Best value',   1, 'active'),
  ('prd_setup_focus',        'setup-focus',          'The focus setup',        'Desk, keyboard and mouse, ready to write',      'A minimal kit for writers and developers: the SmartDesk Pro, the Low-Profile Keyboard and the MX Master 3S. Delivered and set up within 24 hours.',                                    'cat_setups',      NULL,           0, 'active'),
  ('prd_setup_studio',       'setup-studio',         'The studio setup',       'Camera-first kit for people on video',          'For creators and calls-heavy weeks: the Studio Display 27", the Studio Webcam 4K, the USB-C Hub and the Monitor Riser. Light it up and go live.',                                      'cat_setups',      NULL,           0, 'active')
ON CONFLICT (id) DO UPDATE SET
  slug        = excluded.slug,
  name        = excluded.name,
  tagline     = excluded.tagline,
  description = excluded.description,
  category_id = excluded.category_id,
  badge       = excluded.badge,
  featured    = excluded.featured,
  status      = excluded.status,
  updated_at  = unixepoch() * 1000;

-- ---------------------------------------------------------------------------
-- Photos. One real photo per product, in display order. Paths point at the
-- storefront's public asset directory (uploaded to R2 before launch).
-- ---------------------------------------------------------------------------

INSERT INTO product_images (product_id, position, url, alt) VALUES
  ('prd_smartdesk_pro',       0, '/products/smartdesk-pro-1.jpg',        'SmartDesk Pro electric standing desk'),
  ('prd_smartdesk_compact',   0, '/products/smartdesk-compact-1.jpg',    'SmartDesk Compact manual standing desk'),
  ('prd_oak_writing_desk',    0, '/products/oak-writing-desk-1.jpg',     'Oak Writing Desk in a bright room'),
  ('prd_corner_l_desk',       0, '/products/corner-l-desk-1.jpg',        'Corner L-Desk with dual monitors'),
  ('prd_ergonomic_task_chair',0, '/products/ergonomic-task-chair-1.jpg', 'Ergonomic Task Chair, three-quarter view'),
  ('prd_lumbar_pro_chair',    0, '/products/lumbar-pro-chair-1.jpg',     'Lumbar Pro Chair with headrest'),
  ('prd_light_travel_chair',  0, '/products/light-travel-chair-1.jpg',   'Light Travel Chair folded next to a backpack'),
  ('prd_saddle_stool',        0, '/products/saddle-stool-1.jpg',         'Saddle Stool at a standing desk'),
  ('prd_kneeling_chair',      0, '/products/kneeling-chair-1.jpg',       'Kneeling Chair in a home office'),
  ('prd_ultrasharp_27_4k',    0, '/products/ultrasharp-27-4k-1.jpg',     'UltraSharp 27" 4K display on a riser'),
  ('prd_studio_display_27',   0, '/products/studio-display-27-1.jpg',    'Studio Display 27" with webcam on top'),
  ('prd_portable_15_oled',    0, '/products/portable-15-oled-1.jpg',     'Portable 15" OLED next to a laptop'),
  ('prd_ultrawide_34',        0, '/products/ultrawide-34-1.jpg',         'UltraWide 34" curved display'),
  ('prd_standard_24',         0, '/products/standard-24-1.jpg',          'Standard 24" IPS display'),
  ('prd_27_1440_ips',         0, '/products/27-1440-ips-1.jpg',          '27" 1440p IPS display'),
  ('prd_arc_floor_lamp',      0, '/products/arc-floor-lamp-1.jpg',       'Arc Floor Lamp reaching over a desk'),
  ('prd_desk_lamp',           0, '/products/desk-lamp-1.jpg',            'Desk Lamp clamped to a desk edge'),
  ('prd_ring_light_12',       0, '/products/ring-light-12-1.jpg',        'Ring Light 12" on a desk clamp'),
  ('prd_led_strip_light',     0, '/products/led-strip-light-1.jpg',      'LED Strip Light behind a monitor'),
  ('prd_clip_reading_light',  0, '/products/clip-reading-light-1.jpg',   'Clip Reading Light on a book'),
  ('prd_smart_bulb_kit',      0, '/products/smart-bulb-kit-1.jpg',       'Smart Bulb Kit with remote'),
  ('prd_low_profile_keyboard',0, '/products/low-profile-keyboard-1.jpg', 'Low-Profile Keyboard on a desk'),
  ('prd_mx_master_3s',        0, '/products/mx-master-3s-1.jpg',         'MX Master 3S mouse'),
  ('prd_usb_c_hub',           0, '/products/usb-c-hub-1.jpg',            'USB-C Hub with cables attached'),
  ('prd_monitor_riser',       0, '/products/monitor-riser-1.jpg',        'Monitor Riser with keyboard underneath'),
  ('prd_studio_webcam_4k',    0, '/products/studio-webcam-4k-1.jpg',     'Studio Webcam 4K on a monitor'),
  ('prd_power_strip_727',     0, '/products/power-strip-727-1.jpg',      'Power Strip 727 on the floor'),
  ('prd_laptop_riser',        0, '/products/laptop-riser-1.jpg',         'Laptop Riser holding a laptop'),
  ('prd_setup_full',          0, '/products/setup-full-1.jpg',           'The full setup in a villa bedroom'),
  ('prd_setup_focus',         0, '/products/setup-focus-1.jpg',          'The focus setup by a window'),
  ('prd_setup_studio',        0, '/products/setup-studio-1.jpg',         'The studio setup with display and webcam')
ON CONFLICT (product_id, position) DO UPDATE SET
  url = excluded.url,
  alt = excluded.alt;

-- ---------------------------------------------------------------------------
-- Marketing highlights, in display order.
-- ---------------------------------------------------------------------------

INSERT INTO product_highlights (product_id, position, value) VALUES
  ('prd_smartdesk_pro',        0, 'Dual motors, four memory presets'),
  ('prd_smartdesk_pro',        1, '120 × 70 cm surface with cable tray'),
  ('prd_smartdesk_pro',        2, 'Delivered assembled and removed on return'),
  ('prd_smartdesk_compact',    0, 'Manual crank — no outlet needed'),
  ('prd_smartdesk_compact',    1, 'Fits 100 × 60 cm of floor'),
  ('prd_smartdesk_compact',    2, 'Solid feet, zero wobble'),
  ('prd_oak_writing_desk',     0, 'Solid oak, not veneer'),
  ('prd_oak_writing_desk',     1, 'Two cable grommets'),
  ('prd_oak_writing_desk',     2, '110 × 55 cm fixed height'),
  ('prd_corner_l_desk',        0, '140 cm main wing + 100 cm return'),
  ('prd_corner_l_desk',        1, 'Fits dual-monitor command centers'),
  ('prd_corner_l_desk',        2, 'Reversible for left- or right-hand corners'),
  ('prd_ergonomic_task_chair', 0, 'Mesh back · 4D arms'),
  ('prd_ergonomic_task_chair', 1, 'Adjustable lumbar and seat depth'),
  ('prd_ergonomic_task_chair', 2, 'Reclines to 135° for reading breaks'),
  ('prd_lumbar_pro_chair',     0, 'Dynamic lumbar support'),
  ('prd_lumbar_pro_chair',     1, 'Adjustable headrest'),
  ('prd_lumbar_pro_chair',     2, 'Hard-floor casters included'),
  ('prd_light_travel_chair',   0, '6 kg, folds into a travel bag'),
  ('prd_light_travel_chair',   1, 'Surprisingly supportive for its weight'),
  ('prd_light_travel_chair',   2, 'Sets up in under a minute'),
  ('prd_saddle_stool',         0, 'Open-hip posture'),
  ('prd_saddle_stool',         1, 'Gas-lift height adjust'),
  ('prd_saddle_stool',         2, 'Pairs well with standing desks'),
  ('prd_kneeling_chair',       0, 'Takes pressure off the lower back'),
  ('prd_kneeling_chair',       1, 'Ash wood frame'),
  ('prd_kneeling_chair',       2, 'Ideal posture-break chair'),
  ('prd_ultrasharp_27_4k',     0, '4K · USB-C 90 W'),
  ('prd_ultrasharp_27_4k',     1, 'One cable powers your laptop'),
  ('prd_ultrasharp_27_4k',     2, 'Factory-calibrated color'),
  ('prd_studio_display_27',    0, '5K · 12 MP camera'),
  ('prd_studio_display_27',    1, 'Studio-grade speakers'),
  ('prd_studio_display_27',    2, 'Center Stage keeps you in frame'),
  ('prd_portable_15_oled',     0, '15.6" OLED · single USB-C'),
  ('prd_portable_15_oled',     1, 'Fits a laptop sleeve'),
  ('prd_portable_15_oled',     2, 'Includes a magnetic cover stand'),
  ('prd_ultrawide_34',         0, '34" curved · 100 Hz'),
  ('prd_ultrawide_34',         1, 'Split-screen calls without a second screen'),
  ('prd_ultrawide_34',         2, 'VESA mount ready'),
  ('prd_standard_24',          0, '24" 1080p IPS'),
  ('prd_standard_24',          1, 'Height-adjustable stand'),
  ('prd_standard_24',          2, 'The sensible second screen'),
  ('prd_27_1440_ips',          0, '27" QHD IPS'),
  ('prd_27_1440_ips',          1, 'Flicker-free panel'),
  ('prd_27_1440_ips',          2, 'Thin bezels, easy dual setup'),
  ('prd_arc_floor_lamp',       0, 'Dimmable · warm white'),
  ('prd_arc_floor_lamp',       1, 'Reaches over the desk — no clamp'),
  ('prd_arc_floor_lamp',       2, 'Marble base, stays put'),
  ('prd_desk_lamp',            0, 'Clamps to desks up to 6 cm'),
  ('prd_desk_lamp',            1, 'Three color temperatures'),
  ('prd_desk_lamp',            2, 'Weighted, adjustable arm'),
  ('prd_ring_light_12',        0, '12" ring · stepless brightness'),
  ('prd_ring_light_12',        1, 'Desk clamp included'),
  ('prd_ring_light_12',        2, 'Even light for evening calls'),
  ('prd_led_strip_light',      0, '5 m addressable strip'),
  ('prd_led_strip_light',      1, 'Warm-white preset, not spaceship mode'),
  ('prd_led_strip_light',      2, 'Adhesive backing, removes clean'),
  ('prd_clip_reading_light',   0, 'Warm and cool modes'),
  ('prd_clip_reading_light',   1, 'USB-C rechargeable'),
  ('prd_clip_reading_light',   2, 'Clips to any shelf or headboard'),
  ('prd_smart_bulb_kit',       0, 'Two bulbs + scene remote'),
  ('prd_smart_bulb_kit',       1, 'Daylight and candle scenes'),
  ('prd_smart_bulb_kit',       2, 'No app required'),
  ('prd_low_profile_keyboard', 0, 'Wireless · full-size'),
  ('prd_low_profile_keyboard', 1, 'Quiet scissor switches'),
  ('prd_low_profile_keyboard', 2, 'Three-device Bluetooth toggle'),
  ('prd_mx_master_3s',         0, '8K DPI · silent clicks'),
  ('prd_mx_master_3s',         1, 'MagSpeed scroll wheel'),
  ('prd_mx_master_3s',         2, 'Pairs with three devices'),
  ('prd_usb_c_hub',            0, 'USB-C · 100 W passthrough'),
  ('prd_usb_c_hub',            1, 'Dual 4K HDMI + gigabit ethernet'),
  ('prd_usb_c_hub',            2, 'SD and microSD slots'),
  ('prd_monitor_riser',        0, 'Tempered glass · 27" capacity'),
  ('prd_monitor_riser',        1, 'Keyboard stows underneath'),
  ('prd_monitor_riser',        2, 'Lifts any display to eye level'),
  ('prd_studio_webcam_4k',     0, '4K · auto-framing'),
  ('prd_studio_webcam_4k',     1, 'Privacy shutter'),
  ('prd_studio_webcam_4k',     2, 'Monitor mount and mini tripod'),
  ('prd_power_strip_727',      0, '6 outlets · surge protected'),
  ('prd_power_strip_727',      1, 'Two USB-A and two USB-C ports'),
  ('prd_power_strip_727',      2, 'Long cord for villa layouts'),
  ('prd_laptop_riser',         0, 'Aluminum · adjustable'),
  ('prd_laptop_riser',         1, 'Six height steps'),
  ('prd_laptop_riser',         2, 'Packs flat for travel'),
  ('prd_setup_full',           0, 'SmartDesk Pro · Task chair · 27" 4K display'),
  ('prd_setup_full',           1, 'Delivered and set up in 24 hours'),
  ('prd_setup_full',           2, 'One price, one delivery, no assembly'),
  ('prd_setup_focus',          0, 'SmartDesk Pro · Ergo keyboard · Mouse'),
  ('prd_setup_focus',          1, 'Minimal kit for writers and developers'),
  ('prd_setup_focus',          2, 'Working by the first coffee'),
  ('prd_setup_studio',         0, 'Studio Display 27" · Webcam · Hub · Riser'),
  ('prd_setup_studio',         1, 'Camera-first kit for creators'),
  ('prd_setup_studio',         2, 'Light it up and go live')
ON CONFLICT (product_id, position) DO UPDATE SET
  value = excluded.value;

-- ---------------------------------------------------------------------------
-- Specifications, in display order.
-- ---------------------------------------------------------------------------

INSERT INTO product_specs (product_id, position, label, value) VALUES
  ('prd_smartdesk_pro',        0, 'Type',        'Electric standing'),
  ('prd_smartdesk_pro',        1, 'Surface',     '120 × 70 cm'),
  ('prd_smartdesk_pro',        2, 'Load',        'up to 100 kg'),
  ('prd_smartdesk_compact',    0, 'Type',        'Manual standing'),
  ('prd_smartdesk_compact',    1, 'Surface',     '100 × 60 cm'),
  ('prd_smartdesk_compact',    2, 'Load',        'up to 60 kg'),
  ('prd_oak_writing_desk',     0, 'Type',        'Fixed height'),
  ('prd_oak_writing_desk',     1, 'Surface',     '110 × 55 cm'),
  ('prd_oak_writing_desk',     2, 'Material',    'Solid oak'),
  ('prd_corner_l_desk',        0, 'Type',        'Fixed L-shape'),
  ('prd_corner_l_desk',        1, 'Surface',     '140 × 140 cm'),
  ('prd_corner_l_desk',        2, 'Reversible',  'Yes'),
  ('prd_ergonomic_task_chair', 0, 'Back',        'Breathable mesh'),
  ('prd_ergonomic_task_chair', 1, 'Armrests',    '4D adjustable'),
  ('prd_ergonomic_task_chair', 2, 'Recline',     'up to 135°'),
  ('prd_lumbar_pro_chair',     0, 'Lumbar',      'Dynamic adjustable'),
  ('prd_lumbar_pro_chair',     1, 'Headrest',    'Height and angle'),
  ('prd_lumbar_pro_chair',     2, 'Seat depth',  'Sliding, 40–46 cm'),
  ('prd_light_travel_chair',   0, 'Weight',      '6 kg'),
  ('prd_light_travel_chair',   1, 'Folds',       'Into included bag'),
  ('prd_light_travel_chair',   2, 'Max load',    '110 kg'),
  ('prd_saddle_stool',         0, 'Type',        'Saddle seat'),
  ('prd_saddle_stool',         1, 'Height',      'Gas lift, 50–70 cm'),
  ('prd_saddle_stool',         2, 'Tilt',        'Forward 15°'),
  ('prd_kneeling_chair',       0, 'Type',        'Kneeling, backless'),
  ('prd_kneeling_chair',       1, 'Frame',       'Ash wood'),
  ('prd_kneeling_chair',       2, 'Padding',     'Memory foam'),
  ('prd_ultrasharp_27_4k',     0, 'Panel',       '27" 4K IPS'),
  ('prd_ultrasharp_27_4k',     1, 'USB-C',       '90 W power delivery'),
  ('prd_ultrasharp_27_4k',     2, 'Stand',       'Height, tilt, swivel, pivot'),
  ('prd_studio_display_27',    0, 'Panel',       '27" 5K'),
  ('prd_studio_display_27',    1, 'Camera',      '12 MP center stage'),
  ('prd_studio_display_27',    2, 'Speakers',    'Six-speaker system'),
  ('prd_portable_15_oled',     0, 'Panel',       '15.6" 1080p OLED'),
  ('prd_portable_15_oled',     1, 'Power',       'Single USB-C'),
  ('prd_portable_15_oled',     2, 'Weight',      '0.9 kg'),
  ('prd_ultrawide_34',         0, 'Panel',       '34" curved QHD'),
  ('prd_ultrawide_34',         1, 'Refresh',     '100 Hz'),
  ('prd_ultrawide_34',         2, 'Mount',       'VESA 100'),
  ('prd_standard_24',         0, 'Panel',       '24" 1080p IPS'),
  ('prd_standard_24',         1, 'Stand',       'Height adjustable'),
  ('prd_standard_24',         2, 'Ports',       'HDMI, DisplayPort, VGA'),
  ('prd_27_1440_ips',          0, 'Panel',       '27" 1440p IPS'),
  ('prd_27_1440_ips',          1, 'Refresh',     '75 Hz'),
  ('prd_27_1440_ips',          2, 'Ports',       'HDMI, DisplayPort, USB-C 15 W'),
  ('prd_arc_floor_lamp',       0, 'Height',      '180 cm, 90 cm reach'),
  ('prd_arc_floor_lamp',       1, 'Dimming',     'Stepless, warm white'),
  ('prd_arc_floor_lamp',       2, 'Base',        'Marble'),
  ('prd_desk_lamp',            0, 'Mount',       'Clamp up to 6 cm'),
  ('prd_desk_lamp',            1, 'Temperature', '3 modes'),
  ('prd_desk_lamp',            2, 'Brightness',  '10 levels'),
  ('prd_ring_light_12',        0, 'Size',        '12" ring'),
  ('prd_ring_light_12',        1, 'Mount',       'Desk clamp'),
  ('prd_ring_light_12',        2, 'Brightness',  'Stepless'),
  ('prd_led_strip_light',      0, 'Length',      '5 m'),
  ('prd_led_strip_light',      1, 'Control',     'App and remote'),
  ('prd_led_strip_light',      2, 'Adhesive',    'Removable 3M backing'),
  ('prd_clip_reading_light',   0, 'Modes',       'Warm / cool'),
  ('prd_clip_reading_light',   1, 'Battery',     'USB-C rechargeable'),
  ('prd_clip_reading_light',   2, 'Runtime',     'up to 12 h'),
  ('prd_smart_bulb_kit',       0, 'Contents',    '2 bulbs + remote'),
  ('prd_smart_bulb_kit',       1, 'Socket',      'E27'),
  ('prd_smart_bulb_kit',       2, 'Scenes',      'Daylight, candle, focus'),
  ('prd_low_profile_keyboard', 0, 'Layout',      'Full-size'),
  ('prd_low_profile_keyboard', 1, 'Switches',    'Quiet scissor'),
  ('prd_low_profile_keyboard', 2, 'Connect',     'Bluetooth ×3 or USB'),
  ('prd_mx_master_3s',         0, 'Tracking',    '8K DPI'),
  ('prd_mx_master_3s',         1, 'Clicks',      'Silent tactile'),
  ('prd_mx_master_3s',         2, 'Battery',     '70 days per charge'),
  ('prd_usb_c_hub',            0, 'Ports',       '7-in-1'),
  ('prd_usb_c_hub',            1, 'Passthrough', '100 W'),
  ('prd_usb_c_hub',            2, 'Video',       'Dual 4K HDMI'),
  ('prd_monitor_riser',        0, 'Material',    'Tempered glass'),
  ('prd_monitor_riser',        1, 'Capacity',    'up to 27"'),
  ('prd_monitor_riser',        2, 'Load',        'up to 20 kg'),
  ('prd_studio_webcam_4k',     0, 'Resolution',  '4K'),
  ('prd_studio_webcam_4k',     1, 'Framing',     'Auto'),
  ('prd_studio_webcam_4k',     2, 'Privacy',     'Physical shutter'),
  ('prd_power_strip_727',      0, 'Outlets',     '6'),
  ('prd_power_strip_727',      1, 'USB',         '2× A, 2× C'),
  ('prd_power_strip_727',      2, 'Protection',  'Surge 1080 J'),
  ('prd_laptop_riser',         0, 'Material',    'Aluminum'),
  ('prd_laptop_riser',         1, 'Heights',     '6 steps'),
  ('prd_laptop_riser',         2, 'Folds',       'Flat, 0.5 kg'),
  ('prd_setup_full',           0, 'Includes',    'SmartDesk Pro, Ergonomic Task Chair, UltraSharp 27" 4K'),
  ('prd_setup_full',           1, 'Delivery',    'Assembled within 24 h'),
  ('prd_setup_full',           2, 'Swap',        'Any component swap on request'),
  ('prd_setup_focus',          0, 'Includes',    'SmartDesk Pro, Low-Profile Keyboard, MX Master 3S'),
  ('prd_setup_focus',          1, 'Delivery',    'Assembled within 24 h'),
  ('prd_setup_focus',          2, 'Swap',        'Chair upgrade available'),
  ('prd_setup_studio',         0, 'Includes',    'Studio Display 27", Studio Webcam 4K, USB-C Hub, Monitor Riser'),
  ('prd_setup_studio',         1, 'Delivery',    'Assembled within 24 h'),
  ('prd_setup_studio',         2, 'Swap',        'Desk add-on available')
ON CONFLICT (product_id, position) DO UPDATE SET
  label = excluded.label,
  value = excluded.value;

-- ---------------------------------------------------------------------------
-- Weekly prices per city.
--
-- Each product has a base weekly price and stock. City factors turn the base
-- into local prices (rounded to the nearest 50 cents): Bali is the base,
-- Chiang Mai and Da Nang run slightly cheaper, Lisbon slightly higher. The
-- deposit is 25% of the local weekly price, rounded to the nearest cent.
-- Every product is offered in all four launch cities.
-- ---------------------------------------------------------------------------

WITH bases(product_id, weekly, stock) AS (
  VALUES
    ('prd_smartdesk_pro',        1200, 4),
    ('prd_smartdesk_compact',     900, 3),
    ('prd_oak_writing_desk',      700, 3),
    ('prd_corner_l_desk',        1100, 2),
    ('prd_ergonomic_task_chair',  900, 5),
    ('prd_lumbar_pro_chair',     1200, 3),
    ('prd_light_travel_chair',    500, 4),
    ('prd_saddle_stool',          600, 2),
    ('prd_kneeling_chair',        500, 2),
    ('prd_ultrasharp_27_4k',      700, 6),
    ('prd_studio_display_27',    1500, 4),
    ('prd_portable_15_oled',      600, 5),
    ('prd_ultrawide_34',         1200, 2),
    ('prd_standard_24',           400, 6),
    ('prd_27_1440_ips',           500, 4),
    ('prd_arc_floor_lamp',        300, 6),
    ('prd_desk_lamp',             200, 8),
    ('prd_ring_light_12',         300, 5),
    ('prd_led_strip_light',       200, 8),
    ('prd_clip_reading_light',    100, 10),
    ('prd_smart_bulb_kit',        300, 6),
    ('prd_low_profile_keyboard',  200, 8),
    ('prd_mx_master_3s',          200, 8),
    ('prd_usb_c_hub',             400, 6),
    ('prd_monitor_riser',         200, 6),
    ('prd_studio_webcam_4k',      300, 5),
    ('prd_power_strip_727',       300, 8),
    ('prd_laptop_riser',          200, 8),
    ('prd_setup_full',           2500, 2),
    -- Focus setup: $1 under the sum of its parts (desk + keyboard + mouse =
    -- $16 base), so every setup stays cheaper than booking its pieces
    -- separately, like the full and studio setups.
    ('prd_setup_focus',          1500, 2),
    ('prd_setup_studio',         2100, 2)
),
cities(slug, factor) AS (
  VALUES
    ('bali',       1.0),
    ('chiang-mai', 0.9),
    ('da-nang',    0.9),
    ('lisbon',     1.1)
),
local_prices(product_id, location_id, weekly_price, stock) AS (
  SELECT
    b.product_id,
    l.id,
    CAST(ROUND(b.weekly * c.factor / 50.0) * 50 AS INTEGER),
    b.stock
  FROM bases b
  CROSS JOIN cities c
  JOIN locations l ON l.slug = c.slug
)
INSERT INTO product_prices (product_id, location_id, weekly_price, deposit, stock, created_at)
SELECT
  product_id,
  location_id,
  weekly_price,
  CAST(ROUND(weekly_price * 0.25) AS INTEGER),
  stock,
  unixepoch() * 1000
FROM local_prices
WHERE true
ON CONFLICT (product_id, location_id) DO UPDATE SET
  weekly_price = excluded.weekly_price,
  deposit      = excluded.deposit,
  stock        = excluded.stock,
  updated_at   = unixepoch() * 1000;
