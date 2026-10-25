-- Async catalog seed - the real starting stock.
--
-- Source: the monis.rent product export curated to 25 workspace items.
-- Every product keeps at most two photos. The files are downloaded to
-- products/images/ and referenced by their site path (/products/images/<sequence>.jpg);
-- they are uploaded to the R2 bucket from there, so only the path prefix changes.
-- The bucket is `async-rent-products` and the objects live under the
-- `products/images/` key prefix, matching the site paths below. No worker binds
-- that bucket yet - the storefront that will serve the photos is still to come.
-- Prices keep the currency of the sheet they come from. The Bali and Chiang Mai
-- sheets are priced in USD, the Lisbon sheet is priced in EUR (monis.rent's
-- Lisbon merchant declares EUR), so the Lisbon rows carry `EUR` and nothing is
-- converted. Da Nang has no published price sheet yet, so its weekly price,
-- deposit and delivery fee mirror Chiang Mai where the product is listed there,
-- Bali next, and the product's first listed city as a last resort - in the
-- currency of the city they mirror; replace them once the real Da Nang sheet
-- exists. A product keeps only the cities it is really offered in.
--
-- Applied with `wrangler d1 execute` after the schema migrations, on purpose
-- outside migration tracking, e.g.:
--
--   wrangler d1 migrations apply async-rent --local
--   wrangler d1 execute async-rent --local --file=packages/db/seed.sql
--
-- The four cities, nine categories and 25 products upsert by id, and each
-- product's photos, highlights, specs and prices are written fresh, so re-running
-- the file converges on exactly what is written here.

-- Curation map: the Async product slug on the left is built from the monis.rent
-- export slugs on the right (one per city; `-lb` is Lisbon, `-cm` Chiang Mai).
--   dual-motor-electric-standing-desk <- dual-motor-electric-standing-desk
--   adjustable-wooden-desk <- adjustable-wooden-desk, adjustable-wooden-desk-lb
--   electrical-adjustable-desk <- electrical-adjustable-desk, electrical-adjustable-desk-cm
--   ergonomic-office-chair <- ergonomic-office-chair
--   ergonomic-office-chair-anya <- ergonomic-office-chair-anya-cm
--   ergonomic-jaervfjaellet-office-chair <- ergonomic-jaervfjaellet-office-chair-lb
--   full-hd-office-24 <- full-hd-office-24
--   24-full-hd-office-monitor-a24i-2026 <- 24-full-hd-office-monitor-a24i-2026, 24-full-hd-office-monitor-a24i-2026-lb
--   24-full-hd-office-monitor-mp-251 <- 24-full-hd-office-monitor-mp-251-cm
--   27-work-monitor-a27i <- 27-work-monitor-a27i
--   27-full-hd-office-monitor-mr-400 <- 27-full-hd-office-monitor-mr-400-cm
--   4k-grading-monitor-27 <- 4k-grading-monitor-27
--   apple-studio-display <- apple-studio-display, apple-studio-display-lb
--   4-k-ultra-wide-34 <- 4-k-ultra-wide-34
--   adjustable-monitor-stand <- adjustable-monitor-stand, adjustable-monitor-stand-cm, adjustable-monitor-stand-lb
--   apple-magic-keyboard <- apple-magic-keyboard, apple-magic-keyboard-cm, apple-magic-keyboard-lb
--   logitech-mx-keyboard <- logitech-mx-keyboard, logitech-mx-keyboard-cm, logitech-mx-keyboard-lb
--   logitech-mx-master-mouse-s3 <- logitech-mx-master-mouse-s3, logitech-mx-master-mouse-s3-cm, logitech-mx-master-mouse-s3-lb
--   ergonomic-laptop-stand <- ergonomic-laptop-stand, ergonomic-laptop-stand-cm, ergonomic-laptop-stand-lb
--   display-docking-station <- display-docking-station
--   wi-fi-6-router-5-g <- wi-fi-6-router-5-g
--   smart-led-desk-lamp-1-s <- smart-led-desk-lamp-1-s, smart-led-desk-lamp-1-s-lb
--   metal-monitor-light-bar <- metal-monitor-light-bar, monitor-light-bar-cm, metal-monitor-light-bar-lb
--   apple-mac-mini-m4 <- apple-mac-mini-m4
--   apple-mac-studio <- apple-mac-studio

-- Cities ---------------------------------------------------------------
INSERT INTO locations (id, slug, name, country, timezone, description, status) VALUES ('loc_bali', 'bali', 'Bali', 'Indonesia', 'Asia/Makassar', 'The original Async city - desks, chairs and monitors delivered across Canggu, Seminyak and Ubud.', 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, country = excluded.country, timezone = excluded.timezone, description = excluded.description, status = excluded.status;
INSERT INTO locations (id, slug, name, country, timezone, description, status) VALUES ('loc_chiang-mai', 'chiang-mai', 'Chiang Mai', 'Thailand', 'Asia/Bangkok', 'Nomad HQ in the north - gear delivered across Nimman, Old City and Santitham.', 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, country = excluded.country, timezone = excluded.timezone, description = excluded.description, status = excluded.status;
INSERT INTO locations (id, slug, name, country, timezone, description, status) VALUES ('loc_da-nang', 'da-nang', 'Da Nang', 'Vietnam', 'Asia/Ho_Chi_Minh', 'Beach-side workspace set up for long stays along the Han River and My Khe.', 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, country = excluded.country, timezone = excluded.timezone, description = excluded.description, status = excluded.status;
INSERT INTO locations (id, slug, name, country, timezone, description, status) VALUES ('loc_lisbon', 'lisbon', 'Lisbon', 'Portugal', 'Europe/Lisbon', 'Europe''s nomad capital - setups delivered across Alfama, Baixa and Beato.', 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, country = excluded.country, timezone = excluded.timezone, description = excluded.description, status = excluded.status;

-- Categories -----------------------------------------------------------
INSERT INTO categories (id, slug, name, description, sort_order) VALUES ('cat_desks', 'desks', 'Desks', 'Standing and adjustable desks that survive a long work week.', 0)
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;
INSERT INTO categories (id, slug, name, description, sort_order) VALUES ('cat_chairs', 'chairs', 'Chairs', 'Ergonomic seating for eight-hour days.', 1)
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;
INSERT INTO categories (id, slug, name, description, sort_order) VALUES ('cat_monitors', 'monitors', 'Monitors', 'From a clean 24" work display to colour-grading 4K panels.', 2)
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;
INSERT INTO categories (id, slug, name, description, sort_order) VALUES ('cat_monitor-arms', 'monitor-arms', 'Monitor Arms', 'Stands and arms that put the screen at eye level.', 3)
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;
INSERT INTO categories (id, slug, name, description, sort_order) VALUES ('cat_keyboards', 'keyboards', 'Keyboards', 'Wireless and mechanical keyboards sized for travel.', 4)
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;
INSERT INTO categories (id, slug, name, description, sort_order) VALUES ('cat_accessories', 'accessories', 'Accessories', 'Mice, laptop stands, docks and the networking to tie it together.', 5)
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;
INSERT INTO categories (id, slug, name, description, sort_order) VALUES ('cat_lamps', 'lamps', 'Lamps', 'Desk and monitor lighting that is easy on the eyes.', 6)
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;
INSERT INTO categories (id, slug, name, description, sort_order) VALUES ('cat_computers', 'computers', 'Computers', 'Mac mini and Mac Studio towers ready to plug in.', 7)
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;
INSERT INTO categories (id, slug, name, description, sort_order) VALUES ('cat_plants', 'plants', 'Plants', 'Greenery to make a rental feel like home.', 8)
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;

-- Products -------------------------------------------------------------
INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status) VALUES ('prod_dual-motor-electric-standing-desk', 'dual-motor-electric-standing-desk', 'Dual-Motor Electric Standing Desk', 'Dual-motor electric height adjustment, 3-stage lifting columns, up to 120 kg load capacity, 36 mm/s lifting speed, heavy-duty steel frame, 18 mm scratch-resistant tabletop, professional sit-stand design, available in 120×70, 140×70 and 160×70 cm.', 'Meet our Monis Original Professional Dual-Motor Standing Desk, developed around the feedback and real-world needs of our customers. After setting up workspaces for remote professionals, developers, designers, and digital nomads, we wanted to create a standing desk that feels noticeably more solid, smooth, and professional than a typical adjustable desk.

The result is a premium dual-motor electric standing desk for rent, built for professionals who spend serious time at their workstation and care about stability, smooth movement, and everyday comfort. The synchronized dual-motor system and 3-stage lifting columns provide fast and controlled height adjustments at up to 36 mm per second, while the heavy-duty construction supports setups weighing up to 120 kg.

This is the desk we recommend when you want your temporary workspace to feel like a high-end permanent office. It is ideal for multi-monitor workstations, desktop computers, speakers, docking stations, studio equipment, and other professional setups where a basic desk simply does not deliver the same experience. The 18 mm scratch-resistant tabletop and generous 70 cm depth provide plenty of room for serious work without making the desk feel crowded.

Available in 120 × 70 cm, 140 × 70 cm, and 160 × 70 cm, each desk comes with a black heavy-duty frame, while tabletop colors may vary depending on availability. Whether you are building a home office, working remotely from a villa, or looking to rent a premium standing desk in Bali, this Monis-developed desk combines the flexibility of rental with the feel of a professional workstation.', 'cat_desks', NULL, 0, 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, tagline = excluded.tagline, description = excluded.description, category_id = excluded.category_id, badge = excluded.badge, featured = excluded.featured, status = excluded.status;
DELETE FROM product_images WHERE product_id = 'prod_dual-motor-electric-standing-desk';
DELETE FROM product_highlights WHERE product_id = 'prod_dual-motor-electric-standing-desk';
DELETE FROM product_specs WHERE product_id = 'prod_dual-motor-electric-standing-desk';
DELETE FROM product_prices WHERE product_id = 'prod_dual-motor-electric-standing-desk';
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_dual-motor-electric-standing-desk', 0, '/products/images/001.jpg', 'Dual-Motor Electric Standing Desk');
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_dual-motor-electric-standing-desk', 1, '/products/images/002.jpg', 'Dual-Motor Electric Standing Desk - view 2');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_dual-motor-electric-standing-desk', 0, 'Desk');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_dual-motor-electric-standing-desk', 0, 'MODEL', 'Monis Original');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_dual-motor-electric-standing-desk', 1, 'MOTOR SYSTEM', 'Dual-motor electric lifting system, synchronized movement, 3-stage lifting columns');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_dual-motor-electric-standing-desk', 2, 'HEIGHT ADJUSTMENT', 'Approx. 580–1230 mm frame height range, lifting speed up to 36 mm/s');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_dual-motor-electric-standing-desk', 3, 'LOAD CAPACITY', 'Up to 120 kg');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_dual-motor-electric-standing-desk', 4, 'TABLETOP', '18 mm scratch-resistant tabletop, 70 cm depth, tabletop color may vary depending on availability');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_dual-motor-electric-standing-desk', 5, 'FRAME & BUILD', 'Heavy-duty steel construction, black frame, designed for high stability at sitting and standing heights');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_dual-motor-electric-standing-desk', 'loc_bali', 'USD', 1600, '1000', '600');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_dual-motor-electric-standing-desk', 'loc_da-nang', 'USD', 1600, '1000', '600');
INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status) VALUES ('prod_adjustable-wooden-desk', 'adjustable-wooden-desk', 'Mechanical Adjustable Desk', 'Effortlessly adjust the height from 70-120cm, no electricity needed, available in two sizes: 120x70cm, 160x70cm', 'Revolutionize your workday with our top-of-the-line Mechanical Adjustable Desk, meticulously designed to bring flexibility, comfort, and productivity into your daily routine. Say goodbye to the discomfort of prolonged sitting and hello to a healthier, more dynamic work environment. With its seamless height-adjustment mechanism, you can effortlessly transition between sitting and standing positions, encouraging better posture, reducing back strain, and boosting energy levels throughout the day. 

Crafted with durability and style in mind, this desk is the perfect blend of form and function, making it an ideal addition to any home or office space. Its sleek, modern design complements any décor while offering plenty of workspace for all your needs, from computers and accessories to documents and personal touches. Built to last, our desk is constructed with high-quality materials that ensure stability and long-term use. 

Whether you''re tackling important projects, participating in virtual meetings, or simply planning your day, this adjustable desk adapts to your unique workflow, allowing you to work smarter, not harder. Embrace the freedom to customize your work style and transform your productivity like never before. Elevate your workspace today with the Mechanical Adjustable Desk – your ultimate partner for a healthier, more productive lifestyle.', 'cat_desks', NULL, 0, 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, tagline = excluded.tagline, description = excluded.description, category_id = excluded.category_id, badge = excluded.badge, featured = excluded.featured, status = excluded.status;
DELETE FROM product_images WHERE product_id = 'prod_adjustable-wooden-desk';
DELETE FROM product_highlights WHERE product_id = 'prod_adjustable-wooden-desk';
DELETE FROM product_specs WHERE product_id = 'prod_adjustable-wooden-desk';
DELETE FROM product_prices WHERE product_id = 'prod_adjustable-wooden-desk';
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_adjustable-wooden-desk', 0, '/products/images/003.jpg', 'Mechanical Adjustable Desk');
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_adjustable-wooden-desk', 1, '/products/images/004.jpg', 'Mechanical Adjustable Desk - in context');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_adjustable-wooden-desk', 0, 'Desk');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_adjustable-wooden-desk', 0, 'MODEL', 'Trotten');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_adjustable-wooden-desk', 1, 'DIMENSION', '120x70 cm, 160x80 cm, height adjustable between 70-120 cm, 120x60 non hight adjustable (Rexus RXD-121)');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_adjustable-wooden-desk', 2, 'MATERIAL', 'Particleboard (tabletop), Steel (underframe)');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_adjustable-wooden-desk', 3, 'COLOR', 'Color may vary depending on stock');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_adjustable-wooden-desk', 'loc_bali', 'USD', 1300, '2000', NULL);
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_adjustable-wooden-desk', 'loc_lisbon', 'EUR', 1600, '2000', '500');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_adjustable-wooden-desk', 'loc_da-nang', 'USD', 1300, '2000', NULL);
INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status) VALUES ('prod_electrical-adjustable-desk', 'electrical-adjustable-desk', 'Electrical Adjustable Desk', 'Electric height adjustment (70-118cm), smooth and quiet motor, spacious, durable tabletop, ergonomic sit-stand design, improves posture and circulation, available in three sizes.', 'Transform your workspace with our premium electric height-adjustable desk, designed to enhance your productivity, comfort, and overall well-being. Effortlessly switch between sitting and standing positions at the touch of a button, creating a healthier, more dynamic work environment. Say goodbye to back, neck, and shoulder strain while improving your posture, circulation, and energy throughout the day. Whether you''re a remote worker, busy professional, avid gamer, or creative mind, this desk adapts to your lifestyle, providing ergonomic support for today''s demands.

Available in four sizes (110x60 cm, 120x60 cm, 140x60 cm, and 140x70 cm), our desk offers a durable and spacious tabletop designed to accommodate your setup. The robust steel frame ensures excellent stability, even at its maximum height range of 70-118 cm, so you can work with confidence. Its whisper-quiet motor system provides smooth, seamless height adjustments for a distraction-free experience, while the modern design fits perfectly in any office or home setup. Created for performance and convenience, this desk empowers you to stay focused and comfortable all day long, whether you''re managing work projects, gaming sessions, or multitasking.

**Desk Sizes and Recommendations:**
- **110x60 cm and 120x60 cm:** These compact sizes are ideal for small rooms or workspaces where you need to prioritize space efficiency. Perfect for minimal setups like a single laptop or a 24" monitor with essential accessories.
- **140x60 cm:** A slightly larger option suitable for users who need extra room for a dual monitor setup with adequate accessory space.
- **140x70 cm:** The ultimate choice for professional setups. This size is best for comprehensive workstation needs, including dual or ultra-wide monitors, additional equipment, and maximum comfort. Ideal for professionals, gamers, or anyone looking for an ergonomic powerhouse. 

Choose the size that fits your needs and upgrade your workspace today with a desk built to support your goals.', 'cat_desks', NULL, 0, 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, tagline = excluded.tagline, description = excluded.description, category_id = excluded.category_id, badge = excluded.badge, featured = excluded.featured, status = excluded.status;
DELETE FROM product_images WHERE product_id = 'prod_electrical-adjustable-desk';
DELETE FROM product_highlights WHERE product_id = 'prod_electrical-adjustable-desk';
DELETE FROM product_specs WHERE product_id = 'prod_electrical-adjustable-desk';
DELETE FROM product_prices WHERE product_id = 'prod_electrical-adjustable-desk';
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_electrical-adjustable-desk', 0, '/products/images/005.jpg', 'Electrical Adjustable Desk - detail');
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_electrical-adjustable-desk', 1, '/products/images/006.jpg', 'Electrical Adjustable Desk - view 2');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_electrical-adjustable-desk', 0, 'Desk');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_electrical-adjustable-desk', 0, 'MODEL', 'WS414, GD914 or similar');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_electrical-adjustable-desk', 1, 'DIMENSION', '110x60cm, 120x60cm, 140x60cm, 140x70cm');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_electrical-adjustable-desk', 2, 'HEIGHT', 'Adjustable between 70-118cm');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_electrical-adjustable-desk', 3, 'MATERIAL', 'Particleboard (tabletop), Steel (underframe)');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_electrical-adjustable-desk', 4, 'COLOR', 'Color may vary depending on stock');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_electrical-adjustable-desk', 5, 'LOAD', '80kg max ');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_electrical-adjustable-desk', 'loc_bali', 'USD', 700, '1000', '800');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_electrical-adjustable-desk', 'loc_chiang-mai', 'USD', 1300, '2000', '1000');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_electrical-adjustable-desk', 'loc_da-nang', 'USD', 1300, '2000', '1000');
INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status) VALUES ('prod_ergonomic-office-chair', 'ergonomic-office-chair', 'Ergonomic Office Chair', 'Breathable mesh back, high-density molded foam seat, 4D adjustable armrests, adjustable headrest, height-adjustable lumbar support, multi-angle reclining backrest with lock, retractable leg rest, smooth 60mm silent casters, reinforced 5-star metal base, built-in coat hanger.', 'Experience ultimate comfort and support with this ergonomic office chair, designed for professionals, gamers, and remote workers who spend long hours seated. Built with a breathable mesh back, it ensures optimal airflow to keep you cool while providing excellent lumbar support for a healthier sitting posture.

The high-density molded foam seat offers plush yet firm support, maintaining its shape even after extended use. Featuring 4D adjustable armrests, this chair allows you to customize height, width, depth, and angle for perfect arm positioning, reducing strain on your shoulders and wrists.

For added comfort, the adjustable headrest provides neck support, while the height-adjustable lumbar support aligns naturally with your spine, preventing lower back discomfort. The multi-angle reclining backrest with a lock mechanism lets you effortlessly switch from an upright working position to a relaxed recline.

A retractable leg rest extends for moments of relaxation, while smooth 60mm silent casters ensure effortless movement across different surfaces. The reinforced 5-star metal base offers stability and durability, supporting long-term use. With a built-in coat hanger, you can keep your essentials within reach.

This ergonomic office chair is the perfect combination of comfort, functionality, and modern design—ideal for enhancing productivity and well-being in any workspace.', 'cat_chairs', NULL, 0, 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, tagline = excluded.tagline, description = excluded.description, category_id = excluded.category_id, badge = excluded.badge, featured = excluded.featured, status = excluded.status;
DELETE FROM product_images WHERE product_id = 'prod_ergonomic-office-chair';
DELETE FROM product_highlights WHERE product_id = 'prod_ergonomic-office-chair';
DELETE FROM product_specs WHERE product_id = 'prod_ergonomic-office-chair';
DELETE FROM product_prices WHERE product_id = 'prod_ergonomic-office-chair';
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_ergonomic-office-chair', 0, '/products/images/007.jpg', 'Ergonomic Office Chair');
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_ergonomic-office-chair', 1, '/products/images/008.jpg', 'Ergonomic Office Chair - view 2');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_ergonomic-office-chair', 0, 'Chair');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_ergonomic-office-chair', 0, 'MODEL', 'OCA259PRO Ergonomic Office Chair');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_ergonomic-office-chair', 1, 'MATERIAL', 'Ultra-breathable mesh back, high-density molded foam seat');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_ergonomic-office-chair', 2, 'COLOR', 'Black/Grey - Color may vary depending on stock');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_ergonomic-office-chair', 3, 'FEATURES', 'Ergonomic mesh back, 4D soft armrests (height, width, depth, and angle adjustable), Adjustable headrest, Height-adjustable lumbar support, Reclining backrest with lock mechanism, Retractable leg rest.');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_ergonomic-office-chair', 'loc_bali', 'USD', 900, '1000', '600');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_ergonomic-office-chair', 'loc_da-nang', 'USD', 900, '1000', '600');
INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status) VALUES ('prod_ergonomic-office-chair-anya', 'ergonomic-office-chair-anya', 'Ergonomic Office Chair Anya', 'Modena Anya – Ergonomic office chair designed to provide superior comfort and support, featuring adjustable components, breathable mesh backrest, and a sleek, modern design.', 'The Modena Anya ergonomic office chair is meticulously crafted to enhance your sitting experience, promoting better posture and reducing discomfort during prolonged periods of use. Its design focuses on adaptability and user comfort, making it an excellent choice for both home and office environments.

This chair features an adjustable headrest that can be tilted to support the natural curve of your neck, reducing strain during extended sitting sessions. The integrated lumbar support provides targeted lower back support, encouraging proper spinal alignment and alleviating back pain. The high-quality breathable mesh backrest ensures optimal airflow, keeping you cool and comfortable throughout the day.

The armrests are adjustable in height and angle, allowing you to find the perfect position to reduce shoulder and wrist strain. The seat height is fully customizable, ensuring your feet rest flat on the floor and your thighs are parallel to the ground. A reclining function with a tilt lock mechanism allows you to lean back comfortably and securely during breaks.

Equipped with a sturdy five-point base and smooth-rolling casters, the chair provides stability and easy mobility across various floor surfaces. The Modena Anya combines functionality with a sleek, modern aesthetic, making it a versatile addition to any workspace. Its ergonomic design enhances productivity and comfort, catering to the needs of users who spend extended periods seated.', 'cat_chairs', NULL, 0, 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, tagline = excluded.tagline, description = excluded.description, category_id = excluded.category_id, badge = excluded.badge, featured = excluded.featured, status = excluded.status;
DELETE FROM product_images WHERE product_id = 'prod_ergonomic-office-chair-anya';
DELETE FROM product_highlights WHERE product_id = 'prod_ergonomic-office-chair-anya';
DELETE FROM product_specs WHERE product_id = 'prod_ergonomic-office-chair-anya';
DELETE FROM product_prices WHERE product_id = 'prod_ergonomic-office-chair-anya';
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_ergonomic-office-chair-anya', 0, '/products/images/009.jpg', 'Ergonomic Office Chair Anya');
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_ergonomic-office-chair-anya', 1, '/products/images/010.jpg', 'Ergonomic Office Chair Anya - view 2');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_ergonomic-office-chair-anya', 0, 'Chair');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_ergonomic-office-chair-anya', 0, 'MODEL', 'Anya');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_ergonomic-office-chair-anya', 1, 'MATERIALS', 'Breathable mesh backrest, cushioned fabric seat, durable plastic frame');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_ergonomic-office-chair-anya', 2, 'ADJUSTMENTS', 'Headrest tilt, lumbar support, armrest height and angle, seat height, reclining angle with tilt lock');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_ergonomic-office-chair-anya', 3, 'DIMENSIONS', 'Seat width: 50 cm; Seat depth: 50 cm; Backrest height: 70 cm; Adjustable seat height: 45-55 cm');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_ergonomic-office-chair-anya', 4, 'WEIGHT CAPACITY', 'Up to 120 kg');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_ergonomic-office-chair-anya', 5, 'COLOR', 'Black');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_ergonomic-office-chair-anya', 'loc_chiang-mai', 'USD', 1300, '2000', '600');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_ergonomic-office-chair-anya', 'loc_da-nang', 'USD', 1300, '2000', '600');
INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status) VALUES ('prod_ergonomic-jaervfjaellet-office-chair', 'ergonomic-jaervfjaellet-office-chair', 'Ergonomic Office Chair', 'Ergonomic office chair for rent in Lisbon: breathable mesh backrest with height-adjustable lumbar support, high-density moulded foam seat, 2D adjustable armrests, adjustable headrest and a multi-angle reclining backrest with lock.', 'A good chair is the one piece of furniture that pays for itself every hour you work. This ergonomic office chair is built for people in Lisbon who spend full days at a desk, whether that is remote work, study or long gaming sessions.

**Support where your back needs it**

The backrest is shaped to follow the curve of your spine and finished in breathable mesh, so air circulates and you stay cool through a warm Lisbon afternoon. Lumbar support adjusts in height to sit exactly against your lower back. The headrest adjusts as well, taking the weight of your head during calls or when you lean back.

**Adjust it to your body**

- **Seat**: high-density moulded foam that stays firm and keeps its shape.
- **Armrests**: 2D adjustable in height and width so your shoulders can relax.
- **Backrest**: reclines through multiple angles and locks in your preferred position, from upright typing to a relaxed lean.

**Delivered and assembled**

We bring the chair to your address in Lisbon fully assembled and take it away again when your rental ends. Combine it with a sit-stand desk and a monitor for a complete home office.', 'cat_chairs', NULL, 0, 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, tagline = excluded.tagline, description = excluded.description, category_id = excluded.category_id, badge = excluded.badge, featured = excluded.featured, status = excluded.status;
DELETE FROM product_images WHERE product_id = 'prod_ergonomic-jaervfjaellet-office-chair';
DELETE FROM product_highlights WHERE product_id = 'prod_ergonomic-jaervfjaellet-office-chair';
DELETE FROM product_specs WHERE product_id = 'prod_ergonomic-jaervfjaellet-office-chair';
DELETE FROM product_prices WHERE product_id = 'prod_ergonomic-jaervfjaellet-office-chair';
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_ergonomic-jaervfjaellet-office-chair', 0, '/products/images/011.jpg', 'Ergonomic Office Chair');
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_ergonomic-jaervfjaellet-office-chair', 1, '/products/images/012.jpg', 'Ergonomic Office Chair - view 2');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_ergonomic-jaervfjaellet-office-chair', 0, 'Chair');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_ergonomic-jaervfjaellet-office-chair', 0, 'MODEL', 'JÄRVFJÄLLET');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_ergonomic-jaervfjaellet-office-chair', 1, 'MATERIAL', '100 % polyester, highly resilient polyurethane foam');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_ergonomic-jaervfjaellet-office-chair', 2, 'COLOR', 'Black');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_ergonomic-jaervfjaellet-office-chair', 3, 'FEATURES', 'Ergonomic mesh back, 2D soft armrests (height and width adjustable), Adjustable headrest, Height-adjustable lumbar support, Reclining backrest with lock mechanism.');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_ergonomic-jaervfjaellet-office-chair', 'loc_lisbon', 'EUR', 1200, '1000', '600');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_ergonomic-jaervfjaellet-office-chair', 'loc_da-nang', 'EUR', 1200, '1000', '600');
INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status) VALUES ('prod_full-hd-office-24', 'full-hd-office-24', '24" Full HD Office Monitor 1C', 'Xiaomi Mi 23.8 Monitor 1C at 75 Hz, 1920 x 1080 FHD, 250 Nits, 99& sRGB, 6ms response time.', 'Enhance your workspace with the Xiaomi Mi 23.8 Monitor 1C, a sleek, ultra-thin display designed for productivity and immersive entertainment. Its 23.8-inch Full HD (1920x1080) IPS panel delivers vivid colors, wide 178° viewing angles, and sharp details—perfect for work, streaming, or gaming.

Enjoy a more comfortable viewing experience with low blue light technology, reducing eye strain during long sessions. The ultra-narrow 7.3mm slim bezels create a near-borderless look, ideal for multi-monitor setups. With a refresh rate of 60Hz and a response time of 6ms, it ensures smooth visuals for daily tasks and casual gaming.

Built with a minimalist, modern design, it fits seamlessly into any home or office. HDMI and VGA ports provide versatile connectivity for laptops, desktops, or consoles, making it easy to plug and play.', 'cat_monitors', NULL, 0, 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, tagline = excluded.tagline, description = excluded.description, category_id = excluded.category_id, badge = excluded.badge, featured = excluded.featured, status = excluded.status;
DELETE FROM product_images WHERE product_id = 'prod_full-hd-office-24';
DELETE FROM product_highlights WHERE product_id = 'prod_full-hd-office-24';
DELETE FROM product_specs WHERE product_id = 'prod_full-hd-office-24';
DELETE FROM product_prices WHERE product_id = 'prod_full-hd-office-24';
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_full-hd-office-24', 0, '/products/images/013.jpg', '24" Full HD Office Monitor 1C');
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_full-hd-office-24', 1, '/products/images/014.jpg', '24" Full HD Office Monitor 1C - in context');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_full-hd-office-24', 0, 'Full HD Monitor');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_full-hd-office-24', 0, 'MODEL', 'RMMNT238NF');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_full-hd-office-24', 1, 'RESPONSE TIME', '6ms');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_full-hd-office-24', 2, 'CONNECTIVITY', '1x HDMI 1.4 port, 1x VGA port');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_full-hd-office-24', 3, 'DIMENSIONS', '539.2 (L) × 181.2 (W) × 419.5 (H) mm • 2.7 kg');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_full-hd-office-24', 4, 'DISPLAY', 'LED IPS 24-inch (1920 x 1080p) 250 nits');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_full-hd-office-24', 5, 'COLOR', '8-bit, 99% sRGB');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_full-hd-office-24', 'loc_bali', 'USD', 700, '500', '500');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_full-hd-office-24', 'loc_da-nang', 'USD', 700, '500', '500');
INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status) VALUES ('prod_24-full-hd-office-monitor-a24i-2026', '24-full-hd-office-monitor-a24i-2026', '24" Full HD Office Monitor A24i 2026', 'Xiaomi Monitor A24i 2026, 23.8″ Fast IPS Monitor, 1920 × 1080 FHD, 144 Hz Refresh Rate, 300 Nits Brightness, 1500:1 Contrast Ratio, 99% sRGB, 8-bit (6-bit + FRC), 6 ms Response Time, HDMI 2.0, DisplayPort 1.4, Viewing Angle 178°, Low Blue Light Mode, VESA 75 × 75 mm, Tilt Adjustment 5°/15°.', 'The Xiaomi Monitor A24i 2026 is the upgraded evolution of the A24i series, designed for smoother performance, sharper visuals, and modern productivity. Featuring a 23.8-inch Full HD Fast IPS panel with a high 144 Hz refresh rate, it delivers fluid motion, crisp clarity, and wide 178° viewing angles — ideal for remote work, multitasking, content creation, and casual gaming.

With 1920 × 1080 resolution and 99% sRGB color accuracy, the A24i 2026 ensures vibrant, precise colors suitable for design work, video editing, and everyday media consumption. The enhanced 300-nit brightness and 1500:1 contrast ratio provide better depth and visibility in various lighting conditions, making it a reliable all-around display for office setups, home workstations, or rental environments.

The 144 Hz refresh rate significantly improves smoothness during scrolling, gaming, and fast-moving visuals, while the 6 ms response time minimizes motion blur. Built-in Low Blue Light technology reduces eye strain during long work sessions, making it comfortable for extended daily use.

Its minimalist slim design with narrow bezels fits seamlessly into modern workspaces, and the adjustable tilt stand ensures ergonomic comfort. With HDMI 2.0 and DisplayPort 1.4 connectivity, it integrates easily with laptops, desktops, and docking stations. Whether for productivity, gaming, or streaming, the A24i 2026 offers a balanced mix of performance and style.

**NOTE:** To achieve a 144 Hz refresh rate, please include a DP cable with your order and confirm that your device is equipped with a DP connection to link with the screen.', 'cat_monitors', NULL, 0, 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, tagline = excluded.tagline, description = excluded.description, category_id = excluded.category_id, badge = excluded.badge, featured = excluded.featured, status = excluded.status;
DELETE FROM product_images WHERE product_id = 'prod_24-full-hd-office-monitor-a24i-2026';
DELETE FROM product_highlights WHERE product_id = 'prod_24-full-hd-office-monitor-a24i-2026';
DELETE FROM product_specs WHERE product_id = 'prod_24-full-hd-office-monitor-a24i-2026';
DELETE FROM product_prices WHERE product_id = 'prod_24-full-hd-office-monitor-a24i-2026';
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_24-full-hd-office-monitor-a24i-2026', 0, '/products/images/015.jpg', '24" Full HD Office Monitor A24i 2026');
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_24-full-hd-office-monitor-a24i-2026', 1, '/products/images/016.jpg', '24" Full HD Office Monitor A24i 2026 - view 2');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_24-full-hd-office-monitor-a24i-2026', 0, 'Full HD Monitor');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_24-full-hd-office-monitor-a24i-2026', 1, 'New');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_24-full-hd-office-monitor-a24i-2026', 0, 'MODEL', 'P24FDA-RAGL');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_24-full-hd-office-monitor-a24i-2026', 1, 'DISPLAY', '23.8″ Fast IPS, Full HD (1920 × 1080), 300 nits, 1500:1 contrast, 16:9 aspect ratio');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_24-full-hd-office-monitor-a24i-2026', 2, 'REFRESH RATE', '144 Hz');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_24-full-hd-office-monitor-a24i-2026', 3, 'RESPONSE TIME', '6 ms');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_24-full-hd-office-monitor-a24i-2026', 4, 'COLOR', '8-bit (6-bit + FRC), 16.7 million colors, 99% sRGB');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_24-full-hd-office-monitor-a24i-2026', 5, 'ADJUSTMENT', 'Tilt: 5° forward / 15° backward, VESA mount: 75 × 75 mm');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_24-full-hd-office-monitor-a24i-2026', 6, 'CONNECTIVITY', '1× HDMI 2.0, 1× DisplayPort 1.4, DC IN');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_24-full-hd-office-monitor-a24i-2026', 7, 'DIMENSIONS & WEIGHT', '539.2 (L) × 170.0 (W) × 433.7 (H) mm • 3 kg');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_24-full-hd-office-monitor-a24i-2026', 'loc_bali', 'USD', 900, '500', '500');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_24-full-hd-office-monitor-a24i-2026', 'loc_lisbon', 'EUR', 1400, '2000', '500');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_24-full-hd-office-monitor-a24i-2026', 'loc_da-nang', 'USD', 900, '500', '500');
INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status) VALUES ('prod_24-full-hd-office-monitor-mp-251', '24-full-hd-office-monitor-mp-251', '24" Full HD Office Monitor MP251', 'MSI PRO MP251 – Monitor IPS 24.5 inci dengan resolusi 1920 × 1080 FHD, refresh rate 100Hz, kecerahan 300 nits, rasio kontras 1300:1, waktu respons 1ms (MPRT), sudut pandang 178°, dan teknologi Eye Care.', 'The MSI PRO MP251 is a professional-grade monitor designed to enhance productivity and comfort for business users. Its 24.5-inch IPS panel delivers 1920 × 1080 resolution with 101% sRGB color gamut, ensuring vibrant and accurate visuals suitable for various professional applications. The 100Hz refresh rate and 1ms (MPRT) response time provide smooth and responsive performance, ideal for tasks requiring precision and clarity.

Equipped with Adaptive Sync technology, the monitor minimizes screen tearing and stuttering, offering a seamless viewing experience. The Anti-Flicker and Less Blue Light features reduce eye strain during extended use, promoting healthier work habits. The monitor''s slim design and narrow bezels make it a sleek addition to any workspace, while the -5° to 20° tilt adjustment allows for ergonomic positioning.

Connectivity options include HDMI 1.4b and D-Sub (VGA) ports, ensuring compatibility with a wide range of devices. The built-in 2W speakers provide convenient audio output without the need for external speakers. This monitor is an excellent choice for professionals seeking a reliable and feature-rich display to enhance their daily workflow.', 'cat_monitors', NULL, 0, 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, tagline = excluded.tagline, description = excluded.description, category_id = excluded.category_id, badge = excluded.badge, featured = excluded.featured, status = excluded.status;
DELETE FROM product_images WHERE product_id = 'prod_24-full-hd-office-monitor-mp-251';
DELETE FROM product_highlights WHERE product_id = 'prod_24-full-hd-office-monitor-mp-251';
DELETE FROM product_specs WHERE product_id = 'prod_24-full-hd-office-monitor-mp-251';
DELETE FROM product_prices WHERE product_id = 'prod_24-full-hd-office-monitor-mp-251';
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_24-full-hd-office-monitor-mp-251', 0, '/products/images/017.jpg', '24" Full HD Office Monitor MP251');
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_24-full-hd-office-monitor-mp-251', 1, '/products/images/018.jpg', '24" Full HD Office Monitor MP251 - view 2');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_24-full-hd-office-monitor-mp-251', 0, 'Full HD Monitor');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_24-full-hd-office-monitor-mp-251', 0, 'MODEL', 'PRO MP251');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_24-full-hd-office-monitor-mp-251', 1, 'CONNECTIVITY', '1x HDMI 1.4b port, 1x D-Sub (VGA) port, 1x Line-in, 1x Headphone-out');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_24-full-hd-office-monitor-mp-251', 2, 'DISPLAY', 'IPS 24.5-inch (1920 × 1080p) 300 nits');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_24-full-hd-office-monitor-mp-251', 3, 'RESPONSE TIME', '1ms (MPRT) / 4ms (GTG)');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_24-full-hd-office-monitor-mp-251', 4, 'DIMENSIONS', '557.5 (W) × 207.2 (D) × 422.1 (H) mm; 2.9 kg');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_24-full-hd-office-monitor-mp-251', 5, 'COLOR GAMUT', '101% sRGB');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_24-full-hd-office-monitor-mp-251', 6, 'FEATURES', 'Adaptive Sync, Anti-Flicker, Less Blue Light, Anti-Glare surface, built-in 2W speakers, VESA mounting (100 × 100 mm)');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_24-full-hd-office-monitor-mp-251', 'loc_chiang-mai', 'USD', 700, '1000', NULL);
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_24-full-hd-office-monitor-mp-251', 'loc_da-nang', 'USD', 700, '1000', NULL);
INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status) VALUES ('prod_27-work-monitor-a27i', '27-work-monitor-a27i', '27" Full HD Office Monitor A27i', 'Xiaomi Monitor 27" IPS screen at 100Hz, 1920 x 1080 FHD, 100% sRGB, ΔE<2, 8 bit, 250 Nits, 6ms response time, VESA mount.', 'Bring stunning visuals and modern style to your workspace with the Xiaomi Monitor 27 A27i, featuring a 27-inch Full HD (1920×1080) IPS display that delivers vibrant colors, sharp details, and wide 178° viewing angles for immersive viewing from any position.

Enjoy smooth performance with a 75Hz refresh rate, perfect for enhanced productivity and fluid visuals in everyday tasks or casual gaming. The low blue light technology helps reduce eye fatigue during long hours of work or entertainment, while the ultra-slim bezels provide a sleek, minimalist aesthetic ideal for multi-monitor setups.

With HDMI and VGA ports, the A27i ensures versatile connectivity for laptops, desktops, and consoles, making it easy to integrate into any home or office environment.', 'cat_monitors', NULL, 0, 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, tagline = excluded.tagline, description = excluded.description, category_id = excluded.category_id, badge = excluded.badge, featured = excluded.featured, status = excluded.status;
DELETE FROM product_images WHERE product_id = 'prod_27-work-monitor-a27i';
DELETE FROM product_highlights WHERE product_id = 'prod_27-work-monitor-a27i';
DELETE FROM product_specs WHERE product_id = 'prod_27-work-monitor-a27i';
DELETE FROM product_prices WHERE product_id = 'prod_27-work-monitor-a27i';
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_27-work-monitor-a27i', 0, '/products/images/019.jpg', '27" Full HD Office Monitor A27i');
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_27-work-monitor-a27i', 1, '/products/images/020.jpg', '27" Full HD Office Monitor A27i - in context');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_27-work-monitor-a27i', 0, 'Full HD Monitor');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_27-work-monitor-a27i', 0, 'MODEL', 'P27FBA-RAGL');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_27-work-monitor-a27i', 1, 'RESPONSE TIME', '6ms');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_27-work-monitor-a27i', 2, 'CONNECTIVITY', '1x DP 1.4 port, 1x HDMI 2.0 port');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_27-work-monitor-a27i', 3, 'DIMENSIONS', '612.3 (L) × 170 (W) × 451.7 (H) mm • 3.6 kg');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_27-work-monitor-a27i', 4, 'DISPLAY', 'LED IPS 27-inch (1920 x 1080p) 250 nits ');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_27-work-monitor-a27i', 5, 'COLOR', 'HDR 10, ΔE<2, 8-bit, 99% sRGB');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_27-work-monitor-a27i', 'loc_bali', 'USD', 1000, '2000', NULL);
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_27-work-monitor-a27i', 'loc_da-nang', 'USD', 1000, '2000', NULL);
INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status) VALUES ('prod_27-full-hd-office-monitor-mr-400', '27-full-hd-office-monitor-mr-400', '27" Full HD Office Monitor MR400', 'LG 27MR400-B – 27-inch IPS Monitor with 1920 × 1080 FHD resolution, 100Hz refresh rate, 250 nits brightness, 1300:1 contrast ratio, 5ms response time, 178° viewing angle, and AMD FreeSync™ technology.', 'The LG 27MR400-B is a versatile monitor designed to meet the needs of both professionals and casual users. Its 27-inch IPS panel delivers 1920 × 1080 resolution with 99% sRGB color accuracy, ensuring vibrant and accurate visuals suitable for various applications. The 100Hz refresh rate and 5ms response time provide smooth and responsive performance, ideal for tasks requiring precision and clarity.

Equipped with AMD FreeSync™ technology, the monitor minimizes screen tearing and stuttering, offering a seamless viewing experience during fast-paced content. The Flicker Safe and Reader Mode features reduce eye strain during extended use, promoting healthier viewing habits. The monitor''s slim design and narrow bezels make it a sleek addition to any workspace, while the -5° to 15° tilt adjustment allows for ergonomic positioning.

Connectivity options include HDMI 1.4 and D-Sub (VGA) ports, ensuring compatibility with a wide range of devices. This monitor is an excellent choice for users seeking a reliable and feature-rich display to enhance their daily workflow.', 'cat_monitors', NULL, 0, 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, tagline = excluded.tagline, description = excluded.description, category_id = excluded.category_id, badge = excluded.badge, featured = excluded.featured, status = excluded.status;
DELETE FROM product_images WHERE product_id = 'prod_27-full-hd-office-monitor-mr-400';
DELETE FROM product_highlights WHERE product_id = 'prod_27-full-hd-office-monitor-mr-400';
DELETE FROM product_specs WHERE product_id = 'prod_27-full-hd-office-monitor-mr-400';
DELETE FROM product_prices WHERE product_id = 'prod_27-full-hd-office-monitor-mr-400';
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_27-full-hd-office-monitor-mr-400', 0, '/products/images/021.jpg', '27" Full HD Office Monitor MR400');
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_27-full-hd-office-monitor-mr-400', 1, '/products/images/022.jpg', '27" Full HD Office Monitor MR400 - view 2');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_27-full-hd-office-monitor-mr-400', 0, 'Full HD Monitor');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_27-full-hd-office-monitor-mr-400', 0, 'MODEL', '27MR400-B');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_27-full-hd-office-monitor-mr-400', 1, 'CONNECTIVITY', '1x HDMI 1.4 port, 1x D-Sub (VGA) port');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_27-full-hd-office-monitor-mr-400', 2, 'DISPLAY', 'IPS 27-inch (1920 × 1080p) 250 nits');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_27-full-hd-office-monitor-mr-400', 3, 'RESPONSE TIME', '5ms');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_27-full-hd-office-monitor-mr-400', 4, 'DIMENSIONS', '611.7 (W) × 362.3 (H) × 50.5 (D) mm; 3.27 kg');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_27-full-hd-office-monitor-mr-400', 5, 'COLOR GAMUT', '99% sRGB');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_27-full-hd-office-monitor-mr-400', 6, 'ADDITIONAL FEATURES', 'AMD FreeSync™, Flicker Safe, Reader Mode, Anti-Glare surface, VESA mounting (100 × 100 mm)');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_27-full-hd-office-monitor-mr-400', 'loc_chiang-mai', 'USD', 1000, '2000', NULL);
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_27-full-hd-office-monitor-mr-400', 'loc_da-nang', 'USD', 1000, '2000', NULL);
INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status) VALUES ('prod_4k-grading-monitor-27', '4k-grading-monitor-27', '27" 4K+ Grading Monitor', 'Xiaomi 27" monitor with USB-C connection and charging, 400 Nits, 4K (3840×2160) resolution, 99% DCI-P3 Adobe RGB, Cinematic Wide Color Gamut, PANTONE Validated, 6ms response time, VESA mount.', 'Unlock professional-grade color accuracy and breathtaking detail with this 27-inch 4K+ grading monitor, the ideal choice for photographers, video editors, and designers demanding precise visuals. The monitor features a stunning 3840×2160 UHD IPS display, delivering razor-sharp clarity, exceptional brightness, and wide 178° viewing angles, ensuring every hue and tone looks perfect from any angle.

With a smooth 60Hz refresh rate, this monitor provides a responsive, flicker-free viewing experience for everyday tasks and creative work. Covering 100% sRGB and 95% DCI-P3 color gamuts, it produces vibrant, true-to-life colors essential for accurate grading. The factory-calibrated panel ensures Delta E<1 color accuracy, so you can trust what you see on screen.

Designed with an ultra-slim bezel for a modern, immersive look, it supports HDR400 for deeper contrast and richer highlights, and features height, tilt, and swivel adjustments for ergonomic comfort. Equipped with HDMI, DisplayPort, and USB-C connectivity, it seamlessly integrates with your workflow for maximum flexibility.', 'cat_monitors', NULL, 0, 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, tagline = excluded.tagline, description = excluded.description, category_id = excluded.category_id, badge = excluded.badge, featured = excluded.featured, status = excluded.status;
DELETE FROM product_images WHERE product_id = 'prod_4k-grading-monitor-27';
DELETE FROM product_highlights WHERE product_id = 'prod_4k-grading-monitor-27';
DELETE FROM product_specs WHERE product_id = 'prod_4k-grading-monitor-27';
DELETE FROM product_prices WHERE product_id = 'prod_4k-grading-monitor-27';
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_4k-grading-monitor-27', 0, '/products/images/023.jpg', '27" 4K+ Grading Monitor');
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_4k-grading-monitor-27', 1, '/products/images/024.jpg', '27" 4K+ Grading Monitor - in context');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_4k-grading-monitor-27', 0, '4K Monitor');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_4k-grading-monitor-27', 1, 'Grading Monitor');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_4k-grading-monitor-27', 0, 'MODEL', 'XMMNT27NU');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_4k-grading-monitor-27', 1, 'RESPONSE TIME', '6ms');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_4k-grading-monitor-27', 2, 'CONNECTIVITY', '1x USB-C port (90W charging), 2x HDMI 2.1 port, 1x DP 1.4, 2x USB Type A, 1x Audio port ');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_4k-grading-monitor-27', 3, 'DIMENSIONS', '612.9 (L) × 200.0 (W) × 514.9 (H) mm • 3.6 kg');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_4k-grading-monitor-27', 4, 'DISPLAY', 'LCD IPS 27-inch 4K (3840 x 2160p) 400 nits');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_4k-grading-monitor-27', 5, 'COLOR', 'HDR 400, VESA HDR 400, 99% Adobe RGB, 99% DCI-P3, 100% sRGB, Cinematic wide color gamut, Pantone validated');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_4k-grading-monitor-27', 'loc_bali', 'USD', 2400, '6000', '500');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_4k-grading-monitor-27', 'loc_da-nang', 'USD', 2400, '6000', '500');
INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status) VALUES ('prod_apple-studio-display', 'apple-studio-display', '27" 5K Apple Studio Display', '27-inch 5K Retina display (5120 by 2880 pixels), 600 nits brightness, P3 wide color gamut, True Tone technology, Tilt adjustable stand, 12MP Ultra-Wide camera with Center Stage, six-speaker sound system, studio-quality three-microphone, 1x Thunderbolt 3 port (up to 96W power delivery), 3x USB-C ports.', 'The Apple Studio Display is a premier choice for creative professionals looking to rent a top-tier visual solution without committing to a full purchase. With a stunning 5K Retina resolution on its 27-inch display, this monitor is crafted for those who need unparalleled clarity, vibrant colors, and accurate detail for critical projects. Perfect for video editors, photographers, and designers, it brings creative visions to life with exceptional precision.

Equipped with True Tone technology, the Studio Display adapts to ambient lighting, ensuring a natural and comfortable viewing experience in any environment. Its advanced 12MP Ultra Wide camera with Center Stage is perfect for remote meetings, adjusting automatically to keep you centered on screen during calls. The display’s six-speaker sound system with Spatial Audio delivers immersive sound quality, ideal for multimedia editing and entertainment.

For those seeking to experience the best without long-term commitment, renting the Apple Studio Display offers flexible access to this high-performance tool. With versatile connectivity options and an elegant design that integrates seamlessly into any workspace, the Studio Display is the perfect rental solution for professionals who demand Apple’s renowned quality and functionality in their creative and professional endeavors.', 'cat_monitors', NULL, 0, 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, tagline = excluded.tagline, description = excluded.description, category_id = excluded.category_id, badge = excluded.badge, featured = excluded.featured, status = excluded.status;
DELETE FROM product_images WHERE product_id = 'prod_apple-studio-display';
DELETE FROM product_highlights WHERE product_id = 'prod_apple-studio-display';
DELETE FROM product_specs WHERE product_id = 'prod_apple-studio-display';
DELETE FROM product_prices WHERE product_id = 'prod_apple-studio-display';
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_apple-studio-display', 0, '/products/images/025.jpg', '27" 5K Apple Studio Display - display');
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_apple-studio-display', 1, '/products/images/026.jpg', '27" 5K Apple Studio Display - display');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_apple-studio-display', 0, '5K Monitor');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_apple-studio-display', 1, 'New');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-studio-display', 0, 'MODEL', 'Apple Studio Display');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-studio-display', 1, 'CONNECTIVITY', '1x Thunderbolt 3 port (up to 96W power delivery), 3x USB-C ports');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-studio-display', 2, 'DISPLAY', '27-inch 5K Retina (5120 by 2880 pixels), 600 nits brightness');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-studio-display', 3, 'CAMERA', '12MP Ultra-Wide camera with Center Stage');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-studio-display', 4, 'AUDIO', 'Six-speaker sound system with force-canceling woofers, spatial audio support');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-studio-display', 5, 'MICROPHONES', 'Studio-quality three-microphone array with directional beamforming');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-studio-display', 6, 'COLOR', 'P3 wide color gamut, True Tone technology, anti-reflective coating with optional nano-texture glass');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-studio-display', 7, 'STAND', 'Tilt-adjustable stand');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-studio-display', 8, 'COMPATIBILITY', 'All Apple Silicon Macs, select Intel-based Macs');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_apple-studio-display', 'loc_bali', 'USD', 9900, '36000', '1000');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_apple-studio-display', 'loc_lisbon', 'EUR', 14900, '60000', '1000');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_apple-studio-display', 'loc_da-nang', 'USD', 9900, '36000', '1000');
INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status) VALUES ('prod_4-k-ultra-wide-34', '4-k-ultra-wide-34', '34" 4K Curved Monitor', 'Xiaomi Mi Curved 34" Multitasking Monitor at 144Hz, WQHD 3440 × 1440, 300 Nits, 121% sRGB, 4ms response time.', 'Immerse yourself in a world of ultra-wide, crystal-clear visuals with the Xiaomi Mi Curved 34" Gaming Monitor. Enjoy the comfort of the 1500R curvature, stunning WQHD clarity, and silky-smooth 144Hz gameplay. With AMD FreeSync for seamless action and vibrant colors across a 121% sRGB Wide Color Gamut, elevate your gaming and multimedia to new heights with no Visible Flicker Low Blue Light Mode.', 'cat_monitors', NULL, 0, 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, tagline = excluded.tagline, description = excluded.description, category_id = excluded.category_id, badge = excluded.badge, featured = excluded.featured, status = excluded.status;
DELETE FROM product_images WHERE product_id = 'prod_4-k-ultra-wide-34';
DELETE FROM product_highlights WHERE product_id = 'prod_4-k-ultra-wide-34';
DELETE FROM product_specs WHERE product_id = 'prod_4-k-ultra-wide-34';
DELETE FROM product_prices WHERE product_id = 'prod_4-k-ultra-wide-34';
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_4-k-ultra-wide-34', 0, '/products/images/027.jpg', '34" 4K Curved Monitor');
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_4-k-ultra-wide-34', 1, '/products/images/028.jpg', '34" 4K Curved Monitor - in context');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_4-k-ultra-wide-34', 0, '4K Monitor');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_4-k-ultra-wide-34', 0, 'MODEL', 'XOMT01BK');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_4-k-ultra-wide-34', 1, 'RESPONSE TIME', '4ms');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_4-k-ultra-wide-34', 2, 'CONNECTIVITY', '2x DP 1.4, 2x HDMI 2.0 port, 1x Audio port');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_4-k-ultra-wide-34', 3, 'DIMENSIONS', '810.39 (L) × 520.61 (W) × 242.53 (H) mm • 8.6 kg');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_4-k-ultra-wide-34', 4, 'DISPLAY', 'IPS 34-inch 4K (3440 x 1440p) 300 Nits, AMD FreeSync Technology');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_4-k-ultra-wide-34', 5, 'COLOR', '8-bit, 85% NTSC, 121% sRGB, Low Blue Light Mode');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_4-k-ultra-wide-34', 'loc_bali', 'USD', 2300, '6000', NULL);
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_4-k-ultra-wide-34', 'loc_da-nang', 'USD', 2300, '6000', NULL);
INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status) VALUES ('prod_adjustable-monitor-stand', 'adjustable-monitor-stand', 'Adjustable Monitor Stand', 'Adjustable height of 11-18cm, up to 15kg load bearing, ergonomic comfort and storage function compatible with all monitors.', 'Elevate your workspace with an Adjustable Monitor Stand. Crafted from durable metal in a sleek black finish, this stand combines style with functionality to enhance your desk setup. Designed to support monitors and displays, it offers adjustable height settings to ensure optimal viewing angles and ergonomic comfort. Its sturdy construction ensures stability for your devices, while the minimalist design seamlessly integrates into any office or home environment. Perfect for professionals seeking a clutter-free workspace, our Adjustable Monitor Stand is an essential accessory for improved productivity and comfort.', 'cat_monitor-arms', NULL, 0, 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, tagline = excluded.tagline, description = excluded.description, category_id = excluded.category_id, badge = excluded.badge, featured = excluded.featured, status = excluded.status;
DELETE FROM product_images WHERE product_id = 'prod_adjustable-monitor-stand';
DELETE FROM product_highlights WHERE product_id = 'prod_adjustable-monitor-stand';
DELETE FROM product_specs WHERE product_id = 'prod_adjustable-monitor-stand';
DELETE FROM product_prices WHERE product_id = 'prod_adjustable-monitor-stand';
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_adjustable-monitor-stand', 0, '/products/images/029.jpg', 'Adjustable Monitor Stand');
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_adjustable-monitor-stand', 1, '/products/images/030.jpg', 'Adjustable Monitor Stand - view 2');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_adjustable-monitor-stand', 0, 'Stand');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_adjustable-monitor-stand', 0, 'MODEL', 'Nillkin');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_adjustable-monitor-stand', 1, 'DIMENSION', '228.0 (L) × 290.0 (W) × 110.0 (H) mm • height adjustable 11-18cm');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_adjustable-monitor-stand', 2, 'MATERIAL', 'Metal');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_adjustable-monitor-stand', 3, 'COLOR', 'Black');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_adjustable-monitor-stand', 'loc_bali', 'USD', 300, '0', NULL);
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_adjustable-monitor-stand', 'loc_chiang-mai', 'USD', 300, '1000', NULL);
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_adjustable-monitor-stand', 'loc_lisbon', 'EUR', 700, '0', NULL);
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_adjustable-monitor-stand', 'loc_da-nang', 'USD', 300, '1000', NULL);
INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status) VALUES ('prod_apple-magic-keyboard', 'apple-magic-keyboard', 'Apple Magic Keyboard', 'Touch ID, numeric keypad, wireless connection, Apple silicon, lightning port.', 'The Apple Magic Keyboard with Touch ID offers a sleek, wireless typing experience with the added convenience of secure fingerprint recognition. Designed for Mac users, it seamlessly integrates with macOS, allowing for fast user switching and authentication without compromising on comfort or accuracy. Its compact, minimalist design not only complements your workspace but also ensures portability and ease of use. With a stable scissor mechanism beneath each key and optimized key travel, it delivers a remarkably comfortable and precise typing experience. The Magic Keyboard with Touch ID is not just a tool but an extension of your Mac, enhancing productivity and security with style.', 'cat_keyboards', NULL, 0, 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, tagline = excluded.tagline, description = excluded.description, category_id = excluded.category_id, badge = excluded.badge, featured = excluded.featured, status = excluded.status;
DELETE FROM product_images WHERE product_id = 'prod_apple-magic-keyboard';
DELETE FROM product_highlights WHERE product_id = 'prod_apple-magic-keyboard';
DELETE FROM product_specs WHERE product_id = 'prod_apple-magic-keyboard';
DELETE FROM product_prices WHERE product_id = 'prod_apple-magic-keyboard';
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_apple-magic-keyboard', 0, '/products/images/031.jpg', 'Apple Magic Keyboard');
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_apple-magic-keyboard', 1, '/products/images/032.jpg', 'Apple Magic Keyboard - view 2');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_apple-magic-keyboard', 0, 'Keyboard');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-magic-keyboard', 0, 'MODEL', 'Magic Keyboard with Touch ID');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-magic-keyboard', 1, 'CONNECTIVITY', 'Wireless via Bluetooth');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-magic-keyboard', 2, 'FEATURES', 'Touch ID, wireless connectivity, automatic pairing');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-magic-keyboard', 3, 'DIMENSIONS', '1149 (L) × 4187 (W) × 109 (H) mm • 369 g');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_apple-magic-keyboard', 'loc_bali', 'USD', 1200, '6000', NULL);
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_apple-magic-keyboard', 'loc_chiang-mai', 'USD', 600, '6000', NULL);
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_apple-magic-keyboard', 'loc_lisbon', 'EUR', 1600, '6000', NULL);
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_apple-magic-keyboard', 'loc_da-nang', 'USD', 600, '6000', NULL);
INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status) VALUES ('prod_logitech-mx-keyboard', 'logitech-mx-keyboard', 'Logitech MX Keyboard', 'Up to 10 meters wireless range, Easy-Switch™ keys to work on up to 3 computers, supported by all operating systems, up to 5-month battery live.', 'The Logitech MX Keys is a high-performance wireless keyboard featuring a full-size layout with a Numpad and arrow keys, ideal for professionals. Its Easy-Switch™ keys allow seamless operation across up to three computers, boasting a reliable wireless range of up to 10 meters, even in congested environments. Compatible with a wide range of operating systems including Windows®, macOS, Linux®, Chrome OS, iPadOS, and Android, it offers versatility for any setup. With up to 5 months of battery life, the MX Keys combines convenience, durability, and advanced functionality for an optimized typing experience. Ensuring your laptop or PC can connect via Bluetooth will allow you a seamless connection setup with the Logitech MX Keys.

**NOTE:** If you rent a Mac Studio or Mac Mini, we strongly recommend choosing an Apple Magic Keyboard to avoid any connectivity issues during setup. The Logitech MX Keyboard will be shipped without a USB pairing dongle (Logi Bolt Receiver).', 'cat_keyboards', NULL, 0, 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, tagline = excluded.tagline, description = excluded.description, category_id = excluded.category_id, badge = excluded.badge, featured = excluded.featured, status = excluded.status;
DELETE FROM product_images WHERE product_id = 'prod_logitech-mx-keyboard';
DELETE FROM product_highlights WHERE product_id = 'prod_logitech-mx-keyboard';
DELETE FROM product_specs WHERE product_id = 'prod_logitech-mx-keyboard';
DELETE FROM product_prices WHERE product_id = 'prod_logitech-mx-keyboard';
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_logitech-mx-keyboard', 0, '/products/images/033.jpg', 'Logitech MX Keyboard');
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_logitech-mx-keyboard', 1, '/products/images/034.jpg', 'Logitech MX Keyboard - view 2');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_logitech-mx-keyboard', 0, 'Keyboard');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_logitech-mx-keyboard', 0, 'MODEL', 'MX Keys');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_logitech-mx-keyboard', 1, 'CONNECTIVITY', 'Bluetooth');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_logitech-mx-keyboard', 2, 'FEATURES', 'Keyboard lighting, Built-in Rechargeable Battery, Logi Options+ Software');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_logitech-mx-keyboard', 3, 'DIMENSIONS', '131.6 (L) × 430.2 (W) × 20.5 (H) mm • 810 g');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_logitech-mx-keyboard', 'loc_bali', 'USD', 700, '2000', NULL);
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_logitech-mx-keyboard', 'loc_chiang-mai', 'USD', 700, '2000', NULL);
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_logitech-mx-keyboard', 'loc_lisbon', 'EUR', 900, '2000', NULL);
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_logitech-mx-keyboard', 'loc_da-nang', 'USD', 700, '2000', NULL);
INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status) VALUES ('prod_logitech-mx-master-mouse-s3', 'logitech-mx-master-mouse-s3', 'Logitech MX Master Mouse S3', 'Compatible with Windows and macOS, wireless connection, 8,000 DPI Darkfield sensor up to 8,000 DPI, ergonomic design, 70 days with one charge.', 'The Logitech MX Master 3S Mouse is the epitome of precision and ergonomics in the realm of pointing devices. Engineered for advanced users, including creatives and professionals, it boasts a meticulously crafted design that fits comfortably in your hand, reducing fatigue during long work sessions. This mouse is renowned for its ultra-quiet and highly precise scrolling with the MagSpeed wheel, capable of navigating through thousands of lines in seconds. Additionally, it offers customizable buttons, allowing you to tailor your workflow with specific gestures and commands. The MX Master 3S is not only a tool for productivity but also a statement of sophistication on your desk, with its ability to connect to up to three devices seamlessly, including compatibility across multiple operating systems. It''s the perfect combination of functionality, comfort, and advanced technology for those who demand the best in their work essentials.', 'cat_accessories', NULL, 0, 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, tagline = excluded.tagline, description = excluded.description, category_id = excluded.category_id, badge = excluded.badge, featured = excluded.featured, status = excluded.status;
DELETE FROM product_images WHERE product_id = 'prod_logitech-mx-master-mouse-s3';
DELETE FROM product_highlights WHERE product_id = 'prod_logitech-mx-master-mouse-s3';
DELETE FROM product_specs WHERE product_id = 'prod_logitech-mx-master-mouse-s3';
DELETE FROM product_prices WHERE product_id = 'prod_logitech-mx-master-mouse-s3';
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_logitech-mx-master-mouse-s3', 0, '/products/images/035.jpg', 'Logitech MX Master Mouse S3');
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_logitech-mx-master-mouse-s3', 1, '/products/images/036.jpg', 'Logitech MX Master Mouse S3 - view 2');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_logitech-mx-master-mouse-s3', 0, 'Mouse');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_logitech-mx-master-mouse-s3', 0, 'MODEL', 'S3');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_logitech-mx-master-mouse-s3', 1, 'DIMENSIONS', '51.0 (L) × 84.3 (W) × 124.9 (H) mm • 141 g');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_logitech-mx-master-mouse-s3', 2, 'CONNECTIVITY', 'Wireless, USB receiver, Multi OS compatible ');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_logitech-mx-master-mouse-s3', 3, 'FEATURES', '8,000 DPI Darkfield sensor, up to 8,000 DPI sensor, ergonomic design, 70 days with one charge, ');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_logitech-mx-master-mouse-s3', 'loc_bali', 'USD', 500, '0', NULL);
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_logitech-mx-master-mouse-s3', 'loc_chiang-mai', 'USD', 700, NULL, NULL);
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_logitech-mx-master-mouse-s3', 'loc_lisbon', 'EUR', 800, '0', NULL);
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_logitech-mx-master-mouse-s3', 'loc_da-nang', 'USD', 700, NULL, NULL);
INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status) VALUES ('prod_ergonomic-laptop-stand', 'ergonomic-laptop-stand', 'Ergonomic Laptop Stand', 'With all laptops from 10''''-17", raises and angles a laptop for comfortable and efficient use.', 'Elevate your workspace with our Ergonomic Laptop Stand, designed for versatility and comfort. This stand is universally compatible with all laptops ranging from 10'''' to 17'''', including popular models from Apple MacBook, MacBook Pro, MacBook Air, and Powerbook, to a wide range of devices from Asus, Sony, Dell, Toshiba, Lenovo, and more. Whether you''re using a sleek iPad or a sturdy notebook, our stand provides the perfect fit. Crafted for optimal ergonomics, it raises your device to eye level, reducing neck and back strain for a healthier, more comfortable work environment. Its sturdy construction ensures stability for your laptop, making it an essential accessory for both home and office use. Enhance your productivity and comfort with this versatile laptop stand.', 'cat_accessories', NULL, 0, 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, tagline = excluded.tagline, description = excluded.description, category_id = excluded.category_id, badge = excluded.badge, featured = excluded.featured, status = excluded.status;
DELETE FROM product_images WHERE product_id = 'prod_ergonomic-laptop-stand';
DELETE FROM product_highlights WHERE product_id = 'prod_ergonomic-laptop-stand';
DELETE FROM product_specs WHERE product_id = 'prod_ergonomic-laptop-stand';
DELETE FROM product_prices WHERE product_id = 'prod_ergonomic-laptop-stand';
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_ergonomic-laptop-stand', 0, '/products/images/037.jpg', 'Ergonomic Laptop Stand - back view');
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_ergonomic-laptop-stand', 1, '/products/images/038.jpg', 'Ergonomic Laptop Stand - top view');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_ergonomic-laptop-stand', 0, 'Stand');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_ergonomic-laptop-stand', 0, 'MODEL', 'KOLMI');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_ergonomic-laptop-stand', 1, 'MATERIAL', 'Aluminium');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_ergonomic-laptop-stand', 2, 'CONNECTIVITY', 'All laptops from 10-17 inch');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_ergonomic-laptop-stand', 3, 'COLOR', 'Color may vary depending on stock');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_ergonomic-laptop-stand', 'loc_bali', 'USD', 300, '0', NULL);
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_ergonomic-laptop-stand', 'loc_chiang-mai', 'USD', 300, '0', NULL);
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_ergonomic-laptop-stand', 'loc_lisbon', 'EUR', 600, '0', NULL);
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_ergonomic-laptop-stand', 'loc_da-nang', 'USD', 300, '0', NULL);
INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status) VALUES ('prod_display-docking-station', 'display-docking-station', 'Display Docking Station', 'DisplayLink triple display dock, 100W USB‑C laptop charging, USB‑C/USB‑A 10 Gbps ports, Gigabit Ethernet, audio I/O, 4K@60Hz & 2.5K monitor support, ABS compact body.', 'Expand your workspace effortlessly with this 15‑in‑1 universal USB‑C docking station, tailored for dual- or triple-display setups, power-hungry workstations, and seamless productivity. Whether you''re running Windows or a Mac, this dock enables extension to three independent external monitors (via a combination of HDMI Alt Mode and DisplayLink technology)—perfect for beating the single-display limit on basic M1, M2, and M3 Macs.

With DisplayLink built-in, you can connect up to three full-resolution displays—even on Intel-based Macs that normally support only one. This makes it ideal for professionals, content creators, and power users who crave screen real estate and flexibility.
Amazon

Paired with a robust 130 W power adapter, the dock delivers up to 100 W charging via USB‑C—keeping your laptop powered while driving multiple monitors and high-bandwidth peripherals.

Built for speed, it includes USB 3.1 Gen 2 ports (10 Gbps) across USB‑A and USB‑C, Gigabit Ethernet, and audio I/O—all housed in a sleek ABS enclosure with thoughtfully placed driver links and status LEDs.

**Ideal for Mac users with single-display limitations**
Do you have one of the base models below? These Macs natively support only a single external display:

- MacBook Air (M1, M2)
- MacBook Pro (13‑inch M1, M2, M3)
- Standard M3 MacBook Air / Pro (lid open only supports one display)

Pairing your Mac with this DisplayLink dock—and installing its driver—lets you bypass these restrictions and connect two or three monitors, greatly enhancing your productivity.', 'cat_accessories', NULL, 0, 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, tagline = excluded.tagline, description = excluded.description, category_id = excluded.category_id, badge = excluded.badge, featured = excluded.featured, status = excluded.status;
DELETE FROM product_images WHERE product_id = 'prod_display-docking-station';
DELETE FROM product_highlights WHERE product_id = 'prod_display-docking-station';
DELETE FROM product_specs WHERE product_id = 'prod_display-docking-station';
DELETE FROM product_prices WHERE product_id = 'prod_display-docking-station';
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_display-docking-station', 0, '/products/images/039.jpg', 'Display Docking Station - display');
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_display-docking-station', 1, '/products/images/040.jpg', 'Display Docking Station - display');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_display-docking-station', 0, 'Converter');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_display-docking-station', 1, 'New');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_display-docking-station', 0, 'MODEL', 'Wavlink Universal 15-in-1 USB-C Docking Station (WL-UG63PD25)');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_display-docking-station', 1, 'DISPLAY & RESOLUTION SUPPORT', 'Triple display support via DisplayLink (1x HDMI Alt Mode + 2x HDMI/DisplayPort)
Single display up to 4K@60Hz (DP1.4) / 4K@30Hz (DP1.2)
Dual displays up to 4K@60Hz + 2.5K@60Hz (DP1.4)
Triple displays up to 4K@60Hz + 2.5K@60Hz + 2.5K@60Hz (DP1.4)
Supports extended or mirrored displays on Windows/macOS
Note: DisplayLink driver installation required for multi-display on macOS');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_display-docking-station', 2, 'POWER & CHARGING', '130W external power adapter included
Up to 100W USB-C PD charging for host laptops
Supports 5V/3A, 9V/3A, 12V/3A, 15V/3A power profiles
DC input: 20V / 6.5A');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_display-docking-station', 3, 'CONNECTIVITY & PORTS', '1x USB-C (Host, upstream, PD 100W)
3x HDMI ports (including Alt Mode)
2x DisplayPort
4x USB-A 3.1 Gen 2 (10Gbps)
2x USB-C 3.1 Gen 2 (10Gbps)
1x RJ45 Gigabit Ethernet port
1x 3.5mm 4-pole audio/mic combo jack');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_display-docking-station', 4, 'DEVICE COMPATIBILITY', 'Compatible with macOS (10.14–13.x+), Windows 7/8/10/11, Chrome OS, Android, Harmony OS
Not compatible with iPadOS, Linux, or Unix
Ideal for MacBook Air/Pro M1, M2, M3 (single-display limited models) using DisplayLink workaround
Compatible with Intel Mac, Dell, Lenovo, Surface, Asus, Huawei, and more');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_display-docking-station', 5, 'DIMENSIONS & WEIGHT', 'Dock: 223 mm (L) × 91 mm (W) × 29 mm (H) • 378 g');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_display-docking-station', 'loc_bali', 'USD', 800, NULL, '2400');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_display-docking-station', 'loc_da-nang', 'USD', 800, NULL, '2400');
INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status) VALUES ('prod_wi-fi-6-router-5-g', 'wi-fi-6-router-5-g', 'Dual-Band Wi-Fi 6 Router', 'TP-Link Archer AX72 | AX5400, 5400 Mbps WiFi 6, 2.4GHz + 5GHz, up to 200+ devices, 4x LAN, 1x USB 3.0, 6× antennas, 64-bit Qualcomm CPU, TP-Link HomeShield.', 'Bali bliss, work uninterrupted.  The Archer AX72 rocks WiFi 6 speeds, conquering video calls, uploads, and streaming.  Connect 100+ devices, banish lag with MU-MIMO & OFDMA, and enjoy expansive coverage with 6 antennas & beamforming.  HomeShield safeguards your network. Work, connect, stay paradise. The router''s brand may be subject to alteration based on availability. It is important to keep in mind that this router requires a connection to an already installed router at your location in order to function.', 'cat_accessories', NULL, 0, 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, tagline = excluded.tagline, description = excluded.description, category_id = excluded.category_id, badge = excluded.badge, featured = excluded.featured, status = excluded.status;
DELETE FROM product_images WHERE product_id = 'prod_wi-fi-6-router-5-g';
DELETE FROM product_highlights WHERE product_id = 'prod_wi-fi-6-router-5-g';
DELETE FROM product_specs WHERE product_id = 'prod_wi-fi-6-router-5-g';
DELETE FROM product_prices WHERE product_id = 'prod_wi-fi-6-router-5-g';
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_wi-fi-6-router-5-g', 0, '/products/images/041.jpg', 'Dual-Band Wi-Fi 6 Router');
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_wi-fi-6-router-5-g', 1, '/products/images/042.jpg', 'Dual-Band Wi-Fi 6 Router - view 2');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_wi-fi-6-router-5-g', 0, 'WiFi');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_wi-fi-6-router-5-g', 0, 'MODEL', 'AX73 AX5400');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_wi-fi-6-router-5-g', 1, 'CONNECTIVITY', ' 4x LAN, 1x WAN, 1x USB 3.0');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_wi-fi-6-router-5-g', 2, 'COLOR', 'Black');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_wi-fi-6-router-5-g', 3, 'FEATURES', 'WiFi 6, 2.4GHz + 5GHz, up to 200+ devices');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_wi-fi-6-router-5-g', 'loc_bali', 'USD', 1200, '0', '800');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_wi-fi-6-router-5-g', 'loc_da-nang', 'USD', 1200, '0', '800');
INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status) VALUES ('prod_smart-led-desk-lamp-1-s', 'smart-led-desk-lamp-1-s', 'Smart LED Desk Lamp 1S', '520 lm luminous flux, Ra 90 high color rendering, 2600–5000 K color range, 4 lighting modes (Reading/Computer/Child/Focus), flicker‑free dimming, Wi‑Fi smart control, Google Assistant/Alexa/Siri voice support, 25,000 h lifespan, 9 W power, 2.4 GHz Wi‑Fi.', 'Bring premium, eye‑friendly lighting to your desk, workstation, or cozy corner with this smart LED desk lamp. With up to 520 lumens brightness and a high Ra 90 color rendering index, it delivers clear, natural‑looking illumination that’s ideal for reading, studying, working, or relaxing — without glare or flicker that can cause eye strain.

Thanks to its textured Fresnel lens, light is distributed evenly and naturally over your workspace. The lamp also features 4 dedicated lighting modes — Focus, Computer, Reading, and Child — so you can adjust the light profile to reduce blue‑light exposure, boost concentration, or enjoy soft, gentle illumination for evening use.

Control the lamp directly via the intuitive Xiaomi Home App, or use voice assistants like Google Assistant, Amazon Alexa, and Apple Siri/HomeKit to switch modes, change brightness, or dim the light hands‑free. A built‑in dial knob lets you manually adjust brightness and color temperature as well. Designed for long life, its LEDs are backed by heat‑control technology, offering up to 25,000 hours of reliable performance.

Minimalist and modern, this desk lamp blends into any setup — the perfect smart lighting solution for homes, offices, creative studios, or even remote working spaces for a affordable price.', 'cat_lamps', NULL, 0, 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, tagline = excluded.tagline, description = excluded.description, category_id = excluded.category_id, badge = excluded.badge, featured = excluded.featured, status = excluded.status;
DELETE FROM product_images WHERE product_id = 'prod_smart-led-desk-lamp-1-s';
DELETE FROM product_highlights WHERE product_id = 'prod_smart-led-desk-lamp-1-s';
DELETE FROM product_specs WHERE product_id = 'prod_smart-led-desk-lamp-1-s';
DELETE FROM product_prices WHERE product_id = 'prod_smart-led-desk-lamp-1-s';
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_smart-led-desk-lamp-1-s', 0, '/products/images/043.jpg', 'Smart LED Desk Lamp 1S');
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_smart-led-desk-lamp-1-s', 1, '/products/images/044.jpg', 'Smart LED Desk Lamp 1S - view 2');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_smart-led-desk-lamp-1-s', 0, 'Lighting');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_smart-led-desk-lamp-1-s', 0, 'MODEL', 'Mi LED Desk Lamp 1S');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_smart-led-desk-lamp-1-s', 1, 'LIGHT PERFORMANCE', 'Luminous flux: up to 520 lm, Color temperature: 2600 – 5000 K');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_smart-led-desk-lamp-1-s', 2, 'LIGHTING MODES', 'Focus Mode, Reading Mode, Computer Mode, Child Mode');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_smart-led-desk-lamp-1-s', 3, 'CONTROL', 'Built‑in dial knob for brightness & color adjustment, Wi‑Fi (2.4 GHz) connectivity');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_smart-led-desk-lamp-1-s', 4, 'MATERIAL', 'Minimalist white finish, heat‑control tech');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_smart-led-desk-lamp-1-s', 5, 'DIMENSION', '162 (L) × 162 (W) × 479 (H) mm • 0.8 kg');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_smart-led-desk-lamp-1-s', 'loc_bali', 'USD', 400, '1000', NULL);
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_smart-led-desk-lamp-1-s', 'loc_lisbon', 'EUR', 700, '1000', NULL);
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_smart-led-desk-lamp-1-s', 'loc_da-nang', 'USD', 400, '1000', NULL);
INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status) VALUES ('prod_metal-monitor-light-bar', 'metal-monitor-light-bar', 'Monitor Light Bar', 'Mijia dimmable light bar, changeable color (2700-6500K), Premium metal body, High Ra95 color rendering index, Magnetic rotation system.', 'The Mijia Lite Desk Lamp is a versatile and foldable lighting solution designed to enhance your reading and work experience. This 5W desk lamp offers adjustable color temperature settings ranging from a warm 2700K to a cool 6500K, allowing you to customize the lighting mood to match your activity, whether it''s reading, working, or relaxing. Its sleek and foldable design not only saves space but also allows for easy adjustment and direct lighting where it''s needed most. The Mijia Lite Lamp is ideal for those seeking a blend of functionality, style, and comfort in their workspace or reading area. This light bar is compatible with all monitors we have in stock.', 'cat_lamps', NULL, 0, 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, tagline = excluded.tagline, description = excluded.description, category_id = excluded.category_id, badge = excluded.badge, featured = excluded.featured, status = excluded.status;
DELETE FROM product_images WHERE product_id = 'prod_metal-monitor-light-bar';
DELETE FROM product_highlights WHERE product_id = 'prod_metal-monitor-light-bar';
DELETE FROM product_specs WHERE product_id = 'prod_metal-monitor-light-bar';
DELETE FROM product_prices WHERE product_id = 'prod_metal-monitor-light-bar';
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_metal-monitor-light-bar', 0, '/products/images/045.jpg', 'Monitor Light Bar');
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_metal-monitor-light-bar', 1, '/products/images/046.jpg', 'Monitor Light Bar - view 2');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_metal-monitor-light-bar', 0, 'Lighting');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_metal-monitor-light-bar', 0, 'MODEL', 'MJGJD01YL');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_metal-monitor-light-bar', 1, 'CONNECTIVITY', 'USB cable (power), remote control (change and dimming light)');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_metal-monitor-light-bar', 2, 'FEATURE', 'Magnetic rotation system, 2.4-GHz wireless remote control, Premium metal body');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_metal-monitor-light-bar', 3, 'LIGHT', '5W (80 x 0.2W/LED module), 2700-6500K');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_metal-monitor-light-bar', 'loc_bali', 'USD', 500, '0', NULL);
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_metal-monitor-light-bar', 'loc_chiang-mai', 'USD', 700, '1000', NULL);
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_metal-monitor-light-bar', 'loc_lisbon', 'EUR', 700, '0', NULL);
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_metal-monitor-light-bar', 'loc_da-nang', 'USD', 700, '1000', NULL);
INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status) VALUES ('prod_apple-mac-mini-m4', 'apple-mac-mini-m4', 'Apple Mac Mini M4', 'Apple M4 with 10-core CPU, 10-core GPU, 16-core Neural Engine, 16GB unified memory, 256GB SSD storage, Gigabit Ethernet, 2x Thunderbolt 4 ports, HDMI port, two USB-A ports, and a headphone jack.', 'Rent the latest Apple Mac Mini M4, built for power and versatility. Equipped with a 10-core CPU, 10-core GPU, and 16GB of unified memory, this model offers seamless multitasking and top-tier performance for demanding applications. Its 256GB SSD ensures fast storage, while multiple connectivity options, including 2 Thunderbolt 4 ports, HDMI, two USB-A ports, Gigabit Ethernet, and a headphone jack, provide flexibility for all your peripherals.

The Mac Mini M4 supports up to three external displays simultaneously, making it perfect for multi-screen setups. It offers versatile configurations, such as two displays up to 6K resolution at 60Hz via Thunderbolt and one display up to 4K at 60Hz via HDMI. This flexibility caters to professionals working with design, video editing, or other screen-intensive tasks.

Ideal for professionals, designers, and businesses, this compact yet powerful device supports multiple high-resolution monitors. Renting offers a cost-effective, flexible solution with weekly and monthly plans, making it easy to meet short-term or long-term project needs. Accessories include a power cable and delivery box, with reliable support and delivery services. Optimize your workspace today with the power of Apple!

**NOTE: If you rent an Apple Mac Mini M4, you will require a Apple Magic Keyboard and Apple Magic Mouse to ensure a smooth installation. For a hassle-free experience, add the setup service at checkout so our technician can facilitate the device setup and installation. **', 'cat_computers', NULL, 0, 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, tagline = excluded.tagline, description = excluded.description, category_id = excluded.category_id, badge = excluded.badge, featured = excluded.featured, status = excluded.status;
DELETE FROM product_images WHERE product_id = 'prod_apple-mac-mini-m4';
DELETE FROM product_highlights WHERE product_id = 'prod_apple-mac-mini-m4';
DELETE FROM product_specs WHERE product_id = 'prod_apple-mac-mini-m4';
DELETE FROM product_prices WHERE product_id = 'prod_apple-mac-mini-m4';
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_apple-mac-mini-m4', 0, '/products/images/047.jpg', 'Apple Mac Mini M4');
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_apple-mac-mini-m4', 1, '/products/images/048.jpg', 'Apple Mac Mini M4 - back view');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_apple-mac-mini-m4', 0, 'Mac');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-mac-mini-m4', 0, 'MODEL', 'Mac Mini M4');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-mac-mini-m4', 1, 'STORAGE', '256GB SSD');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-mac-mini-m4', 2, 'PROCESSOR', 'Apple M4 with 10-core CPU, 10-core GPU, 16-core Neural Engine');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-mac-mini-m4', 3, 'RAM MEMORY', '16GB unified memory');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-mac-mini-m4', 4, 'GRAPHICS', 'Apple Silicon M4');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-mac-mini-m4', 5, 'CONNECTIVITY', 'Up to 3 screens, 1x Gigabit Ethernet, 2x Thunderbolt 4 ports, 1x HDMI port, 2x USB-A ports, 1x headphone jack');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-mac-mini-m4', 6, 'DIMENSIONS', '363.8 (L) × 243.5 (W) × 19.9 (H) mm • 1.8 kg');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-mac-mini-m4', 7, 'OPERATING SYSTEM', 'macOS 14 Sonoma');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_apple-mac-mini-m4', 'loc_bali', 'USD', 3900, '36000', '1200');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_apple-mac-mini-m4', 'loc_da-nang', 'USD', 3900, '36000', '1200');
INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status) VALUES ('prod_apple-mac-studio', 'apple-mac-studio', 'Apple Mac Studio', 'Apple M1 Max with 10‑core CPU, 24‑core GPU, 16‑core Neural Engine, 32GB unified memory, 512GB SSD storage, or Apple M2 Ultra with 24-core CPU, 60-core GPU, 32-core Neural Engine, 64GB unified memory, 1TB SSD storage. Two USB-C ports (front), one SDXC card slot, four (M1 Max) or six (M2 Ultra) Thunderbolt 4 ports, two USB-A ports, one HDMI port, one 10Gb Ethernet port, one 3.5mm headphone jack.', 'The Apple Mac Studio, available with M1 Max and M2 Ultra chips, is a high-performance powerhouse designed for professionals in editing, 3D design, and demanding computational tasks. It delivers exceptional processing speed, efficiency, and multitasking capabilities, making it ideal for creators and professionals who need peak performance.

With robust connectivity options and the ability to support multiple high-resolution displays, the Mac Studio provides the flexibility required for advanced workflows. Whether you''re handling intensive video editing, 3D rendering, or machine learning, the Mac Studio (M1 Max & M2 Ultra) delivers uncompromising power in a compact desktop form factor.

**NOTE:** If you rent an Apple Mac Studio, we strongly recommend selecting an Apple Magic Keyboard and Apple Magic Mouse to ensure a smooth installation. For a hassle-free experience, add the setup service at checkout so our technician can facilitate the device setup and installation.', 'cat_computers', NULL, 0, 'active')
ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, tagline = excluded.tagline, description = excluded.description, category_id = excluded.category_id, badge = excluded.badge, featured = excluded.featured, status = excluded.status;
DELETE FROM product_images WHERE product_id = 'prod_apple-mac-studio';
DELETE FROM product_highlights WHERE product_id = 'prod_apple-mac-studio';
DELETE FROM product_specs WHERE product_id = 'prod_apple-mac-studio';
DELETE FROM product_prices WHERE product_id = 'prod_apple-mac-studio';
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_apple-mac-studio', 0, '/products/images/049.jpg', 'Apple Mac Studio');
INSERT INTO product_images (product_id, position, url, alt) VALUES ('prod_apple-mac-studio', 1, '/products/images/050.jpg', 'Apple Mac Studio - view 2');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_apple-mac-studio', 0, 'Mac');
INSERT INTO product_highlights (product_id, position, value) VALUES ('prod_apple-mac-studio', 1, 'New');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-mac-studio', 0, 'MODEL', 'Mac Studio M1 Max / Mac Studio M2 Ultra');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-mac-studio', 1, 'STORAGE', '512GB SSD (M1 Max) / 1TB SSD (M2 Ultra)');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-mac-studio', 2, 'PROCESSOR', 'Apple M1 Max: 10-core CPU (8 performance + 2 efficiency cores), 24-core GPU, 16-core Neural Engine / Apple M2 Ultra: 24-core CPU (16 performance + 8 efficiency cores), 60-core GPU, 32-core Neural Engine');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-mac-studio', 3, 'DIMENSIONS', '197.0 (L) × 197.0 (W) × 95.0 (H) mm • 2.7 kg');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-mac-studio', 4, 'RAM MEMORY', '32GB (M1 Max) / 64GB (M2 Ultra)');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-mac-studio', 5, 'GRAPHICS', 'Apple Silicon M1 Max / Apple Silicon M2 Ultra');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-mac-studio', 6, 'CONNECTIVITY M1 MAX', 'Supports up to 4 displays, 2x USB-C ports, 1x SDXC card slot, 4x Thunderbolt 4 ports, 2x USB-A ports, 1x HDMI port, 1x 10Gb Ethernet port, 1x 3.5mm headphone jack');
INSERT INTO product_specs (product_id, position, label, value) VALUES ('prod_apple-mac-studio', 7, 'CONNECTIVITY M2 ULTRA', 'Supports up to 8 displays, 2x USB-C ports (front), 2x USB-C ports (back), 1x SDXC card slot, 6x Thunderbolt 4 ports, 2x USB-A ports, 1x HDMI port, 1x 10Gb Ethernet port, 1x 3.5mm headphone jack');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_apple-mac-studio', 'loc_bali', 'USD', 6900, '216000', '2000');
INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee) VALUES ('prod_apple-mac-studio', 'loc_da-nang', 'USD', 6900, '216000', '2000');
