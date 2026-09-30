import { onCLS, onINP, onLCP, onTTFB, type Metric } from "web-vitals";
import { getRuntimeConfig } from "./runtime-config";

/**
 * Real-user Core Web Vitals monitoring (LCP / CLS / INP / TTFB), tagged with
 * the tool name so SOS-page vitals are separable in analytics. Lab tools
 * (Lighthouse/PageSpeed) can't observe the full interactive lifecycle — INP
 * especially only exists in the field — so we report from real sessions.
 *
 * Reporting sinks, in order:
 *   1. window.gtag  (GA4 on the host WordPress page)
 *   2. window.dataLayer  (Google Tag Manager)
 *   3. cfg.vitalsEndpoint  (optional beacon URL the host may configure)
 *
 * All sinks are optional — with none present this is a no-op beyond the tiny
 * observer registrations. Never throws: monitoring must not break the tool.
 */
export function initVitals() {
  try {
    // Once per page — survives HMR module re-executions in dev.
    const w = window as unknown as { __sosVitalsInit?: boolean };
    if (w.__sosVitalsInit) return;
    w.__sosVitalsInit = true;
    const report = (metric: Metric) => {
      try {
        const w = window as unknown as {
          gtag?: (...args: unknown[]) => void;
          dataLayer?: unknown[];
        };
        // GA4 counts `value` as an integer; CLS is a small fraction, so send
        // it scaled ×1000 per the web-vitals GA guidance. The exact value
        // still travels in metric_value.
        const rounded = Math.round(
          metric.name === "CLS" ? metric.value * 1000 : metric.value,
        );
        if (typeof w.gtag === "function") {
          w.gtag("event", metric.name, {
            value: rounded,
            metric_id: metric.id,
            metric_value: metric.value,
            metric_rating: metric.rating,
            tool: "statchasers-sos",
            non_interaction: true,
          });
        } else if (Array.isArray(w.dataLayer)) {
          w.dataLayer.push({
            event: "web-vitals",
            metric_name: metric.name,
            metric_value: metric.value,
            metric_id: metric.id,
            metric_rating: metric.rating,
            tool: "statchasers-sos",
          });
        }
        const endpoint = getRuntimeConfig().vitalsEndpoint;
        if (endpoint && typeof navigator.sendBeacon === "function") {
          navigator.sendBeacon(
            endpoint,
            JSON.stringify({
              name: metric.name,
              value: metric.value,
              id: metric.id,
              rating: metric.rating,
              tool: "statchasers-sos",
              page: window.location.pathname,
            }),
          );
        }
      } catch {
        // Reporting failures are never allowed to surface.
      }
    };

    onLCP(report);
    onCLS(report);
    onINP(report);
    onTTFB(report);
  } catch {
    // web-vitals unsupported (ancient browser) — silently skip.
  }
}
