import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import type { HttpMethod } from "../../generated/prisma";

const TIMEOUT_MS = 15_000;
const MAX_BODY_CHARS = 20_000;

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
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") || // unique local fc00::/7
    normalized.startsWith("fe80") || // link-local
    normalized.startsWith("::ffff:") // IPv4-mapped, re-checked by caller
  );
}

/**
 * Guards against SSRF: only http(s) URLs pointing at public addresses may be fetched, since
 * registered calls and ad-hoc "test" requests are targets chosen by any signed-in user.
 */
async function assertPublicHttpUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed");
  }

  const hostname = url.hostname;
  if (hostname === "localhost") {
    throw new Error("Requests to localhost are not allowed");
  }

  const ipVersion = isIP(hostname);
  const addresses: string[] = [];
  if (ipVersion === 4) {
    addresses.push(hostname);
  } else if (ipVersion === 6) {
    addresses.push(hostname);
  } else {
    const results = await lookup(hostname, { all: true, verbatim: true });
    addresses.push(...results.map((r) => r.address));
  }

  for (const addr of addresses) {
    if (isIP(addr) === 4 && isBlockedIpv4(addr)) {
      throw new Error(`Resolved address ${addr} is not a public address`);
    }
    if (isIP(addr) === 6 && isBlockedIpv6(addr)) {
      throw new Error(`Resolved address ${addr} is not a public address`);
    }
  }
}

export async function executeHttpCall(
  input: HttpExecInput,
): Promise<HttpExecResult> {
  const start = Date.now();
  try {
    await assertPublicHttpUrl(input.url);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const hasBody = !["GET", "HEAD"].includes(input.method);
      const response = await fetch(input.url, {
        method: input.method,
        headers: input.headers ?? undefined,
        body: hasBody && input.body ? input.body : undefined,
        signal: controller.signal,
        redirect: "follow",
      });

      const text = await response.text();
      const truncated =
        text.length > MAX_BODY_CHARS
          ? text.slice(0, MAX_BODY_CHARS) +
            `\n... [truncated, ${text.length - MAX_BODY_CHARS} more chars]`
          : text;

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: truncated,
        error: null,
        durationMs: Date.now() - start,
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === "AbortError"
          ? `Request timed out after ${TIMEOUT_MS}ms`
          : err.message
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
