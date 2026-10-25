# Product photos

The catalog photos: two per product, numbered so the order is stable.

- `images/` — the files themselves, `<sequence>.jpg`, numbered across the whole
  catalog in seed order.
- `manifest.json` — the product slug mapped to its files, their alt text and
  the monis.rent source each file came from.

The seed (`packages/db/seed.sql`) references the files by their site path,
`/products/images/<sequence>.jpg`. They move to the R2 bucket later; when they
do, only the path prefix changes — the file names stay.

Keep the manifest in step with the files: it is what maps a product to its
photos and keeps the source of every image on record.
