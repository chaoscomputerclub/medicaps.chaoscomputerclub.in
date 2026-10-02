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

const SIZE_CONFIGS: Record<
  NonNullable<WanderingEyesProps["size"]>,
  { eye: string; gap: string; heightClass: string }
> = {
  inline: { eye: "10px", gap: "2px", heightClass: "h-3" },
  sm: { eye: "13px", gap: "2.5px", heightClass: "h-4" },
  default: { eye: "20px", gap: "3.5px", heightClass: "h-6" },
  md: { eye: "20px", gap: "3.5px", heightClass: "h-6" },
  modal: { eye: "32px", gap: "6px", heightClass: "h-8" },
  large: { eye: "52px", gap: "9px", heightClass: "h-[52px]" },
  lg: { eye: "52px", gap: "9px", heightClass: "h-[52px]" },
  xl: { eye: "52px", gap: "9px", heightClass: "h-[52px]" },
};

function WanderingEyes({
  className,
  style,
  eyeScale,
  gapScale,
  pupilScale = 0.32,
  blinkScale = 0.375,
  travelScale = 0.3125,
  size = "default",
  ...props
}: WanderingEyesProps) {
  // Calibrated size presets matching pre-hydration shell and tactical density
  const config = SIZE_CONFIGS[size] ?? SIZE_CONFIGS.default;

  const resolvedEye = eyeScale ? `${(eyeScale * 52).toFixed(1)}px` : config.eye;
  const resolvedGap = gapScale !== undefined ? `${(gapScale * 100).toFixed(1)}px` : config.gap;

  const safePupilScale = clamp(pupilScale, 0.12, 0.45);
  const safeBlinkScale = clamp(blinkScale, 0.15, 1);
  const safeTravelScale = clamp(travelScale, 0.08, 0.5);

  const eyesStyle = {
    height: style?.height ?? config.eye,
    ...style,
    "--loading-ui-wandering-eyes-eye": resolvedEye,
    "--loading-ui-wandering-eyes-gap": resolvedGap,
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
          "relative inline-flex aspect-9/4 items-center justify-center align-middle shrink-0 [--eye-color:color-mix(in_srgb,currentColor_16%,transparent)] [--pupil-color:currentColor]",
          config.heightClass,
          className,
        )}
        style={eyesStyle}
        {...props}
      >
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center"
          style={{ gap: "var(--loading-ui-wandering-eyes-gap)" }}
        >
          {Array.from({ length: 2 }, (_, index) => (
            <span
              key={index}
              className="wandering-eyes-pupil inline-block rounded-full"
              style={{
                width: "var(--loading-ui-wandering-eyes-eye)",
                height: "var(--loading-ui-wandering-eyes-eye)",
                backgroundColor: "var(--eye-color, rgba(255,255,255,0.16))",
                backgroundImage:
                  "radial-gradient(circle calc(var(--loading-ui-wandering-eyes-eye) * var(--loading-ui-wandering-eyes-pupil-scale)), var(--pupil-color, #ffffff) 100%, transparent 0)",
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
    <div className={cn("flex flex-col items-center justify-center select-none", className)}>
      <WanderingEyes size={size} className="text-white" {...props} />
      {text && (
        <TextShimmer className="mt-5 text-[11px] font-mono tracking-[0.25em] text-white uppercase">
          {text}
        </TextShimmer>
      )}
    </div>
  );
}

export { WanderingEyes };
