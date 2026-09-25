import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import sharp from "sharp";
import { deriveAutoPalette, type AutoPalette } from "./site-theme";

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 30_000_000;
const MAX_REDIRECTS = 2;
const IMAGE_REQUEST_TIMEOUT_MS = 2500;
const CACHE_TTL_MS = 60 * 60 * 1000;
const imageCache = new Map<string, { expiresAt: number; result: Promise<AutoPalette | null> }>();
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);

function isPublicIPv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113) || (a === 192 && b === 0 && c === 0)) return false;
  return true;
}

function isPublicIPv6(address: string) {
  const normalized = address.toLowerCase().split("%")[0];
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice(7);
    if (isIP(mapped) === 4) return isPublicIPv4(mapped);
    return false;
  }
  const firstSegment = parseInt(normalized.split(":").find(Boolean) ?? "0", 16);
  // Only global unicast 2000::/3 is accepted. This excludes unspecified, loopback,
  // link-local, unique-local, multicast, and IPv4-compatible special addresses.
  if ((firstSegment & 0xe000) !== 0x2000) return false;
  if (normalized.startsWith("2001:db8:")) return false;
  return true;
}

async function assertPublicHttpsUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Invalid image URL"); }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new Error("Only public HTTPS images are allowed");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("Local image hosts are not allowed");
  if (isIP(host) === 4 && !isPublicIPv4(host)) throw new Error("Private image hosts are not allowed");
  if (isIP(host) === 6 && !isPublicIPv6(host)) throw new Error("Private image hosts are not allowed");
  if (!isIP(host)) {
    const addresses = await lookup(host, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(item => !(item.family === 4 ? isPublicIPv4(item.address) : isPublicIPv6(item.address)))) throw new Error("Image host does not resolve to public addresses");
  }
  return url;
}

async function downloadImage(source: string) {
  let url = source;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_REQUEST_TIMEOUT_MS);
  try {
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      const parsed = await assertPublicHttpsUrl(url);
      const response = await fetch(parsed, {
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.1" },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location || redirectCount === MAX_REDIRECTS) throw new Error("Too many image redirects");
        url = new URL(location, parsed).toString();
        continue;
      }
      if (!response.ok || !response.body) throw new Error("Image is unavailable");
      const mimeType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (!IMAGE_TYPES.has(mimeType)) {
        await response.body.cancel();
        throw new Error("Response is not an image");
      }
      const contentLength = Number(response.headers.get("content-length") ?? 0);
      if (contentLength > MAX_IMAGE_BYTES) {
        await response.body.cancel();
        throw new Error("Image is too large");
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_IMAGE_BYTES) {
          await reader.cancel();
          throw new Error("Image is too large");
        }
        chunks.push(value);
      }
      return Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
    }
    throw new Error("Image is unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

async function pixelsFrom(image: Buffer, width: number, height: number) {
  const result = await sharp(image, { failOn: "error", limitInputPixels: MAX_IMAGE_PIXELS })
    .rotate()
    .resize({ width, height, fit: "cover", position: "centre" })
    .flatten({ background: "#ffffff" })
    .toColourspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (result.info.channels < 3) throw new Error("Unsupported image color space");
  return { data: new Uint8Array(result.data), width: result.info.width, height: result.info.height };
}

async function analyze(source: string): Promise<AutoPalette | null> {
  try {
    const image = await downloadImage(source);
    const metadata = await sharp(image, { failOn: "error", limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
    if (!metadata.width || !metadata.height || metadata.width > 12000 || metadata.height > 12000) return null;
    const [full, desktop, mobile] = await Promise.all([
      pixelsFrom(image, 40, 40),
      pixelsFrom(image, 480, 220),
      pixelsFrom(image, 300, 440),
    ]);
    return deriveAutoPalette(full.data, full.width, full.height, desktop.data, desktop.width, desktop.height, mobile.data, mobile.width, mobile.height);
  } catch {
    return null;
  }
}

/** Reject malformed, animated, or unexpectedly large Hero uploads before writing them to public storage. */
export async function validateHeroImageBuffer(image: Buffer, expectedFormat: "jpeg" | "png" | "webp") {
  try {
    const metadata = await sharp(image, { failOn: "error", limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
    return Boolean(metadata.format === expectedFormat && metadata.width && metadata.height && metadata.width <= 12000 && metadata.height <= 12000 && metadata.width * metadata.height <= MAX_IMAGE_PIXELS && (metadata.pages ?? 1) === 1);
  } catch { return false; }
}

/** Only called for image URLs already stored as album covers or the private admin-uploaded Hero. */
export function analyzeStoredImage(source: string): Promise<AutoPalette | null> {
  const cached = imageCache.get(source);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  const result = analyze(source);
  imageCache.set(source, { expiresAt: Date.now() + CACHE_TTL_MS, result });
  while (imageCache.size > 96) imageCache.delete(imageCache.keys().next().value as string);
  return result;
}
