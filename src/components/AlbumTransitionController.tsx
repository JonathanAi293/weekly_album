"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

type ReturnPoint = { albumId: string; issuePath: string; offset: number; scrollY: number };

function nextFrame() {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

function scrollImmediately(top: number) {
  const root = document.documentElement;
  const previous = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  window.scrollTo(0, Math.max(0, top));
  root.style.scrollBehavior = previous;
}

function waitForElement(find: () => HTMLElement | null, signal: AbortSignal): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    let observer: MutationObserver | null = null;
    function cleanup() { observer?.disconnect(); signal.removeEventListener("abort", abort); }
    function abort() { cleanup(); reject(new Error("Transition cancelled")); }
    function check() {
      try { const element = find(); if (element) { cleanup(); resolve(element); } }
      catch (error) { cleanup(); reject(error); }
    }
    if (signal.aborted) { abort(); return; }
    observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    signal.addEventListener("abort", abort, { once: true });
    check();
  });
}

function waitForImage(image: HTMLImageElement, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    function cleanup() { image.removeEventListener("load", check); image.removeEventListener("error", fail); signal.removeEventListener("abort", fail); }
    function check() { if (image.complete && image.naturalWidth > 0) { cleanup(); resolve(); } }
    function fail() { cleanup(); reject(new Error("Cover unavailable")); }
    if (signal.aborted) { fail(); return; }
    image.addEventListener("load", check);
    image.addEventListener("error", fail);
    signal.addEventListener("abort", fail, { once: true });
    check();
  });
}

function copyStyle(source: Element, target: HTMLElement, properties: string[]) {
  const computed = getComputedStyle(source);
  for (const property of properties) target.style.setProperty(property, computed.getPropertyValue(property));
}

function makeFlight(source: HTMLElement, face: HTMLElement, spine: HTMLElement) {
  const rect = source.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const sourceImage = face.querySelector("img");
  if (!width || !height || !sourceImage || !sourceImage.complete || !sourceImage.naturalWidth) return null;

  const object = source.cloneNode(true) as HTMLElement;
  const flightFace = object.querySelector<HTMLElement>("[data-shelf-face]");
  const flightSpine = object.querySelector<HTMLElement>("[data-shelf-spine]");
  const image = flightFace?.querySelector("img");
  if (!flightFace || !flightSpine || !image) return null;
  const sourceUrl = sourceImage.currentSrc || sourceImage.src;
  image.src = sourceUrl;
  image.removeAttribute("srcset");
  image.loading = "eager";

  const edge = parseFloat(getComputedStyle(spine).height) || 0;
  const tilt = parseFloat(getComputedStyle(source).getPropertyValue("--shelf-tilt")) || (window.innerWidth <= 650 ? 43 : 46);
  const perspective = window.innerWidth <= 650 ? 1000 : 1400;
  const layer = document.createElement("div");
  const backdrop = document.createElement("div");
  const wrapper = document.createElement("div");
  layer.className = "album-flight-layer";
  layer.setAttribute("aria-hidden", "true");
  backdrop.className = "album-flight-backdrop";
  Object.assign(wrapper.style, { position: "fixed", left: `${rect.left}px`, top: `${rect.top}px`, width: `${width}px`, height: `${height}px`, transformOrigin: "0 0", pointerEvents: "none" });
  Object.assign(object.style, { position: "relative", width: `${width}px`, height: `${height}px`, filter: getComputedStyle(source).filter });
  Object.assign(flightFace.style, { position: "absolute", left: "0", right: "0", bottom: `${edge}px`, width: "100%", height: `${width}px`, transformOrigin: "50% 100%", transform: `perspective(${perspective}px) rotateX(${tilt}deg)`, backfaceVisibility: "hidden" });
  copyStyle(face, flightFace, ["background", "box-shadow"]);
  Object.assign(image.style, { display: "block", width: "100%", height: "100%", objectFit: "cover" });
  copyStyle(spine, flightSpine, ["position", "left", "right", "bottom", "height", "display", "grid-template-columns", "align-items", "gap", "padding", "overflow", "border-radius", "background", "box-shadow", "color", "font-family", "font-size", "letter-spacing"]);
  Array.from(spine.children).forEach((child, index) => {
    const copy = flightSpine.children[index];
    if (copy instanceof HTMLElement) copyStyle(child, copy, ["font-family", "font-size", "font-style", "font-variant", "letter-spacing", "text-align", "overflow", "text-overflow", "white-space"]);
  });
  const sheen = flightFace.lastElementChild;
  if (sheen instanceof HTMLElement && sheen !== image) Object.assign(sheen.style, { position: "absolute", inset: "0", background: "linear-gradient(180deg, rgba(255,255,255,.06), transparent 55%, rgba(0,0,0,.18))", pointerEvents: "none" });
  wrapper.appendChild(object);
  layer.append(backdrop, wrapper);
  document.body.appendChild(layer);
  return { rect, width, height, edge, tilt, perspective, sourceUrl, layer, backdrop, wrapper, object, face: flightFace, spine: flightSpine };
}

function makeReturnPreview(point: ReturnPoint) {
  // Leave touch-driven browser history gestures entirely to the system.
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios || !window.matchMedia("(hover: hover) and (pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof Element.prototype.animate !== "function" || typeof Animation === "undefined" || !("finished" in Animation.prototype)) return null;
  const article = document.getElementById(point.albumId);
  const image = article?.firstElementChild?.querySelector("img.cover");
  if (!(image instanceof HTMLImageElement) || !image.complete || !image.naturalWidth) return null;
  const rect = image.getBoundingClientRect();
  if (!rect.width || rect.top < 0 || rect.bottom > window.innerHeight || rect.left < 0 || rect.right > window.innerWidth) return null;
  const layer = document.createElement("div");
  const backdrop = document.createElement("div");
  const copy = image.cloneNode(true) as HTMLImageElement;
  const sourceUrl = image.currentSrc || image.src;
  layer.className = "album-flight-layer";
  layer.setAttribute("aria-hidden", "true");
  backdrop.className = "album-flight-backdrop";
  copy.src = sourceUrl;
  copy.removeAttribute("srcset");
  Object.assign(copy.style, { position: "fixed", left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, objectFit: "cover" });
  layer.append(backdrop, copy);
  document.body.appendChild(layer);
  backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: "ease-out", fill: "forwards" });
  return { layer, rect, sourceUrl };
}

async function animateReturn(record: HTMLElement, preview: NonNullable<ReturnType<typeof makeReturnPreview>>, signal: AbortSignal) {
  const source = record.querySelector<HTMLElement>("[data-shelf-object]");
  const face = record.querySelector<HTMLElement>("[data-shelf-face]");
  const spine = record.querySelector<HTMLElement>("[data-shelf-spine]");
  if (!source || !face || !spine || signal.aborted) return;
  const flight = makeFlight(source, face, spine);
  if (!flight) return;
  if (flight.sourceUrl !== preview.sourceUrl) { flight.layer.remove(); return; }
  const previousVisibility = source.style.visibility;
  const animations: Animation[] = [];
  const cancel = () => animations.forEach(animation => animation.cancel());
  signal.addEventListener("abort", cancel, { once: true });
  source.style.visibility = "hidden";
  record.setAttribute("data-transition-freeze", "");
  document.documentElement.classList.add("album-flight-active");

  try {
    const x = preview.rect.left - flight.rect.left;
    const y = preview.rect.top - flight.rect.top;
    const scale = preview.rect.width / flight.width;
    const start = `translate3d(${x}px,${y}px,0) scale(${scale})`;
    flight.wrapper.style.transform = start;
    flight.object.style.height = `${flight.width}px`;
    flight.face.style.bottom = "0px";
    flight.face.style.transform = `perspective(${flight.perspective}px) rotateX(0deg)`;
    flight.spine.style.opacity = "0";
    flight.backdrop.style.opacity = "1";
    const options: KeyframeAnimationOptions = { duration: 620, easing: "cubic-bezier(.22, 1, .36, 1)", fill: "forwards" };
    const move = flight.wrapper.animate([{ transform: start }, { transform: "translate3d(0,0,0) scale(1)" }], options);
    animations.push(move);
    animations.push(flight.object.animate([{ height: `${flight.width}px` }, { height: `${flight.height}px` }], options));
    animations.push(flight.face.animate([{ bottom: "0px", transform: `perspective(${flight.perspective}px) rotateX(0deg)` }, { bottom: `${flight.edge}px`, transform: `perspective(${flight.perspective}px) rotateX(${flight.tilt}deg)` }], options));
    animations.push(flight.spine.animate([{ opacity: 0, transform: "scaleY(.1)" }, { opacity: 1, transform: "scaleY(1)" }], { ...options, delay: 180, duration: 440 }));
    animations.push(flight.backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { ...options, duration: 550 }));
    preview.layer.remove();
    await move.finished;
  } catch {
    // Native history navigation remains in control if the animation is interrupted.
  } finally {
    signal.removeEventListener("abort", cancel);
    source.style.visibility = previousVisibility;
    record.removeAttribute("data-transition-freeze");
    document.documentElement.classList.remove("album-flight-active");
    animations.forEach(animation => animation.cancel());
    flight.layer.remove();
  }
}

export function AlbumTransitionController() {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const returnPoint = useRef<ReturnPoint | null>(null);

  useEffect(() => {
    const point = returnPoint.current;
    if (point && pathname !== point.issuePath && (pathname !== "/" || pathRef.current === point.issuePath)) returnPoint.current = null;
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ALBUM_TRANSITIONS === "0") return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let active: AbortController | null = null;
    let restoring: AbortController | null = null;

    async function fly(record: HTMLElement, source: HTMLElement, face: HTMLElement, spine: HTMLElement, destination: URL) {
      let flight: ReturnType<typeof makeFlight>;
      try { flight = makeFlight(source, face, spine); }
      catch { router.push(destination.pathname + destination.search + destination.hash); return; }
      if (!flight) { router.push(destination.pathname + destination.search + destination.hash); return; }
      const controller = new AbortController();
      active = controller;
      const timeout = window.setTimeout(() => controller.abort(), 8000);
      const sourceVisibility = source.style.visibility;
      let targetCover: HTMLElement | null = null;
      let targetVisibility = "";
      let contentAnimation: Animation | null = null;
      const animations: Animation[] = [];
      const cancelAnimations = () => { animations.forEach(animation => animation.cancel()); contentAnimation?.cancel(); };
      controller.signal.addEventListener("abort", cancelAnimations, { once: true });
      const albumId = record.dataset.shelfAlbum || "";
      returnPoint.current = { albumId, issuePath: destination.pathname, offset: record.getBoundingClientRect().top, scrollY: window.scrollY };
      source.style.visibility = "hidden";
      document.documentElement.classList.add("album-flight-active");

      try {
        animations.push(flight.backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 330, easing: "ease-out", fill: "forwards" }));
        const lift = flight.wrapper.animate([{ transform: "translate3d(0,0,0)" }, { transform: "translate3d(0,-10px,0)" }], { duration: 120, easing: "ease-out", fill: "forwards" });
        animations.push(lift);
        router.push(destination.pathname + destination.search + destination.hash, { scroll: false });

        const target = await waitForElement(() => {
          if (window.location.pathname !== destination.pathname) {
            if (window.location.pathname !== "/") throw new Error("Navigation redirected");
            return null;
          }
          const article = document.getElementById(albumId);
          if (article?.classList.contains("detail-card")) return article;
          if (document.querySelector("[data-issue-content], .next-error-h1, meta[name='boundary-next-error']")) throw new Error("Detail unavailable");
          return null;
        }, controller.signal);
        targetCover = target.firstElementChild?.querySelector<HTMLElement>(".cover") ?? null;
        if (!targetCover) throw new Error("Detail cover unavailable");
        targetVisibility = targetCover.style.visibility;
        targetCover.style.visibility = "hidden";

        const safeProbe = document.createElement("div");
        safeProbe.style.paddingTop = "env(safe-area-inset-top, 0px)";
        flight.layer.appendChild(safeProbe);
        const safeTop = parseFloat(getComputedStyle(safeProbe).paddingTop) || 0;
        safeProbe.remove();
        scrollImmediately(window.scrollY + target.getBoundingClientRect().top - safeTop - 24);
        await nextFrame();
        const targetImage = targetCover instanceof HTMLImageElement ? targetCover : null;
        if (!targetImage) throw new Error("Detail cover unavailable");
        await waitForImage(targetImage, controller.signal);
        if ((targetImage.currentSrc || targetImage.src) !== flight.sourceUrl) throw new Error("Cover source changed");
        await lift.finished;
        if (controller.signal.aborted) throw new Error("Transition cancelled");
        const destinationRect = targetCover.getBoundingClientRect();
        if (!destinationRect.width || !destinationRect.height) throw new Error("Detail cover not visible");
        const x = destinationRect.left - flight.rect.left;
        const y = destinationRect.top - flight.rect.top;
        const scale = destinationRect.width / flight.width;
        const options: KeyframeAnimationOptions = { duration: 580, easing: "cubic-bezier(.22, 1, .36, 1)", fill: "forwards" };
        const move = flight.wrapper.animate([{ transform: "translate3d(0,-10px,0) scale(1)" }, { transform: `translate3d(${x}px,${y}px,0) scale(${scale})` }], options);
        animations.push(move);
        animations.push(flight.object.animate([{ height: `${flight.height}px` }, { height: `${flight.width}px` }], options));
        animations.push(flight.face.animate([{ bottom: `${flight.edge}px`, transform: `perspective(${flight.perspective}px) rotateX(${flight.tilt}deg)` }, { bottom: "0px", transform: `perspective(${flight.perspective}px) rotateX(0deg)` }], options));
        animations.push(flight.spine.animate([{ opacity: 1, transform: "scaleY(1)" }, { opacity: 0, transform: "scaleY(.1)" }], { ...options, duration: 420 }));
        const content = target.lastElementChild;
        if (content instanceof HTMLElement) {
          contentAnimation = content.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 300, delay: 320, easing: "ease-out", fill: "both" });
        }
        await move.finished;
        if (controller.signal.aborted) throw new Error("Transition cancelled");
        targetCover.style.visibility = targetVisibility;
        targetCover = null;
        await nextFrame();
        const fade = flight.backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: "ease-out", fill: "forwards" });
        animations.push(fade);
        await fade.finished;
      } catch {
        // The ordinary route and its loading/error UI remain available on failure.
      } finally {
        window.clearTimeout(timeout);
        controller.signal.removeEventListener("abort", cancelAnimations);
        if (targetCover) targetCover.style.visibility = targetVisibility;
        source.style.visibility = sourceVisibility;
        document.documentElement.classList.remove("album-flight-active");
        animations.forEach(animation => animation.cancel());
        contentAnimation?.cancel();
        flight.layer.remove();
        if (active === controller) active = null;
      }
    }

    function click(event: MouseEvent) {
      const element = event.target instanceof Element ? event.target : null;
      const link = element?.closest<HTMLAnchorElement>("a[data-album-transition]");
      if (active) {
        if (link) { event.preventDefault(); event.stopPropagation(); }
        else if (element?.closest("a, button")) active.abort();
        return;
      }
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute("download")) return;
      if (reducedMotion.matches || typeof Element.prototype.animate !== "function" || typeof Animation === "undefined" || !("finished" in Animation.prototype) || document.visibilityState !== "visible") return;
      const record = link.closest<HTMLElement>("[data-shelf-album]");
      const source = link.querySelector<HTMLElement>("[data-shelf-object]");
      const face = link.querySelector<HTMLElement>("[data-shelf-face]");
      const spine = link.querySelector<HTMLElement>("[data-shelf-spine]");
      const destination = new URL(link.href, window.location.href);
      if (!record?.dataset.shelfAlbum || !source || !face || !spine || destination.origin !== window.location.origin || !destination.pathname.startsWith("/issues/") || destination.hash !== `#${record.dataset.shelfAlbum}`) return;
      const image = face.querySelector("img");
      if (!image?.complete || !image.naturalWidth) return;
      event.preventDefault();
      event.stopPropagation();
      restoring?.abort();
      void fly(record, source, face, spine, destination);
    }

    function restore(point: ReturnPoint, preview: ReturnType<typeof makeReturnPreview>) {
      restoring?.abort();
      const controller = new AbortController();
      restoring = controller;
      if (preview) active = controller;
      const timeout = window.setTimeout(() => controller.abort(), 4000);
      const cancel = () => controller.abort();
      window.addEventListener("touchstart", cancel, { passive: true, once: true });
      window.addEventListener("wheel", cancel, { passive: true, once: true });
      window.addEventListener("keydown", cancel, { once: true });
      void waitForElement(() => {
        if (window.location.pathname !== "/") return null;
        return Array.from(document.querySelectorAll<HTMLElement>("[data-shelf-album]")).find(item => item.dataset.shelfAlbum === point.albumId) ?? null;
      }, controller.signal).then(async record => {
        let stableFrames = 0;
        for (let i = 0; i < 12 && stableFrames < 3 && !controller.signal.aborted; i += 1) {
          await nextFrame();
          if (controller.signal.aborted || window.location.pathname !== "/") return;
          const difference = record.getBoundingClientRect().top - point.offset;
          stableFrames = Math.abs(difference) < 2 ? stableFrames + 1 : 0;
          const top = window.scrollY + difference;
          scrollImmediately(Number.isFinite(top) ? top : point.scrollY);
        }
        if (preview && !controller.signal.aborted) await animateReturn(record, preview, controller.signal);
      }).catch(() => {}).finally(() => {
        window.clearTimeout(timeout);
        preview?.layer.remove();
        window.removeEventListener("touchstart", cancel);
        window.removeEventListener("wheel", cancel);
        window.removeEventListener("keydown", cancel);
        if (active === controller) active = null;
        if (restoring === controller) restoring = null;
      });
    }

    function popstate() {
      active?.abort();
      const point = returnPoint.current;
      if (point && window.location.pathname === "/" && (pathRef.current === point.issuePath || document.getElementById(point.albumId))) {
        returnPoint.current = null;
        restore(point, makeReturnPreview(point));
      }
    }
    function interrupt() { active?.abort(); }
    function visibility() { if (document.visibilityState !== "visible") interrupt(); }
    function motionPreference() { if (reducedMotion.matches) interrupt(); }

    document.addEventListener("click", click, true);
    document.addEventListener("visibilitychange", visibility);
    reducedMotion.addEventListener("change", motionPreference);
    window.addEventListener("popstate", popstate);
    window.addEventListener("resize", interrupt);
    window.addEventListener("wheel", interrupt, { passive: true });
    window.addEventListener("touchmove", interrupt, { passive: true });
    return () => {
      active?.abort();
      restoring?.abort();
      document.removeEventListener("click", click, true);
      document.removeEventListener("visibilitychange", visibility);
      reducedMotion.removeEventListener("change", motionPreference);
      window.removeEventListener("popstate", popstate);
      window.removeEventListener("resize", interrupt);
      window.removeEventListener("wheel", interrupt);
      window.removeEventListener("touchmove", interrupt);
    };
  }, [router]);

  return null;
}
