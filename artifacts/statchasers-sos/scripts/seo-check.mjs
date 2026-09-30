#!/usr/bin/env node
/**
 * SEO regression check for the StatChasers SOS page.
 *
 * Phase 1 (always): fetch the page HTML WITHOUT executing JavaScript — what a
 * crawler's first pass sees — and assert the head metadata, structured data,
 * and the server-rendered SOS content are all present. This is the guard that
 * keeps a future React/plugin update from quietly turning the tool back into
 * an empty <div> for crawlers.
 *
 * Phase 2 (when playwright is installed): load the page in headless Chromium
 * and assert the interactive app actually mounts (shadow DOM present, SSR
 * block removed) — i.e. hydration still works for users.
 *
 * Usage:
 *   node scripts/seo-check.mjs [url] [--canonical <url>]
 *   pnpm seo-check                      # defaults to the production URL
 *   node scripts/seo-check.mjs file:///path/to/snapshot.html --canonical https://...
 */

const DEFAULT_URL =
  "https://statchasers.com/nfl/fantasy-football-strength-of-schedule/";

const args = process.argv.slice(2);
let target = DEFAULT_URL;
let expectedCanonical = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--canonical") expectedCanonical = args[++i];
  else target = args[i];
}
if (!expectedCanonical && !target.startsWith("file:")) {
  expectedCanonical = target.split(/[?#]/)[0];
}

async function loadHtml(url) {
  if (url.startsWith("file:")) {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    return { status: 200, html: await readFile(fileURLToPath(url), "utf8") };
  }
  const res = await fetch(url, {
    headers: { "User-Agent": "statchasers-seo-check/1.0 (raw HTML, no JS)" },
    redirect: "follow",
  });
  return { status: res.status, html: await res.text() };
}

const failures = [];
const passes = [];
function check(name, ok, detail = "") {
  (ok ? passes : failures).push(name + (ok || !detail ? "" : ` — ${detail}`));
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

const { status, html } = await loadHtml(target);
console.log(`\nRaw-HTML checks (no JavaScript) for ${target}\n`);

check("HTTP 200", status === 200, `got ${status}`);

// --- Head metadata --------------------------------------------------------
const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || "";
check(
  "<title> mentions Fantasy Football Strength of Schedule",
  /fantasy football strength of schedule/i.test(title),
  `title: "${title}"`,
);

const metaDesc =
  (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i) ||
    [])[1] || "";
check(
  "meta description present and on-topic",
  metaDesc.length > 50 && /strength of schedule/i.test(metaDesc),
  metaDesc ? `"${metaDesc.slice(0, 80)}..."` : "missing",
);

const canonical =
  (html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i) ||
    html.match(/<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["']/i) ||
    [])[1] || "";
const norm = (u) => (u || "").replace(/\/+$/, "");
check(
  "self-referencing canonical (no tool-state params)",
  !!canonical &&
    !/[?&](tab|pos|scoring)=/.test(canonical) &&
    (!expectedCanonical || norm(canonical) === norm(expectedCanonical)),
  canonical ? `canonical: ${canonical}` : "missing",
);

const h1 = (html.match(/<h1[^>]*>(.*?)<\/h1>/is) || [])[1]?.replace(/<[^>]+>/g, "").trim() || "";
check(
  "H1 mentions Strength of Schedule",
  /strength of schedule/i.test(h1),
  h1 ? `h1: "${h1}"` : "no <h1> found",
);

// --- Structured data ------------------------------------------------------
const ldBlocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>(.*?)<\/script>/gis)].map((m) => m[1]);
let webApp = null;
for (const block of ldBlocks) {
  try {
    const data = JSON.parse(block.trim());
    const nodes = [data, ...(Array.isArray(data["@graph"]) ? data["@graph"] : []), ...(Array.isArray(data) ? data : [])];
    for (const n of nodes) {
      if (n && [].concat(n["@type"] || []).includes("WebApplication")) webApp = n;
    }
  } catch {
    /* unparseable block — ignore, others may match */
  }
}
check(
  "JSON-LD WebApplication node present",
  !!webApp,
  `${ldBlocks.length} ld+json block(s) found`,
);
check(
  "WebApplication category is SportsApplication, no fabricated ratings",
  !!webApp && webApp.applicationCategory === "SportsApplication" && !webApp.aggregateRating && !webApp.review,
);

// --- Server-rendered SOS content (the crawlable tool state) ---------------
check("semantic tables with captions", (html.match(/<caption>/g) || []).length >= 8, `${(html.match(/<caption>/g) || []).length} captions (expect 8: team+player × 4 positions)`);
check("table row headers (<th scope=\"row\">)", /<th scope="row">/.test(html));
const positions = ["Quarterback (QB)", "Running Back (RB)", "Wide Receiver (WR)", "Tight End (TE)"];
for (const p of positions) {
  check(`section for ${p} present without user interaction`, html.includes(p));
}
check(
  "real team names in HTML",
  html.includes("Philadelphia Eagles") && html.includes("Los Angeles Rams"),
);
check(
  "weekly opponent cells with aFPA values",
  /(vs|@) [A-Z]{2,3} \d+\.\d/.test(html),
);
check(
  "player-profile internal links",
  /href="https:\/\/statchasers\.com\/nfl\/players\/[a-z0-9-]+\/"/.test(html),
);
check("data last-updated timestamp (<time>)", /<time datetime="\d{4}-\d{2}-\d{2}">/.test(html));

// --- Phase 2: rendered check (optional, needs playwright) ------------------
if (!target.startsWith("file:")) {
  let chromium = null;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.log("\n  (rendered check skipped — install playwright to enable: pnpm add -D playwright && npx playwright install chromium)");
  }
  if (chromium) {
    console.log("\nRendered checks (headless Chromium)\n");
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto(target, { waitUntil: "networkidle", timeout: 45000 });
      const state = await page.evaluate(() => {
        const host = document.querySelector(".sos-app-root");
        return {
          hostFound: !!host,
          shadowMounted: !!host?.shadowRoot?.querySelector(".sos-app-shell"),
          appHasContent: (host?.shadowRoot?.textContent || "").length > 500,
          ssrRemoved: !host?.querySelector(".sos-ssr"),
        };
      });
      check("mount wrapper present", state.hostFound);
      check("interactive app mounted in shadow DOM", state.shadowMounted);
      check("app rendered content", state.appHasContent);
      check("SSR block removed after hydration (no duplicate content)", state.ssrRemoved);
    } finally {
      await browser.close();
    }
  }
}

console.log(`\n${passes.length} passed, ${failures.length} failed\n`);
if (failures.length) {
  console.error("FAILED checks:\n" + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
