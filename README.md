# Steam & Slate

A programmatic SEO site for hot tub and glamping breaks in Wales. One template, one data file, twelve pages — and it scales to hundreds without you writing any more code.

---

## What this actually is

`data/locations.json` holds the content. `build.js` reads it and stamps out a full static site into `site/`. Add a region to the JSON, run the build, and a new page appears with correct metadata, structured data and a sitemap entry. That's the whole trick.

No dependencies. No npm install. Just Node.

---

## Getting it live tonight

**1. Run it**

```bash
node build.js
```

You'll see twelve pages appear in `site/`. Open `site/index.html` to check it.

**2. Push to GitHub**

New repo, drag the whole folder in via GitHub Desktop, commit, push.

**3. Connect Netlify**

New site from Git → pick the repo. Netlify reads `netlify.toml` and knows what to do:
- Build command: `node build.js`
- Publish directory: `site`

That's it. It's live.

**4. Point a domain at it**

Buy through Netlify to skip the DNS faff. Something like `steamandslate.co.uk`. Then update `domain` in `data/config.json` and rebuild, so the canonical tags and sitemap are correct.

**5. Submit to Google**

Google Search Console → add the property → submit `/sitemap.xml`. Nothing happens until you do this.

---

## Turning the money on

The site currently links to plain public search URLs. Honest, useful, earns nothing. Here's the sequence:

**Apply to Awin.** Sykes Cottages runs its affiliate programme there and explicitly courts hot-tub and pet-friendly niche sites, so you're the exact publisher they want. There's usually a small refundable deposit to join Awin.

**Important ordering:** they need to see a real site before they'll approve you. So publishing tonight isn't a delay before earning — it's the thing that unlocks earning. Approval typically takes a few days to a couple of weeks.

**Then flip the switch.** In `data/config.json`:

```json
"awinAffiliateId": "YOUR_ID_HERE",
"useAffiliateLinks": true
```

Rebuild, push. Every Browse button on every page becomes a tracked link at once. That's the leverage.

Worth adding later: Booking.com's partner programme, and Pitchup for the camping/glamping end.

---

## The honest timeline

I'd rather you hear this now than wonder in three weeks why nothing's happening.

- **Tonight** — site is live, indexed, ready to earn.
- **Weeks 2–8** — Google starts ranking the long-tail pages. First trickle of visitors.
- **Months 3–6** — this is when programmatic SEO normally starts paying. Traffic compounds.
- **Month 6+** — if the content's good and you've kept adding, this is where it becomes real money.

Nobody makes rent from this in week one. What you're building tonight is an asset that pays later, not a wage that pays Friday. Anyone who tells you different is selling a course.

---

## How to make it actually work

The single biggest risk is thin content. Google is aggressive about mass-produced pages that say nothing, and a penalty is very hard to come back from. The defence is simple: **every page must be worth reading on its own.**

That's why the twelve pages here have real, specific, different content — actual local knowledge, not spun paragraphs with the place name swapped. Keep that bar.

**How to scale properly:**

1. **Go deeper before wider.** Add sections to existing pages — a "best for couples vs families" split, notes on parking, what's open in winter. Depth ranks.
2. **Then add a second layer.** Town-level pages under each region (`/wales/snowdonia/betws-y-coed/`) once the region pages are earning. Only where you genuinely have something to say.
3. **Then add a second angle.** Dog-friendly, sea view, off-grid. Same template, new dimension.

**What not to do:** generate 800 pages of near-identical text. It's the fastest way to get the whole domain buried.

---

## Adding a region

Copy an existing block in `data/locations.json` and fill it in honestly:

```json
{
  "slug": "url-friendly-name",
  "name": "Display Name",
  "welsh": "Welsh name",
  "county": "County",
  "lead": "One line that makes someone want to click.",
  "intro": "Two or three sentences of real context.",
  "whereToStay": "Break the area into zones and be opinionated.",
  "whenToBook": "Actual seasonality and pressure points.",
  "localTip": "One thing a local knows and a guidebook doesn't.",
  "nearby": ["Town", "Town", "Town"],
  "searchTerm": "What to search the provider for"
}
```

Run `node build.js`. Done.

---

## Working on it with Claude Code

Paste this to get going:

> This is a zero-dependency Node static site generator for a Welsh hot tub / glamping directory. `build.js` reads `data/locations.json` and `data/config.json` and writes to `site/`. Read build.js first so you understand the structure before changing anything. Fix and extend rather than rebuilding — the design system and CSS tokens are deliberate. I want to [your change here].

---

## Design notes

Palette is Welsh slate at dusk with mineral-water turquoise and a lamp-glow amber, used sparingly. Instrument Serif for display, Familjen Grotesk for everything else. The signature is the ridge silhouette with steam rising in front of it — it's on every hero and nothing else competes with it.

Responsive to mobile, keyboard focus visible, `prefers-reduced-motion` respected.
