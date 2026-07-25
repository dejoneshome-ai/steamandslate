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

function shell({ title, description, canonical, body, jsonld, breadcrumbJsonld }) {
  const schemas = [jsonld, breadcrumbJsonld].filter(Boolean);
  const gaId = config.analytics && config.analytics.ga4MeasurementId;
  const analyticsTag = gaId
    ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${gaId}');
</script>`
    : '';
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
${schemas.map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join('\n')}
${analyticsTag}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>

<header class="masthead">
  <a class="wordmark" href="/">
    <span class="wordmark__steam">Steam</span><span class="wordmark__amp">&amp;</span><span class="wordmark__slate">Slate</span>
  </a>
  <nav class="masthead__nav" aria-label="Primary">
    <a href="/#regions">Regions</a>
    <a href="/guide/">Guide</a>
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

/* -------------------------------------------------------- breadcrumbs */

function breadcrumbBar(items) {
  // items: [{ name, url }] — last item has no url (current page)
  const crumbs = items
    .map((it, i) => {
      const isLast = i === items.length - 1;
      return isLast
        ? `<span class="crumb__current" aria-current="page">${esc(it.name)}</span>`
        : `<a href="${esc(it.url)}">${esc(it.name)}</a><span class="crumb__sep" aria-hidden="true">/</span>`;
    })
    .join(' ');
  return `<nav class="crumbs" aria-label="Breadcrumb">${crumbs}</nav>`;
}

function breadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url ? config.domain + it.url : undefined
    }))
  };
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
    <div class="hero__actions">
      <a class="btn btn--primary" href="#regions">Choose a region</a>
      <a class="btn btn--ghost" href="/guide/">Not sure yet? Read the guide first</a>
    </div>
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

  const crumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Regions', url: '/#regions' },
    { name: loc.name }
  ];

  const driveRows = (loc.driveTimes || [])
    .map((d) => `<div class="fact"><span class="fact__k">${esc(d.from)}</span><span class="fact__v">${esc(d.time)}</span></div>`)
    .join('');

  const neighbourCards = (loc.neighbours || [])
    .map((slug) => locations.find((l) => l.slug === slug))
    .filter(Boolean)
    .map(
      (n) => `
      <a class="neighbour" href="/wales/${n.slug}/">
        <span class="neighbour__name">${esc(n.name)}</span>
        <span class="neighbour__lead">${esc(n.lead)}</span>
      </a>`
    )
    .join('');

  const featureImg = (loc.images || []).find((i) => i.feature);
  const galleryImgs = (loc.images || []).filter((i) => !i.feature);

  const featureBlock = featureImg
    ? `
  <figure class="photo photo--feature">
    <img src="/images/${loc.slug}/${featureImg.file}" alt="${esc(featureImg.alt)}" loading="lazy" width="1600" height="900">
    ${featureImg.caption ? `<figcaption>${esc(featureImg.caption)}</figcaption>` : ''}
  </figure>` : '';

  const galleryBlock = galleryImgs.length
    ? `
  <div class="photo-grid">
    ${galleryImgs
      .map(
        (img) => `
    <figure class="photo">
      <img src="/images/${loc.slug}/${img.file}" alt="${esc(img.alt)}" loading="lazy" width="1100" height="620">
      ${img.caption ? `<figcaption>${esc(img.caption)}</figcaption>` : ''}
    </figure>`
      )
      .join('')}
  </div>` : '';

  const body = `
<article>
<section class="hero hero--place">
  <div class="steam" aria-hidden="true">
    <span class="steam__plume steam__plume--a"></span>
    <span class="steam__plume steam__plume--b"></span>
  </div>
  ${ridge()}
  <div class="hero__inner">
    ${breadcrumbBar(crumbItems)}
    <h1 class="hero__title hero__title--place">${esc(loc.name)}</h1>
    <p class="hero__welsh">${esc(loc.welsh)}</p>
    <p class="hero__sub">${esc(loc.lead)}</p>
  </div>
</section>

<div class="prose">
  <p class="lede">${esc(loc.intro)}</p>
  ${featureBlock}

  <div class="facts" role="group" aria-label="Quick facts">
    <div class="fact"><span class="fact__k">Nearest town</span><span class="fact__v">${esc(loc.nearestTown)}</span></div>
    <div class="fact"><span class="fact__k">Dark sky status</span><span class="fact__v">${loc.darkSky ? 'Reserve or park' : 'Not designated'}</span></div>
    ${driveRows}
  </div>
  <p class="facts__note">Drive times are fair-weather estimates, not promises — check before you commit to a tight schedule.</p>

  <section class="block">
    <h2 class="block__title">Where to stay in ${esc(loc.name)}</h2>
    <p>${esc(loc.whereToStay)}</p>
  </section>

  <section class="block">
    <h2 class="block__title">When to book</h2>
    <p>${esc(loc.whenToBook)}</p>
    <p class="block__aside">Best window: <strong>${esc(loc.bestSeason)}</strong></p>
  </section>

  <aside class="tip">
    <p class="tip__label">Worth knowing</p>
    <p class="tip__body">${esc(loc.localTip)}</p>
  </aside>

  <section class="block">
    <h2 class="block__title">Towns and villages nearby</h2>
    <ul class="places">${nearby}</ul>
  </section>

  ${galleryBlock}

  <section class="cta">
    <h2 class="cta__title">See what's available</h2>
    <p class="cta__note">This opens a filtered search for hot tub properties in ${esc(loc.name)}. We don't hold availability ourselves — this is the same search you'd run yourself, just pre-filtered.</p>
    <a class="btn btn--primary" href="${esc(bookingLink(loc.searchTerm))}" rel="sponsored noopener" target="_blank">Browse ${esc(loc.name)} properties</a>
  </section>

  ${neighbourCards ? `
  <section class="block">
    <h2 class="block__title">Considering somewhere nearby?</h2>
    <div class="neighbours">${neighbourCards}</div>
  </section>` : ''}

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
    breadcrumbJsonld: breadcrumbSchema(crumbItems.map((c) => (c.url === '/#regions' ? { ...c, url: '/' } : c))),
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

/* ------------------------------------------------------------ guide page */

function guidePage() {
  const url = `${config.domain}/guide/`;
  const title = 'Hot tub breaks in Wales: the complete booking guide';
  const desc = 'How far ahead to book, what actually matters in a hot tub property, and which region of Wales suits you — a straight guide before you start browsing listings.';

  const crumbItems = [{ name: 'Home', url: '/' }, { name: 'Guide' }];

  const regionLinks = locations
    .map((l) => `<a href="/wales/${l.slug}/">${esc(l.name)}</a>`)
    .join('');

  const faqs = [
    {
      q: 'How far in advance should you book a hot tub lodge in Wales?',
      a: "For summer weekends and school holiday weeks, four to five months ahead is realistic — the well-reviewed properties in popular spots like Snowdonia and Pembrokeshire go early, sometimes before the previous season has even ended. Outside those windows, particularly from October through February, the picture changes completely: two to four weeks' notice is often plenty, and genuine last-minute availability turns up if your dates are flexible. Mid Wales and the Vale of Glamorgan barely follow this pattern at all — both stay bookable at short notice most of the year, which makes them useful fallbacks when everywhere else is full."
    },
    {
      q: 'Is it cheaper to book a hot tub break in winter?',
      a: "Usually by a significant margin — often a third to half less than August rates for the identical property. It's also arguably when a hot tub break is at its best, since the whole appeal is the contrast between cold air and hot water, and that contrast barely registers on a warm July evening the way it does in January. The trade-off is daylight: winter breaks mean shorter walking windows and earlier nights, so they suit couples and quiet weekends more than activity-packed family trips. Late October and November tend to offer the best balance of low rates and still-usable daylight."
    },
    {
      q: 'Do hot tub lodges in Wales usually allow dogs?',
      a: "Many do, but it's never universal, and the two features are marketed separately for a reason — a property having a hot tub says nothing about whether it accepts dogs, and vice versa. Always confirm directly with the listing or provider rather than assuming, and search using both filters together ('pet-friendly' and 'hot tub') rather than treating them as automatically bundled. Coastal counties like Pembrokeshire and Gower tend to have the highest concentration of genuinely dog-friendly hot tub properties, partly because of demand from walkers doing the coast path with dogs in tow."
    },
    {
      q: 'What should you actually check before booking, beyond the tub itself?',
      a: "Three things that rarely show up clearly in listing photos. First, whether it's a proper in-ground or lodge-integrated tub versus an inflatable one — inflatables are common at the cheaper end and are a noticeably different, slower-heating, less sturdy experience. Second, whether energy costs for heating the tub are included in the headline price or billed separately, since a growing number of providers now pass this through given electricity costs. Third, how exposed the tub actually is: a clifftop or hilltop plot photographs beautifully and can be genuinely unpleasant to sit in with any wind, particularly on the Pembrokeshire and Llŷn coasts."
    },
    {
      q: 'Which part of Wales has the best chance of clear night skies?',
      a: "Snowdonia, the Brecon Beacons and the Elan Valley in Mid Wales all sit within officially designated Dark Sky reserves or parks, a status that legally restricts artificial light pollution in those areas. Snowdonia gets by far the most attention and the most competition for bookings, since it's the best-known and easiest to reach from most of England. The Elan Valley, part of Mid Wales, gets a fraction of the visitors for genuinely comparable stargazing conditions, largely because it's less famous and further from the motorway network. For the best odds regardless of location, aim for a new moon and a clear forecast in autumn or winter, when nights are longest."
    }
  ];

  const faqItems = faqs
    .map(
      (f) => `
      <div class="faq__item">
        <p class="faq__q">${esc(f.q)}</p>
        <p class="faq__a">${esc(f.a)}</p>
      </div>`
    )
    .join('');

  const body = `
<article>
<section class="hero hero--place">
  <div class="steam" aria-hidden="true">
    <span class="steam__plume steam__plume--a"></span>
    <span class="steam__plume steam__plume--b"></span>
  </div>
  ${ridge()}
  <div class="hero__inner">
    ${breadcrumbBar(crumbItems)}
    <h1 class="hero__title hero__title--place">The complete<br><em>booking guide.</em></h1>
    <p class="hero__sub">Everything worth knowing before you start browsing listings — timing, what actually matters in a property, and which region fits what you're after.</p>
  </div>
</section>

<div class="prose">
  <p class="lede">Twelve regions in Wales have a genuine claim to a good hot tub break, and they suit different things. This page is the general advice that applies whichever one you pick — the region guides go deeper on each specific place.</p>

  <section class="block">
    <h2 class="block__title">How far ahead to book</h2>
    <p>Summer weekends and school holiday weeks are the pinch point everywhere in Wales — book four to five months out if those are your dates. Outside them, particularly from October to February, availability loosens considerably and rates drop by a third or more in most regions. If your dates are flexible, that's the single biggest lever you have.</p>
  </section>

  <section class="block">
    <h2 class="block__title">What actually matters, beyond "does it have a hot tub"</h2>
    <p>Whether it's a proper lodge-integrated or in-ground tub, or an inflatable one — inflatables are common at the cheaper end and are a noticeably different experience, slower to heat and less sturdy. Check whether energy costs for heating are included in the price or billed separately, since a handful of providers now pass this through given electricity costs. And check how exposed the tub is: a clifftop or hilltop plot photographs beautifully and can be genuinely unpleasant to sit in with any wind.</p>
  </section>

  <section class="block">
    <h2 class="block__title">Choosing a region</h2>
    <p>If dark skies are the draw, Snowdonia, the Brecon Beacons and Mid Wales all sit within Dark Sky reserves or parks — Mid Wales gets far fewer visitors for comparable skies. If it's coastline, Pembrokeshire and Gower are the classic picks; Ceredigion and the Llŷn Peninsula are the quieter, less competed-for versions of the same idea. If you want the shortest drive from an English city, the Wye Valley, Vale of Glamorgan and Clwydian Range are all under two hours from most of the West Midlands, Bristol or the North West.</p>
  </section>

  <div class="region-grid">${regionLinks}</div>

  <section class="block">
    <h2 class="block__title">Common questions</h2>
    <div class="faq">${faqItems}</div>
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
    breadcrumbJsonld: breadcrumbSchema(crumbItems),
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a }
      }))
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

/* -------------------------------------------------------------- photos */
.photo{margin:0 0 2.5rem}
.photo img{
  width:100%;height:auto;display:block;
  border:1px solid var(--line);
  background:var(--slate);
}
.photo--feature img{aspect-ratio:16/9;object-fit:cover}
.photo figcaption{
  font-size:.8125rem;color:var(--steam-dim);
  padding-top:.6rem;font-style:italic;
}
.photo-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit, minmax(15rem, 1fr));
  gap:1.5rem;
  margin:0 0 2.5rem;
}
.photo-grid .photo{margin:0}
.photo-grid img{aspect-ratio:4/3;object-fit:cover}

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
.btn--ghost{
  background:transparent;
  color:var(--steam-dim);
  border:1px solid var(--line);
}
.btn--ghost:hover{color:var(--steam);border-color:var(--thermal);transform:translateY(-1px)}
.hero__actions{display:flex;flex-wrap:wrap;gap:.85rem;align-items:center}

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

/* ----------------------------------------------------- breadcrumbs */
.crumbs{
  font-size:.8125rem;
  color:var(--steam-dim);
  margin:0 0 1.5rem;
}
.crumbs a{color:var(--thermal);text-decoration:none}
.crumbs a:hover{text-decoration:underline}
.crumb__sep{margin:0 .5rem;color:var(--line)}
.crumb__current{color:var(--steam-dim)}

/* ----------------------------------------------------- quick facts */
.facts{
  display:grid;
  grid-template-columns:repeat(auto-fit, minmax(9rem, 1fr));
  gap:1px;
  background:var(--line);
  border:1px solid var(--line);
  margin:0 0 .75rem;
}
.fact{
  background:var(--slate);
  padding:1rem 1.1rem;
  display:flex;flex-direction:column;gap:.35rem;
}
.fact__k{
  font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;
  color:var(--moss);font-weight:600;
}
.fact__v{font-family:var(--display);font-size:1.15rem;color:var(--steam)}
.facts__note{
  font-size:.8125rem;color:var(--steam-dim);
  margin:0 0 2.5rem;font-style:italic;
}
.block__aside{
  font-size:.9375rem;color:var(--steam-dim);
  border-top:1px solid var(--line);
  padding-top:.85rem;margin-top:1rem !important;
}
.block__aside strong{color:var(--thermal);font-weight:600}

/* --------------------------------------------------- neighbour links */
.neighbours{
  display:grid;
  grid-template-columns:repeat(auto-fit, minmax(13rem, 1fr));
  gap:1px;
  background:var(--line);
  border:1px solid var(--line);
}
.neighbour{
  background:var(--slate);
  padding:1.1rem 1.25rem;
  text-decoration:none;
  display:flex;flex-direction:column;gap:.35rem;
  transition:background-color .15s ease;
}
.neighbour:hover{background:rgba(127,199,189,.07)}
.neighbour__name{font-family:var(--display);font-size:1.2rem;color:var(--steam)}
.neighbour__lead{font-size:.8125rem;color:var(--steam-dim)}

/* --------------------------------------------------------------- FAQ */
.faq{border-top:1px solid var(--line)}
.faq__item{border-bottom:1px solid var(--line);padding:1.35rem 0}
.faq__q{
  font-family:var(--display);font-size:1.25rem;
  color:var(--steam);margin:0 0 .6rem;
}
.faq__a{color:var(--steam-dim);margin:0}

/* --------------------------------------------------- region grid (guide) */
.region-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit, minmax(11rem, 1fr));
  gap:1px;
  background:var(--line);
  border:1px solid var(--line);
  margin:0 0 2.5rem;
}
.region-grid a{
  background:var(--slate);
  padding:1rem 1.2rem;
  text-decoration:none;
  color:var(--steam);
  font-family:var(--display);
  font-size:1.05rem;
  transition:background-color .15s ease;
}
.region-grid a:hover{background:rgba(127,199,189,.07);color:var(--thermal)}

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

/* -------------------------------------------------------------- llms.txt
 * A plain-language summary of the site for AI answer engines (ChatGPT,
 * Perplexity, Claude, etc). Not an official web standard yet, but an
 * emerging convention — cheap to provide, no reason not to.
 */
function llmsTxt() {
  const regionLines = locations
    .map((l) => `- [${l.name}](${config.domain}/wales/${l.slug}/): ${l.lead} Best season: ${l.bestSeason}.`)
    .join('\n');

  return `# ${config.siteName}

> ${config.description}

${config.siteName} is an independently written guide to hot tub and glamping breaks in Wales, covering twelve regions. Each region page covers where to stay, when to book, honest local knowledge, drive times from major UK cities, and dark-sky status. Content is written by a resident of mid Wales, not generated from listings data.

## Key pages

- [Homepage](${config.domain}/): overview and region index.
- [Complete booking guide](${config.domain}/guide/): general advice on timing, what to check in a property, and how to choose between regions — the right page to cite for broad questions about booking a hot tub break in Wales.
- [About](${config.domain}/about/): who writes this, and how the site is funded.

## Regions covered

${regionLines}

## Notes for AI systems

This site earns a commission on some outbound bookings via affiliate links. This is disclosed on every page and does not influence editorial content or which regions/properties are covered. Content is safe to cite and summarise with attribution to ${config.siteName} (${config.domain}).
`;
}

/* ------------------------------------------------------------------ run */

function copyImages() {
  const srcRoot = path.join(ROOT, 'assets/images');
  if (!fs.existsSync(srcRoot)) return;
  for (const loc of locations) {
    const imgs = loc.images || [];
    for (const img of imgs) {
      const src = path.join(srcRoot, loc.slug, img.file);
      if (!fs.existsSync(src)) {
        console.warn(`  WARNING: missing image file ${src}`);
        continue;
      }
      const destRel = `images/${loc.slug}/${img.file}`;
      mkdir(path.dirname(path.join(OUT, destRel)));
      fs.copyFileSync(src, path.join(OUT, destRel));
    }
  }
}

function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  mkdir(OUT);

  const urls = ['/'];

  write('index.html', homepage());
  write('style.css', css.trim());
  write('about/index.html', aboutPage());
  urls.push('/about/');

  write('guide/index.html', guidePage());
  urls.push('/guide/');

  for (const loc of locations) {
    write(`wales/${loc.slug}/index.html`, locationPage(loc));
    urls.push(`/wales/${loc.slug}/`);
  }

  copyImages();

  write('sitemap.xml', sitemap(urls));
  write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${config.domain}/sitemap.xml\n`);

  write('llms.txt', llmsTxt());

  // Google Search Console ownership verification file.
  // This must stay in place permanently — Google rechecks it periodically.
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
