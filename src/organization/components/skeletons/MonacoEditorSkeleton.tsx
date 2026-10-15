import React from "react";

export function MonacoEditorSkeleton() {
  const lines = [
    { num: 1, indent: 0, width: "36%" },
    { num: 2, indent: 4, width: "52%" },
    { num: 3, indent: 4, width: "44%" },
    { num: 4, indent: 8, width: "64%" },
    { num: 5, indent: 8, width: "48%" },
    { num: 6, indent: 12, width: "32%" },
    { num: 7, indent: 8, width: "50%" },
    { num: 8, indent: 4, width: "22%" },
    { num: 9, indent: 0, width: "0%" },
    { num: 10, indent: 4, width: "38%" },
    { num: 11, indent: 8, width: "58%" },
    { num: 12, indent: 8, width: "42%" },
    { num: 13, indent: 4, width: "28%" },
    { num: 14, indent: 0, width: "0%" },
    { num: 15, indent: 4, width: "34%" },
    { num: 16, indent: 8, width: "54%" },
    { num: 17, indent: 8, width: "46%" },
    { num: 18, indent: 4, width: "26%" },
    { num: 19, indent: 0, width: "0%" },
    { num: 20, indent: 4, width: "30%" },
    { num: 21, indent: 0, width: "16%" },
    { num: 22, indent: 0, width: "24%" },
    { num: 23, indent: 4, width: "40%" },
    { num: 24, indent: 0, width: "18%" },
  ];

  return (
    <div className="w-full h-full bg-[#171717] flex flex-col select-none overflow-hidden font-mono pt-3 px-3">
      <div className="space-y-1 flex-1">
        {lines.map((line) => (
          <div key={line.num} className="flex items-center gap-3.5 h-[21px]">
            {/* Monaco line numbers gutter */}
            <span className="w-5 text-right text-[11px] text-zinc-700 tabular-nums select-none shrink-0 font-mono">
              {line.num}
            </span>
            {/* Code token shimmer skeleton */}
            {line.width !== "0%" ? (
              <div
                className="h-3 rounded-[3px] bg-white/[0.06] animate-pulse"
                style={{
                  width: line.width,
                  marginLeft: `${line.indent * 4}px`,
                }}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default MonacoEditorSkeleton;
