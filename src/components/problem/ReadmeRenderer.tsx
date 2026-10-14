import React, { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";

export interface ReadmeRendererProps {
  content?: string | null | undefined;
  className?: string;
  inline?: boolean;
}

// Configure marked with GitHub-Flavored Markdown & line break fidelity
marked.setOptions({
  gfm: true,
  breaks: true,
});

export const ReadmeRenderer: React.FC<ReadmeRendererProps> = ({
  content,
  className = "",
  inline = false,
}) => {
  const sanitizedHtml = useMemo(() => {
    if (!content || typeof content !== "string") {
      return "";
    }

    try {
      const rawHtml = inline
        ? (marked.parseInline(content) as string)
        : (marked.parse(content, { async: false }) as string);
      return DOMPurify.sanitize(rawHtml, {
        ADD_ATTR: ["target", "rel", "class"],
        ADD_TAGS: ["kbd", "samp", "sup", "sub"],
      });
    } catch {
      // Fallback: return escaped text
      return DOMPurify.sanitize(content);
    }
  }, [content, inline]);

  if (!sanitizedHtml) {
    return null;
  }

  if (inline) {
    return (
      <span
        className={cn(
          "readme-renderer-inline text-[13px] text-zinc-200 selection:bg-lime-400/20 selection:text-white",
          className
        )}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    );
  }

  return (
    <div
      className={cn(
        "readme-renderer text-[13.5px] leading-relaxed text-zinc-200 selection:bg-lime-400/20 selection:text-white",
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};

export default ReadmeRenderer;
