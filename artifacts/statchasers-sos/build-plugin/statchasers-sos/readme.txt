=== StatChasers Strength of Schedule ===
Contributors: statchasers
Tags: fantasy football, nfl, strength of schedule, sos
Requires at least: 5.6
Tested up to: 6.7
Requires PHP: 7.2
Stable tag: 1.4.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Embed the StatChasers Fantasy Football Strength of Schedule tool on any page or post with a shortcode.

== Description ==

A self-contained interactive Strength of Schedule (SOS) tool for fantasy football:

* Team SOS and Player SOS views
* Position (QB / RB / WR / TE) and scoring (PPR / Half-PPR / Standard) filters
* Weekly matchup grid colored by opponent difficulty (adjusted fantasy points allowed)
* Premium player "spotlight" insight cards
* Sortable columns, CSV export, and a matchup color legend
* Fully responsive (desktop, tablet, mobile)

All data (the 2026 SOS dataset) ships inside the plugin and loads at runtime —
there is no external API, account, or service dependency.

SEO: the shortcode server-renders the tool's data into the page HTML — team
SOS rankings and full weekly opponent grids for all four positions, plus the
top players by schedule strength, as semantic tables with captions and proper
header cells. Search engines get the meaningful content in the initial HTML
response (no clicks or JavaScript required), and the interactive app replaces
it when it mounts. The rendered HTML is cached in a transient and rebuilt
automatically whenever the data files or plugin version change.

== Installation ==

1. In WordPress admin go to Plugins -> Add New -> Upload Plugin.
2. Upload `statchasers-sos.zip` and click Install Now, then Activate.
3. Create or edit a page and add the shortcode:

       [statchasers_sos]

4. Publish. For the cleanest look, use a full-width page template so the tool
   has room to breathe.

== How it renders (theme isolation) ==

The app is built with Tailwind CSS v4. Rather than an iframe, it is embedded
inline and mounts itself inside a Shadow DOM under the `.sos-app-root` wrapper
the shortcode outputs. Its entire compiled stylesheet is injected into that
shadow root, so styling is isolated in both directions: the active theme's CSS
cannot reach into the tool, and the tool's CSS cannot leak out onto the page.
There is no iframe and no fixed height — the tool grows naturally with the page.

== Shortcode options ==

`[statchasers_sos]`
Default. There are no options — the tool sizes itself to its content.

== Updating the data ==

The SOS dataset lives in `/data/sos/*.json` inside the plugin folder. To refresh
it, replace those JSON files (or re-upload a newer plugin build). The app reads
whatever is in that folder — no code changes required.

== Notes ==

* The tool loads the Inter webfont from Google Fonts to match the StatChasers
  design system.
* The app styles are built with Tailwind; for the most faithful appearance, embed
  it on a page without competing layout styles (full-width / blank template).

== Shareable URLs ==

As you change the tab / position / scoring, the plugin updates the page URL with
query parameters (e.g. ?tab=player&pos=wr&scoring=half-ppr). Those links are
shareable and bookmarkable, and the browser Back/Forward buttons move through
your view history. This works on any page — no server rewrite rules needed.

== Changelog ==

= 1.4.0 =
* Core Web Vitals: reserve the tool's layout space across hydration (stable
  min-height on the wrapper; the server-rendered block is capped to the same
  height and scrolls internally) so swapping in the interactive app no longer
  shifts the page (CLS). Preconnect to the webfont and team-logo origins on
  pages that embed the tool.
* Real-user monitoring: the app now reports LCP / CLS / INP / TTFB via the
  web-vitals library, tagged "statchasers-sos", to gtag (GA4) or dataLayer
  (GTM) when present on the host page — or to an optional beacon endpoint.
* Freshness: show a "Data last updated" date sourced from the data manifest
  (moves only when the dataset actually changes), and advertise that real
  update time as the sitemap <lastmod> for the embedding page via the
  Rank Math / Yoast sitemap entry filters when the data is newer than the
  page's own modified date.
* Tooling: add scripts/seo-check.mjs — an automated SEO regression test that
  fetches the page without JavaScript and asserts the title, canonical, meta
  description, WebApplication structured data, and the server-rendered SOS
  rankings are present, with an optional headless-Chromium check that the
  interactive app still mounts.

= 1.3.2 =
* Coexist with Rank Math / Yoast as the SEO authority: SEO values are supplied
  through their own filter pipelines (never a second title/canonical/graph),
  core-level filters stand down entirely when an SEO plugin is active, and an
  explicit per-page title/description/canonical set in the SEO plugin's UI is
  always respected — the plugin only fills in where the SEO plugin would use
  its auto-generated template.
* Structured data: add a WebApplication node (applicationCategory:
  SportsApplication) describing the tool — name, URL, description, browser
  environment, and free offer. Appended into Rank Math's / Yoast's existing
  JSON-LD graph and linked to their WebPage entity; printed standalone only
  when no SEO plugin is active. No fabricated ratings or reviews, and no
  unrelated schema types. Customizable via the statchasers_sos_webapp_schema
  filter.

= 1.3.1 =
* SEO head: serve the SEO title ("<season> Fantasy Football Strength of
  Schedule (SOS) Rankings"), a page-specific meta description, og:title, and a
  self-referencing canonical in the initial HTML for the page embedding the
  shortcode. Works through core filters and integrates with Yoast SEO and
  Rank Math when active; the season is read from the bundled data manifest so
  titles roll forward with each data refresh. The canonical is always the
  clean permalink — tool-state URLs (?tab/?pos/?scoring) consolidate to the
  base page instead of creating duplicate indexable URLs. Override strings via
  the statchasers_sos_seo_title / statchasers_sos_seo_description filters.

= 1.3.0 =
* SEO: server-render the tool's data as semantic HTML in the shortcode output.
  Team rankings, weekly opponent grids (with aFPA values), and top-player SOS
  tables for QB/RB/WR/TE all ship in the initial HTML response — visible to
  crawlers and no-JS visitors — and are removed when the interactive app
  mounts. Uses real table/caption/thead/th-scope markup with H2/H3 section
  headings; player names link to their StatChasers profile pages. Rendered
  HTML is cached in a transient keyed to the data files' mtimes.

= 1.2.0 =
* Switch from the same-origin iframe to an inline embed: the tool now mounts in
  a Shadow DOM and injects its own styles there, so it is fully isolated from the
  theme in both directions without an iframe or height-measuring script. Fixes
  the occasional truncation on mobile and lets the tool flow naturally with the
  page. Tab/position/scoring still sync to the page URL as query parameters.

= 1.1.2 =
* Fix the embed occasionally loading truncated (cut off at the footer) on mobile
  until you switched tabs: force the iframe to lay out at the correct width on
  first paint, and have the app re-measure its height after fonts, logos, and
  async data settle instead of only on user interaction.

= 1.1.1 =
* Fix the embed being cut off by the page footer on mobile: measure the app's
  true content height (not just documentElement.scrollHeight), remeasure once
  web fonts/logos finish loading, and prevent a wide table from widening the
  mobile layout viewport (which made the page measure shorter than it renders).

= 1.1.0 =
* Render the tool inside a same-origin, auto-resizing iframe so its styling is
  fully isolated from the active theme (fixes design/styling mismatches).
* Sync the active tab/position/scoring to the page URL as query parameters
  (shareable links + working Back/Forward), bridged across the iframe.

= 1.0.0 =
* Initial release.
