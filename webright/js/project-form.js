/**
 * Start a Project — multi-step brief
 * ------------------------------------------------------------------
 * Progressive enhancement of a normal <form>: without JS every step is
 * visible and it submits as a standard POST. This module turns it into a
 * 7-step flow with per-step validation, a progress indicator, focus
 * management, a draft kept in sessionStorage, and async submission.
 *
 * BACKEND CONNECTION (see README → "Start a Project form"):
 *   Set `formEndpoint` in site.config.json and run `node tools/sync.mjs`.
 *   The brief is POSTed as multipart FormData with `Accept: application/json`,
 *   which works with services such as Formspree, Basin or Getform, or with
 *   your own endpoint. Any 2xx response is treated as success.
 *   Field names: services (repeated), name, company, email, phone, country,
 *   description, link, goals, budget, timeline, next_step, source,
 *   form_started_at, website (honeypot — must be empty).
 *
 *   While `formEndpoint` is null, the completed brief is handed to WhatsApp
 *   instead (prefilled message). Nothing pretends to have been sent.
 *
 * SECURITY: everything here is a convenience for honest visitors. The
 * server must re-validate every field, enforce length limits, reject
 * submissions with the honeypot filled, and rate-limit. Never trust the
 * client. User input is only ever written back to the page via
 * textContent (never innerHTML).
 */
import { config } from './config.js';
import { track } from './analytics.js';
import { el, prefersReducedMotion } from './utils.js';

const DRAFT_KEY = 'webright:project-brief';
const MIN_FILL_MS = 3000; // faster than this is almost certainly a bot
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9\s().-]{6,20}$/;
const LINK_RE = /^(https?:\/\/)?[^\s/$.?#]+\.[^\s]{2,}$/i;

const LABELS = {
  services: 'Services',
  name: 'Name',
  company: 'Company',
  email: 'Email',
  phone: 'Phone / WhatsApp',
  country: 'Country',
  description: 'Project',
  link: 'Link',
  goals: 'Goals',
  budget: 'Budget',
  timeline: 'Timeline',
  next_step: 'Preferred next step',
};

export function initProjectForm() {
  const form = document.querySelector('[data-project-form]');
  if (form) new ProjectForm(form);
}

class ProjectForm {
  constructor(form) {
    this.form = form;
    this.steps = [...form.querySelectorAll('[data-step]')];
    this.current = 0;
    this.started = false;
    this.sending = false;

    this.ui = {
      prev: form.querySelector('[data-prev]'),
      next: form.querySelector('[data-next]'),
      submit: form.querySelector('[data-submit]'),
      bar: form.querySelector('[data-progress-bar]'),
      label: form.querySelector('[data-progress-label]'),
      title: form.querySelector('[data-progress-title]'),
      status: form.querySelector('[data-form-status]'),
      summary: form.querySelector('[data-error-summary]'),
      review: form.querySelector('[data-review]'),
      reviewList: form.querySelector('[data-review-list]'),
      stepList: [...document.querySelectorAll('[data-brief-steps] li')],
      results: Object.fromEntries(
        [...document.querySelectorAll('[data-result]')].map((node) => [node.dataset.result, node]),
      ),
    };

    // We validate ourselves so errors are consistent and announced.
    form.setAttribute('novalidate', '');
    form.querySelector('[data-started-at]').value = String(Date.now());

    this.restoreDraft();
    this.bind();
    this.render({ focus: false });
  }

  /* ----------------------------------------------------------- events */
  bind() {
    this.ui.next.addEventListener('click', () => this.go(1));
    this.ui.prev.addEventListener('click', () => this.go(-1));
    this.form.addEventListener('submit', (event) => this.submit(event));

    // Enter in a single-line input advances instead of submitting early.
    this.form.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.target.tagName !== 'INPUT') return;
      if (event.target.type === 'checkbox' || event.target.type === 'radio') return;
      event.preventDefault();
      if (this.current < this.steps.length - 1) this.go(1);
      else this.form.requestSubmit();
    });

    this.form.addEventListener('input', (event) => {
      if (!this.started) {
        this.started = true;
        track('project_form_start');
      }
      // Clear an error as soon as the visitor fixes the field.
      const name = event.target.name;
      if (name && this.errorFor(name)?.textContent) this.validateStep(this.current, { only: name });
      this.saveDraft();
    });

    document
      .querySelectorAll('[data-edit]')
      .forEach((button) => button.addEventListener('click', () => this.showForm()));

    document
      .querySelectorAll('[data-handoff-link]')
      .forEach((link) =>
        link.addEventListener('click', () =>
          track('project_form_handoff', { channel: 'whatsapp' }),
        ),
      );
  }

  /* ------------------------------------------------------- navigation */
  go(direction) {
    if (direction > 0 && !this.validateStep(this.current)) return;
    const next = Math.min(Math.max(this.current + direction, 0), this.steps.length - 1);
    if (next === this.current) return;
    this.current = next;
    this.render({ back: direction < 0 });
    track('project_form_step', { step: this.current + 1 });
  }

  render({ focus = true, back = false } = {}) {
    const total = this.steps.length;
    const step = this.steps[this.current];
    const isLast = this.current === total - 1;

    this.steps.forEach((node, i) => {
      node.classList.toggle('is-current', i === this.current);
      node.classList.toggle('is-back', i === this.current && back);
    });
    this.ui.stepList.forEach((item, i) => {
      item.classList.toggle('is-current', i === this.current);
      item.classList.toggle('is-done', i < this.current);
      if (i === this.current) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });

    this.ui.prev.hidden = this.current === 0;
    this.ui.next.hidden = isLast;
    this.ui.submit.hidden = !isLast;
    this.ui.bar.style.setProperty('--progress', String((this.current + 1) / total));
    this.ui.label.textContent = `Step ${this.current + 1} of ${total}`;
    this.ui.title.textContent = step.dataset.title;
    this.hideSummary();

    if (isLast) this.renderReview();

    if (focus) {
      this.ui.status.textContent = `Step ${this.current + 1} of ${total}: ${step.dataset.title}`;
      const heading = step.querySelector('.brief__question');
      heading?.focus({ preventScroll: true });
      const top = this.form.getBoundingClientRect().top + window.scrollY - 96;
      if (window.scrollY > top) {
        window.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      }
    }
  }

  /* ------------------------------------------------------- validation */
  errorFor(name) {
    return this.form.querySelector(`[data-error-for="${name}"]`);
  }

  setError(name, message) {
    const target = this.errorFor(name);
    if (target) target.textContent = message || '';
    this.form.querySelectorAll(`[name="${name}"]`).forEach((field) => {
      if (field.type === 'checkbox' || field.type === 'radio') return;
      if (message) field.setAttribute('aria-invalid', 'true');
      else field.removeAttribute('aria-invalid');
    });
    const group = this.form.querySelector(`[data-group="${name}"]`);
    if (group) {
      const fieldset = group.closest('fieldset');
      if (message) fieldset.setAttribute('aria-invalid', 'true');
      else fieldset.removeAttribute('aria-invalid');
    }
  }

  value(name) {
    return (this.form.elements[name]?.value || '').trim();
  }

  rulesFor(stepNumber) {
    const data = new FormData(this.form);
    const rules = {
      1: { services: () => (data.getAll('services').length ? '' : 'Choose at least one option.') },
      2: {
        name: () => (this.value('name').length >= 2 ? '' : 'Please enter your name.'),
        email: () => {
          const v = this.value('email');
          if (!v) return 'Please enter your email address.';
          return EMAIL_RE.test(v) ? '' : 'That email address doesn’t look right — please check it.';
        },
        phone: () => {
          const v = this.value('phone');
          return !v || PHONE_RE.test(v)
            ? ''
            : 'Please enter a valid phone number, including the country code.';
        },
      },
      3: {
        description: () => {
          const v = this.value('description');
          if (!v) return 'Please tell us a little about the project.';
          return v.length >= 20 ? '' : 'A little more detail helps — at least a sentence or two.';
        },
        link: () => {
          const v = this.value('link');
          return !v || LINK_RE.test(v) ? '' : 'That link doesn’t look right — please check it.';
        },
      },
      5: {
        budget: () => (data.get('budget') ? '' : 'Please choose a range — “Not sure yet” is fine.'),
      },
      6: { timeline: () => (data.get('timeline') ? '' : 'Please choose a timeline.') },
      7: {
        next_step: () => {
          const choice = data.get('next_step');
          if (!choice) return 'Please choose how we should get back to you.';
          if ((choice === 'WhatsApp' || choice === 'Call / Meeting') && !this.value('phone')) {
            return 'Add a phone / WhatsApp number in step 2 so we can reach you this way.';
          }
          return '';
        },
      },
    };
    return rules[stepNumber] || {};
  }

  validateStep(index, { only } = {}) {
    const rules = this.rulesFor(index + 1);
    const errors = [];
    for (const [name, check] of Object.entries(rules)) {
      if (only && name !== only) continue;
      const message = check();
      this.setError(name, message);
      if (message) errors.push({ name, message });
    }
    if (only) return errors.length === 0;

    if (errors.length) {
      this.showSummary(errors);
      const first = this.form.querySelector(`[name="${errors[0].name}"]:not([type="hidden"])`);
      first?.focus();
      return false;
    }
    this.hideSummary();
    return true;
  }

  showSummary(errors) {
    const { summary } = this.ui;
    summary.replaceChildren(
      errors.length === 1
        ? errors[0].message
        : el('span', {}, [
            `Please fix ${errors.length} things before continuing: `,
            errors.map((e) => e.message).join(' '),
          ]),
    );
    summary.hidden = false;
  }

  hideSummary() {
    this.ui.summary.hidden = true;
    this.ui.summary.replaceChildren();
  }

  /* ----------------------------------------------------------- review */
  collect() {
    const data = new FormData(this.form);
    const entries = [];
    for (const key of Object.keys(LABELS)) {
      const values = data
        .getAll(key)
        .map((v) => String(v).trim())
        .filter(Boolean);
      if (values.length) entries.push([LABELS[key], values.join(', ')]);
    }
    return entries;
  }

  renderReview() {
    const entries = this.collect().filter(([label]) => label !== LABELS.next_step);
    this.ui.reviewList.replaceChildren(
      ...entries.map(([label, value]) =>
        el('div', {}, [el('dt', { text: label }), el('dd', { text: value })]),
      ),
    );
    this.ui.review.hidden = entries.length === 0;
  }

  whatsappLink() {
    const lines = ['Hi WEBRIGHT — here is my project brief:', ''];
    for (const [label, value] of this.collect()) lines.push(`${label}: ${value}`);
    const text = lines.join('\n').slice(0, 3500); // keep the URL a sensible length
    return `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(text)}`;
  }

  /* ------------------------------------------------------- submission */
  async submit(event) {
    event.preventDefault();
    if (this.sending) return;

    // Validate every step; jump to the first one with a problem.
    for (let i = 0; i < this.steps.length; i++) {
      const rules = this.rulesFor(i + 1);
      const hasError = Object.values(rules).some((check) => check());
      if (hasError) {
        this.current = i;
        this.render();
        this.validateStep(i);
        return;
      }
    }

    // Spam heuristics: pretend success so bots learn nothing.
    const startedAt = Number(this.form.elements.form_started_at.value) || 0;
    if (this.value('website') || Date.now() - startedAt < MIN_FILL_MS) {
      this.showResult('success');
      return;
    }

    const handoff = this.whatsappLink();
    document.querySelectorAll('[data-handoff-link]').forEach((link) => (link.href = handoff));

    if (!config.formEndpoint) {
      this.showResult('handoff');
      return;
    }

    this.sending = true;
    this.ui.submit.setAttribute('aria-disabled', 'true');
    this.ui.submit.firstChild.textContent = 'Sending… ';
    try {
      const response = await fetch(config.formEndpoint, {
        method: 'POST',
        body: new FormData(this.form),
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      track('project_form_submit', {
        services: new FormData(this.form).getAll('services').join('|'),
        budget: this.value('budget') || undefined,
      });
      this.clearDraft();
      this.form.reset();
      this.showResult('success');
    } catch (error) {
      console.error('[webright] project form submission failed', error);
      track('project_form_error', { message: String(error.message || error) });
      this.showResult('error');
    } finally {
      this.sending = false;
      this.ui.submit.removeAttribute('aria-disabled');
      this.ui.submit.firstChild.textContent = 'Send Project ';
    }
  }

  showResult(name) {
    this.form.hidden = true;
    Object.entries(this.ui.results).forEach(([key, node]) => (node.hidden = key !== name));
    const node = this.ui.results[name];
    node.focus({ preventScroll: true });
    node.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    this.ui.stepList.forEach((item) => {
      item.classList.add('is-done');
      item.classList.remove('is-current');
    });
  }

  showForm() {
    Object.values(this.ui.results).forEach((node) => (node.hidden = true));
    this.form.hidden = false;
    this.render();
  }

  /* ------------------------------------------------------------ draft */
  saveDraft() {
    try {
      const data = {};
      for (const [key, value] of new FormData(this.form)) {
        if (key === 'website' || key === 'form_started_at') continue;
        (data[key] ||= []).push(value);
      }
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch {
      /* storage unavailable (private mode) — drafts are a nicety */
    }
  }

  restoreDraft() {
    let data;
    try {
      data = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
    } catch {
      return;
    }
    if (!data || typeof data !== 'object') return;
    for (const [key, values] of Object.entries(data)) {
      if (!Array.isArray(values)) continue;
      this.form.querySelectorAll(`[name="${CSS.escape(key)}"]`).forEach((field) => {
        if (field.type === 'checkbox' || field.type === 'radio')
          field.checked = values.includes(field.value);
        else if (field.type !== 'hidden') field.value = String(values[0] ?? '');
      });
    }
  }

  clearDraft() {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  }
}
