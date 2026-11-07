import { Button } from "@async-rent/ui/components/button";
import { RiCheckLine, RiFileCopyLine } from "@remixicon/react";
import { useEffect, useState, type ComponentProps } from "react";

interface CopyButtonProps extends Omit<ComponentProps<typeof Button>, "onClick" | "children"> {
  /** The text put on the clipboard. */
  value: string;
  /** What is copied, e.g. "setup prompt": names the button ("Copy setup prompt") and the announcement. */
  label: string;
}

/** An icon button that copies `value` and shows a check for two seconds. */
export function CopyButton({ value, label, ...props }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const Icon = copied ? RiCheckLine : RiFileCopyLine;

  return (
    <Button
      {...props}
      aria-label={`Copy ${label}`}
      onClick={() => {
        // A refused clipboard (insecure origin, denied permission) leaves the
        // text on screen to select by hand, so there is nothing else to do.
        navigator.clipboard.writeText(value).then(
          () => setCopied(true),
          () => undefined,
        );
      }}
    >
      <Icon />
      <span aria-live="polite" className="sr-only">
        {copied ? `Copied ${label}` : ""}
      </span>
    </Button>
  );
}
