"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Tilt each sleeve with its viewport position, keeping its projected space compact. */
export function RecordShelfMotion({ children, className }: { children: ReactNode; className: string }) {
  const shelfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const records = Array.from(shelfRef.current?.querySelectorAll<HTMLElement>("[data-shelf-record]") ?? []);
    if (!records.length) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const visible = new Set<HTMLElement>();
    let observer: IntersectionObserver | null = null;
    let frame = 0;

    function projectedHeight(width: number, angle: number, narrow: boolean) {
      const radians = angle * Math.PI / 180;
      const perspective = narrow ? 1000 : 1400;
      const edge = narrow ? 48 : 28;
      return Math.ceil(width * Math.cos(radians) / (1 + width * Math.sin(radians) / perspective) + edge);
    }

    // Use the stationary, reduced-motion angle as a safe initial size.
    function sizeRecords() {
      const narrow = window.innerWidth <= 650;
      const widths = records.map(record => ({ record, width: record.clientWidth }));
      for (const { record, width } of widths) {
        if (!width) continue;
        record.style.setProperty("--shelf-object-height", `${projectedHeight(width, 44, narrow)}px`);
      }
    }

    function update() {
      frame = 0;
      const viewport = window.innerHeight || document.documentElement.clientHeight;
      const narrow = window.innerWidth <= 650;
      // Batch all reads before writes to avoid forcing layout for every record.
      const positions = Array.from(visible, record => ({ record, rect: record.getBoundingClientRect() }));
      for (const { record, rect } of positions) {
        const position = Math.max(0, Math.min(1, (rect.top + rect.height * 0.5) / viewport));
        const angle = narrow ? 77 - position * 37 : 80 - position * 45;
        record.style.setProperty("--shelf-tilt", `${angle.toFixed(1)}deg`);
        if (rect.width) record.style.setProperty("--shelf-object-height", `${projectedHeight(rect.width, angle, narrow)}px`);
      }
    }

    function schedule() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }

    function onResize() {
      sizeRecords();
      if (!reducedMotion.matches) schedule();
    }

    function stop() {
      observer?.disconnect();
      observer = null;
      window.removeEventListener("scroll", schedule);
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      visible.clear();
      records.forEach(record => record.style.removeProperty("--shelf-tilt"));
    }

    function start() {
      stop();
      if (reducedMotion.matches) {
        sizeRecords();
        return;
      }
      if ("IntersectionObserver" in window) {
        observer = new IntersectionObserver(entries => {
          for (const entry of entries) {
            const record = entry.target as HTMLElement;
            if (entry.isIntersecting) visible.add(record);
            else visible.delete(record);
          }
          schedule();
        }, { rootMargin: "600px 0px" });
        records.forEach(record => observer?.observe(record));
      } else {
        records.forEach(record => visible.add(record));
      }
      window.addEventListener("scroll", schedule, { passive: true });
      schedule();
    }

    sizeRecords();
    window.addEventListener("resize", onResize, { passive: true });
    start();
    reducedMotion.addEventListener("change", start);
    return () => {
      reducedMotion.removeEventListener("change", start);
      window.removeEventListener("resize", onResize);
      stop();
      records.forEach(record => record.style.removeProperty("--shelf-object-height"));
    };
  }, []);

  return <div ref={shelfRef} className={className}>{children}</div>;
}
