#!/usr/bin/env node
/*
 * Steam & Slate — static site generator
 * No dependencies. Run with:  node build.js
 * Output goes into ./site  — that's the folder you deploy to Netlify.
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'site');

const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/config.json'), 'utf8'));
const locations = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/locations.json'), 'utf8'));

/* ---------------------------------------------------------------- helpers */

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function mkdir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function write(relPath, contents) {
  const full = path.join(OUT, relPath);
  mkdir(path.dirname(full));
  fs.writeFileSync(full, contents, 'utf8');
  return relPath;
}

/*
 * Builds the outbound booking link.
 * If you haven't been approved for an affiliate programme yet, this returns
 * a plain public search URL — which is honest and still useful to the reader.
 * Once approved, set useAffiliateLinks to true and drop your ID in config.json.
 */
function bookingLink(searchTerm) {
  const target = `${config.searchBase}?location=${encodeURIComponent(searchTerm)}&features=hot-tub`;
  const a = config.affiliate;
  if (!a.useAffiliateLinks || a.awinAffiliateId === 'PENDING') return target;
  return `https://www.awin1.com/cread.php?awinmid=${a.awinMerchantId}&awinaffid=${a.awinAffiliateId}&ued=${encodeURIComponent(target)}`;
}

/* ------------------------------------------------------------------- html */

function shell({ title, description, canonical, body, jsonld }) {
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonical)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Familjen+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>

<header class="masthead">
  <a class="wordmark" href="/">
    <span class="wordmark__steam">Steam</span><span class="wordmark__amp">&amp;</span><span class="wordmark__slate">Slate</span>
  </a>
  <nav class="masthead__nav" aria-label="Primary">
    <a href="/#regions">Regions</a>
    <a href="/about/">About</a>
  </nav>
</header>

<main id="main">
${body}
</main>

<footer class="footer">
  <div class="footer__inner">
    <p class="footer__note">${esc(config.author.bio)}</p>
    <p class="footer__meta">
      ${esc(config.siteName)} &middot; Written in ${esc(config.author.location)}<br>
      Some links to accommodation providers earn us a commission. It never changes what you pay, and it never decides what goes on the site.
    </p>
  </div>
</footer>
</body>
</html>`;
}

/* ---------------------------------------------- signature: the ridge line
 * A layered silhouette of Welsh hills sitting at the base of every hero,
 * with the steam rising in front of it. This is the thing the site is
 * remembered by, so it stays on every page and nothing else competes.
 */
function ridge() {
  return `<svg class="ridge" viewBox="0 0 1440 220" preserveAspectRatio="none" aria-hidden="true" focusable="false">
  <path class="ridge__far" d="M0,150 L90,118 L170,140 L260,96 L340,128 L430,84 L520,120 L610,92 L700,126 L790,88 L880,124 L980,100 L1070,132 L1160,104 L1250,136 L1340,110 L1440,138 L1440,220 L0,220 Z"/>
  <path class="ridge__mid" d="M0,178 L110,152 L200,172 L300,138 L400,166 L500,132 L600,164 L700,140 L810,174 L910,148 L1010,178 L1120,150 L1230,180 L1330,156 L1440,182 L1440,220 L0,220 Z"/>
  <path class="ridge__near" d="M0,204 L130,186 L240,202 L360,180 L470,200 L590,178 L710,202 L830,184 L950,206 L1080,186 L1200,208 L1320,190 L1440,206 L1440,220 L0,220 Z"/>
</svg>`;
}

/* --------------------------------------------------------------- homepage */

function homepage() {
  const rows = locations
    .map(
      (loc, i) => `
      <a class="region" href="/wales/${loc.slug}/">
        <span class="region__index">${String(i + 1).padStart(2, '0')}</span>
        <span class="region__names">
          <span class="region__name">${esc(loc.name)}</span>
          <span class="region__welsh">${esc(loc.welsh)}</span>
        </span>
        <span class="region__lead">${esc(loc.lead)}</span>
        <span class="region__go" aria-hidden="true">&rarr;</span>
      </a>`
    )
    .join('');

  const body = `
<section class="hero">
  <div class="steam" aria-hidden="true">
    <span class="steam__plume steam__plume--a"></span>
    <span class="steam__plume steam__plume--b"></span>
    <span class="steam__plume steam__plume--c"></span>
  </div>
  ${ridge()}
  <div class="hero__inner">
    <p class="eyebrow">An independent guide &middot; ${locations.length} regions</p>
    <h1 class="hero__title">Hot water,<br><em>cold Welsh air.</em></h1>
    <p class="hero__sub">Where to find a lodge with a hot tub in Wales, which part of each region is actually worth staying in, and when the prices drop. Written by someone who lives here.</p>
    <a class="btn btn--primary" href="#regions">Choose a region</a>
  </div>
</section>

<section class="regions" id="regions">
  <div class="section__head">
    <h2 class="section__title">Every region in Wales</h2>
    <p class="section__note">Pick where you want to be. Each guide covers the areas within it, when to book, and one thing worth knowing before you go.</p>
  </div>
  <div class="region__list">${rows}</div>
</section>`;

  return shell({
    title: `${config.siteName} — ${config.tagline}`,
    description: config.description,
    canonical: config.domain + '/',
    body,
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: config.siteName,
      url: config.domain,
      description: config.description
    }
  });
}

/* --------------------------------------------------------- location pages */

function locationPage(loc) {
  const url = `${config.domain}/wales/${loc.slug}/`;
  const title = `Hot tub lodges in ${loc.name}, Wales — where to stay and when to book`;
  const desc = `${loc.lead} An honest guide to hot tub and glamping breaks in ${loc.name}: the best areas, booking timings and local knowledge.`;

  const nearby = loc.nearby.map((n) => `<li>${esc(n)}</li>`).join('');

  const body = `
<article>
<section class="hero hero--place">
  <div class="steam" aria-hidden="true">
    <span class="steam__plume steam__plume--a"></span>
    <span class="steam__plume steam__plume--b"></span>
  </div>
  ${ridge()}
  <div class="hero__inner">
    <p class="eyebrow"><a href="/">${esc(config.siteName)}</a> &middot; ${esc(loc.county)}</p>
    <h1 class="hero__title hero__title--place">${esc(loc.name)}</h1>
    <p class="hero__welsh">${esc(loc.welsh)}</p>
    <p class="hero__sub">${esc(loc.lead)}</p>
  </div>
</section>

<div class="prose">
  <p class="lede">${esc(loc.intro)}</p>

  <section class="block">
    <h2 class="block__title">Where to stay in ${esc(loc.name)}</h2>
    <p>${esc(loc.whereToStay)}</p>
  </section>

  <section class="block">
    <h2 class="block__title">When to book</h2>
    <p>${esc(loc.whenToBook)}</p>
  </section>

  <aside class="tip">
    <p class="tip__label">Worth knowing</p>
    <p class="tip__body">${esc(loc.localTip)}</p>
  </aside>

  <section class="block">
    <h2 class="block__title">Towns and villages nearby</h2>
    <ul class="places">${nearby}</ul>
  </section>

  <section class="cta">
    <h2 class="cta__title">See what's available</h2>
    <p class="cta__note">This opens a filtered search for hot tub properties in ${esc(loc.name)}. We don't hold availability ourselves — this is the same search you'd run yourself, just pre-filtered.</p>
    <a class="btn btn--primary" href="${esc(bookingLink(loc.searchTerm))}" rel="sponsored noopener" target="_blank">Browse ${esc(loc.name)} properties</a>
  </section>

  <nav class="pagination" aria-label="Other regions">
    <a href="/#regions">&larr; All regions in Wales</a>
  </nav>
</div>
</article>`;

  return shell({
    title,
    description: desc,
    canonical: url,
    body,
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description: desc,
      about: { '@type': 'Place', name: `${loc.name}, Wales` },
      author: { '@type': 'Person', name: config.author.name },
      publisher: { '@type': 'Organization', name: config.siteName }
    }
  });
}

/* ------------------------------------------------------------ about page */

function aboutPage() {
  const body = `
<div class="prose prose--top">
  <h1 class="page__title">About ${esc(config.siteName)}</h1>
  <p class="lede">${esc(config.author.bio)}</p>
  <section class="block">
    <h2 class="block__title">How this site makes money</h2>
    <p>Some of the links to accommodation providers on this site are affiliate links. If you book through one, the provider pays a small commission. It costs you nothing extra and the price is identical to going direct.</p>
    <p>It doesn't influence what's written. No provider has paid to appear here, and no region has been included or left out for commercial reasons.</p>
  </section>
  <section class="block">
    <h2 class="block__title">What this site isn't</h2>
    <p>It isn't a booking engine. We don't hold availability, take payment, or handle your reservation. Every booking happens on the provider's own site under their terms.</p>
  </section>
  <nav class="pagination"><a href="/#regions">&larr; All regions in Wales</a></nav>
</div>`;

  return shell({
    title: `About — ${config.siteName}`,
    description: `How ${config.siteName} works, who writes it, and how it makes money.`,
    canonical: config.domain + '/about/',
    body
  });
}

/* --------------------------------------------------------------- the CSS */

const css = `
/* ============================================================
   Steam & Slate
   Palette: Welsh slate at dusk, mineral water, lamp glow.
   ============================================================ */
:root{
  --ink:#0D171C;
  --slate:#152730;
  --slate-2:#1E3742;
  --line:#294550;
  --moss:#4E6B5D;
  --steam:#E9EFEC;
  --steam-dim:#9CB3AE;
  --thermal:#7FC7BD;
  --ember:#E8A25E;

  --display:"Instrument Serif",Georgia,serif;
  --body:"Familjen Grotesk","Helvetica Neue",Arial,sans-serif;

  --wrap:68rem;
  --read:38rem;
}

*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0;
  background:var(--ink);
  color:var(--steam);
  font-family:var(--body);
  font-size:1.0625rem;
  line-height:1.65;
  -webkit-font-smoothing:antialiased;
}
img{max-width:100%;display:block}
a{color:inherit}

.skip{
  position:absolute;left:-9999px;top:0;
  background:var(--thermal);color:var(--ink);
  padding:.75rem 1rem;z-index:99;font-weight:600;
}
.skip:focus{left:0}

:focus-visible{
  outline:2px solid var(--thermal);
  outline-offset:3px;
  border-radius:2px;
}

/* ---------------------------------------------------- masthead */
.masthead{
  display:flex;align-items:center;justify-content:space-between;
  gap:1rem;
  max-width:var(--wrap);margin:0 auto;
  padding:1.5rem 1.5rem;
  position:relative;z-index:3;
}
.wordmark{
  text-decoration:none;
  font-family:var(--display);
  font-size:1.35rem;
  letter-spacing:.01em;
  display:inline-flex;align-items:baseline;gap:.3em;
}
.wordmark__amp{color:var(--thermal);font-style:italic}
.wordmark__slate{color:var(--steam-dim)}
.masthead__nav{display:flex;gap:1.5rem}
.masthead__nav a{
  text-decoration:none;
  font-size:.8125rem;
  letter-spacing:.09em;
  text-transform:uppercase;
  color:var(--steam-dim);
  padding:.25rem 0;
  border-bottom:1px solid transparent;
}
.masthead__nav a:hover{color:var(--steam);border-bottom-color:var(--thermal)}

/* -------------------------------------------------------- hero */
.hero{
  position:relative;
  overflow:hidden;
  background:
    radial-gradient(120% 90% at 50% 110%, rgba(127,199,189,.16), transparent 60%),
    linear-gradient(178deg, var(--ink) 0%, var(--slate) 55%, var(--slate-2) 100%);
  border-bottom:1px solid var(--line);
  margin-top:-5.5rem;
  padding:9rem 1.5rem 5.5rem;
}
.hero__inner{max-width:var(--wrap);margin:0 auto;position:relative;z-index:2}

.eyebrow{
  font-size:.75rem;letter-spacing:.18em;text-transform:uppercase;
  color:var(--thermal);margin:0 0 1.5rem;font-weight:600;
}
.eyebrow a{text-decoration:none}
.eyebrow a:hover{text-decoration:underline}

.hero__title{
  font-family:var(--display);
  font-weight:400;
  font-size:clamp(3rem,10vw,6.5rem);
  line-height:.95;
  letter-spacing:-.02em;
  margin:0 0 1.5rem;
}
.hero__title em{color:var(--thermal);font-style:italic}
.hero__title--place{margin-bottom:.25rem}
.hero__welsh{
  font-family:var(--display);
  font-style:italic;
  font-size:clamp(1.25rem,3.5vw,1.75rem);
  color:var(--steam-dim);
  margin:0 0 1.5rem;
}
.hero__sub{
  max-width:var(--read);
  color:var(--steam-dim);
  font-size:1.125rem;
  margin:0 0 2rem;
}

/* --------------------------------- signature: the ridge + steam */
.ridge{
  position:absolute;left:0;right:0;bottom:-1px;
  width:100%;height:clamp(90px,15vw,190px);
  z-index:1;pointer-events:none;display:block;
}
.ridge__far{fill:#1B333C}
.ridge__mid{fill:#152A32}
.ridge__near{fill:#0D171C}

.steam{
  position:absolute;inset:auto 0 0 0;height:78%;
  pointer-events:none;z-index:2;
}
.steam__plume{
  position:absolute;bottom:0;
  width:34vw;height:34vw;
  max-width:460px;max-height:460px;
  border-radius:50%;
  background:radial-gradient(circle, rgba(196,228,222,.26) 0%, rgba(196,228,222,0) 66%);
  filter:blur(10px);
  animation:rise 19s ease-in-out infinite;
}
.steam__plume--a{left:4%;animation-delay:0s}
.steam__plume--b{left:38%;animation-delay:-7s;animation-duration:24s}
.steam__plume--c{left:70%;animation-delay:-13s;animation-duration:21s}

@keyframes rise{
  0%   {transform:translateY(18%) scale(.82);opacity:0}
  22%  {opacity:.85}
  100% {transform:translateY(-88%) scale(1.5);opacity:0}
}

@media (prefers-reduced-motion:reduce){
  .steam__plume{animation:none;opacity:.4;transform:translateY(-30%) scale(1.2)}
  *{transition-duration:.01ms !important}
}

/* ------------------------------------------------------ buttons */
.btn{
  display:inline-block;
  font-family:var(--body);
  font-weight:600;
  font-size:.9375rem;
  letter-spacing:.02em;
  text-decoration:none;
  padding:.9rem 1.6rem;
  border-radius:2px;
  transition:transform .15s ease, background-color .15s ease;
}
.btn--primary{
  background:var(--ember);
  color:var(--ink);
}
.btn--primary:hover{background:#f0b174;transform:translateY(-1px)}

/* ------------------------------------------------------ regions */
.regions{
  max-width:var(--wrap);margin:0 auto;
  padding:5rem 1.5rem 4rem;
}
.section__head{margin-bottom:3rem;max-width:var(--read)}
.section__title{
  font-family:var(--display);font-weight:400;
  font-size:clamp(2rem,5vw,3rem);line-height:1.05;
  margin:0 0 1rem;
}
.section__note{color:var(--steam-dim);margin:0}

.region__list{border-top:1px solid var(--line)}
.region{
  display:grid;
  grid-template-columns:3.5rem minmax(9rem,16rem) 1fr 2rem;
  align-items:baseline;
  gap:1rem;
  padding:1.6rem .5rem;
  border-bottom:1px solid var(--line);
  text-decoration:none;
  transition:background-color .18s ease, padding-left .18s ease;
}
.region:hover{background:rgba(127,199,189,.05);padding-left:1rem}
.region__index{
  font-size:.75rem;letter-spacing:.12em;
  color:var(--moss);font-weight:600;
}
.region__names{display:flex;flex-direction:column;gap:.15rem}
.region__name{
  font-family:var(--display);font-size:1.6rem;line-height:1.1;
}
.region__welsh{
  font-family:var(--display);font-style:italic;
  font-size:.95rem;color:var(--steam-dim);
}
.region__lead{color:var(--steam-dim);font-size:.9375rem}
.region__go{color:var(--thermal);justify-self:end;font-size:1.1rem}

@media (max-width:44rem){
  .region{grid-template-columns:2.5rem 1fr;row-gap:.35rem}
  .region__lead{grid-column:2}
  .region__go{display:none}
}

/* -------------------------------------------------------- prose */
.prose{
  max-width:var(--read);
  margin:0 auto;
  padding:4rem 1.5rem 5rem;
}
.prose--top{padding-top:3rem}
.page__title{
  font-family:var(--display);font-weight:400;
  font-size:clamp(2.25rem,6vw,3.25rem);line-height:1.05;
  margin:0 0 1.5rem;
}
.lede{
  font-size:1.1875rem;
  color:var(--steam);
  margin:0 0 2.5rem;
}
.block{margin:0 0 2.5rem}
.block__title{
  font-family:var(--display);font-weight:400;
  font-size:1.65rem;line-height:1.15;
  margin:0 0 .75rem;
  color:var(--steam);
}
.block p{color:var(--steam-dim);margin:0 0 1rem}

.tip{
  border-left:2px solid var(--thermal);
  background:rgba(127,199,189,.06);
  padding:1.25rem 1.5rem;
  margin:0 0 2.5rem;
}
.tip__label{
  font-size:.7rem;letter-spacing:.16em;text-transform:uppercase;
  color:var(--thermal);font-weight:600;margin:0 0 .5rem;
}
.tip__body{margin:0;color:var(--steam)}

.places{
  list-style:none;padding:0;margin:0;
  display:flex;flex-wrap:wrap;gap:.5rem;
}
.places li{
  border:1px solid var(--line);
  padding:.35rem .8rem;
  font-size:.875rem;
  color:var(--steam-dim);
  border-radius:2px;
}

/* ---------------------------------------------------------- cta */
.cta{
  border-top:1px solid var(--line);
  border-bottom:1px solid var(--line);
  padding:2.5rem 0;
  margin:3rem 0;
}
.cta__title{
  font-family:var(--display);font-weight:400;
  font-size:1.75rem;margin:0 0 .75rem;
}
.cta__note{color:var(--steam-dim);font-size:.9375rem;margin:0 0 1.5rem}

.pagination{padding-top:1rem}
.pagination a{
  color:var(--steam-dim);text-decoration:none;font-size:.9375rem;
}
.pagination a:hover{color:var(--thermal)}

/* ------------------------------------------------------- footer */
.footer{
  border-top:1px solid var(--line);
  background:var(--slate);
}
.footer__inner{
  max-width:var(--wrap);margin:0 auto;
  padding:3rem 1.5rem;
}
.footer__note{
  font-family:var(--display);
  font-size:1.15rem;
  max-width:var(--read);
  margin:0 0 1.5rem;
  color:var(--steam);
}
.footer__meta{
  font-size:.8125rem;
  color:var(--steam-dim);
  margin:0;
  max-width:var(--read);
  line-height:1.7;
}
`;

/* -------------------------------------------------------------- sitemap */

function sitemap(urls) {
  const items = urls
    .map((u) => `  <url><loc>${config.domain}${u}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>`;
}

/* ------------------------------------------------------------------ run */

function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  mkdir(OUT);

  const urls = ['/'];

  write('index.html', homepage());
  write('style.css', css.trim());
  write('about/index.html', aboutPage());
  urls.push('/about/');

  for (const loc of locations) {
    write(`wales/${loc.slug}/index.html`, locationPage(loc));
    urls.push(`/wales/${loc.slug}/`);
  }

  write('sitemap.xml', sitemap(urls));
  write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${config.domain}/sitemap.xml\n`);
  write('google0b3bbcc5984512fc.html', 'google-site-verification: google0b3bbcc5984512fc.html');

  console.log(`\n  ${config.siteName} built.`);
  console.log(`  ${urls.length} pages -> ./site\n`);
  urls.forEach((u) => console.log('   ' + u));
  console.log('');

  if (!config.affiliate.useAffiliateLinks) {
    console.log('  NOTE: affiliate links are OFF. Buttons point at plain search URLs.');
    console.log('  Turn them on in data/config.json once your application is approved.\n');
  }
}

build();
