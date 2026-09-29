/**
 * Analytics hooks — provider-agnostic, no tracking IDs, no cookies.
 * ------------------------------------------------------------------
 * Nothing is sent anywhere until an analytics tool is connected.
 * Every event is:
 *   1. pushed to `window.dataLayer` if one exists (Google Tag Manager,
 *      GA4 via gtag, and most tag managers read from it), and
 *   2. dispatched as a `webright:track` DOM event, so any other tool
 *      (Plausible, Fathom, PostHog…) can subscribe in a few lines:
 *
 *      window.addEventListener('webright:track', (e) => {
 *        plausible(e.detail.event, { props: e.detail });
 *      });
 *
 * Declarative tracking: add data-track="event_name" (and optionally
 * data-track-location / data-track-project / data-track-service) to any
 * link or button. Events currently emitted:
 *
 *   start_project_click   any "Start a Project" CTA (location = where)
 *   service_view          a service page was viewed (service = slug)
 *   project_click         a project/case study link (project = slug)
 *   project_view          a case study page was viewed
 *   whatsapp_click        WhatsApp link
 *   instagram_click       Instagram link
 *   email_click           email link (once an address exists)
 *   project_form_start    first interaction with the Start a Project form
 *   project_form_step     visitor moved to a new form step
 *   project_form_submit   form sent successfully  ← primary conversion
 *   project_form_handoff  form completed and handed to WhatsApp (no endpoint yet)
 *   project_form_error    submission failed
 *
 * Consent: if you connect a tool that sets cookies or tracks personal
 * data, add a consent mechanism first and update privacy.html.
 */

export function track(event, properties = {}) {
  const detail = { event, page: location.pathname, ...properties };

  if (Array.isArray(window.dataLayer)) window.dataLayer.push(detail);
  window.dispatchEvent(new CustomEvent('webright:track', { detail }));

  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    console.debug('[webright:track]', detail);
  }
}

export function initAnalytics() {
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-track]');
    if (!target) return;
    const { track: name, trackLocation, trackProject, trackService } = target.dataset;
    track(name, {
      location: trackLocation,
      project: trackProject,
      service: trackService,
      href: target.getAttribute('href') || undefined,
    });
  });

  const { service, project } = document.body.dataset;
  if (service) track('service_view', { service });
  if (project) track('project_view', { project });
}
