/**
 * Chaos Computer Club India — chaoscomputerclub.in
 *
 * Copyright (c) 2026 Chaos Computer Club India
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import { useEffect, useState } from "react";

/** Returns scroll direction plus current offset, for the reverse-scroll HUD. */
export function useScrollDirection() {
  const [state, setState] = useState<{ dir: "up" | "down"; y: number }>({ dir: "down", y: 0 });

  useEffect(() => {
    let last = window.scrollY;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (Math.abs(y - last) > 4) {
          setState({ dir: y > last ? "down" : "up", y });
          last = y;
        } else {
          setState((s) => ({ ...s, y }));
        }
        raf = 0;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return state;
}
