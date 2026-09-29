#!/usr/bin/env node
/**
 * WEBRIGHT — partial & config sync
 * ------------------------------------------------------------------
 * The site is plain static HTML: every page is complete, committed and
 * deployable without a build step. To avoid hand-editing the header,
 * footer and <head> boilerplate in 17 files, shared markup lives in
 * /partials and is stamped into each page between marker comments:
 *
 *   <!-- partial:header --> ...generated... <!-- /partial:header -->
 *
 * Run from the webright/ folder after changing a partial or
 * site.config.json:
 *
 *   node tools/sync.mjs
 *
 * What it does (idempotent — safe to run any number of times):
 *   1. Replaces every partial block with the rendered partial.
 *   2. Rewrites the site origin everywhere in each page (canonical,
 *      Open Graph, JSON-LD) when `siteUrl` changes in the config.
 *   3. Writes `formEndpoint` into the Start a Project form's action.
 *   4. Regenerates sitemap.xml (skipping pages marked noindex),
 *      robots.txt and js/config.js.
 *
 * Partial template syntax (deliberately tiny):
 *   {{root}}            relative path to the site root ("" or "../")
 *   {{home}}            link to the home page ("./" or "../")
 *   {{canonical}}       absolute URL of the current page
 *   {{some.config.key}} any value from site.config.json
 *   {{current:KEY}}     ` aria-current="page"` when KEY matches the page
 *   {{active:KEY}}      ` is-active` when KEY matches the page
 *   {{#key}}..{{/key}}  block rendered only when the config value is set
 *   {{^key}}..{{/key}}  block rendered only when the config value is empty
 *
 * KEY matches either the page's <body data-page="..."> value or its
 * path relative to the site root (e.g. "services/marketing.html").
 * Zero dependencies — Node 18+.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['partials', 'tools', 'assets', 'css', 'js', 'node_modules']);

const config = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));
const origin = config.siteUrl.replace(/\/+$/, '');

// Derived values available to partials alongside the raw config.
const derived = {
  ...config,
  whatsapp: { ...config.whatsapp, url: `https://wa.me/${config.whatsapp.number}` },
  ogImage: `${origin}/assets/images/og/webright-og.png`,
};

function findPages(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return SKIP_DIRS.has(name) ? [] : findPages(full);
    return name.endsWith('.html') ? [full] : [];
  });
}

function lookup(path) {
  return path.split('.').reduce((obj, key) => (obj == null ? undefined : obj[key]), derived);
}

function pageUrl(rel) {
  if (rel === 'index.html') return `${origin}/`;
  return `${origin}/${rel}`;
}

function render(template, page) {
  const matches = (key) => key === page.key || key === page.rel;
  return (
    template
      // Conditional blocks first so their contents can contain tokens.
      .replace(/\{\{([#^])([\w.]+)\}\}([\s\S]*?)\{\{\/\2\}\}/g, (_, type, key, body) => {
        const value = lookup(key);
        const truthy = value !== null && value !== undefined && value !== '' && value !== false;
        return (type === '#') === truthy ? body : '';
      })
      .replace(/\{\{current:([\w./-]+)\}\}/g, (_, key) =>
        matches(key) ? ' aria-current="page"' : '',
      )
      .replace(/\{\{active:([\w./-]+)\}\}/g, (_, key) => (matches(key) ? ' is-active' : ''))
      .replace(/\{\{root\}\}/g, page.root)
      .replace(/\{\{home\}\}/g, page.home)
      .replace(/\{\{canonical\}\}/g, page.url)
      .replace(/\{\{([\w.]+)\}\}/g, (token, key) => {
        const value = lookup(key);
        if (value === undefined || value === null) {
          throw new Error(`Unknown or empty token ${token} in partial for ${page.rel}`);
        }
        return String(value);
      })
  );
}

const partialCache = new Map();
function partial(name) {
  if (!partialCache.has(name)) {
    partialCache.set(name, readFileSync(join(ROOT, 'partials', `${name}.html`), 'utf8').trim());
  }
  return partialCache.get(name);
}

const pages = findPages(ROOT).sort();
const sitemapEntries = [];

for (const file of pages) {
  const rel = relative(ROOT, file).split(sep).join('/');
  let html = readFileSync(file, 'utf8');
  const depth = rel.split('/').length - 1;
  // 404 pages are served from arbitrary URLs, so they need root-absolute links.
  const absolute = /<body[^>]*data-root="absolute"/.test(html);
  const page = {
    rel,
    key: (html.match(/<body[^>]*data-page="([^"]+)"/) || [])[1] || '',
    root: absolute ? '/' : '../'.repeat(depth),
    home: absolute ? '/' : depth ? '../'.repeat(depth) : './',
    url: pageUrl(rel),
  };

  // Detect the origin the page was last synced with so JSON-LD and other
  // absolute URLs outside partials follow a domain change.
  const previous = (html.match(/<link rel="canonical" href="(https?:\/\/[^/"]+)/) || [])[1];

  html = html.replace(
    /(<!-- partial:([\w-]+) -->)[\s\S]*?(<!-- \/partial:\2 -->)/g,
    (_, open, name, close) => `${open}\n${render(partial(name), page)}\n${close}`,
  );
  if (previous && previous !== origin) html = html.split(previous).join(origin);

  // Point the project form at the configured endpoint so it also works
  // without JavaScript once a backend exists.
  html = html.replace(
    /(<form[^>]*id="project-form"[^>]*action=")[^"]*(")/,
    (_, open, close) => `${open}${config.formEndpoint || ''}${close}`,
  );

  writeFileSync(file, html);

  const noindex = /<meta name="robots" content="[^"]*noindex/.test(html);
  if (!noindex && rel !== '404.html') sitemapEntries.push(page.url);
}

const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by tools/sync.mjs — do not edit by hand. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.map((url) => `  <url><loc>${url}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`,
);

writeFileSync(
  join(ROOT, 'robots.txt'),
  `# Generated by tools/sync.mjs — do not edit by hand.
User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml
`,
);

writeFileSync(
  join(ROOT, 'js', 'config.js'),
  `/**
 * GENERATED by tools/sync.mjs from site.config.json — edit that file instead.
 * Public, client-side values only. Never put secrets or private API keys here:
 * everything in this file is downloaded by every visitor.
 */
export const config = Object.freeze({
${Object.entries({
  siteName: config.siteName,
  siteUrl: origin,
  email: config.email,
  whatsappNumber: config.whatsapp.number,
  whatsappDisplay: config.whatsapp.display,
  instagramUrl: config.instagram.url,
  formEndpoint: config.formEndpoint,
})
  .map(([key, value]) => `  ${key}: ${jsLiteral(value)},`)
  .join('\n')}
});
`,
);

// Prettier-compatible literal (single quotes) so the generated file stays lint-clean.
function jsLiteral(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'string') return JSON.stringify(value);
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

console.log(
  `Synced ${pages.length} pages · ${sitemapEntries.length} in sitemap · origin ${origin}`,
);
if (config.siteUrlIsPlaceholder) {
  console.warn(
    '⚠ siteUrl is still a placeholder — set the real domain in site.config.json before launch.',
  );
}
