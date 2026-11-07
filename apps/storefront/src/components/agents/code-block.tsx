import { cn } from "cn";

import { CopyButton } from "./copy-button";

interface CodeBlockProps {
  code: string;
  className?: string;
}

/** A command, URL or config to copy as is. Long lines scroll sideways instead of wrapping mid-flag. */
export function CodeBlock({ code, className }: CodeBlockProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border bg-fog py-1.5 pr-1.5 pl-4",
        className,
      )}
    >
      <pre className="min-w-0 flex-1 overflow-x-auto py-1.5 font-mono text-[12.5px] leading-5 text-ink">
        <code>{code}</code>
      </pre>
      <CopyButton
        value={code}
        label="to clipboard"
        variant="ghost"
        size="icon-sm"
        className="shrink-0"
      />
    </div>
  );
}
