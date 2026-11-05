import type { Image } from "@async-rent/core";
import { cn } from "cn";
import { useState } from "react";

interface ProductImageProps {
  image?: Image;
  /** Classes for the grey frame around the photo. */
  className?: string;
  /** Classes for the photo inside the frame. */
  imageClassName?: string;
}

/**
 * A product cut-out on the design's fog frame. The photo multiplies onto the
 * frame so white backgrounds disappear; a missing or broken photo leaves the
 * empty frame instead of a broken-image icon.
 */
export function ProductImage({ image, className, imageClassName }: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={cn("flex items-center justify-center overflow-hidden bg-fog", className)}>
      {image && !failed && (
        <img
          src={image.url}
          alt={image.alt ?? ""}
          loading="lazy"
          onError={() => setFailed(true)}
          className={cn("size-full object-contain mix-blend-multiply", imageClassName)}
        />
      )}
    </div>
  );
}
