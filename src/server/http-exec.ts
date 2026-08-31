import { lookup as dnsLookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";

import { Agent, type Dispatcher, request as undiciRequest } from "undici";

import type { HttpMethod } from "../../generated/prisma";

const TIMEOUT_MS = 15_000;
const MAX_BODY_CHARS = 20_000;
const MAX_BODY_BYTES = 5 * 1024 * 1024; // hard cap on what we pull off the wire
const MAX_REDIRECTS = 5;

export interface HttpExecInput {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string> | null;
  body?: string | null;
}

export interface HttpExecResult {
  ok: boolean;
  status: number | null;
  statusText: string | null;
  headers: Record<string, string> | null;
  body: string | null;
  error: string | null;
  durationMs: number;
}

function ipToInt(ip: string) {
  return ip
    .split(".")
    .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function inRange(ip: string, cidr: string) {
  const [range, bitsStr] = cidr.split("/");
  const bits = parseInt(bitsStr!, 10);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipToInt(ip) & mask) === (ipToInt(range!) & mask);
}

const BLOCKED_V4_RANGES = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "224.0.0.0/4",
  "240.0.0.0/4",
];

function isBlockedIpv4(ip: string) {
  return BLOCKED_V4_RANGES.some((range) => inRange(ip, range));
}

function isBlockedIpv6(ip: string) {
  const normalized = ip.toLowerCase();
  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible / NAT64 (64:ff9b::a.b.c.d)
  // addresses can smuggle a private IPv4 target through an IPv6 literal.
  const mapped = normalized.match(/(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]!);
  const embedded = normalized.match(/(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}:[0-9a-f]{1,4})$/);
  if (embedded) {
    const [hi, lo] = embedded[1]!.split(":");
    const a = parseInt(hi!, 16);
    const b = parseInt(lo!, 16);
    const v4 = `${a >> 8}.${a & 0xff}.${b >> 8}.${b & 0xff}`;
    return isBlockedIpv4(v4);
  }
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") || // unique local fc00::/7
    normalized.startsWith("fe80") || // link-local
    normalized.startsWith("2001:db8") // documentation
  );
}

/** Throws if `ip` (a literal v4/v6 address) points at a non-public range. */
function assertIpAllowed(ip: string) {
  const version = isIP(ip);
  if (version === 4 && isBlockedIpv4(ip)) {
    throw new Error(`Resolved to a non-public address`);
  }
  if (version === 6 && isBlockedIpv6(ip)) {
    throw new Error(`Resolved to a non-public address`);
  }
}

/**
 * Guards against SSRF at the point of validation: only http(s) URLs whose host is
 * not an obviously-internal literal may proceed. DNS-name hosts are enforced again
 * at connect time by `guardedLookup` so a name cannot resolve to a blocked address
 * (and cannot be rebound between the check and the socket).
 */
function assertPublicHttpUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed");
  }

  let hostname = url.hostname;
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    hostname = hostname.slice(1, -1);
  }
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("Requests to localhost are not allowed");
  }

  if (isIP(hostname)) {
    assertIpAllowed(hostname);
  }
  return url;
}

/**
 * DNS resolver handed to undici's connector. It runs for every hostname the
 * dispatcher connects to (including redirect hops), and it is the address undici
 * actually dials — so validating here closes the DNS-rebinding / TOCTOU window
 * that a separate pre-flight lookup leaves open.
 */
const guardedLookup = ((hostname, options, callback) => {
  const cb = callback as (
    err: NodeJS.ErrnoException | null,
    address?: string | { address: string; family: number }[],
    family?: number,
  ) => void;
  dnsLookup(hostname, { all: true, verbatim: true })
    .then((addresses) => {
      if (addresses.length === 0) {
        cb(new Error(`Could not resolve ${hostname}`));
        return;
      }
      for (const { address } of addresses) {
        assertIpAllowed(address);
      }
      if (options && typeof options === "object" && options.all) {
        cb(
          null,
          addresses.map((a) => ({ address: a.address, family: a.family })),
        );
      } else {
        cb(null, addresses[0]!.address, addresses[0]!.family);
      }
    })
    .catch((err: Error) => cb(err as NodeJS.ErrnoException));
}) as LookupFunction;

const guardedAgent = new Agent({
  connect: { lookup: guardedLookup },
  headersTimeout: TIMEOUT_MS,
  bodyTimeout: TIMEOUT_MS,
  maxRedirections: 0,
});

// Headers a caller must not be able to set — they let the request impersonate
// another origin or confuse an upstream proxy.
const FORBIDDEN_HEADERS = new Set([
  "host",
  "content-length",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-real-ip",
  "forwarded",
]);

function sanitizeHeaders(headers?: Record<string, string> | null) {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (!FORBIDDEN_HEADERS.has(key.toLowerCase())) out[key] = value;
  }
  return out;
}

async function readCappedBody(
  body: Dispatcher.ResponseData["body"],
): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  let capped = false;
  for await (const chunk of body) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    total += buf.length;
    chunks.push(buf);
    if (total >= MAX_BODY_BYTES) {
      capped = true;
      break;
    }
  }
  if (capped) await body.dump();
  const text = Buffer.concat(chunks).toString("utf8");
  return text.length > MAX_BODY_CHARS
    ? text.slice(0, MAX_BODY_CHARS) +
        `\n... [truncated, ${text.length - MAX_BODY_CHARS} more chars]`
    : text;
}

export async function executeHttpCall(
  input: HttpExecInput,
): Promise<HttpExecResult> {
  const start = Date.now();
  const deadline = start + TIMEOUT_MS;

  try {
    let currentUrl = assertPublicHttpUrl(input.url).toString();
    let method: Dispatcher.HttpMethod = input.method;
    let sendBody = !["GET", "HEAD"].includes(input.method);

    for (let hop = 0; ; hop++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw Object.assign(new Error(), { name: "AbortError" });

      const response = await undiciRequest(currentUrl, {
        dispatcher: guardedAgent,
        method,
        headers: sanitizeHeaders(input.headers),
        body: sendBody && input.body ? input.body : undefined,
        signal: AbortSignal.timeout(remaining),
      });

      const isRedirect =
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location !== undefined;

      if (isRedirect) {
        await response.body.dump();
        if (hop >= MAX_REDIRECTS) throw new Error("Too many redirects");
        const location = Array.isArray(response.headers.location)
          ? response.headers.location[0]!
          : response.headers.location!;
        const next = new URL(location, currentUrl);
        currentUrl = assertPublicHttpUrl(next.toString()).toString();
        // Match fetch semantics: 303, or 301/302 on POST, become GET.
        if (
          response.statusCode === 303 ||
          ((response.statusCode === 301 || response.statusCode === 302) &&
            method === "POST")
        ) {
          method = "GET";
          sendBody = false;
        }
        continue;
      }

      const bodyText = await readCappedBody(response.body);
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(response.headers)) {
        headers[k] = Array.isArray(v) ? v.join(", ") : String(v);
      }

      return {
        ok: response.statusCode >= 200 && response.statusCode < 300,
        status: response.statusCode,
        statusText: null,
        headers,
        body: bodyText,
        error: null,
        durationMs: Date.now() - start,
      };
    }
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === "AbortError" || err.name === "TimeoutError"
          ? `Request timed out after ${TIMEOUT_MS}ms`
          : err.message || String(err)
        : String(err);
    return {
      ok: false,
      status: null,
      statusText: null,
      headers: null,
      body: null,
      error: message,
      durationMs: Date.now() - start,
    };
  }
}
