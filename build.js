#!/usr/bin/env node
/*
 * Steam & Slate — static site generator
 * No dependencies. Run with:  node build.js
 * Output goes into ./site  — that's the folder you deploy to Netlify.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'site');

// Stylesheet URL, replaced at build time with a content-hashed filename
// (e.g. /style.a1b2c3d4.css) so browsers always fetch the current CSS
// instead of a stale cached copy after a deploy.
let cssHref = '/style.css';

const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/config.json'), 'utf8'));
const locations = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/locations.json'), 'utf8'));

// Town-level pages: one per notable town, each canonically under a single
// region at /wales/<region>/<town>/. Lookups keep region <-> town linking simple.
const townsFile = path.join(ROOT, 'data/towns.json');
const towns = fs.existsSync(townsFile) ? JSON.parse(fs.readFileSync(townsFile, 'utf8')) : [];
const regionBySlug = {};
for (const l of locations) regionBySlug[l.slug] = l;
const townsByRegion = {};
const townByName = {};
for (const t of towns) {
  (townsByRegion[t.region] = townsByRegion[t.region] || []).push(t);
  townByName[t.name] = t;
}
const townUrl = (t) => `/wales/${t.region}/${t.slug}/`;

// Themed "collections" pages (dark skies, dog-friendly, couples, families,
// best value) at /collections/<slug>/. Each curates the regions best suited to
// it, cross-linked both ways with the region pages.
const themesFile = path.join(ROOT, 'data/themes.json');
const themes = fs.existsSync(themesFile) ? JSON.parse(fs.readFileSync(themesFile, 'utf8')) : [];
const themeUrl = (t) => `/collections/${t.slug}/`;
// reverse map: region slug -> [themes featuring it]
const themesByRegion = {};
for (const th of themes) {
  for (const r of th.regions || []) {
    (themesByRegion[r.slug] = themesByRegion[r.slug] || []).push(th);
  }
}

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

/*
 * Photo attribution. Some region photos come from Wikimedia Commons under
 * Creative Commons licences, which require a visible credit (author + licence).
 * The author's own photos (e.g. mid Wales) carry no `credit` block, so nothing
 * is shown for them.
 */
function imageCredit(credit) {
  if (!credit || !credit.author) return '';
  const lic = credit.licenseUrl
    ? `<a href="${esc(credit.licenseUrl)}" rel="nofollow noopener" target="_blank">${esc(credit.license)}</a>`
    : esc(credit.license || '');
  const via = credit.sourceUrl
    ? `<a href="${esc(credit.sourceUrl)}" rel="nofollow noopener" target="_blank">Wikimedia Commons</a>`
    : 'Wikimedia Commons';
  return `<span class="photo__credit">Photo: ${esc(credit.author)}${lic ? ` / ${lic}` : ''}, via ${via}</span>`;
}

function figcaption(img) {
  const cap = img.caption ? `<span class="photo__cap">${esc(img.caption)}</span>` : '';
  const cr = imageCredit(img.credit);
  if (!cap && !cr) return '';
  return `<figcaption>${cap}${cr}</figcaption>`;
}

/* ------------------------------------------------------------------- html */

function shell({ title, description, canonical, body, jsonld, breadcrumbJsonld, ogImage }) {
  // jsonld may be a single object or an array of schema objects.
  const schemas = [].concat(jsonld || [], breadcrumbJsonld || []).filter(Boolean);
  const ogImageTag = ogImage
    ? `<meta property="og:image" content="${esc(ogImage.startsWith('http') ? ogImage : config.domain + ogImage)}">
<meta name="twitter:card" content="summary_large_image">`
    : '';
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
<meta name="theme-color" content="#0D171C">
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:site_name" content="${esc(config.siteName)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:locale" content="en_GB">
${ogImageTag}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=Source+Sans+3:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${cssHref}">
${schemas.map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join('\n')}
${analyticsTag}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>

<header class="masthead" id="top">
  <a class="wordmark" href="/">
    <span class="wordmark__steam">Steam</span><span class="wordmark__amp">&amp;</span><span class="wordmark__slate">Slate</span>
  </a>
  <button class="nav-toggle" type="button" aria-label="Menu" aria-controls="nav" aria-expanded="false">
    <span class="nav-toggle__bar"></span><span class="nav-toggle__bar"></span><span class="nav-toggle__bar"></span>
  </button>
  <nav class="masthead__nav" id="nav" aria-label="Primary">
    <div class="navitem navitem--drop">
      <a class="navitem__top" href="/#regions">Regions</a>
      <div class="navpanel">
        <div class="navpanel__grid">${locations.map((l) => `<a href="/wales/${l.slug}/">${esc(l.name)}</a>`).join('')}</div>
      </div>
    </div>
    <div class="navitem navitem--drop">
      <a class="navitem__top" href="/collections/">Collections</a>
      <div class="navpanel">
        <div class="navpanel__grid navpanel__grid--two">${themes.map((t) => `<a href="/collections/${t.slug}/">${esc(t.name)}</a>`).join('')}</div>
      </div>
    </div>
    <a class="navitem__top" href="/guide/">Guide</a>
    <a class="navitem__top" href="/about/">About</a>
  </nav>
</header>

<main id="main">
${body}
</main>

<footer class="footer">
  <div class="footer__inner">
    <div class="footer__cols">
      <div class="footer__brand">
        <a class="wordmark" href="/"><span class="wordmark__steam">Steam</span><span class="wordmark__amp">&amp;</span><span class="wordmark__slate">Slate</span></a>
        <p class="footer__note">${esc(config.author.bio)}</p>
      </div>
      <nav class="footer__col" aria-label="Regions">
        <h2 class="footer__h">Regions</h2>
        <ul>${locations.map((l) => `<li><a href="/wales/${l.slug}/">${esc(l.name)}</a></li>`).join('')}</ul>
      </nav>
      <nav class="footer__col" aria-label="Browse by theme">
        <h2 class="footer__h">Browse by</h2>
        <ul>${themes.map((t) => `<li><a href="/collections/${t.slug}/">${esc(t.name)}</a></li>`).join('')}<li><a href="/collections/">All collections</a></li></ul>
      </nav>
      <nav class="footer__col" aria-label="More">
        <h2 class="footer__h">More</h2>
        <ul>
          <li><a href="/guide/">The booking guide</a></li>
          <li><a href="/about/">About this site</a></li>
          <li><a href="/credits/">Image credits</a></li>
        </ul>
      </nav>
    </div>
    <p class="footer__meta">
      ${esc(config.siteName)} &middot; Written in ${esc(config.author.location)}<br>
      Some links to accommodation providers earn us a commission. It never changes what you pay, and it never decides what goes on the site.
    </p>
  </div>
</footer>
<script>
(function(){
  var t=document.querySelector('.nav-toggle');if(!t)return;
  var b=document.body;
  t.addEventListener('click',function(){
    var open=b.classList.toggle('nav-open');
    t.setAttribute('aria-expanded',open?'true':'false');
  });
  document.querySelectorAll('#nav a').forEach(function(a){
    a.addEventListener('click',function(){b.classList.remove('nav-open');t.setAttribute('aria-expanded','false');});
  });
})();
</script>
${gaId ? `<script>
document.addEventListener('click',function(e){
  var a=e.target.closest&&e.target.closest('.booking-cta');
  if(!a||typeof gtag!=='function')return;
  gtag('event','booking_click',{place:a.getAttribute('data-place')||'',scope:a.getAttribute('data-scope')||''});
});
</script>` : ''}
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
  const regionCards = locations
    .map((loc, i) => {
      const cover = (loc.images || []).find((im) => im.feature);
      const media = cover
        ? `<img src="/images/${loc.slug}/${cover.file}" alt="${esc(cover.alt)}" loading="lazy" width="800" height="534">`
        : '';
      return `
      <a class="rcard" href="/wales/${loc.slug}/">
        <span class="rcard__media">${media}<span class="rcard__index">${String(i + 1).padStart(2, '0')}</span></span>
        <span class="rcard__body">
          <span class="rcard__name">${esc(loc.name)}</span>
          <span class="rcard__welsh">${esc(loc.welsh)}</span>
          <span class="rcard__lead">${esc(loc.lead)}</span>
          <span class="rcard__go">Explore ${esc(loc.name)} <span aria-hidden="true">&rarr;</span></span>
        </span>
      </a>`;
    })
    .join('');

  const collectionCards = themes
    .map((t) => `
      <a class="ccard" href="${themeUrl(t)}">
        <span class="ccard__go" aria-hidden="true">&rarr;</span>
        <span class="ccard__name">${esc(t.name)}</span>
        <span class="ccard__lead">${esc(t.lead)}</span>
      </a>`)
    .join('');

  const body = `
<section class="hero hero--home">
  <img class="hero__img" src="/images/mid-wales/mid-wales-valley-mist.jpg" alt="Dawn mist filling a Welsh valley, with hills rising above it into clear sky" width="1600" height="900" fetchpriority="high">
  <div class="steam" aria-hidden="true">
    <span class="steam__plume steam__plume--a"></span>
    <span class="steam__plume steam__plume--b"></span>
    <span class="steam__plume steam__plume--c"></span>
  </div>
  <div class="hero__scrim" aria-hidden="true"></div>
  <div class="hero__inner">
    <p class="eyebrow">An independent guide &middot; ${locations.length} regions of Wales</p>
    <h1 class="hero__title">Hot water,<br><em>cold Welsh air.</em></h1>
    <p class="hero__sub">The hand-written guide to hot tub lodges, cabins and glamping in Wales &mdash; which region actually suits you, where the good ones hide, and when the prices drop.</p>
    <div class="hero__actions">
      <a class="btn btn--primary" href="#regions">Choose a region</a>
      <a class="btn btn--ghost" href="/guide/">Read the guide first</a>
    </div>
  </div>
</section>

<section class="regions regions--top" id="regions">
  <div class="section__head">
    <h2 class="section__title">Every region in Wales</h2>
    <p class="section__note">Self-catering lodges, log cabins, cottages and glamping with hot tubs, across every corner of the country. Pick where you want to be.</p>
  </div>
  <div class="region-cards">${regionCards}</div>
  <p class="cards-note">Region cover photography is Creative Commons licensed &mdash; <a href="/credits/">full image credits</a>.</p>
</section>

<section class="collections-home" id="collections">
  <div class="section__head">
    <h2 class="section__title">Or start from what you're after</h2>
    <p class="section__note">Not sure which region? Browse by the thing that matters most &mdash; each one pulls together the areas that do it best.</p>
  </div>
  <div class="collection-cards">${collectionCards}</div>
</section>

<section class="closing">
  <div class="closing__inner">
    <figure class="closing__figure">
      <img src="/images/mid-wales/mid-wales-village-aerial.jpg" alt="Aerial view of Montgomery, the mid Wales market town this guide is written from" loading="lazy" width="1200" height="800">
    </figure>
    <div class="closing__body">
      <p class="eyebrow">Written in Montgomery, Powys</p>
      <h2 class="closing__title">Real places, real photographs, real opinions.</h2>
      <p class="closing__text">No provider has paid to appear here, and no region has been included or left out for commercial reasons. Some links earn a small commission if you book &mdash; it never changes what you pay, and it never decides what goes on the site.</p>
      <div class="hero__actions">
        <a class="btn btn--primary" href="/guide/">Read the booking guide</a>
        <a class="btn btn--ghost" href="/about/">About this site</a>
      </div>
    </div>
  </div>
</section>`;

  return shell({
    title: `${config.siteName} — ${config.tagline}`,
    description: config.description,
    canonical: config.domain + '/',
    body,
    ogImage: '/images/mid-wales/mid-wales-valley-mist.jpg',
    jsonld: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: config.siteName,
        url: config.domain,
        description: config.description,
        publisher: { '@id': config.domain + '/#organization' }
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        '@id': config.domain + '/#organization',
        name: config.siteName,
        url: config.domain,
        logo: config.domain + '/apple-touch-icon.png',
        description: config.description,
        founder: { '@type': 'Person', name: config.author.name },
        knowsAbout: ['hot tub breaks in Wales', 'glamping in Wales', 'self-catering lodges', 'dark sky stargazing']
      }
    ]
  });
}

/* --------------------------------------------------------- location pages */

function locationPage(loc) {
  const url = `${config.domain}/wales/${loc.slug}/`;
  const title = `Hot tub lodges in ${loc.name}, Wales — where to stay and when to book`;
  const desc = `${loc.lead} An honest guide to hot tub and glamping breaks in ${loc.name}: the best areas, booking timings and local knowledge.`;

  const nearby = loc.nearby
    .map((n) => {
      const t = townByName[n];
      return t
        ? `<li><a href="${townUrl(t)}">${esc(n)}</a></li>`
        : `<li>${esc(n)}</li>`;
    })
    .join('');

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
  const heroCredit = featureImg ? imageCredit(featureImg.credit) : '';

  // The place hero leads with the region's own photograph when there is one,
  // full-bleed behind a legibility scrim. Pages without a photo fall back to
  // the illustrated ridge-and-steam hero.
  const placeHero = featureImg
    ? `
<section class="hero hero--place hero--photo">
  <img class="hero__img" src="/images/${loc.slug}/${featureImg.file}" alt="${esc(featureImg.alt)}" width="1600" height="900" fetchpriority="high">
  <div class="hero__scrim" aria-hidden="true"></div>
  <div class="hero__inner">
    ${breadcrumbBar(crumbItems)}
    <h1 class="hero__title hero__title--place">${esc(loc.name)}</h1>
    <p class="hero__welsh">${esc(loc.welsh)}</p>
    <p class="hero__sub">${esc(loc.lead)}</p>
    ${heroCredit ? `<p class="hero__credit">${heroCredit}</p>` : ''}
  </div>
</section>`
    : `
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
</section>`;

  const galleryBlock = galleryImgs.length
    ? `
  <div class="photo-grid">
    ${galleryImgs
      .map(
        (img) => `
    <figure class="photo">
      <img src="/images/${loc.slug}/${img.file}" alt="${esc(img.alt)}" loading="lazy" width="1100" height="620">
      ${figcaption(img)}
    </figure>`
      )
      .join('')}
  </div>` : '';

  const body = `
<article>
${placeHero}

<div class="prose">
  <p class="lede">${esc(loc.intro)}</p>

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
    <h2 class="block__title">Towns and villages in ${esc(loc.name)}</h2>
    <p>Each of these has its own guide — where to stay, what's there, and when to visit.</p>
    <ul class="places places--links">${nearby}</ul>
  </section>

  ${(themesByRegion[loc.slug] && themesByRegion[loc.slug].length) ? `
  <section class="block">
    <h2 class="block__title">${esc(loc.name)} is a good pick for</h2>
    <ul class="places places--links">${themesByRegion[loc.slug].map((th) => `<li><a href="${themeUrl(th)}">${esc(th.name)}</a></li>`).join('')}</ul>
  </section>` : ''}

  ${galleryBlock}

  <section class="cta">
    <h2 class="cta__title">See what's available</h2>
    <p class="cta__note">This opens a filtered search for hot tub properties in ${esc(loc.name)}. We don't hold availability ourselves — this is the same search you'd run yourself, just pre-filtered.</p>
    <a class="btn btn--primary booking-cta" data-place="${esc(loc.name)}" data-scope="region" href="${esc(bookingLink(loc.searchTerm))}" rel="sponsored noopener" target="_blank">Browse ${esc(loc.name)} properties</a>
    <p class="cta__disclosure">If you book through this link we may earn a small commission, at no extra cost to you.</p>
  </section>

  ${(loc.faqs && loc.faqs.length) ? `
  <section class="block">
    <h2 class="block__title">Common questions about ${esc(loc.name)}</h2>
    <div class="faq">${loc.faqs.map((f) => `
      <div class="faq__item">
        <p class="faq__q">${esc(f.q)}</p>
        <p class="faq__a">${esc(f.a)}</p>
      </div>`).join('')}</div>
  </section>` : ''}

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
    ogImage: featureImg ? `/images/${loc.slug}/${featureImg.file}` : undefined,
    breadcrumbJsonld: breadcrumbSchema(crumbItems.map((c) => (c.url === '/#regions' ? { ...c, url: '/' } : c))),
    jsonld: [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: title,
        description: desc,
        about: { '@type': 'Place', name: `${loc.name}, Wales` },
        author: { '@type': 'Person', name: config.author.name },
        publisher: { '@type': 'Organization', name: config.siteName }
      },
      ...(loc.faqs && loc.faqs.length ? [{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: loc.faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a }
        }))
      }] : [])
    ]
  });
}

/* ------------------------------------------------------------- town pages */

function townPage(town) {
  const region = regionBySlug[town.region];
  const url = `${config.domain}/wales/${town.region}/${town.slug}/`;
  const title = `Hot tub & glamping breaks in ${town.name}, Wales`;
  const desc = `${town.lead} A local guide to hot tub and glamping stays in ${town.name}, ${region.name}: where to stay, what's there and when to visit.`;

  const crumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Regions', url: '/#regions' },
    { name: region.name, url: `/wales/${region.slug}/` },
    { name: town.name }
  ];

  const featureImg = (town.images || []).find((i) => i.feature);
  const heroCredit = featureImg ? imageCredit(featureImg.credit) : '';
  const ogImage = featureImg ? `/images/towns/${featureImg.file}` : (region.images || []).find((i) => i.feature) ? `/images/${region.slug}/${region.images.find((i) => i.feature).file}` : undefined;

  const hero = featureImg
    ? `
<section class="hero hero--place hero--photo">
  <img class="hero__img" src="/images/towns/${featureImg.file}" alt="${esc(featureImg.alt)}" width="1600" height="900" fetchpriority="high">
  <div class="hero__scrim" aria-hidden="true"></div>
  <div class="hero__inner">
    ${breadcrumbBar(crumbItems)}
    <h1 class="hero__title hero__title--place">${esc(town.name)}</h1>
    ${town.welsh ? `<p class="hero__welsh">${esc(town.welsh)}</p>` : ''}
    <p class="hero__sub">${esc(town.lead)}</p>
    ${heroCredit ? `<p class="hero__credit">${heroCredit}</p>` : ''}
  </div>
</section>`
    : `
<section class="hero hero--place">
  <div class="steam" aria-hidden="true">
    <span class="steam__plume steam__plume--a"></span>
    <span class="steam__plume steam__plume--b"></span>
  </div>
  ${ridge()}
  <div class="hero__inner">
    ${breadcrumbBar(crumbItems)}
    <h1 class="hero__title hero__title--place">${esc(town.name)}</h1>
    ${town.welsh ? `<p class="hero__welsh">${esc(town.welsh)}</p>` : ''}
    <p class="hero__sub">${esc(town.lead)}</p>
  </div>
</section>`;

  const siblings = (townsByRegion[town.region] || []).filter((t) => t.slug !== town.slug);
  const siblingBlock = siblings.length
    ? `
  <section class="block">
    <h2 class="block__title">More in ${esc(region.name)}</h2>
    <div class="neighbours">${siblings
      .map(
        (s) => `
      <a class="neighbour" href="${townUrl(s)}">
        <span class="neighbour__name">${esc(s.name)}</span>
        <span class="neighbour__lead">${esc(s.lead)}</span>
      </a>`
      )
      .join('')}</div>
  </section>`
    : '';

  const faqItems = (town.faqs || [])
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
${hero}

<div class="prose">
  <p class="lede">${esc(town.intro)}</p>

  <div class="facts" role="group" aria-label="Quick facts">
    <div class="fact"><span class="fact__k">Region</span><span class="fact__v"><a href="/wales/${region.slug}/">${esc(region.name)}</a></span></div>
    <div class="fact"><span class="fact__k">County</span><span class="fact__v">${esc(town.county || region.county)}</span></div>
    <div class="fact"><span class="fact__k">Best season</span><span class="fact__v">${esc((region.bestSeason || '').split('—')[0].split(',')[0].trim() || 'Year-round')}</span></div>
  </div>

  <section class="block">
    <h2 class="block__title">Staying near ${esc(town.name)}</h2>
    <p>${esc(town.staying)}</p>
  </section>

  <section class="block">
    <h2 class="block__title">What's here</h2>
    <p>${esc(town.thingsToDo)}</p>
  </section>

  <section class="block">
    <h2 class="block__title">When to visit</h2>
    <p>${esc(town.whenToVisit)}</p>
  </section>

  <aside class="tip">
    <p class="tip__label">Worth knowing</p>
    <p class="tip__body">${esc(town.localTip)}</p>
  </aside>

  <section class="cta">
    <h2 class="cta__title">See what's available in ${esc(town.name)}</h2>
    <p class="cta__note">This opens a filtered search for hot tub properties around ${esc(town.name)}. We don't hold availability ourselves — it's the same search you'd run, just pre-filtered.</p>
    <a class="btn btn--primary booking-cta" data-place="${esc(town.name)}" data-scope="town" href="${esc(bookingLink(town.searchTerm))}" rel="sponsored noopener" target="_blank">Browse ${esc(town.name)} properties</a>
    <p class="cta__disclosure">If you book through this link we may earn a small commission, at no extra cost to you.</p>
  </section>

  ${faqItems ? `
  <section class="block">
    <h2 class="block__title">Common questions</h2>
    <div class="faq">${faqItems}</div>
  </section>` : ''}

  ${siblingBlock}

  <nav class="pagination" aria-label="Back to region">
    <a href="/wales/${region.slug}/">&larr; Back to ${esc(region.name)}</a>
  </nav>
</div>
</article>`;

  const jsonld = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description: desc,
      about: { '@type': 'Place', name: `${town.name}, ${region.name}, Wales` },
      author: { '@type': 'Person', name: config.author.name },
      publisher: { '@type': 'Organization', name: config.siteName }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'TouristDestination',
      name: `${town.name}, Wales`,
      description: town.lead,
      containedInPlace: { '@type': 'AdministrativeArea', name: `${region.name}, Wales` }
    }
  ];
  if (town.faqs && town.faqs.length) {
    jsonld.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: town.faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a }
      }))
    });
  }

  return shell({
    title,
    description: desc,
    canonical: url,
    body,
    ogImage,
    breadcrumbJsonld: breadcrumbSchema(crumbItems.map((c) => (c.url === '/#regions' ? { ...c, url: '/' } : c))),
    jsonld
  });
}

/* -------------------------------------------------------- theme pages */

function themePage(theme) {
  const url = `${config.domain}/collections/${theme.slug}/`;
  const title = `${theme.title} — ${config.siteName}`;
  const desc = theme.lead;
  const crumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Guide', url: '/guide/' },
    { name: theme.name }
  ];

  const regionCards = (theme.regions || [])
    .map((r) => regionBySlug[r.slug] ? `
      <a class="neighbour" href="/wales/${r.slug}/">
        <span class="neighbour__name">${esc(regionBySlug[r.slug].name)}</span>
        <span class="neighbour__lead">${esc(r.why)}</span>
      </a>` : '')
    .join('');

  const faqItems = (theme.faqs || [])
    .map((f) => `
      <div class="faq__item">
        <p class="faq__q">${esc(f.q)}</p>
        <p class="faq__a">${esc(f.a)}</p>
      </div>`)
    .join('');

  const otherThemes = themes
    .filter((t) => t.slug !== theme.slug)
    .map((t) => `<li><a href="${themeUrl(t)}">${esc(t.name)}</a></li>`)
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
    <h1 class="hero__title hero__title--place">${esc(theme.title)}</h1>
    <p class="hero__sub">${esc(theme.lead)}</p>
  </div>
</section>

<div class="prose">
  <p class="lede">${esc(theme.intro)}</p>

  ${(theme.body || []).map((p) => `<p>${esc(p)}</p>`).join('\n  ')}

  <section class="block">
    <h2 class="block__title">Where to go</h2>
    <div class="neighbours">${regionCards}</div>
  </section>

  <section class="cta">
    <h2 class="cta__title">Start your search</h2>
    <p class="cta__note">This opens a search for hot tub properties in Wales. We don't hold availability ourselves — it's the same search you'd run, just a starting point.</p>
    <a class="btn btn--primary booking-cta" data-place="${esc(theme.slug)}" data-scope="collection" href="${esc(bookingLink(theme.searchTerm))}" rel="sponsored noopener" target="_blank">Browse hot tub properties in Wales</a>
    <p class="cta__disclosure">If you book through this link we may earn a small commission, at no extra cost to you.</p>
  </section>

  ${faqItems ? `
  <section class="block">
    <h2 class="block__title">Common questions</h2>
    <div class="faq">${faqItems}</div>
  </section>` : ''}

  <section class="block">
    <h2 class="block__title">More ways to choose</h2>
    <ul class="places places--links">${otherThemes}</ul>
  </section>

  <nav class="pagination" aria-label="Guide"><a href="/guide/">&larr; Back to the guide</a></nav>
</div>
</article>`;

  const jsonld = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: theme.title,
      description: desc,
      author: { '@type': 'Person', name: config.author.name },
      publisher: { '@type': 'Organization', name: config.siteName }
    }
  ];
  if (theme.faqs && theme.faqs.length) {
    jsonld.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: theme.faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a }
      }))
    });
  }

  return shell({
    title,
    description: desc,
    canonical: url,
    body,
    breadcrumbJsonld: breadcrumbSchema(crumbItems.map((c) => (c.url === '/#regions' ? { ...c, url: '/' } : c))),
    jsonld
  });
}

/* ------------------------------------------------ collections index */

function collectionsIndexPage() {
  const url = `${config.domain}/collections/`;
  const title = 'Hot tub breaks in Wales by theme — dark skies, dog-friendly, couples & more';
  const desc = "Browse hot tub and glamping breaks in Wales by what matters most: dark skies, dog-friendly, couples, families and best value.";
  const crumbItems = [{ name: 'Home', url: '/' }, { name: 'Collections' }];

  const cards = themes
    .map((t) => `
      <a class="ccard" href="${themeUrl(t)}">
        <span class="ccard__go" aria-hidden="true">&rarr;</span>
        <span class="ccard__name">${esc(t.name)}</span>
        <span class="ccard__lead">${esc(t.lead)}</span>
      </a>`)
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
    <h1 class="hero__title hero__title--place">Browse by what<br><em>you're after.</em></h1>
    <p class="hero__sub">Not sure which region? Start from the thing that matters most — each collection pulls together the regions that do it best.</p>
  </div>
</section>

<section class="collections-home">
  <div class="collection-cards">${cards}</div>
  <nav class="pagination" aria-label="Regions"><a href="/#regions">&larr; Or browse every region</a></nav>
</section>
</article>`;

  return shell({
    title,
    description: desc,
    canonical: url,
    body,
    breadcrumbJsonld: breadcrumbSchema(crumbItems),
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description: desc,
      url,
      isPartOf: { '@id': config.domain + '/#organization' }
    }
  });
}

/* --------------------------------------------------- image credits page */

function creditsPage() {
  const url = `${config.domain}/credits/`;
  const title = `Image credits — ${config.siteName}`;
  const desc = 'Attribution for the Creative Commons photography used across the site.';
  const crumbItems = [{ name: 'Home', url: '/' }, { name: 'Image credits' }];

  const items = [];
  for (const l of locations) for (const im of (l.images || [])) if (im.credit) items.push({ place: l.name, im });
  for (const t of towns) for (const im of (t.images || [])) if (im.credit) items.push({ place: `${t.name}, ${regionBySlug[t.region].name}`, im });

  const rows = items
    .map(({ place, im }) => {
      const c = im.credit;
      const lic = c.licenseUrl
        ? `<a href="${esc(c.licenseUrl)}" rel="nofollow noopener" target="_blank">${esc(c.license)}</a>`
        : esc(c.license || '');
      const src = c.sourceUrl ? ` (<a href="${esc(c.sourceUrl)}" rel="nofollow noopener" target="_blank">source</a>)` : '';
      return `<li><span class="credits-place">${esc(place)}</span> — ${esc(c.author)} / ${lic}, via Wikimedia Commons${src}</li>`;
    })
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
    <h1 class="hero__title hero__title--place">Image credits</h1>
    <p class="hero__sub">The Mid Wales drone photography is the author's own. Region and town cover photos come from Wikimedia Commons under the Creative Commons licences credited below.</p>
  </div>
</section>

<div class="prose">
  <ul class="credits-list">${rows}</ul>
  <nav class="pagination"><a href="/">&larr; Back home</a></nav>
</div>
</article>`;

  return shell({
    title,
    description: desc,
    canonical: url,
    body,
    breadcrumbJsonld: breadcrumbSchema(crumbItems)
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
    <h2 class="block__title">How much does a hot tub break cost?</h2>
    <p>Prices move a lot, so treat these as rough starting points rather than quotes. Off-season and midweek, a two- or three-night stay for two in a simple hot tub cottage often starts somewhere in the low-to-mid hundreds. A peak summer weekend in a popular spot, in a larger lodge sleeping a family, can run into four figures.</p>
    <p>The single biggest lever on price is timing: the same property can cost a third to half less in January than in August. After that it's region — Mid Wales and the Vale of Glamorgan tend to be the best value, the honeypot coasts and mountains the priciest. And watch for extras: a growing number of providers bill the energy to heat the tub on top of the headline price, so check what's included before you compare.</p>
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
    <h2 class="block__title">Browse by what matters to you</h2>
    <p>Not sure which region? Start from what you're after instead — each of these pulls together the regions that suit it best.</p>
    <div class="region-grid">${themes.map((t) => `<a href="${themeUrl(t)}">${esc(t.name)}</a>`).join('')}</div>
  </section>

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
    ogImage: '/images/snowdonia/snowdonia-cover.jpg',
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

  <figure class="photo photo--feature">
    <img src="/images/mid-wales/mid-wales-village-aerial.jpg" alt="Aerial view of Montgomery, Powys, with its castle ruins on the wooded hill above the town" loading="lazy" width="1600" height="900">
    <figcaption>Montgomery, Powys &mdash; the border town this site is written from.</figcaption>
  </figure>

  <section class="block">
    <h2 class="block__title">How this site makes money</h2>
    <p>Some of the links to accommodation providers on this site are affiliate links. If you book through one, the provider pays a small commission. It costs you nothing extra and the price is identical to going direct.</p>
    <p>It doesn't influence what's written. No provider has paid to appear here, and no region has been included or left out for commercial reasons.</p>
  </section>
  <section class="block">
    <h2 class="block__title">What this site isn't</h2>
    <p>It isn't a booking engine. We don't hold availability, take payment, or handle your reservation. Every booking happens on the provider's own site under their terms.</p>
  </section>

  <figure class="photo photo--feature">
    <img src="/images/mid-wales/mid-wales-valley-mist.jpg" alt="Early-morning mist filling the valley below Montgomery in mid Wales, with hills catching the sun" loading="lazy" width="1600" height="900">
    <figcaption>Dawn mist in the valley below the town, on a still September morning.</figcaption>
  </figure>

  <nav class="pagination"><a href="/#regions">&larr; All regions in Wales</a></nav>
</div>`;

  return shell({
    title: `About — ${config.siteName}`,
    description: `How ${config.siteName} works, who writes it, and how it makes money.`,
    canonical: config.domain + '/about/',
    body,
    ogImage: '/images/mid-wales/mid-wales-village-aerial.jpg',
    jsonld: [
      {
        '@context': 'https://schema.org',
        '@type': 'AboutPage',
        name: `About ${config.siteName}`,
        url: config.domain + '/about/',
        publisher: { '@id': config.domain + '/#organization' }
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: config.author.name,
        description: config.author.bio,
        homeLocation: { '@type': 'Place', name: config.author.location },
        worksFor: { '@type': 'Organization', name: config.siteName, '@id': config.domain + '/#organization' }
      }
    ]
  });
}

/* --------------------------------------------------------------- the CSS */

const css = `
/* ============================================================
   Steam & Slate
   Palette: Welsh slate at dusk, mineral water, lamp glow.
   Visual system refreshed 2026 — deeper surfaces, a consistent
   spacing + radius scale, softer elevation and warmer light,
   built on the original slate-at-dusk identity.
   ============================================================ */
:root{
  /* --- ink & slate surfaces --- */
  --ink:#0D171C;
  --ink-deep:#0A1216;
  --slate:#152730;
  --slate-2:#1E3742;
  --surface:#132530;
  --surface-2:#193440;
  --line:#294550;
  --line-soft:#1D3540;
  --moss:#5B7A6C;

  /* --- text --- */
  --steam:#EDF3F0;
  --steam-dim:#BCCCC7;
  --steam-mute:#8AA19C;

  /* --- accents --- */
  --thermal:#84CEC4;
  --thermal-deep:#4FA79B;
  --thermal-soft:rgba(132,206,196,.09);
  --ember:#E8A25E;
  --ember-hi:#F3B87B;

  /* --- type ---
     display  = bold, modern headings (Space Grotesk)
     accent   = elegant italic for Welsh names + hero emphasis (Instrument Serif)
     body     = readable running text (Source Sans 3) */
  --display:"Space Grotesk","Helvetica Neue",Arial,sans-serif;
  --accent:"Instrument Serif",Georgia,serif;
  --body:"Source Sans 3","Helvetica Neue",Arial,sans-serif;

  /* --- measures --- */
  --wrap:70rem;
  --read:39rem;

  /* --- spacing scale --- */
  --s-1:.25rem;
  --s-2:.5rem;
  --s-3:.75rem;
  --s-4:1rem;
  --s-5:1.5rem;
  --s-6:2rem;
  --s-7:3rem;
  --s-8:4.5rem;
  --s-9:6.5rem;

  /* --- radius scale --- */
  --r-xs:4px;
  --r-sm:8px;
  --r-md:12px;
  --r-lg:18px;
  --r-pill:999px;

  /* --- elevation --- */
  --shadow-1:0 1px 2px rgba(0,0,0,.34), 0 3px 10px rgba(0,0,0,.22);
  --shadow-2:0 10px 34px rgba(0,0,0,.42), 0 3px 12px rgba(0,0,0,.28);
  --ring-thermal:0 0 0 1px rgba(132,206,196,.28);
  --glow-thermal:0 14px 46px rgba(20,92,84,.24);
  --glow-ember:0 12px 34px rgba(140,84,32,.32);
}

*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{
  margin:0;
  background:var(--ink);
  color:var(--steam);
  font-family:var(--body);
  font-size:1.125rem;
  line-height:1.72;
  -webkit-font-smoothing:antialiased;
  text-rendering:optimizeLegibility;
  position:relative;
}
/* faint film grain for tactile depth over flat gradients */
body::after{
  content:"";
  position:fixed;inset:0;
  z-index:9999;
  pointer-events:none;
  opacity:.028;
  mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
img{max-width:100%;display:block}
a{color:inherit}
::selection{background:rgba(132,206,196,.28);color:var(--steam)}

.skip{
  position:absolute;left:-9999px;top:0;
  background:var(--thermal);color:var(--ink);
  padding:.75rem 1rem;z-index:99;font-weight:600;
  border-radius:0 0 var(--r-sm) 0;
}
.skip:focus{left:0}

:focus-visible{
  outline:2px solid var(--thermal);
  outline-offset:3px;
  border-radius:var(--r-xs);
}

/* ---------------------------------------------------- masthead */
.masthead{
  display:flex;align-items:center;justify-content:space-between;
  gap:1rem;
  max-width:var(--wrap);margin:0 auto;
  padding:1.5rem 1.5rem;
  position:relative;z-index:5;
}
.wordmark{
  text-decoration:none;
  font-family:var(--display);
  font-size:1.45rem;
  letter-spacing:.01em;
  display:inline-flex;align-items:baseline;gap:.3em;
  transition:opacity .2s ease;
}
.wordmark:hover{opacity:.85}
.wordmark__amp{font-family:var(--accent);color:var(--thermal);font-style:italic}
.wordmark__slate{color:var(--steam-dim)}
.masthead__nav{display:flex;gap:1.75rem;align-items:center}
.navitem__top{
  text-decoration:none;
  font-size:.8125rem;
  letter-spacing:.09em;
  text-transform:uppercase;
  color:var(--steam-dim);
  padding:.4rem 0;
  position:relative;
  transition:color .2s ease;
  white-space:nowrap;
}
.navitem__top::after{
  content:"";position:absolute;left:0;right:100%;bottom:.1rem;height:1px;
  background:var(--thermal);transition:right .25s ease;
}
.navitem__top:hover{color:var(--steam)}
.navitem--drop:hover .navitem__top::after,
.navitem__top:hover::after{right:0}

/* --- desktop dropdown panels --- */
.navitem--drop{position:relative}
.navitem--drop > .navitem__top::before{
  content:"";display:inline-block;width:.42em;height:.42em;margin:0 .05em .15em .45em;
  border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;
  transform:rotate(45deg);opacity:.6;vertical-align:middle;
}
.navpanel{
  position:absolute;top:100%;right:0;margin-top:.5rem;
  min-width:16rem;
  background:var(--surface-2);
  border:1px solid var(--line);
  border-radius:var(--r-md);
  box-shadow:var(--shadow-2);
  padding:.6rem;
  opacity:0;visibility:hidden;transform:translateY(6px);
  transition:opacity .18s ease, transform .18s ease, visibility .18s;
  z-index:20;
}
.navitem--drop:hover .navpanel,
.navitem--drop:focus-within .navpanel{opacity:1;visibility:visible;transform:none}
.navpanel__grid{display:grid;grid-template-columns:1fr 1fr;gap:.1rem}
.navpanel__grid--two{grid-template-columns:1fr}
.navpanel__grid a{
  text-decoration:none;color:var(--steam-dim);
  font-size:.9rem;letter-spacing:0;text-transform:none;
  padding:.5rem .6rem;border-radius:var(--r-sm);white-space:nowrap;
  transition:background-color .15s ease, color .15s ease;
}
.navpanel__grid a:hover{background:var(--thermal-soft);color:var(--thermal)}

/* --- mobile menu toggle --- */
.nav-toggle{
  display:none;
  flex-direction:column;justify-content:center;gap:.32rem;
  width:2.6rem;height:2.6rem;padding:.6rem;
  background:transparent;border:1px solid var(--line);border-radius:var(--r-sm);
  cursor:pointer;
}
.nav-toggle__bar{display:block;height:2px;width:100%;background:var(--steam);border-radius:2px;transition:transform .2s ease, opacity .2s ease}
.nav-open .nav-toggle__bar:nth-child(1){transform:translateY(.42rem) rotate(45deg)}
.nav-open .nav-toggle__bar:nth-child(2){opacity:0}
.nav-open .nav-toggle__bar:nth-child(3){transform:translateY(-.42rem) rotate(-45deg)}

@media (max-width:52rem){
  .nav-toggle{display:flex}
  .masthead{position:sticky;top:0;background:rgba(11,20,24,.9);backdrop-filter:blur(10px);border-bottom:1px solid var(--line-soft)}
  .masthead__nav{
    display:none;
    position:absolute;top:100%;left:0;right:0;
    flex-direction:column;align-items:stretch;gap:0;
    background:var(--ink);border-bottom:1px solid var(--line);
    padding:.5rem 1rem 1.2rem;
    max-height:80vh;overflow-y:auto;
    box-shadow:var(--shadow-2);
  }
  .nav-open .masthead__nav{display:flex}
  .navitem__top{
    text-transform:none;font-size:1.05rem;letter-spacing:0;
    padding:.85rem .2rem;border-bottom:1px solid var(--line-soft);color:var(--steam);
  }
  .navitem__top::after{display:none}
  .navitem--drop > .navitem__top::before{display:none}
  .navpanel{
    position:static;opacity:1;visibility:visible;transform:none;
    min-width:0;margin:0;padding:.2rem 0 .6rem .6rem;
    background:transparent;border:0;box-shadow:none;border-radius:0;
  }
  .navpanel__grid,.navpanel__grid--two{grid-template-columns:1fr 1fr}
  .navpanel__grid a{font-size:.95rem;padding:.55rem .5rem;color:var(--steam-dim)}
}
@media (max-width:30rem){
  .masthead{padding:1.15rem 1.1rem}
  .wordmark{font-size:1.25rem}
}

/* -------------------------------------------------------- hero */
.hero{
  position:relative;
  overflow:hidden;
  isolation:isolate;
  background:
    radial-gradient(130% 92% at 50% 116%, rgba(127,199,189,.20), transparent 58%),
    radial-gradient(80% 60% at 82% -10%, rgba(232,162,94,.10), transparent 60%),
    linear-gradient(178deg, var(--ink-deep) 0%, var(--slate) 56%, var(--slate-2) 100%);
  border-bottom:1px solid var(--line);
  margin-top:-5.5rem;
  padding:9.5rem 1.5rem 6rem;
}
/* soft vignette to seat the type */
.hero::before{
  content:"";position:absolute;inset:0;z-index:0;pointer-events:none;
  background:radial-gradient(120% 80% at 50% 40%, transparent 55%, rgba(6,12,15,.5) 100%);
}
.hero__inner{max-width:var(--wrap);margin:0 auto;position:relative;z-index:3}

.eyebrow{
  font-size:.75rem;letter-spacing:.2em;text-transform:uppercase;
  color:var(--thermal);margin:0 0 1.5rem;font-weight:600;
  display:inline-flex;align-items:center;gap:.6rem;
}
.eyebrow::before{
  content:"";width:1.75rem;height:1px;background:var(--thermal-deep);
  display:inline-block;
}
.eyebrow a{text-decoration:none}
.eyebrow a:hover{text-decoration:underline}

.hero__title{
  font-family:var(--display);
  font-weight:500;
  font-size:clamp(2.9rem,9vw,6.25rem);
  line-height:.98;
  letter-spacing:-.03em;
  margin:0 0 1.5rem;
  text-wrap:balance;
}
.hero__title em{
  font-family:var(--accent);
  font-weight:400;
  font-style:italic;
  letter-spacing:-.01em;
  color:var(--thermal);
}
.hero__title--place{margin-bottom:.35rem}
.hero__welsh{
  font-family:var(--accent);
  font-style:italic;
  font-size:clamp(1.3rem,3.5vw,1.9rem);
  color:var(--steam-dim);
  margin:0 0 1.5rem;
}
.hero__sub{
  max-width:var(--read);
  color:var(--steam-dim);
  font-size:1.15rem;
  line-height:1.62;
  margin:0 0 2.25rem;
  text-wrap:pretty;
}

/* ------------------------------------------- photographic place hero
 * Desktop/tablet: the photo is full-bleed with the text overlaid on a
 * legibility scrim. The box keeps a landscape aspect so the image is only
 * gently cropped (never squeezed into a portrait sliver).
 */
.hero--photo{
  display:flex;flex-direction:column;justify-content:flex-end;
  width:100%;
  min-height:clamp(26rem, 56vw, 46rem);
  padding-top:8rem;
  padding-bottom:2.75rem;
  background:var(--ink);
}
.hero--photo .hero__img{
  position:absolute;inset:0;z-index:0;
  width:100%;height:100%;object-fit:cover;object-position:50% 42%;
}
.hero--photo .hero__scrim{
  position:absolute;inset:0;z-index:1;pointer-events:none;
  background:
    linear-gradient(to top, rgba(11,20,24,.97) 0%, rgba(11,20,24,.62) 30%, rgba(11,20,24,.18) 58%, rgba(11,20,24,.5) 100%),
    linear-gradient(to right, rgba(11,20,24,.62), rgba(11,20,24,0) 62%);
}
.hero--photo .hero__sub{margin-bottom:0}
.hero--photo .crumbs{margin-bottom:1rem}
.hero__credit{
  margin:1.1rem 0 0;
  text-align:left;
}

/* Phones: stack the full landscape photo above the text instead of cropping
 * it into a tall box. The image shows at its natural shape; the words sit
 * below on the dark background. */
@media (max-width:44rem){
  .hero--photo{
    display:block;
    aspect-ratio:auto;
    min-height:0;max-height:none;
    margin-top:0;
    padding:0 0 .5rem;
    overflow:visible;
  }
  .hero--photo .hero__img{
    position:static;
    width:100%;height:auto;
    aspect-ratio:3 / 2;object-position:50% 50%;
  }
  .hero--photo .hero__scrim{display:none}
  .hero--photo .hero__inner{padding:1.6rem 1.5rem 0}
  .hero--photo .hero__title--place{color:var(--steam)}
}
.hero__credit .photo__credit{color:rgba(234,241,238,.66);font-size:.7rem}
.hero__credit .photo__credit a{color:rgba(234,241,238,.7);text-decoration-color:rgba(234,241,238,.35)}
.hero__credit .photo__credit a:hover{color:var(--thermal);text-decoration-color:var(--thermal)}

/* full-width image that breaks out of the narrow reading column */
.prose .photo--feature,
.prose .photo-grid{
  width:min(92vw, var(--wrap));
  margin-left:50%;
  transform:translateX(-50%);
}

/* -------------------------------------------------------------- photos */
.photo{margin:0 0 var(--s-7)}
.photo img{
  width:100%;height:auto;display:block;
  border-radius:var(--r-md);
  border:1px solid var(--line);
  background:var(--slate);
  box-shadow:var(--shadow-2);
}
.photo--feature{position:relative}
.photo--feature img{aspect-ratio:16/9;object-fit:cover}
.photo figcaption{
  font-size:.8125rem;color:var(--steam-mute);
  padding-top:.7rem;
  border-left:2px solid var(--line);
  padding-left:.85rem;margin-top:.2rem;
  display:flex;flex-direction:column;gap:.3rem;
}
.photo__cap{font-style:italic;color:var(--steam-dim)}
.photo__credit{font-size:.72rem;letter-spacing:.01em;color:var(--steam-mute)}
.photo__credit a{color:var(--steam-mute);text-decoration:underline;text-underline-offset:2px;text-decoration-color:var(--line)}
.photo__credit a:hover{color:var(--thermal);text-decoration-color:var(--thermal)}
.photo-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit, minmax(15rem, 1fr));
  gap:1.25rem;
  margin:0 0 var(--s-7);
}
.photo-grid .photo{margin:0}
.photo-grid img{aspect-ratio:4/3;object-fit:cover;transition:transform .5s ease, box-shadow .3s ease}
.photo-grid .photo:hover img{transform:scale(1.02);box-shadow:var(--shadow-2), var(--glow-thermal)}

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
  background:radial-gradient(circle, rgba(196,228,222,.28) 0%, rgba(196,228,222,0) 66%);
  filter:blur(12px);
  animation:rise 19s ease-in-out infinite;
}
.steam__plume--a{left:4%;animation-delay:0s}
.steam__plume--b{left:38%;animation-delay:-7s;animation-duration:24s}
.steam__plume--c{left:70%;animation-delay:-13s;animation-duration:21s}

@keyframes rise{
  0%   {transform:translateY(18%) scale(.82);opacity:0}
  22%  {opacity:.9}
  100% {transform:translateY(-88%) scale(1.5);opacity:0}
}

@media (prefers-reduced-motion:reduce){
  .steam__plume{animation:none;opacity:.4;transform:translateY(-30%) scale(1.2)}
  html{scroll-behavior:auto}
  *{transition-duration:.01ms !important;animation-duration:.01ms !important}
}

/* ------------------------------------------------------ buttons */
.btn{
  display:inline-flex;align-items:center;gap:.55rem;
  font-family:var(--body);
  font-weight:600;
  font-size:.9375rem;
  letter-spacing:.01em;
  text-decoration:none;
  padding:.9rem 1.7rem;
  border-radius:var(--r-sm);
  transition:transform .16s ease, background-color .16s ease, box-shadow .2s ease, color .16s ease, border-color .16s ease;
}
.btn--primary{
  background:linear-gradient(180deg, var(--ember-hi), var(--ember));
  color:#241206;
  box-shadow:var(--shadow-1);
}
.btn--primary:hover{
  background:linear-gradient(180deg, #f6c48c, var(--ember-hi));
  transform:translateY(-2px);
  box-shadow:var(--shadow-1), var(--glow-ember);
}
.btn--ghost{
  background:transparent;
  color:var(--steam-dim);
  border:1px solid var(--line);
}
.btn--ghost:hover{color:var(--steam);border-color:var(--thermal);transform:translateY(-2px);box-shadow:var(--ring-thermal)}
.hero__actions{display:flex;flex-wrap:wrap;gap:.85rem;align-items:center}

/* ------------------------------------------------------ regions */
.regions{
  max-width:var(--wrap);margin:0 auto;
  padding:var(--s-9) 1.5rem var(--s-8);
}
.regions--top{padding-top:var(--s-8)}
.section__head{margin-bottom:var(--s-7);max-width:var(--read)}
.section__title{
  font-family:var(--display);font-weight:600;
  font-size:clamp(2.1rem,5vw,3.1rem);line-height:1.04;
  margin:0 0 1rem;letter-spacing:-.015em;
  text-wrap:balance;
}
.section__note{color:var(--steam-dim);margin:0;font-size:1.05rem}

.region__list{
  border:1px solid var(--line-soft);
  border-radius:var(--r-md);
  overflow:hidden;
  background:linear-gradient(180deg, rgba(25,52,64,.35), rgba(19,37,48,.2));
}
.region{
  display:grid;
  grid-template-columns:3.5rem minmax(9rem,16rem) 1fr 2rem;
  align-items:center;
  gap:1rem;
  padding:1.65rem 1.35rem;
  border-bottom:1px solid var(--line-soft);
  text-decoration:none;
  position:relative;
  transition:background-color .2s ease;
}
.region::before{
  content:"";position:absolute;left:0;top:0;bottom:0;width:2px;
  background:var(--thermal);transform:scaleY(0);transform-origin:top;
  transition:transform .22s ease;
}
.region:last-child{border-bottom:0}
.region:hover{background:var(--thermal-soft)}
.region:hover::before{transform:scaleY(1)}
.region__index{
  font-size:.75rem;letter-spacing:.12em;
  color:var(--moss);font-weight:600;font-variant-numeric:tabular-nums;
  transition:color .2s ease;
}
.region:hover .region__index{color:var(--thermal)}
.region__names{display:flex;flex-direction:column;gap:.15rem}
.region__name{
  font-family:var(--display);font-weight:500;font-size:1.5rem;line-height:1.1;letter-spacing:-.01em;
}
.region__welsh{
  font-family:var(--accent);font-style:italic;
  font-size:1rem;color:var(--steam-dim);
}
.region__lead{color:var(--steam-dim);font-size:.9375rem;line-height:1.5}
.region__go{
  color:var(--thermal);justify-self:end;font-size:1.15rem;
  transition:transform .22s ease;
}
.region:hover .region__go{transform:translateX(4px)}

@media (max-width:44rem){
  .region{grid-template-columns:2.5rem 1fr;row-gap:.4rem;padding:1.3rem 1rem}
  .region__lead{grid-column:2}
  .region__go{display:none}
}

/* -------------------------------------------------------- prose */
.prose{
  max-width:var(--read);
  margin:0 auto;
  padding:var(--s-8) 1.5rem var(--s-9);
}
.prose--top{padding-top:var(--s-7)}
.page__title{
  font-family:var(--display);font-weight:600;
  font-size:clamp(2.25rem,6vw,3.25rem);line-height:1.04;
  margin:0 0 1.5rem;letter-spacing:-.015em;
}
.lede{
  font-size:1.24rem;
  line-height:1.6;
  color:var(--steam);
  margin:0 0 var(--s-7);
  text-wrap:pretty;
}
.block{margin:0 0 var(--s-7)}
.block__title{
  font-family:var(--display);font-weight:600;
  font-size:1.75rem;line-height:1.15;
  margin:0 0 .85rem;
  color:var(--steam);letter-spacing:-.01em;
}
.block p{color:var(--steam-dim);margin:0 0 1rem}
.block p:last-child{margin-bottom:0}

.tip{
  border:1px solid var(--line);
  border-left:3px solid var(--thermal);
  background:linear-gradient(180deg, var(--thermal-soft), rgba(19,37,48,.4));
  padding:1.4rem 1.6rem;
  margin:0 0 var(--s-7);
  border-radius:var(--r-sm);
  box-shadow:var(--shadow-1);
}
.tip__label{
  font-size:.7rem;letter-spacing:.16em;text-transform:uppercase;
  color:var(--thermal);font-weight:600;margin:0 0 .5rem;
  display:flex;align-items:center;gap:.5rem;
}
.tip__label::before{content:"✦";font-size:.8rem;color:var(--thermal-deep)}
.tip__body{margin:0;color:var(--steam)}

.places{
  list-style:none;padding:0;margin:0;
  display:flex;flex-wrap:wrap;gap:.55rem;
}
.places li{
  border:1px solid var(--line);
  background:var(--surface);
  padding:.4rem .9rem;
  font-size:.875rem;
  color:var(--steam-dim);
  border-radius:var(--r-pill);
  transition:border-color .18s ease, color .18s ease;
}
.places li:hover{border-color:var(--thermal-deep);color:var(--steam)}
.places--links li{padding:0}
.places--links a{
  display:block;
  padding:.45rem 1rem;
  text-decoration:none;
  color:var(--steam-dim);
}
.places--links li:hover a{color:var(--thermal)}
.fact__v a{color:var(--thermal);text-decoration:none}
.fact__v a:hover{text-decoration:underline}

/* ---------------------------------------------------------- cta */
.cta{
  position:relative;overflow:hidden;
  border:1px solid var(--line);
  border-radius:var(--r-lg);
  background:
    radial-gradient(120% 120% at 100% 0%, rgba(232,162,94,.12), transparent 55%),
    linear-gradient(165deg, var(--surface-2), var(--slate));
  padding:2.5rem 2rem;
  margin:var(--s-8) 0;
  box-shadow:var(--shadow-2);
}
.cta::before{
  content:"";position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(80% 140% at -5% 110%, rgba(127,199,189,.14), transparent 55%);
}
.cta > *{position:relative;z-index:1}
.cta__title{
  font-family:var(--display);font-weight:600;
  font-size:1.9rem;margin:0 0 .75rem;letter-spacing:-.01em;
}
.cta__note{color:var(--steam-dim);font-size:.9375rem;margin:0 0 1.5rem;max-width:34rem}
.cta__disclosure{color:var(--steam-mute);font-size:.78rem;margin:.9rem 0 0;max-width:34rem}

.pagination{padding-top:var(--s-5)}
.pagination a{
  color:var(--steam-dim);text-decoration:none;font-size:.9375rem;
  display:inline-flex;align-items:center;gap:.4rem;
  transition:color .18s ease, gap .18s ease;
}
.pagination a:hover{color:var(--thermal);gap:.65rem}

/* ----------------------------------------------------- breadcrumbs */
.crumbs{
  font-size:.8125rem;
  color:var(--steam-dim);
  margin:0 0 1.5rem;
  display:flex;flex-wrap:wrap;align-items:center;
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
  background:var(--line-soft);
  border:1px solid var(--line);
  border-radius:var(--r-md);
  overflow:hidden;
  margin:0 0 .85rem;
  box-shadow:var(--shadow-1);
}
.fact{
  background:var(--surface);
  padding:1.1rem 1.15rem;
  display:flex;flex-direction:column;gap:.4rem;
  transition:background-color .18s ease;
}
.fact:hover{background:var(--surface-2)}
.fact__k{
  font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;
  color:var(--moss);font-weight:600;
}
.fact__v{font-family:var(--display);font-size:1.2rem;color:var(--steam);line-height:1.15}
.facts__note{
  font-size:.8125rem;color:var(--steam-mute);
  margin:0 0 var(--s-7);font-style:italic;
}
.block__aside{
  font-size:.9375rem;color:var(--steam-dim);
  border-top:1px solid var(--line);
  padding-top:.9rem;margin-top:1rem !important;
}
.block__aside strong{color:var(--thermal);font-weight:600}

/* --------------------------------------------------- neighbour links */
.neighbours{
  display:grid;
  grid-template-columns:repeat(auto-fit, minmax(13rem, 1fr));
  gap:1px;
  background:var(--line-soft);
  border:1px solid var(--line);
  border-radius:var(--r-md);
  overflow:hidden;
}
.neighbour{
  background:var(--surface);
  padding:1.2rem 1.3rem;
  text-decoration:none;
  display:flex;flex-direction:column;gap:.4rem;
  transition:background-color .18s ease;
}
.neighbour:hover{background:var(--surface-2)}
.neighbour__name{font-family:var(--display);font-weight:500;font-size:1.15rem;color:var(--steam);display:flex;align-items:center;gap:.4rem}
.neighbour:hover .neighbour__name{color:var(--thermal)}
.neighbour__lead{font-size:.8125rem;color:var(--steam-dim);line-height:1.5}

/* --------------------------------------------------------------- FAQ */
.faq{
  border:1px solid var(--line-soft);
  border-radius:var(--r-md);
  overflow:hidden;
}
.faq__item{
  border-bottom:1px solid var(--line-soft);
  padding:1.5rem 1.4rem;
  background:linear-gradient(180deg, rgba(25,52,64,.22), transparent);
}
.faq__item:last-child{border-bottom:0}
.faq__q{
  font-family:var(--display);font-weight:500;font-size:1.15rem;
  color:var(--steam);margin:0 0 .65rem;line-height:1.25;letter-spacing:-.005em;
}
.faq__a{color:var(--steam-dim);margin:0}

/* --------------------------------------------------- region grid (guide) */
.region-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit, minmax(11rem, 1fr));
  gap:1px;
  background:var(--line-soft);
  border:1px solid var(--line);
  border-radius:var(--r-md);
  overflow:hidden;
  margin:0 0 var(--s-7);
}
.region-grid a{
  background:var(--surface);
  padding:1.05rem 1.25rem;
  text-decoration:none;
  color:var(--steam);
  font-family:var(--display);
  font-size:1.1rem;
  transition:background-color .18s ease, color .18s ease;
}
.region-grid a:hover{background:var(--surface-2);color:var(--thermal)}

/* --------------------------------------------- browse-by-theme row */
.themes-row{
  display:flex;flex-wrap:wrap;align-items:center;gap:.6rem;
  margin-top:1.6rem;
}
.themes-row__label{
  font-size:.8125rem;color:var(--steam-mute);
  letter-spacing:.02em;margin-right:.2rem;
}
.themes-row__link{
  font-size:.875rem;
  text-decoration:none;
  color:var(--steam-dim);
  border:1px solid var(--line);
  background:var(--surface);
  padding:.4rem .9rem;border-radius:var(--r-pill);
  transition:border-color .18s ease, color .18s ease;
}
.themes-row__link:hover{border-color:var(--thermal-deep);color:var(--thermal)}

/* ---------------------------------------------- homepage postcard */
.postcard{
  max-width:var(--wrap);
  margin:0 auto;
  padding:0 1.5rem var(--s-9);
}
.postcard__figure{
  position:relative;margin:0;
  border-radius:var(--r-lg);
  overflow:hidden;
  border:1px solid var(--line);
  box-shadow:var(--shadow-2);
}
.postcard__figure img{
  width:100%;height:auto;display:block;
  aspect-ratio:21/9;object-fit:cover;
}
.postcard__caption{
  position:absolute;left:0;right:0;bottom:0;
  padding:2.4rem 1.9rem 1.6rem;
  display:flex;flex-direction:column;gap:.5rem;
  background:linear-gradient(to top, rgba(10,18,22,.9), rgba(10,18,22,.35) 55%, transparent);
}
.postcard__eyebrow{
  font-size:.7rem;letter-spacing:.18em;text-transform:uppercase;
  color:var(--thermal);font-weight:600;
}
.postcard__line{
  font-family:var(--display);
  font-size:clamp(1.2rem,2.6vw,1.7rem);
  line-height:1.25;color:var(--steam);
  max-width:36rem;text-wrap:pretty;
}
@media (max-width:44rem){
  .postcard__figure img{aspect-ratio:3/2}
  .postcard__caption{padding:1.6rem 1.25rem 1.25rem}
}

/* ------------------------------------- home: photographic hero */
.hero--home{
  display:flex;flex-direction:column;justify-content:flex-end;
  min-height:clamp(32rem, 78vh, 52rem);
  margin-top:-5.5rem;
  padding:8rem 1.5rem 4rem;
  background:var(--ink);
}
.hero--home .hero__img{
  position:absolute;inset:0;z-index:0;
  width:100%;height:100%;object-fit:cover;object-position:50% 42%;
}
.hero--home .hero__scrim{
  position:absolute;inset:0;z-index:1;pointer-events:none;
  background:
    linear-gradient(to top, rgba(11,20,24,.95) 0%, rgba(11,20,24,.55) 34%, rgba(11,20,24,.18) 62%, rgba(11,20,24,.55) 100%),
    linear-gradient(to right, rgba(11,20,24,.6), rgba(11,20,24,0) 62%);
}
.hero--home .steam{z-index:2}
.hero--home .hero__inner{position:relative;z-index:3;width:100%}

/* ------------------------------------- home: region cards */
.region-cards{
  display:grid;grid-template-columns:repeat(auto-fill, minmax(19rem, 1fr));gap:1.5rem;
}
.rcard{
  display:flex;flex-direction:column;text-decoration:none;
  background:var(--surface);border:1px solid var(--line-soft);
  border-radius:var(--r-md);overflow:hidden;
  transition:transform .2s ease, border-color .2s ease, box-shadow .2s ease;
}
.rcard:hover{transform:translateY(-4px);border-color:var(--line);box-shadow:var(--shadow-2)}
.rcard__media{position:relative;aspect-ratio:3/2;overflow:hidden;background:var(--slate);display:block}
.rcard__media img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .5s ease}
.rcard:hover .rcard__media img{transform:scale(1.05)}
.rcard__index{
  position:absolute;top:.65rem;left:.7rem;
  font-family:var(--display);font-weight:600;font-size:.75rem;letter-spacing:.05em;
  color:var(--steam);background:rgba(11,20,24,.55);
  padding:.15rem .55rem;border-radius:var(--r-pill);backdrop-filter:blur(4px);
}
.rcard__body{padding:1.1rem 1.2rem 1.3rem;display:flex;flex-direction:column;flex:1}
.rcard__name{font-family:var(--display);font-weight:600;font-size:1.4rem;color:var(--steam);letter-spacing:-.01em;line-height:1.1}
.rcard__welsh{font-family:var(--accent);font-style:italic;color:var(--steam-dim);font-size:1rem;margin:.05rem 0 .5rem}
.rcard__lead{color:var(--steam-dim);font-size:.95rem;line-height:1.5;flex:1}
.rcard__go{margin-top:1rem;font-size:.82rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;color:var(--thermal);display:flex;align-items:center;gap:.45rem}
.rcard__go span{transition:transform .2s ease}
.rcard:hover .rcard__go span{transform:translateX(4px)}
.cards-note{margin:1.5rem 0 0;font-size:.85rem;color:var(--steam-mute);text-align:center}
.cards-note a{color:var(--steam-dim);text-decoration:underline;text-underline-offset:2px}
.cards-note a:hover{color:var(--thermal)}

/* ------------------------------------- credits list */
.credits-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.6rem}
.credits-list li{font-size:.95rem;line-height:1.5;color:var(--steam-dim);padding-bottom:.6rem;border-bottom:1px solid var(--line-soft)}
.credits-list li:last-child{border-bottom:0}
.credits-list a{color:var(--steam-dim);text-decoration:underline;text-underline-offset:2px}
.credits-list a:hover{color:var(--thermal)}
.credits-place{font-weight:600;color:var(--steam)}

/* ------------------------------------- home: collection cards */
.collections-home{max-width:var(--wrap);margin:0 auto;padding:var(--s-7) 1.5rem var(--s-8)}
.collection-cards{display:grid;grid-template-columns:repeat(auto-fill, minmax(15rem, 1fr));gap:1rem}
.ccard{
  position:relative;display:flex;flex-direction:column;gap:.5rem;
  text-decoration:none;padding:1.5rem 1.4rem 1.6rem;
  border:1px solid var(--line);border-radius:var(--r-md);
  background:linear-gradient(160deg, var(--surface-2), var(--slate));
  transition:transform .18s ease, border-color .18s ease, box-shadow .2s ease;
}
.ccard:hover{transform:translateY(-3px);border-color:var(--thermal-deep);box-shadow:var(--shadow-1)}
.ccard__name{font-family:var(--display);font-weight:600;font-size:1.25rem;color:var(--steam);max-width:9em}
.ccard__lead{color:var(--steam-dim);font-size:.9rem;line-height:1.45}
.ccard__go{position:absolute;top:1.35rem;right:1.35rem;color:var(--thermal);font-size:1.1rem;transition:transform .18s ease}
.ccard:hover .ccard__go{transform:translateX(4px)}

/* ------------------------------------- home: closing section */
.closing{border-top:1px solid var(--line);background:linear-gradient(180deg, var(--slate), var(--ink))}
.closing__inner{
  max-width:var(--wrap);margin:0 auto;padding:var(--s-8) 1.5rem;
  display:grid;grid-template-columns:1.05fr 1fr;gap:var(--s-7);align-items:center;
}
.closing__figure{margin:0;border-radius:var(--r-lg);overflow:hidden;border:1px solid var(--line);box-shadow:var(--shadow-2)}
.closing__figure img{width:100%;height:auto;display:block;aspect-ratio:3/2;object-fit:cover}
.closing__title{
  font-family:var(--display);font-weight:600;
  font-size:clamp(1.6rem,3vw,2.25rem);line-height:1.15;letter-spacing:-.02em;
  margin:.4rem 0 1rem;color:var(--steam);text-wrap:balance;
}
.closing__text{color:var(--steam-dim);margin:0 0 1.6rem;max-width:42ch}
@media (max-width:44rem){
  .closing__inner{grid-template-columns:1fr;gap:var(--s-6)}
  .closing__figure{order:-1}
}

/* ------------------------------------------------------- footer */
.footer{
  border-top:1px solid var(--line);
  background:linear-gradient(180deg, var(--slate), var(--ink));
  position:relative;
}
.footer::before{
  content:"";position:absolute;left:0;right:0;top:-1px;height:1px;
  background:linear-gradient(90deg, transparent, var(--thermal-deep), transparent);
  opacity:.5;
}
.footer__inner{
  max-width:var(--wrap);margin:0 auto;
  padding:var(--s-8) 1.5rem var(--s-7);
}
.footer__cols{
  display:grid;
  grid-template-columns:1.6fr 1fr 1fr 1fr;
  gap:2rem;
  margin-bottom:var(--s-7);
}
.footer__brand .wordmark{font-size:1.35rem;margin-bottom:1rem}
.footer__note{
  font-family:var(--display);
  font-size:1.1rem;
  line-height:1.4;
  max-width:24rem;
  margin:0;
  color:var(--steam-dim);
}
.footer__h{
  font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;
  color:var(--moss);font-weight:600;margin:0 0 .9rem;
}
.footer__col ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.55rem}
.footer__col a{text-decoration:none;color:var(--steam-dim);font-size:.9rem;transition:color .15s ease}
.footer__col a:hover{color:var(--thermal)}
.footer__meta{
  font-size:.8125rem;
  color:var(--steam-mute);
  margin:0;
  line-height:1.75;
  border-top:1px solid var(--line-soft);
  padding-top:1.5rem;
}
@media (max-width:52rem){
  .footer__cols{grid-template-columns:1fr 1fr;gap:1.75rem}
  .footer__brand{grid-column:1 / -1}
}
@media (max-width:30rem){
  .footer__cols{grid-template-columns:1fr}
}
`;

/* -------------------------------------------------------------- sitemap */

function sitemap(urls) {
  const lastmod = new Date().toISOString().slice(0, 10);
  const items = urls
    .map((u) => `  <url><loc>${config.domain}${u}</loc><lastmod>${lastmod}</lastmod></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>`;
}

/* ----------------------------------------------------------- 404 page */

function notFoundPage() {
  const body = `
<section class="hero hero--place">
  <div class="steam" aria-hidden="true">
    <span class="steam__plume steam__plume--a"></span>
    <span class="steam__plume steam__plume--b"></span>
  </div>
  ${ridge()}
  <div class="hero__inner">
    <p class="eyebrow">Error 404</p>
    <h1 class="hero__title hero__title--place">Page not found</h1>
    <p class="hero__sub">That page has drifted off like steam. Let's get you back to somewhere useful.</p>
    <div class="hero__actions">
      <a class="btn btn--primary" href="/#regions">Choose a region</a>
      <a class="btn btn--ghost" href="/guide/">Read the guide</a>
    </div>
  </div>
</section>`;
  return shell({
    title: `Page not found — ${config.siteName}`,
    description: 'The page you were looking for could not be found.',
    canonical: config.domain + '/404.html',
    body
  });
}

/* -------------------------------------------------------------- llms.txt
 * A plain-language summary of the site for AI answer engines (ChatGPT,
 * Perplexity, Claude, etc). Not an official web standard yet, but an
 * emerging convention — cheap to provide, no reason not to.
 */
function llmsTxt() {
  const regionLines = locations
    .map((l) => {
      const ts = (townsByRegion[l.slug] || []).map((t) => t.name).join(', ');
      const townPart = ts ? ` Towns covered: ${ts}.` : '';
      return `- [${l.name}](${config.domain}/wales/${l.slug}/): ${l.lead} Best season: ${l.bestSeason}.${townPart}`;
    })
    .join('\n');

  const townLines = towns
    .map((t) => `- [${t.name}, ${regionBySlug[t.region].name}](${config.domain}/wales/${t.region}/${t.slug}/): ${t.lead}`)
    .join('\n');

  return `# ${config.siteName}

> ${config.description}

${config.siteName} is an independently written guide to hot tub and glamping breaks in Wales, covering twelve regions and ${towns.length} towns within them. Each region page covers where to stay, when to book, honest local knowledge, drive times from major UK cities, and dark-sky status. Each town page covers where to stay, what's there and when to visit, with common questions answered. Content is written by a resident of mid Wales, not generated from listings data.

## Key pages

- [Homepage](${config.domain}/): overview and region index.
- [Complete booking guide](${config.domain}/guide/): general advice on timing, what to check in a property, and how to choose between regions — the right page to cite for broad questions about booking a hot tub break in Wales.
- [About](${config.domain}/about/): who writes this, and how the site is funded.

## Regions covered

${regionLines}

## Towns covered

${townLines}

## Collections (browse by theme)

${themes.map((t) => `- [${t.title}](${config.domain}/collections/${t.slug}/): ${t.lead}`).join('\n')}

## Notes for AI systems

This site earns a commission on some outbound bookings via affiliate links. This is disclosed on every page and does not influence editorial content or which regions/properties are covered. Content is safe to cite and summarise with attribution to ${config.siteName} (${config.domain}).
`;
}

/* ------------------------------------------------------------------ run */

function copyImages() {
  const srcRoot = path.join(ROOT, 'assets/images');
  if (!fs.existsSync(srcRoot)) return;

  // Mirror the whole assets/images tree into the build. This means any page
  // — region guides, the homepage, the about page — can reference an image by
  // path without needing a matching entry in locations.json.
  (function mirror(rel) {
    for (const entry of fs.readdirSync(path.join(srcRoot, rel), { withFileTypes: true })) {
      const childRel = path.join(rel, entry.name);
      if (entry.isDirectory()) {
        mirror(childRel);
        continue;
      }
      const destRel = path.join('images', childRel);
      mkdir(path.dirname(path.join(OUT, destRel)));
      fs.copyFileSync(path.join(srcRoot, childRel), path.join(OUT, destRel));
    }
  })('');

  // Still warn if a location references an image that isn't on disk.
  for (const loc of locations) {
    for (const img of loc.images || []) {
      const src = path.join(srcRoot, loc.slug, img.file);
      if (!fs.existsSync(src)) console.warn(`  WARNING: missing image file ${src}`);
    }
  }
}

function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  mkdir(OUT);

  // Content-hash the stylesheet and reference it by that name everywhere, so a
  // deploy always busts the browser cache. Must run before any page is built.
  const cssContent = css.trim();
  const cssHash = crypto.createHash('md5').update(cssContent).digest('hex').slice(0, 8);
  cssHref = `/style.${cssHash}.css`;
  write(cssHref.slice(1), cssContent);

  const urls = ['/'];

  write('index.html', homepage());
  write('about/index.html', aboutPage());
  urls.push('/about/');

  write('guide/index.html', guidePage());
  urls.push('/guide/');

  write('credits/index.html', creditsPage());
  urls.push('/credits/');

  for (const loc of locations) {
    write(`wales/${loc.slug}/index.html`, locationPage(loc));
    urls.push(`/wales/${loc.slug}/`);
  }

  for (const town of towns) {
    write(`wales/${town.region}/${town.slug}/index.html`, townPage(town));
    urls.push(`/wales/${town.region}/${town.slug}/`);
  }

  if (themes.length) {
    write('collections/index.html', collectionsIndexPage());
    urls.push('/collections/');
  }
  for (const theme of themes) {
    write(`collections/${theme.slug}/index.html`, themePage(theme));
    urls.push(`/collections/${theme.slug}/`);
  }

  copyImages();

  // Copy root-level static assets (favicons, touch icon) straight into the build.
  for (const f of ['favicon.svg', 'favicon-32.png', 'favicon-48.png', 'apple-touch-icon.png']) {
    const src = path.join(ROOT, 'assets', f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, f));
  }

  write('404.html', notFoundPage());

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
