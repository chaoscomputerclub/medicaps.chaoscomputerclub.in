import React, { useState, useCallback } from "react";
import { Check, Copy } from "lucide-react";
import {
  formatExampleInput,
  formatExampleOutput,
  type FunctionSignatureContract,
  type TestCaseItem,
} from "@/lib/problemFormatter";
import { ReadmeRenderer } from "./ReadmeRenderer";

export interface ProblemExampleProps {
  index: number;
  functionSignature?: FunctionSignatureContract | null | undefined;
  testcase: TestCaseItem | { stdin?: string; input?: any; expected_output: any; explanation?: string };
  className?: string;
}

export const ProblemExample: React.FC<ProblemExampleProps> = ({
  index,
  functionSignature,
  testcase,
  className = "",
}) => {
  const [copied, setCopied] = useState(false);

  const rawInput = (testcase as any).input !== undefined && (testcase as any).input !== null && (testcase as any).input !== ""
    ? (testcase as any).input
    : (testcase as any).stdin;

  const formattedInput = formatExampleInput(functionSignature, rawInput);
  const formattedOutput = formatExampleOutput(
    testcase.expected_output,
    functionSignature?.return_type
  );

  const handleCopyInput = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formattedInput || String(rawInput || ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Fallback if clipboard API is restricted
      setCopied(false);
    }
  }, [formattedInput, rawInput]);

  return (
    <div
      className={`rounded-lg bg-zinc-950 border border-white/8 p-3.5 space-y-2.5 font-mono text-xs transition-colors hover:border-white/12 ${className}`}
      data-testid={`problem-example-${index}`}
    >
      <div className="flex items-center justify-between text-zinc-300 font-semibold tracking-wide">
        <span className="text-[13px] text-zinc-200">Example {index}:</span>
        <button
          type="button"
          onClick={handleCopyInput}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lime-400"
          title="Copy example input"
        >
          {copied ? (
            <>
              <Check className="size-3 text-lime-400" />
              <span className="text-lime-400 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-3 text-zinc-400" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div className="space-y-1.5 text-[13px] leading-relaxed">
        <div className="text-zinc-400">
          <strong className="text-zinc-200 font-medium select-none">Input: </strong>
          <span className="text-zinc-100 select-text whitespace-pre-wrap break-all">
            {formattedInput || "(empty)"}
          </span>
        </div>

        <div className="text-zinc-400">
          <strong className="text-zinc-200 font-medium select-none">Output: </strong>
          <span className="text-lime-400 select-text whitespace-pre-wrap break-all">
            {formattedOutput || "(empty)"}
          </span>
        </div>

        {testcase.explanation && (
          <div className="text-zinc-400 pt-0.5 font-sans text-xs">
            <strong className="text-zinc-300 font-medium font-mono select-none block pb-0.5">
              Explanation:
            </strong>
            <ReadmeRenderer
              content={testcase.explanation}
              className="text-zinc-400 leading-relaxed select-text"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProblemExample;
