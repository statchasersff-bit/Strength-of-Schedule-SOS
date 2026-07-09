=== StatChasers Strength of Schedule ===
Contributors: statchasers
Tags: fantasy football, nfl, strength of schedule, sos
Requires at least: 5.6
Tested up to: 6.7
Requires PHP: 7.2
Stable tag: 1.2.0
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
