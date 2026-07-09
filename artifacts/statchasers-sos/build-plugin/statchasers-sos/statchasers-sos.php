<?php
/**
 * Plugin Name:       StatChasers Strength of Schedule
 * Plugin URI:        https://statchasers.com/
 * Description:        Embeds the StatChasers Fantasy Football Strength of Schedule tool. Add the shortcode [statchasers_sos] to any page or post.
 * Version:           1.2.0
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
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

define( 'STATCHASERS_SOS_VERSION', '1.2.0' );
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
}
add_action( 'wp_enqueue_scripts', 'statchasers_sos_register_assets' );

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

	// The single wrapper the app mounts into. Left empty — the app fills it.
	return '<div class="sos-app-root"></div>';
}
add_shortcode( 'statchasers_sos', 'statchasers_sos_shortcode' );
