import React from "react";
import { cn } from "@/lib/utils";
import { TextShimmer } from "./TextShimmer";

export type WanderingEyesProps = React.ComponentProps<"span"> & {
  eyeScale?: number;
  gapScale?: number;
  pupilScale?: number;
  blinkScale?: number;
  travelScale?: number;
  size?: "inline" | "sm" | "default" | "md" | "modal" | "large" | "lg" | "xl";
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function WanderingEyes({
  className,
  style,
  eyeScale,
  gapScale = 0.09,
  pupilScale = 0.32,
  blinkScale = 0.375,
  travelScale = 0.3125,
  size = "default",
  ...props
}: WanderingEyesProps) {
  // Calibrated size presets per Section 8 of loading state architecture
  const resolvedEyeScale =
    eyeScale ??
    (size === "inline" || size === "sm"
      ? 0.35
      : size === "xl"
        ? 0.68
        : size === "modal" || size === "large" || size === "lg"
          ? 0.65
          : 0.62);

  const defaultHeightClass =
    size === "inline" || size === "sm"
      ? "h-4"
      : size === "xl"
        ? "h-14"
        : size === "modal" || size === "large" || size === "lg"
          ? "h-12"
          : "h-[1.25em]";

  const safeEyeScale = clamp(resolvedEyeScale, 0.28, 0.7);
  const safeGapScale = clamp(gapScale, 0.04, 0.3);
  const safePupilScale = clamp(pupilScale, 0.12, 0.45);
  const safeBlinkScale = clamp(blinkScale, 0.15, 1);
  const safeTravelScale = clamp(travelScale, 0.08, 0.5);

  const eyesStyle = {
    ...style,
    "--loading-ui-wandering-eyes-eye": `${(safeEyeScale * 100).toFixed(2)}cqmin`,
    "--loading-ui-wandering-eyes-gap": `${(safeGapScale * 100).toFixed(2)}cqmin`,
    "--loading-ui-wandering-eyes-pupil-scale": `${safePupilScale}`,
    "--loading-ui-wandering-eyes-blink": `${safeBlinkScale}`,
    "--loading-ui-wandering-eyes-travel-scale": `${safeTravelScale}`,
  } as React.CSSProperties;

  return (
    <>
      <style>{`
        @keyframes loading-ui-wandering-eyes-move {
          0%,
          10% {
            background-position: 0 0;
          }

          13%,
          40% {
            background-position: calc(var(--loading-ui-wandering-eyes-eye) * var(--loading-ui-wandering-eyes-travel-scale) * -1) 0;
          }

          43%,
          70% {
            background-position: calc(var(--loading-ui-wandering-eyes-eye) * var(--loading-ui-wandering-eyes-travel-scale)) 0;
          }

          73%,
          90% {
            background-position: 0 calc(var(--loading-ui-wandering-eyes-eye) * var(--loading-ui-wandering-eyes-travel-scale));
          }

          93%,
          100% {
            background-position: 0 0;
          }
        }

        @keyframes loading-ui-wandering-eyes-blink {
          0%,
          10%,
          12%,
          20%,
          22%,
          40%,
          42%,
          60%,
          62%,
          70%,
          72%,
          90%,
          92%,
          98%,
          100% {
            height: var(--loading-ui-wandering-eyes-eye);
          }

          11%,
          21%,
          41%,
          61%,
          71%,
          91%,
          99% {
            height: calc(var(--loading-ui-wandering-eyes-eye) * var(--loading-ui-wandering-eyes-blink));
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .wandering-eyes-pupil {
            animation: none !important;
          }
        }
      `}</style>
      <span
        role="status"
        className={cn(
          "@container-[size] [container-type:size] relative inline-flex aspect-9/4 items-center justify-center align-middle shrink-0 [--eye-color:color-mix(in_srgb,currentColor_16%,transparent)] [--pupil-color:currentColor]",
          defaultHeightClass,
          className,
        )}
        style={eyesStyle}
        {...props}
      >
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center gap-(--loading-ui-wandering-eyes-gap)"
        >
          {Array.from({ length: 2 }, (_, index) => (
            <span
              key={index}
              className="wandering-eyes-pupil inline-block rounded-full"
              style={{
                width: "var(--loading-ui-wandering-eyes-eye)",
                height: "var(--loading-ui-wandering-eyes-eye)",
                backgroundColor: "var(--eye-color)",
                backgroundImage:
                  "radial-gradient(circle calc(var(--loading-ui-wandering-eyes-eye) * var(--loading-ui-wandering-eyes-pupil-scale)), var(--pupil-color) 100%, transparent 0)",
                backgroundRepeat: "no-repeat",
                animation:
                  "loading-ui-wandering-eyes-move var(--duration, 10s) infinite, loading-ui-wandering-eyes-blink var(--duration, 10s) infinite",
              }}
            />
          ))}
        </span>
        <span className="sr-only">Loading</span>
      </span>
    </>
  );
}

export function GlobalLoader({
  text = "Loading",
  size = "large",
  className,
  ...props
}: WanderingEyesProps & { text?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
      <WanderingEyes size={size} className="text-white" {...props} />
      {text && (
        <TextShimmer className="text-xs font-mono tracking-widest text-white uppercase">
          {text}
        </TextShimmer>
      )}
    </div>
  );
}

export { WanderingEyes };
