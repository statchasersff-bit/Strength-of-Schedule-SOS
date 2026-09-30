<?php
/**
 * Plugin Name:       StatChasers Strength of Schedule
 * Plugin URI:        https://statchasers.com/
 * Description:        Embeds the StatChasers Fantasy Football Strength of Schedule tool. Add the shortcode [statchasers_sos] to any page or post.
 * Version:           1.4.0
 * Requires at least: 5.6
 * Requires PHP:      7.2
 * Author:            StatChasers
 * Author URI:        https://statchasers.com/
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 *
 * Usage:
 *   1. Create a page.
 *   2. Add the shortcode:  [statchasers_sos]
 *
 * The tool is a self-contained React app. Its data (the SOS JSON files) ships
 * with the plugin under /data/sos and is loaded at runtime — no API or external
 * service is required.
 *
 * The app is embedded INLINE (no iframe) and mounts itself inside a Shadow DOM
 * under the `.sos-app-root` wrapper this shortcode outputs. All of its (Tailwind
 * v4) styles are injected into that shadow root, so they are fully isolated from
 * the active theme — the theme's CSS can't reach into the tool, and the tool's
 * CSS can't leak out onto the page. The compiled stylesheet is bundled into the
 * single JS file, so only one script needs to load.
 *
 * SEO / server rendering: the shortcode also renders the tool's data — team
 * SOS rankings and weekly opponent grids for ALL four positions (QB/RB/WR/TE),
 * plus the top players by schedule strength — as real semantic HTML tables
 * built server-side from the bundled JSON. That content ships in the initial
 * HTML response, is visible to users until the JavaScript app mounts (and
 * whenever JS is unavailable), and is removed once the interactive app takes
 * over. It is the same information the app shows — progressive enhancement,
 * not bot-only text.
 *
 * SEO head: for the page that embeds the tool, the plugin also serves the SEO
 * title, meta description, og:title, and a self-referencing canonical in the
 * initial HTML (via core filters, or Yoast/Rank Math when active). The
 * canonical is always the page's clean permalink — tool-state parameters like
 * ?tab/?pos/?scoring never change it, so filter-state URLs consolidate to the
 * base page instead of creating a duplicate URL space. Filter controls inside
 * the tool are real <button>s (not <a href> links), so crawlers don't discover
 * parameterized filter URLs in the first place.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

define( 'STATCHASERS_SOS_VERSION', '1.4.0' );
define( 'STATCHASERS_SOS_DIR', plugin_dir_path( __FILE__ ) );
define( 'STATCHASERS_SOS_URL', plugin_dir_url( __FILE__ ) );
define( 'STATCHASERS_SOS_HANDLE', 'statchasers-sos' );

/**
 * Locate the hashed built asset (e.g. assets/index-AbC123.js). Vite emits a
 * content hash in the filename, so we resolve it at runtime rather than
 * hard-coding it — the plugin keeps working across rebuilds.
 *
 * @param string $ext "js" or "css".
 * @return string|null Filename (basename) or null when missing.
 */
function statchasers_sos_find_asset( $ext ) {
	$matches = glob( STATCHASERS_SOS_DIR . 'assets/index-*.' . $ext );
	if ( empty( $matches ) ) {
		return null;
	}
	return basename( $matches[0] );
}

/**
 * Sanitize the shareable view triple from a query source ($_GET or atts).
 * Returns slugs the app understands, falling back to defaults.
 *
 * @return array{tab:string,position:string,scoring:string}
 */
function statchasers_sos_view_state( $source ) {
	$tabs     = array( 'team', 'player' );
	$posns    = array( 'qb', 'rb', 'wr', 'te' );
	$scorings = array( 'ppr', 'half-ppr', 'std' );

	$tab      = isset( $source['tab'] ) ? strtolower( sanitize_text_field( wp_unslash( $source['tab'] ) ) ) : '';
	$position = isset( $source['pos'] ) ? strtolower( sanitize_text_field( wp_unslash( $source['pos'] ) ) ) : '';
	$scoring  = isset( $source['scoring'] ) ? strtolower( sanitize_text_field( wp_unslash( $source['scoring'] ) ) ) : '';

	return array(
		'tab'      => in_array( $tab, $tabs, true ) ? $tab : 'team',
		'position' => in_array( $position, $posns, true ) ? $position : 'rb',
		'scoring'  => in_array( $scoring, $scorings, true ) ? $scoring : 'ppr',
	);
}

/**
 * Register the bundle + webfont so the shortcode can enqueue them on demand.
 * The compiled CSS is inlined into the JS (and injected into the app's Shadow
 * DOM at runtime), so there is no separate stylesheet to load.
 */
function statchasers_sos_register_assets() {
	$js = statchasers_sos_find_asset( 'js' );
	if ( ! $js ) {
		return;
	}

	// Inter, to match the StatChasers design system. Harmless if the theme
	// already loads it — the browser dedupes identical font requests.
	wp_register_style(
		'statchasers-sos-fonts',
		'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
		array(),
		null
	);

	wp_register_script(
		STATCHASERS_SOS_HANDLE,
		STATCHASERS_SOS_URL . 'assets/' . $js,
		array(),
		STATCHASERS_SOS_VERSION,
		true // In the footer, after the mount element exists in the DOM.
	);

	// Light styling for the server-rendered tables (shown before the app mounts
	// and whenever JavaScript is unavailable). Registered against a virtual
	// handle so it prints from the head like any other stylesheet.
	wp_register_style( 'statchasers-sos-ssr', false, array(), STATCHASERS_SOS_VERSION );
	wp_add_inline_style(
		'statchasers-sos-ssr',
		// Reserve the tool's layout space across hydration: the wrapper keeps a
		// stable minimum height, and the server-rendered block is capped to the
		// same height (scrolling internally when taller). Swapping the SSR
		// tables for the mounted app then barely moves anything below — the
		// swap is not a viewport-wide layout shift (CLS).
		'.sos-app-root{min-height:clamp(560px,90vh,1200px)}' .
		'.sos-ssr{max-height:clamp(560px,90vh,1200px);overflow-y:auto;overscroll-behavior:contain}' .
		'.sos-ssr{font-family:Inter,system-ui,-apple-system,sans-serif;line-height:1.5;max-width:100%}' .
		'.sos-ssr h2{font-size:1.35em;margin:1.4em 0 .4em}' .
		'.sos-ssr h3{font-size:1.1em;margin:1.2em 0 .4em}' .
		'.sos-ssr p{margin:.4em 0 .8em}' .
		'.sos-ssr .sos-ssr-scroll{overflow-x:auto;margin:0 0 1.4em;-webkit-overflow-scrolling:touch}' .
		'.sos-ssr table{border-collapse:collapse;white-space:nowrap;font-size:13px}' .
		'.sos-ssr caption{caption-side:top;text-align:left;font-weight:600;padding:.35em 0}' .
		'.sos-ssr th,.sos-ssr td{border:1px solid #d4d4d8;padding:3px 8px;text-align:left;font-weight:400}' .
		'.sos-ssr thead th{background:#f4f4f5;font-weight:600}' .
		'.sos-ssr tbody th{font-weight:600}' .
		'.sos-ssr td.sos-ssr-bye{color:#71717a;font-style:italic}'
	);

	// When we can already tell the page embeds the tool, enqueue from here so
	// the stylesheets print in the <head> (the server-rendered tables are then
	// styled on first paint). The shortcode enqueues again as a fallback for
	// widgets/page builders this check can't see — that's a no-op when already
	// enqueued, and merely footer-prints the styles when it isn't.
	if ( is_singular() ) {
		$post = get_post();
		if ( $post && has_shortcode( (string) $post->post_content, 'statchasers_sos' ) ) {
			wp_enqueue_style( 'statchasers-sos-fonts' );
			wp_enqueue_style( 'statchasers-sos-ssr' );
			wp_enqueue_script( STATCHASERS_SOS_HANDLE );
		}
	}
}
add_action( 'wp_enqueue_scripts', 'statchasers_sos_register_assets' );

/**
 * Preconnect to the origins the first paint depends on, only on pages that
 * embed the tool: the webfont hosts (render-critical) and the team-logo CDN.
 */
function statchasers_sos_resource_hints( $urls, $relation_type ) {
	if ( 'preconnect' === $relation_type && statchasers_sos_embed_post() ) {
		$urls[] = 'https://fonts.googleapis.com';
		$urls[] = array(
			'href'        => 'https://fonts.gstatic.com',
			'crossorigin' => 'anonymous',
		);
		$urls[] = 'https://a.espncdn.com';
	}
	return $urls;
}
add_filter( 'wp_resource_hints', 'statchasers_sos_resource_hints', 10, 2 );

/* -------------------------------------------------------------------------
 * SEO head: server-side title / description / canonical
 *
 * All of this ships in the initial HTML response — nothing relies on the
 * JavaScript app (which deliberately never touches the host page's head).
 * The canonical is always the clean permalink: tool-state parameters
 * (?tab/?pos/?scoring) never change it, so every filter-state URL
 * consolidates to the base SOS page.
 * ---------------------------------------------------------------------- */

/**
 * The singular post being viewed, when its content embeds the shortcode.
 * Resolved once per request.
 *
 * @return WP_Post|null
 */
function statchasers_sos_embed_post() {
	static $resolved = false, $embed = null;
	if ( $resolved ) {
		return $embed;
	}
	$resolved = true;
	if ( is_singular() ) {
		$post = get_post();
		if ( $post && has_shortcode( (string) $post->post_content, 'statchasers_sos' ) ) {
			$embed = $post;
		}
	}
	return $embed;
}

/**
 * Season the bundled dataset covers (e.g. 2026), read from the data manifest
 * so the titles roll forward automatically with each data refresh.
 *
 * @return int|null
 */
function statchasers_sos_season() {
	static $loaded = false, $season = null;
	if ( ! $loaded ) {
		$loaded   = true;
		$manifest = statchasers_sos_load_json( 'manifest.json' );
		if ( $manifest && ! empty( $manifest['season'] ) ) {
			$season = (int) $manifest['season'];
		}
	}
	return $season;
}

/**
 * The SEO title for the embedding page. Kept in agreement with the page H1
 * and the prominent on-page wording, per Google's title guidance.
 *
 * @return string
 */
function statchasers_sos_seo_title() {
	$season = statchasers_sos_season();
	$title  = trim( ( $season ? $season . ' ' : '' ) . 'Fantasy Football Strength of Schedule (SOS) Rankings' );
	return apply_filters( 'statchasers_sos_seo_title', $title );
}

/**
 * Page-specific meta description for the embedding page.
 *
 * @return string
 */
function statchasers_sos_seo_description() {
	$season = statchasers_sos_season();
	$desc   = sprintf(
		'%s fantasy football strength of schedule for every NFL team and top players: QB, RB, WR and TE weekly matchup difficulty, rest-of-season and playoff SOS in PPR, Half-PPR and Standard scoring.',
		$season ? $season : 'NFL'
	);
	return apply_filters( 'statchasers_sos_seo_description', $desc );
}

/** True when a dedicated SEO plugin owns the page's head output. */
function statchasers_sos_seo_plugin_active() {
	return defined( 'WPSEO_VERSION' ) || class_exists( 'RankMath' ) || defined( 'AIOSEO_VERSION' ) || defined( 'SEOPRESS_VERSION' );
}

/**
 * Shared deference logic for the Rank Math / Yoast filters: the SEO plugin
 * remains the authority. If the site owner set an explicit per-page value in
 * the SEO plugin's UI (stored in $meta_key post meta), that value passes
 * through untouched; our string is only supplied where the SEO plugin would
 * otherwise fall back to its auto-generated template.
 *
 * @param mixed  $value    Value coming through the SEO plugin's filter.
 * @param string $meta_key Post-meta key that holds an explicit per-page value.
 * @param string $ours     Our replacement value.
 * @return mixed
 */
function statchasers_sos_seo_defer( $value, $meta_key, $ours ) {
	$post = statchasers_sos_embed_post();
	if ( ! $post ) {
		return $value;
	}
	if ( $meta_key && get_post_meta( $post->ID, $meta_key, true ) ) {
		return $value; // Explicit per-page setting in the SEO plugin wins.
	}
	return $ours;
}

/* --- Titles. Rank Math / Yoast hooks shape THEIR output pipeline (one title
 * tag on the page, theirs); the core hook only fires when no SEO plugin is
 * active, so we never emit a competing second title. --- */
function statchasers_sos_rm_title( $title ) {
	return statchasers_sos_seo_defer( $title, 'rank_math_title', statchasers_sos_seo_title() );
}
add_filter( 'rank_math/frontend/title', 'statchasers_sos_rm_title', 20 );

function statchasers_sos_yoast_title( $title ) {
	return statchasers_sos_seo_defer( $title, '_yoast_wpseo_title', statchasers_sos_seo_title() );
}
add_filter( 'wpseo_title', 'statchasers_sos_yoast_title', 20 );

function statchasers_sos_yoast_og_title( $title ) {
	return statchasers_sos_seo_defer( $title, '_yoast_wpseo_opengraph-title', statchasers_sos_seo_title() );
}
add_filter( 'wpseo_opengraph_title', 'statchasers_sos_yoast_og_title', 20 );

function statchasers_sos_core_title( $title ) {
	if ( statchasers_sos_seo_plugin_active() || ! statchasers_sos_embed_post() ) {
		return $title;
	}
	return statchasers_sos_seo_title();
}
add_filter( 'pre_get_document_title', 'statchasers_sos_core_title', 20 );

/* --- Meta description. --- */
function statchasers_sos_rm_description( $desc ) {
	return statchasers_sos_seo_defer( $desc, 'rank_math_description', statchasers_sos_seo_description() );
}
add_filter( 'rank_math/frontend/description', 'statchasers_sos_rm_description', 20 );

function statchasers_sos_yoast_description( $desc ) {
	return statchasers_sos_seo_defer( $desc, '_yoast_wpseo_metadesc', statchasers_sos_seo_description() );
}
add_filter( 'wpseo_metadesc', 'statchasers_sos_yoast_description', 20 );

/* --- Canonical: always the clean permalink, never a parameterized
 * filter-state URL. An explicit per-page canonical set in the SEO plugin is
 * respected; otherwise we pin the plugin's auto value to the permalink. --- */
function statchasers_sos_clean_canonical() {
	$post = statchasers_sos_embed_post();
	return $post ? get_permalink( $post ) : '';
}

function statchasers_sos_rm_canonical( $url ) {
	return statchasers_sos_seo_defer( $url, 'rank_math_canonical_url', statchasers_sos_clean_canonical() );
}
add_filter( 'rank_math/frontend/canonical', 'statchasers_sos_rm_canonical', 20 );

function statchasers_sos_yoast_canonical( $url ) {
	return statchasers_sos_seo_defer( $url, '_yoast_wpseo_canonical', statchasers_sos_clean_canonical() );
}
add_filter( 'wpseo_canonical', 'statchasers_sos_yoast_canonical', 20 );

function statchasers_sos_core_canonical( $url ) {
	if ( statchasers_sos_seo_plugin_active() || ! statchasers_sos_embed_post() ) {
		return $url;
	}
	return statchasers_sos_clean_canonical();
}
add_filter( 'get_canonical_url', 'statchasers_sos_core_canonical', 20 );

/* -------------------------------------------------------------------------
 * Structured data: WebApplication (SportsApplication category)
 *
 * Describes the tool itself, per Google's SoftwareApplication guidance.
 * Deliberately NO reviews/ratings (never fabricated) and no unrelated types —
 * WebPage / BreadcrumbList remain the SEO plugin's job. When Rank Math or
 * Yoast is active the node is appended to THEIR schema graph (linked to their
 * WebPage entity) instead of printing a second competing graph.
 * ---------------------------------------------------------------------- */

/**
 * The WebApplication schema node for the tool.
 *
 * @param string|null $webpage_id "@id" of the host graph's WebPage entity.
 * @return array|null
 */
function statchasers_sos_webapp_schema( $webpage_id = null ) {
	$post = statchasers_sos_embed_post();
	if ( ! $post ) {
		return null;
	}
	$url    = get_permalink( $post );
	$season = statchasers_sos_season();
	$node   = array(
		'@type'               => 'WebApplication',
		'@id'                 => $url . '#webapp',
		'name'                => trim( ( $season ? $season . ' ' : '' ) . 'Fantasy Football Strength of Schedule (SOS) Tool' ),
		'url'                 => $url,
		'description'         => statchasers_sos_seo_description(),
		'applicationCategory' => 'SportsApplication',
		'operatingSystem'     => 'Web browser',
		'browserRequirements' => 'Requires JavaScript',
		'isAccessibleForFree' => true,
		'offers'              => array(
			'@type'         => 'Offer',
			'price'         => '0',
			'priceCurrency' => 'USD',
		),
	);
	if ( $webpage_id ) {
		$node['mainEntityOfPage'] = array( '@id' => $webpage_id );
	}
	return apply_filters( 'statchasers_sos_webapp_schema', $node );
}

/** Rank Math: append to its JSON-LD graph, linked to its WebPage entity. */
function statchasers_sos_rm_schema( $data, $jsonld = null ) {
	if ( ! is_array( $data ) || ! statchasers_sos_embed_post() ) {
		return $data;
	}
	$webpage_id = null;
	foreach ( $data as $piece ) {
		if ( is_array( $piece ) && isset( $piece['@type'], $piece['@id'] )
			&& in_array( 'WebPage', (array) $piece['@type'], true ) ) {
			$webpage_id = $piece['@id'];
			break;
		}
	}
	$node = statchasers_sos_webapp_schema( $webpage_id );
	if ( $node ) {
		$data['statchasersSosApp'] = $node;
	}
	return $data;
}
add_filter( 'rank_math/json_ld', 'statchasers_sos_rm_schema', 99, 2 );

/** Yoast: append to its schema graph, linked to its WebPage entity. */
function statchasers_sos_yoast_schema( $graph ) {
	if ( ! is_array( $graph ) || ! statchasers_sos_embed_post() ) {
		return $graph;
	}
	$webpage_id = null;
	foreach ( $graph as $piece ) {
		if ( is_array( $piece ) && isset( $piece['@type'], $piece['@id'] )
			&& in_array( 'WebPage', (array) $piece['@type'], true ) ) {
			$webpage_id = $piece['@id'];
			break;
		}
	}
	$node = statchasers_sos_webapp_schema( $webpage_id );
	if ( $node ) {
		$graph[] = $node;
	}
	return $graph;
}
add_filter( 'wpseo_schema_graph', 'statchasers_sos_yoast_schema', 20 );

/* -------------------------------------------------------------------------
 * Sitemap <lastmod>: reflect real dataset updates
 *
 * Google uses <lastmod> when it is consistently accurate. The SOS page's
 * main content is the dataset, so when the bundled data manifest is newer
 * than the page's own modified date, the sitemap entry advertises the data's
 * real update time. It never fakes freshness — the date only moves when the
 * dataset (or the page itself) actually changed.
 * ---------------------------------------------------------------------- */

/**
 * Shared lastmod logic for the Rank Math / Yoast sitemap entry filters.
 *
 * @param array  $url    Sitemap entry (contains 'mod').
 * @param string $type   Entry type ('post' for pages/posts).
 * @param object $object The post object for the entry.
 * @return array
 */
function statchasers_sos_sitemap_entry( $url, $type, $object = null ) {
	if ( 'post' !== $type || ! is_array( $url ) || ! is_object( $object )
		|| empty( $object->post_content )
		|| ! has_shortcode( (string) $object->post_content, 'statchasers_sos' ) ) {
		return $url;
	}
	$manifest = statchasers_sos_load_json( 'manifest.json' );
	if ( ! $manifest || empty( $manifest['updatedAt'] ) ) {
		return $url;
	}
	$data_time = strtotime( (string) $manifest['updatedAt'] );
	$page_time = isset( $url['mod'] ) ? strtotime( (string) $url['mod'] ) : 0;
	if ( $data_time && $data_time > (int) $page_time ) {
		$url['mod'] = gmdate( 'c', $data_time );
	}
	return $url;
}
add_filter( 'rank_math/sitemap/entry', 'statchasers_sos_sitemap_entry', 20, 3 );
add_filter( 'wpseo_sitemap_entry', 'statchasers_sos_sitemap_entry', 20, 3 );

/**
 * Fallback head output for sites without a dedicated SEO plugin: WordPress
 * core prints the canonical for singular pages but no meta description,
 * Open Graph tags, or schema, so provide those here. When an SEO plugin is
 * active it owns every one of these tags (shaped by the filters above) and
 * this stays completely silent — no second canonical, title, or graph.
 */
function statchasers_sos_seo_head() {
	$post = statchasers_sos_embed_post();
	if ( ! $post || statchasers_sos_seo_plugin_active() ) {
		return;
	}
	$canonical = get_permalink( $post );
	echo '<meta name="description" content="' . esc_attr( statchasers_sos_seo_description() ) . '">' . "\n";
	echo '<meta property="og:title" content="' . esc_attr( statchasers_sos_seo_title() ) . '">' . "\n";
	echo '<meta property="og:description" content="' . esc_attr( statchasers_sos_seo_description() ) . '">' . "\n";
	echo '<meta property="og:url" content="' . esc_url( $canonical ) . '">' . "\n";
	// Core's rel_canonical covers singular pages; if a theme removed it,
	// print the self-referencing canonical ourselves.
	if ( false === has_action( 'wp_head', 'rel_canonical' ) ) {
		echo '<link rel="canonical" href="' . esc_url( $canonical ) . '">' . "\n";
	}
	$node = statchasers_sos_webapp_schema();
	if ( $node ) {
		echo '<script type="application/ld+json">' .
			wp_json_encode( array_merge( array( '@context' => 'https://schema.org' ), $node ) ) .
			'</script>' . "\n";
	}
}
add_action( 'wp_head', 'statchasers_sos_seo_head', 4 );

/* -------------------------------------------------------------------------
 * Server-side rendering of the tool data (SEO / no-JS content)
 *
 * Google receives the meaningful tool state — team names, rankings, weekly
 * opponents, positional aFPA values, and real table headings — in the initial
 * HTML response instead of an empty mount node. All four positions render
 * without any user interaction. The React app removes this block when it
 * mounts, so users never see it duplicated.
 * ---------------------------------------------------------------------- */

/**
 * Read and decode one bundled JSON data file.
 *
 * @param string $file Basename inside /data/sos.
 * @return array|null
 */
function statchasers_sos_load_json( $file ) {
	$path = STATCHASERS_SOS_DIR . 'data/sos/' . $file;
	if ( ! is_readable( $path ) ) {
		return null;
	}
	$decoded = json_decode( (string) file_get_contents( $path ), true );
	return is_array( $decoded ) ? $decoded : null;
}

/**
 * StatChasers player-profile URL for a full player name. Mirrors the slug
 * logic in the app (src/lib/utils.ts getPlayerProfileUrl): drop periods and
 * apostrophes, collapse any other non-alphanumeric run to a single hyphen.
 *
 * @param string $name Player full name.
 * @return string|null
 */
function statchasers_sos_player_url( $name ) {
	$slug = strtolower( (string) $name );
	$slug = preg_replace( '/[\'.\x{2019}]/u', '', $slug );
	$slug = preg_replace( '/[^a-z0-9]+/', '-', $slug );
	$slug = trim( (string) $slug, '-' );
	if ( '' === $slug ) {
		return null;
	}
	return 'https://statchasers.com/nfl/players/' . $slug . '/';
}

/**
 * One weekly matchup cell: "vs SF 23.5" / "@ DEN 20.1" / "Bye".
 * The number is the opponent's adjusted fantasy points allowed (aFPA) vs the
 * position — the same value the interactive grid shows.
 *
 * @param array $week Week entry from the JSON.
 * @return string HTML for the <td>.
 */
function statchasers_sos_week_cell( $week ) {
	if ( ! empty( $week['isBye'] ) || empty( $week['opponent'] ) ) {
		return '<td class="sos-ssr-bye">Bye</td>';
	}
	$prefix = ! empty( $week['isHome'] ) ? 'vs ' : '@ ';
	$afpa   = isset( $week['adjustedPoints'] ) && null !== $week['adjustedPoints']
		? ' ' . number_format( (float) $week['adjustedPoints'], 1 )
		: '';
	return '<td>' . esc_html( $prefix . $week['opponent'] . $afpa ) . '</td>';
}

/**
 * Build the full server-rendered block for one scoring format: for each
 * position, the 32-team weekly SOS table plus the top players by schedule
 * strength. Cached in a transient keyed to the data files' mtimes, so the
 * JSON is only parsed when the dataset (or plugin) actually changes.
 *
 * @param string $scoring_slug "ppr" | "half-ppr" | "std".
 * @return string HTML (empty string when the data files are missing).
 */
function statchasers_sos_render_ssr( $scoring_slug ) {
	$positions = array(
		'qb' => 'Quarterback',
		'rb' => 'Running Back',
		'wr' => 'Wide Receiver',
		'te' => 'Tight End',
	);
	$scorings  = array(
		'ppr'      => 'PPR',
		'half-ppr' => 'Half-PPR',
		'std'      => 'Standard',
	);
	if ( ! isset( $scorings[ $scoring_slug ] ) ) {
		$scoring_slug = 'ppr';
	}
	$scoring_label = $scorings[ $scoring_slug ];

	// Cache signature: plugin version + mtime of every data file involved.
	$sig = STATCHASERS_SOS_VERSION;
	$manifest_path = STATCHASERS_SOS_DIR . 'data/sos/manifest.json';
	if ( file_exists( $manifest_path ) ) {
		$sig .= '|manifest:' . filemtime( $manifest_path );
	}
	foreach ( array( 'team-sos', 'player-sos' ) as $kind ) {
		foreach ( array_keys( $positions ) as $pos ) {
			$files = glob( STATCHASERS_SOS_DIR . 'data/sos/' . $kind . '-*-' . $pos . '-' . $scoring_slug . '.json' );
			foreach ( (array) $files as $f ) {
				$sig .= '|' . basename( $f ) . ':' . filemtime( $f );
			}
		}
	}
	$cache_key = 'statchasers_sos_ssr_' . $scoring_slug;
	$cached    = get_transient( $cache_key );
	if ( is_array( $cached ) && isset( $cached['sig'], $cached['html'] ) && $cached['sig'] === $sig ) {
		return $cached['html'];
	}

	$season   = null;
	$sections = '';

	foreach ( $positions as $pos => $pos_label ) {
		$team_files = glob( STATCHASERS_SOS_DIR . 'data/sos/team-sos-*-' . $pos . '-' . $scoring_slug . '.json' );
		if ( empty( $team_files ) ) {
			continue;
		}
		$team = statchasers_sos_load_json( basename( $team_files[0] ) );
		if ( ! $team || empty( $team['rows'] ) ) {
			continue;
		}
		if ( null === $season && isset( $team['season'] ) ) {
			$season = (int) $team['season'];
		}
		$pos_uc = strtoupper( $pos );

		$rows = $team['rows'];
		usort(
			$rows,
			function ( $a, $b ) {
				return ( isset( $a['overallRank'] ) ? (int) $a['overallRank'] : 99 ) - ( isset( $b['overallRank'] ) ? (int) $b['overallRank'] : 99 );
			}
		);

		// Week columns, taken from the first team's schedule.
		$week_numbers = array();
		foreach ( $rows[0]['weeks'] as $w ) {
			$week_numbers[] = (int) $w['week'];
		}

		// A short data-driven summary sentence (real prose for the section).
		$easiest = array();
		$hardest = array();
		foreach ( array_slice( $rows, 0, 3 ) as $r ) {
			$easiest[] = $r['teamFullName'];
		}
		foreach ( array_slice( $rows, -3 ) as $r ) {
			$hardest[] = $r['teamFullName'];
		}

		$sections .= '<section>';
		$sections .= '<h2>' . esc_html( $pos_label . ' (' . $pos_uc . ') Strength of Schedule — ' . $season . ' Fantasy Football' ) . '</h2>';
		$sections .= '<p>' . esc_html(
			sprintf(
				'Easiest %1$s schedules in %2$d: %3$s. Toughest: %4$s (%5$s scoring, ranked by average opponent adjusted fantasy points allowed).',
				$pos_uc,
				$season,
				implode( ', ', $easiest ),
				implode( ', ', $hardest ),
				$scoring_label
			)
		) . '</p>';

		// --- Team table -------------------------------------------------
		$sections .= '<div class="sos-ssr-scroll"><table>';
		$sections .= '<caption>' . esc_html( $season . ' ' . $pos_uc . ' team strength of schedule (' . $scoring_label . '): schedule ranks and weekly opponents with adjusted fantasy points allowed (aFPA). Rank 1 = easiest schedule.' ) . '</caption>';
		$sections .= '<thead><tr><th scope="col">Team</th><th scope="col">Overall Rank</th><th scope="col">ROS Rank</th><th scope="col">Playoff Rank</th>';
		foreach ( $week_numbers as $wn ) {
			$sections .= '<th scope="col">Wk ' . (int) $wn . '</th>';
		}
		$sections .= '</tr></thead><tbody>';
		foreach ( $rows as $r ) {
			$sections .= '<tr><th scope="row">' . esc_html( $r['teamFullName'] . ' (' . $r['team'] . ')' ) . '</th>';
			$sections .= '<td>' . esc_html( isset( $r['overallRank'] ) ? $r['overallRank'] : '-' ) . '</td>';
			$sections .= '<td>' . esc_html( isset( $r['rosRank'] ) ? $r['rosRank'] : '-' ) . '</td>';
			$sections .= '<td>' . esc_html( isset( $r['playoffRank'] ) ? $r['playoffRank'] : '-' ) . '</td>';
			foreach ( $r['weeks'] as $w ) {
				$sections .= statchasers_sos_week_cell( $w );
			}
			$sections .= '</tr>';
		}
		$sections .= '</tbody></table></div>';

		// --- Top players table -------------------------------------------
		$player_files = glob( STATCHASERS_SOS_DIR . 'data/sos/player-sos-*-' . $pos . '-' . $scoring_slug . '.json' );
		$players      = empty( $player_files ) ? null : statchasers_sos_load_json( basename( $player_files[0] ) );
		if ( $players && ! empty( $players['rows'] ) ) {
			$prows = array_values(
				array_filter(
					$players['rows'],
					function ( $p ) {
						return ! empty( $p['isStarter'] );
					}
				)
			);
			usort(
				$prows,
				function ( $a, $b ) {
					return ( isset( $a['sosRank'] ) ? (int) $a['sosRank'] : 999 ) - ( isset( $b['sosRank'] ) ? (int) $b['sosRank'] : 999 );
				}
			);
			if ( $prows ) {
				$sections .= '<h3>' . esc_html( 'Top ' . $pos_label . 's by ' . $season . ' Schedule Strength' ) . '</h3>';
				$sections .= '<div class="sos-ssr-scroll"><table>';
				$sections .= '<caption>' . esc_html( 'Starting ' . $pos_uc . 's ranked by ' . $season . ' strength of schedule (' . $scoring_label . '). Rank 1 = easiest schedule.' ) . '</caption>';
				$sections .= '<thead><tr><th scope="col">SOS Rank</th><th scope="col">Player</th><th scope="col">NFL Team</th><th scope="col">ROS Rank</th><th scope="col">Playoff Rank</th></tr></thead><tbody>';
				foreach ( $prows as $p ) {
					$url   = statchasers_sos_player_url( $p['playerName'] );
					$name  = esc_html( $p['playerName'] );
					$name  = $url ? '<a href="' . esc_url( $url ) . '">' . $name . '</a>' : $name;
					$sections .= '<tr><td>' . esc_html( isset( $p['sosRank'] ) ? $p['sosRank'] : '-' ) . '</td>';
					$sections .= '<th scope="row">' . $name . '</th>';
					$sections .= '<td>' . esc_html( $p['team'] ) . '</td>';
					$sections .= '<td>' . esc_html( isset( $p['rosSosRank'] ) ? $p['rosSosRank'] : '-' ) . '</td>';
					$sections .= '<td>' . esc_html( isset( $p['playoffSosRank'] ) ? $p['playoffSosRank'] : '-' ) . '</td></tr>';
				}
				$sections .= '</tbody></table></div>';
			}
		}

		$sections .= '</section>';
	}

	if ( '' === $sections ) {
		return '';
	}

	$intro = '<p>' . esc_html(
		sprintf(
			'%1$d fantasy football strength of schedule rankings for every NFL team, by position (%2$s scoring). Schedules are ranked by the adjusted fantasy points allowed (aFPA) of each weekly opponent: rank 1 is the easiest schedule, rank 32 the hardest. Each weekly cell shows the matchup (vs = home, @ = away) and the opponent\'s aFPA against that position — a higher aFPA means an easier matchup.',
			$season,
			$scoring_label
		)
	) . '</p>';

	// Honest freshness signal: the dataset's real modification date, straight
	// from the data manifest. It only moves when the data actually changes.
	$manifest = statchasers_sos_load_json( 'manifest.json' );
	if ( $manifest && ! empty( $manifest['updatedAt'] ) ) {
		$ts = strtotime( (string) $manifest['updatedAt'] );
		if ( $ts ) {
			$intro .= '<p>Data last updated <time datetime="' . esc_attr( gmdate( 'Y-m-d', $ts ) ) . '">' . esc_html( gmdate( 'F j, Y', $ts ) ) . '</time>.</p>';
		}
	}

	$html = '<section class="sos-ssr" aria-label="' . esc_attr( $season . ' fantasy football strength of schedule rankings' ) . '">' . $intro . $sections . '</section>';

	set_transient( $cache_key, array( 'sig' => $sig, 'html' => $html ), WEEK_IN_SECONDS );
	return $html;
}

/**
 * The Vite bundle is an ES module — it must be loaded with type="module".
 */
function statchasers_sos_script_type( $tag, $handle ) {
	if ( STATCHASERS_SOS_HANDLE === $handle ) {
		$tag = str_replace( ' src=', ' type="module" src=', $tag );
	}
	return $tag;
}
add_filter( 'script_loader_tag', 'statchasers_sos_script_type', 10, 2 );

/**
 * Shortcode: enqueue the bundle and output the mount wrapper. The app finds
 * every `.sos-app-root` on the page, attaches a Shadow DOM, injects its styles,
 * and renders itself inside — no iframe.
 */
function statchasers_sos_shortcode( $atts ) {
	$js = statchasers_sos_find_asset( 'js' );
	if ( ! $js ) {
		return '<p style="font-family:sans-serif;color:#b91c1c">StatChasers SOS: build assets were not found. Please re-upload the plugin zip.</p>';
	}

	// Initial view: read it from the page's own URL so deep links / reloads land
	// on the right tab/position/scoring.
	$state = statchasers_sos_view_state( $_GET ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended

	wp_enqueue_style( 'statchasers-sos-fonts' );
	wp_enqueue_style( 'statchasers-sos-ssr' );
	wp_enqueue_script( STATCHASERS_SOS_HANDLE );

	// Runtime config the app reads before it boots. `inline` puts it in
	// query-string sync mode and tells it not to touch the host page's head.
	$config = array(
		'dataBase'     => untrailingslashit( STATCHASERS_SOS_URL ) . '/data/sos',
		'prettyUrls'   => false,
		'inline'       => true,
		'initialState' => array(
			'tab'      => $state['tab'],
			'position' => $state['position'],
			'scoring'  => $state['scoring'],
		),
	);
	// Printed before the (deferred) module executes, so the global is set in time.
	wp_add_inline_script(
		STATCHASERS_SOS_HANDLE,
		'window.__STATCHASERS_SOS__ = ' . wp_json_encode( $config ) . ';',
		'before'
	);

	// The wrapper the app mounts into. It is NOT empty: it carries the
	// server-rendered tables (same data the app shows) so the initial HTML
	// response is meaningful to crawlers and to users without JavaScript.
	// When the app boots it attaches a Shadow DOM here and removes this
	// light-DOM block, so the content is never shown twice.
	return '<div class="sos-app-root">' . statchasers_sos_render_ssr( $state['scoring'] ) . '</div>';
}
add_shortcode( 'statchasers_sos', 'statchasers_sos_shortcode' );
