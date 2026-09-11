/**
 * Create Harbor & Heat Spas as a complete preview/publish demo:
 * new client, every config field, every media slot, generated photos.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(
  "C:",
  "Users",
  "sky",
  ".cursor",
  "projects",
  "e-work-Work-IncreaseRoas-site-launchpad-source",
  "assets",
);
const DEST = path.join(ROOT, "demo-resources", "harbor-and-heat");
const API = "http://127.0.0.1:3000";
const BUSINESS_NAME = "Harbor & Heat Spas";

const IMAGES = {
  logo: path.join(SRC, "hh-logo.png"),
  favicon: path.join(SRC, "hh-favicon.png"),
  hero: path.join(SRC, "hh-hero.png"),
  swimSpas: path.join(SRC, "hh-swim-spa.png"),
  saunas: path.join(SRC, "hh-sauna.png"),
  coldPlunge: path.join(SRC, "hh-cold-plunge.png"),
  massageChairs: path.join(SRC, "hh-massage-chair.png"),
  showroom: path.join(SRC, "hh-showroom.png"),
  product: path.join(SRC, "hh-product.png"),
  delivery: path.join(SRC, "hh-delivery.png"),
};

const FOREST = { r: 27, g: 58, b: 47, alpha: 1 };
const FONTS = {
  display: "Fraunces",
  body: "Source Sans 3",
  mono: "IBM Plex Mono",
  googleFontsUrl:
    "https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600;700&family=Source+Sans+3:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;700&display=swap",
};

function log(message) {
  console.log(message);
}

async function trpc(procedure, input, method = "GET") {
  const encoded = encodeURIComponent(JSON.stringify({ json: input ?? null }));
  const url =
    method === "GET"
      ? `${API}/api/trpc/${procedure}?input=${encoded}`
      : `${API}/api/trpc/${procedure}`;
  const response = await fetch(url, {
    method,
    headers: method === "POST" ? { "content-type": "application/json" } : undefined,
    body: method === "POST" ? JSON.stringify({ json: input }) : undefined,
  });
  const body = await response.json();
  if (!response.ok || body.error) {
    const err = body.error?.json ?? body.error ?? body;
    throw new Error(`${procedure} failed: ${JSON.stringify(err)}`);
  }
  return body.result.data.json;
}

async function containPad(src, dest, width, height, background) {
  await mkdir(path.dirname(dest), { recursive: true });
  await sharp(src)
    .rotate()
    .resize(width, height, { fit: "contain", background, withoutEnlargement: false })
    .png()
    .toFile(dest);
}

async function coverWebp(src, dest, width, height) {
  await mkdir(path.dirname(dest), { recursive: true });
  await sharp(src)
    .rotate()
    .resize(width, height, { fit: "cover", position: "centre" })
    .webp({ quality: 86 })
    .toFile(dest);
}

async function prepareImages() {
  const files = {
    logoNav: path.join(DEST, "logo-nav.png"),
    logoFooter: path.join(DEST, "logo-footer.png"),
    logoInventory: path.join(DEST, "logo-inventory.png"),
    logoClient: path.join(DEST, "logo.png"),
    favicon: path.join(DEST, "favicon.png"),
    ogImage: path.join(DEST, "og-image.webp"),
    hero: path.join(DEST, "hero.webp"),
    categoryHotTubs: path.join(DEST, "category-hot-tubs-hero.webp"),
    categorySwimSpas: path.join(DEST, "category-swim-spas-hero.webp"),
    categorySaunas: path.join(DEST, "category-saunas-hero.webp"),
    categoryColdPlunge: path.join(DEST, "category-cold-plunge-hero.webp"),
    categoryMassageChairs: path.join(DEST, "category-massage-chairs-hero.webp"),
    hotTubs: path.join(DEST, "hot-tubs.webp"),
    swimSpas: path.join(DEST, "swim-spas.webp"),
    showroom: path.join(DEST, "showroom.webp"),
    product: path.join(DEST, "product.webp"),
    delivery: path.join(DEST, "delivery.webp"),
    libraryShowroom: path.join(DEST, "library-showroom.webp"),
    librarySauna: path.join(DEST, "library-sauna.webp"),
    libraryPlunge: path.join(DEST, "library-cold-plunge.webp"),
    libraryChair: path.join(DEST, "library-massage-chair.webp"),
    librarySwim: path.join(DEST, "library-swim-spa.webp"),
    libraryProduct: path.join(DEST, "library-jets.webp"),
  };

  await containPad(IMAGES.logo, files.logoNav, 800, 400, FOREST);
  await containPad(IMAGES.logo, files.logoFooter, 800, 400, FOREST);
  await containPad(IMAGES.logo, files.logoInventory, 800, 400, FOREST);
  await containPad(IMAGES.logo, files.logoClient, 800, 400, FOREST);
  await containPad(IMAGES.favicon, files.favicon, 512, 512, FOREST);
  await coverWebp(IMAGES.hero, files.ogImage, 1200, 630);
  await coverWebp(IMAGES.hero, files.hero, 1600, 900);
  await coverWebp(IMAGES.hero, files.categoryHotTubs, 1600, 900);
  await coverWebp(IMAGES.swimSpas, files.categorySwimSpas, 1600, 900);
  await coverWebp(IMAGES.saunas, files.categorySaunas, 1600, 900);
  await coverWebp(IMAGES.coldPlunge, files.categoryColdPlunge, 1600, 900);
  await coverWebp(IMAGES.massageChairs, files.categoryMassageChairs, 1600, 900);
  await coverWebp(IMAGES.hero, files.hotTubs, 1200, 800);
  await coverWebp(IMAGES.swimSpas, files.swimSpas, 1200, 800);
  await coverWebp(IMAGES.showroom, files.showroom, 1200, 800);
  await coverWebp(IMAGES.product, files.product, 1200, 800);
  await coverWebp(IMAGES.delivery, files.delivery, 1200, 800);
  await coverWebp(IMAGES.showroom, files.libraryShowroom, 1600, 1200);
  await coverWebp(IMAGES.saunas, files.librarySauna, 1600, 1200);
  await coverWebp(IMAGES.coldPlunge, files.libraryPlunge, 1600, 1200);
  await coverWebp(IMAGES.massageChairs, files.libraryChair, 1600, 1200);
  await coverWebp(IMAGES.swimSpas, files.librarySwim, 1600, 1200);
  await coverWebp(IMAGES.product, files.libraryProduct, 1600, 1200);
  return files;
}

function mimeFor(filePath) {
  return path.extname(filePath).toLowerCase() === ".png" ? "image/png" : "image/webp";
}

async function uploadSlot(clientId, assetKind, slot, filePath, alt, description) {
  const buffer = await readFile(filePath);
  const mimeType = mimeFor(filePath);
  const session = await trpc(
    "assets.requestUpload",
    {
      clientId,
      assetKind,
      slot,
      originalFilename: path.basename(filePath),
      mimeType,
      sizeBytes: buffer.length,
    },
    "POST",
  );
  const putUrl = session.uploadUrl.startsWith("http")
    ? session.uploadUrl
    : `${API}${session.uploadUrl}`;
  const put = await fetch(putUrl, {
    method: "PUT",
    headers: session.requiredHeaders,
    body: buffer,
  });
  if (!put.ok) {
    throw new Error(`PUT ${slot} failed: ${put.status} ${await put.text()}`);
  }
  const completed = await trpc("assets.completeUpload", { uploadId: session.uploadId }, "POST");
  const mediaItem = completed.mediaItem ?? completed.asset;
  const url = mediaItem?.storageUrl ?? completed.asset?.storageUrl;
  const itemId = mediaItem?.id;
  if (itemId && (alt || description)) {
    await trpc(
      "assets.updateLibraryItem",
      { clientId, itemId, alt: alt ?? "", description: description ?? "" },
      "POST",
    );
  }
  log(`  uploaded ${assetKind}:${slot} -> ${url}`);
  return { slot, storageUrl: url, itemId, filename: path.basename(filePath) };
}

function section(type, id, fields, enabled = true) {
  return { id, type, enabled, fields };
}

function buildConfig(urls, gallery) {
  const categories = {
    "hot-tubs": {
      enabled: true,
      label: "Hot Tubs",
      slug: "hot-tubs",
      description:
        "Deep-seat cedar-side spas for rainy Portland evenings — strong jets, tight covers, and models you can sit in today.",
      heroImage: urls.categoryHotTubs ?? "",
    },
    "swim-spas": {
      enabled: true,
      label: "Swim Spas",
      slug: "swim-spas",
      description:
        "Year-round current training without a pool permit. Swim, recover, and soak in one backyard unit.",
      heroImage: urls.categorySwimSpas ?? "",
    },
    saunas: {
      enabled: true,
      label: "Saunas",
      slug: "saunas",
      description:
        "Cedar infrared and traditional rooms sized for a garage, ADU, or covered patio.",
      heroImage: urls.categorySaunas ?? "",
    },
    "cold-plunge": {
      enabled: true,
      label: "Cold Plunge",
      slug: "cold-plunge",
      description:
        "Chilled plunge tubs for contrast after a soak, a run on the Springwater, or a long desk day.",
      heroImage: urls.categoryColdPlunge ?? "",
    },
    "massage-chairs": {
      enabled: true,
      label: "Massage Chairs",
      slug: "massage-chairs",
      description:
        "Quiet zero-gravity chairs with heat and stretch programs for the den — not a gym lobby.",
      heroImage: urls.categoryMassageChairs ?? "",
    },
  };

  return {
    identity: {
      businessName: BUSINESS_NAME,
      shortName: "Harbor Heat",
      foundedYear: 2011,
      tagline: "Pacific Northwest hot tubs, swim spas, and recovery — try them on the lake.",
      siteUrl: "https://www.harborandheatspas.com",
      schemaType: "Store",
    },
    contact: {
      phone: "+15035550190",
      smsPhone: "+15035550190",
      phoneDisplayOverride: "(503) 555-0190",
      email: "hello@harborandheatspas.com",
    },
    address: {
      street1: "333 S State St",
      street2: "Suite 200",
      city: "Lake Oswego",
      state: "OR",
      postalCode: "97034",
      country: "US",
      latitude: "45.41780",
      longitude: "-122.66870",
      googlePlaceId: "ChIJDemoHarborHeatLakeOswegoOR2011",
    },
    hours: [
      { day: "monday", isOpen: true, opensAt: "10:00", closesAt: "18:00" },
      { day: "tuesday", isOpen: true, opensAt: "10:00", closesAt: "18:00" },
      { day: "wednesday", isOpen: true, opensAt: "10:00", closesAt: "18:00" },
      { day: "thursday", isOpen: true, opensAt: "10:00", closesAt: "18:00" },
      { day: "friday", isOpen: true, opensAt: "10:00", closesAt: "18:00" },
      { day: "saturday", isOpen: true, opensAt: "09:00", closesAt: "17:00" },
      { day: "sunday", isOpen: true, opensAt: "11:00", closesAt: "16:00" },
    ],
    socialLinks: {
      facebook: "https://www.facebook.com/harborandheatspas",
      instagram: "https://www.instagram.com/harborandheatspas",
      youtube: "https://www.youtube.com/@harborandheatspas",
      tiktok: "https://www.tiktok.com/@harborandheatspas",
      x: "https://x.com/harborandheat",
      linkedin: "https://www.linkedin.com/company/harbor-and-heat-spas",
      googleBusiness: "https://maps.google.com/?cid=harborandheatlakeoswego",
    },
    brand: { theme: "natural", fonts: FONTS },
    navigationItems: [
      { id: "nav-categories", type: "categories", label: "Products", href: "", inHeader: true, inFooter: true },
      { id: "nav-match", type: "link", label: "Find Your Match", href: "/find-your-match", inHeader: true, inFooter: true },
      { id: "nav-inventory", type: "link", label: "Inventory", href: "/inventory", inHeader: true, inFooter: true },
      { id: "nav-financing", type: "link", label: "Financing", href: "/financing", inHeader: true, inFooter: true },
      { id: "nav-visit", type: "link", label: "Visit Us", href: "/visit-us", inHeader: true, inFooter: true },
    ],
    categories,
    financing: {
      enabled: true,
      lenderName: "Wells Fargo Home Projects",
      lenderUrl: "https://retailservices.wellsfargo.com/",
      disclaimer:
        "Subject to credit approval. Equal Housing Lender. Example payment is an estimate only and is not an offer of credit.",
      terms:
        "Promotional financing available on qualifying purchases of $2,500 or more. Terms from 24 to 60 months. Ask the Lake Oswego team for today's rates.",
      ctaLabel: "Check my options",
      monthlyExample: "From about $139/month on a mid-size spa after delivery and setup.",
    },
    serviceAreas:
      "Lake Oswego, Portland, West Linn, Oregon City, Tigard, Tualatin, Sherwood, Lake Grove, Dunthorpe, Clackamas",
    homepageSections: [
      section("announcement", "section-announcement", {
        badge: "Harvest Soak Event",
        text: "In-stock spas include Metro Portland delivery through November 30",
        href: "/inventory",
      }),
      section("hero", "section-hero", {
        eyebrow: "Lake Oswego showroom",
        headline: "The soak you can try before the rain sets in",
        highlight: "try before",
        subheadline:
          "Walk a floor of filled hot tubs, swim spas, saunas, and plunges. Leave with one written number — unit, delivery, and setup.",
        promo: "Harvest event: complimentary Metro Portland delivery on in-stock spas through November 30.",
        bullets: [
          "Working models on the floor — sit in them before you buy",
          "Out-the-door pricing that includes delivery and professional setup",
          "Financing from about $139/month on qualifying spas",
        ].join("\n"),
        backgroundImage: urls.hero ?? "",
        ctaLabel: "Shop inventory",
        ctaHref: "/inventory",
        ctaLabel2: "Request pricing",
        ctaHref2: "/find-your-match",
        leadHeading: "Get today's local price",
        leadSubtext: "Tell us seats, budget, and backyard access. We'll text current inventory and a written total.",
        leadFootnote:
          "What happens next: a specialist texts availability within one business hour. No spam, no hard sell.",
      }),
      section("stats", "section-stats", {
        items: [
          "15+ | Years on the Willamette",
          "4.8★ | Google rating",
          "72hr | Typical in-stock delivery",
          "100% | Written out-the-door price",
        ].join("\n"),
      }),
      section("offercard", "section-offer", {
        eyebrow: "Open 7 days in Lake Oswego",
        heading: "There has never been a better week to sit in one",
        body: "Every spa on the floor is filled and running. Compare jets, seating, and insulation with someone who delivers these in the rain.",
        bullets: [
          "Sit in working models before you spend a dollar",
          "One written price: spa, delivery, crane if needed, and startup",
          "Flexible financing for most credit profiles",
          "Local water-care and service after the sale",
        ].join("\n"),
        ctaLabel: "See what's in stock",
        ctaHref: "/inventory",
        ctaLabel2: "Plan a showroom visit",
        ctaHref2: "/visit-us",
      }),
      section("products", "section-products", {
        eyebrow: "In stock · no factory wait",
        heading: "Showroom selection",
        body: "These are units you can sit in today. Ask about current availability, covers, and steps.",
        limit: "6",
        category: "",
        moreLabel: "See the full floor",
        moreHref: "/inventory",
        disclaimer: "Photos are representative. Serial numbers, options, and pricing are confirmed in the showroom.",
      }),
      section("categoryrow", "section-categoryrow", {
        eyebrow: "Shop by ritual",
        heading: "What are you adding to the backyard?",
        body: "Hot tubs for wet-night soaks, swim spas for training, saunas and plunges for recovery, chairs for the den.",
      }),
      section("cards", "section-cards", {
        heading: "Start with the right category",
        intro: "Every line we sell is on the floor in Lake Oswego. Pick a path or walk them all.",
        items: [
          `Hot Tubs | Deep seats, tight covers, and shells that stay warm in January. | /hot-tubs | ${urls.hotTubs ?? ""}`,
          `Swim Spas | Swim current plus a therapy seat — no pool required. | /swim-spas | ${urls.swimSpas ?? ""}`,
          `Saunas | Cedar infrared and traditional rooms that fit a garage or patio. | /saunas | ${urls.saunas ?? ""}`,
          `Cold Plunge | Contrast therapy next to the spa, ready for backyard power. | /cold-plunges | ${urls.coldPlunge ?? ""}`,
          `Massage Chairs | Zero-gravity chairs with heat, stretch, and quiet motors. | /massage-chairs | ${urls.massageChairs ?? ""}`,
        ].join("\n"),
      }),
      section("imagecards", "section-imagecards", {
        eyebrow: "Find your fit",
        heading: "Three ways to start",
        items: [
          `Hot Tubs | Premium seating and hydrotherapy for 4–8 people. | /hot-tubs | ${urls.hotTubs ?? ""}`,
          `Swim Spas | Train, recover, and soak without a pool permit. | /swim-spas | ${urls.swimSpas ?? ""}`,
          `Find Your Match | 60-second quiz for seats, budget, and backyard access. | /find-your-match | ${urls.hero ?? ""}`,
        ].join("\n"),
      }),
      section("benefits", "section-benefits", {
        heading: "Why neighbors drive to Lake Oswego",
        items: [
          "Try before you buy | Sit in filled spas and feel the jet layout, not a brochure.",
          "One written total | Delivery, placement, and startup are in the quote.",
          "Rain-ready setup | We plan pads, covers, and electrical before the truck rolls.",
          "Local aftercare | Water-care visits and parts from the same team.",
        ].join("\n"),
      }),
      section("gallery", "section-gallery", {
        heading: "From the showroom and recent installs",
        images: gallery,
      }),
      section("reviews", "section-reviews", {
        eyebrow: "Reviews",
        heading: "What Portland families say",
        items: [
          "Priya M. | 5 | We sat in three spas on a Saturday and knew which shell fit. They delivered in the rain and stayed until the chemistry was right. | Google Review | August 2026",
          "Jonah K. | 5 | Bought a swim spa for winter laps. They measured the side yard twice so crane day was boring — perfect. | Google Review | July 2026",
          "Elena S. | 5 | Straight answers on 50-amp circuits and covers. We financed the sauna and plunge as a pair. | Google Review | June 2026",
        ].join("\n"),
        aggregate: "4.8 | 142 | Google",
      }),
      section("comparison", "section-why", {
        eyebrow: "Why buy local",
        heading: "Harbor & Heat vs. a crate on a driveway",
        themLabel: "Online marketplace",
        body: "A spa is a 20-year backyard fixture. The difference is who shows up when the cover needs a clip or the water turns cloudy.",
        rows: [
          "Try before you buy | Filled units on the floor | Photos and a spec sheet",
          "Pricing | One written out-the-door number | Freight, crane, and startup later",
          "Delivery | Local crew that knows Lake Oswego access | Curbside drop",
          "After the sale | A cell phone that a tech answers | A ticket queue",
        ].join("\n"),
      }),
      section("promise", "section-promise", {
        badgeValue: "100%",
        badgeLabel: "Written price",
        heading: "Straight numbers, no weekend close",
        body: "We would rather send you home to think than push a same-day signature. Come with measurements and leave with a quote you can compare.",
        bullets: [
          "Out-the-door pricing in writing",
          "No pressure, no hidden freight",
          "Local delivery and placement plan",
          "Water-care walkthrough on day one",
        ].join("\n"),
      }),
      section("visit", "section-visit", {
        heading: "Visit the Lake Oswego showroom",
        body: "333 S State St, Suite 200. Street parking out front. Every category is filled and running — hot tubs, swim spas, saunas, plunges, and chairs.",
        ctaLabel: "Get directions",
        ctaHref: "/visit-us",
      }),
      section("splitcards", "section-split", {
        eyebrow: "Worth the drive",
        heading: "Two reasons to come in",
        items: [
          "See them filled and running | Ten minutes in a seat tells you more than an evening of tabs. | /inventory | yes | yes",
          "Talk to people who install them | Ask about pads, 50-amp circuits, and winter covers — you'll get a plan, not a script. | /visit-us | no | no",
        ].join("\n"),
      }),
      section("steps", "section-steps", {
        eyebrow: "How it works",
        heading: "From first sit to first soak",
        steps: [
          "Come sit in them | Compare models side by side with a specialist who knows the jet maps.",
          "Get the out-the-door number | Spa, delivery, placement, and startup — one page you can take home.",
          "We handle the rest | Pad check, delivery window, water chemistry, and a local number after.",
        ].join("\n"),
      }),
      section("faq", "section-faq", {
        eyebrow: "Good questions",
        heading: "What Portland buyers ask first",
        items: [
          "How much does a hot tub actually cost? | Most four-to-six person spas landed in a backyard here run from the mid $8,000s to the low $20,000s out the door. We quote one number that includes delivery and setup.",
          "What does delivery involve? | We measure gates, grade, and overhead lines, then schedule a crew and crane if the side yard is tight. You are not left with a crate on the driveway.",
          "What do I need at home? | A level pad and, for most spas, a dedicated 50-amp circuit. Swim spas and saunas have their own needs — we walk those before you buy.",
          "Can I finance it? | Yes, through Wells Fargo Home Projects on qualifying purchases. Checking options in the showroom will not open a hard pull until you apply.",
          "Do you deliver outside Lake Oswego? | Yes — Portland, West Linn, Oregon City, Tigard, Tualatin, Sherwood, Lake Grove, Dunthorpe, and Clackamas.",
        ].join("\n"),
      }),
      section("ctaband", "section-financing-band", {
        eyebrow: "Easy monthly options",
        headline: "See your financing options",
        subheadline:
          "Promotional terms on qualifying spas. Check your options in a couple of minutes — asking will not affect your credit.",
        footnote: "Subject to credit approval. Example payments are estimates, not offers of credit.",
        ctaLabel: "Check my options",
        ctaHref: "/financing",
        ctaLabel2: "Text (503) 555-0190",
        ctaHref2: "sms:+15035550190",
      }),
      section("cta", "section-lead", {
        headline: "Text us the seats and the budget",
        ctaLabel: "Request pricing",
        subtext: "We reply with in-stock matches and a written total. No mailing list, no second salesperson.",
      }),
      section("trust", "section-trust", {
        items: [
          "Family-run since 2011",
          "Lake Oswego showroom",
          "Licensed delivery crew",
          "4.8★ from 142 Google reviews",
          "Written out-the-door pricing",
        ].join("\n"),
      }),
      section("bignumber", "section-years", {
        value: "15+",
        label: "years helping Willamette backyards",
        body: "Same showroom on State Street. Same crew that delivers in November still answers the phone in July.",
      }),
      section("countdown", "section-countdown", {
        eyebrow: "Harvest soak event",
        heading: "Complimentary delivery ends November 30",
        body: "In-stock spas include Metro Portland delivery and a starter chemical kit if you take delivery by the event date.",
        endsAt: "2026-11-30T17:00:00",
      }),
      section("ctaband", "section-final", {
        eyebrow: "Ready when you are",
        headline: "Come walk the floor this week",
        subheadline:
          "Sit in the spas, or start with a text. Either way you get real Lake Oswego pricing without the runaround.",
        footnote: "Open Monday–Saturday, Sunday 11–4. 333 S State St, Suite 200.",
        ctaLabel: "Request pricing",
        ctaHref: "/find-your-match",
        ctaLabel2: "Get directions",
        ctaHref2: "/visit-us",
      }),
    ],
    integrations: {
      d1: { enabled: true, config: { binding: "DB", databaseName: "harbor-and-heat-spas" } },
      r2: { enabled: true, config: { binding: "PRODUCT_IMAGES", bucketName: "harbor-and-heat-spas-media" } },
      ghl: { enabled: false, config: {} },
      meta: { enabled: false, config: {} },
      zaraz: { enabled: false, config: { endpoint: "https://www.harborandheatspas.com/cdn-cgi/zaraz/s.js", debug: "false" } },
      sentry: { enabled: false, config: { dsn: "https://example@o0.ingest.sentry.io/0", environment: "demo" } },
    },
  };
}

async function resolveClient() {
  const existing = await trpc("clients.list", null);
  const match = existing
    .map(row => row.client)
    .find(row => row.businessName === BUSINESS_NAME);
  if (match) {
    log(`Reusing client ${match.id} (${match.shortName})`);
    return match;
  }
  log("Creating Harbor & Heat Spas client…");
  const created = await trpc("clients.createDraft", { businessName: BUSINESS_NAME }, "POST");
  return created.client;
}

async function main() {
  log("Preparing Harbor & Heat Spas image pack…");
  const files = await prepareImages();
  log(`Wrote processed images to ${DEST}`);

  const client = await resolveClient();
  const clientId = client.id;
  log(`Client id=${clientId} shortName=${client.shortName}`);

  const uploaded = {};
  const jobs = [
    ["astro", "navLogo", files.logoNav, "Harbor & Heat Spas navigation logo", "Forest-and-copper wordmark for the site header."],
    ["astro", "footerLogo", files.logoFooter, "Harbor & Heat Spas footer logo", "Matching mark for the site footer."],
    ["astro", "inventoryLogo", files.logoInventory, "Harbor & Heat Spas inventory logo", "Brand mark used on inventory listings."],
    ["astro", "favicon", files.favicon, "Harbor & Heat Spas favicon", "Square wave monogram for browser tabs."],
    ["astro", "ogImage", files.ogImage, "Lakeside hot tub at dusk for social sharing", "Steaming backyard spa used when the site is shared."],
    ["astro", "categoryHotTubs", files.categoryHotTubs, "Luxury backyard hot tub at dusk", "Hero for the Hot Tubs category page."],
    ["astro", "categorySwimSpas", files.categorySwimSpas, "Long swim spa in a Pacific Northwest backyard", "Hero for the Swim Spas category page."],
    ["astro", "categorySaunas", files.categorySaunas, "Cedar indoor sauna interior", "Hero for the Saunas category page."],
    ["astro", "categoryColdPlunge", files.categoryColdPlunge, "Outdoor cold plunge among evergreens", "Hero for the Cold Plunge category page."],
    ["astro", "categoryMassageChairs", files.categoryMassageChairs, "Luxury massage chair in a showroom", "Hero for the Massage Chairs category page."],
    ["client", "logo", files.logoClient, "Harbor & Heat Spas logo", "Client marketing logo."],
    ["client", "hero", files.hero, "Lakeside hot tub hero", "Main marketing photo."],
    ["client", "hotTubs", files.hotTubs, "Hot tubs marketing photo", "Marketing photo for hot tubs."],
    ["client", "swimSpas", files.swimSpas, "Swim spas marketing photo", "Marketing photo for swim spas."],
    ["client", "showroom", files.showroom, "Lake Oswego spa showroom", "Filled spas on the showroom floor."],
    ["client", "product", files.product, "Hot tub jet detail", "Close-up of chrome jets underwater."],
    ["client", "delivery", files.delivery, "Spa delivery and placement", "Crew placing a spa on a backyard pad."],
  ];

  const libraryJobs = [
    [files.libraryShowroom, "Showroom floor with filled spas", "Lake Oswego showroom interior."],
    [files.librarySauna, "Cedar sauna benches and heater", "Indoor sauna detail for the gallery."],
    [files.libraryPlunge, "Outdoor cold plunge among evergreens", "Cold plunge ready for contrast therapy."],
    [files.libraryChair, "Leather massage chair", "Showroom massage chair."],
    [files.librarySwim, "Backyard swim spa", "Swim spa lifestyle photo."],
    [files.libraryProduct, "Underwater jet close-up", "Hydrotherapy jet detail."],
  ];

  for (const [kind, slot, filePath, alt, description] of jobs) {
    const result = await uploadSlot(clientId, kind, slot, filePath, alt, description);
    uploaded[slot] = result.storageUrl;
  }

  const galleryItems = [];
  for (const [filePath, alt, description] of libraryJobs) {
    const result = await uploadSlot(clientId, "library", "library", filePath, alt, description);
    galleryItems.push({
      id: result.itemId,
      src: result.storageUrl,
      alt,
      description,
    });
  }

  const config = buildConfig(
    {
      hero: uploaded.hero,
      hotTubs: uploaded.hotTubs,
      swimSpas: uploaded.swimSpas,
      saunas: uploaded.categorySaunas,
      coldPlunge: uploaded.categoryColdPlunge,
      massageChairs: uploaded.categoryMassageChairs,
      categoryHotTubs: uploaded.categoryHotTubs,
      categorySwimSpas: uploaded.categorySwimSpas,
      categorySaunas: uploaded.categorySaunas,
      categoryColdPlunge: uploaded.categoryColdPlunge,
      categoryMassageChairs: uploaded.categoryMassageChairs,
    },
    JSON.stringify(galleryItems),
  );

  log("Saving configuration…");
  const saved = await trpc("astroConfig.save", { clientId, config }, "POST");
  await trpc(
    "astroConfig.saveSecrets",
    {
      clientId,
      values: {
        ADMIN_PASSWORD: "DemoShowroom!2011",
        ADMIN_SESSION_SECRET: "hh-demo-session-secret-2011-lake-oswego",
      },
    },
    "POST",
  );

  await writeFile(
    path.join(DEST, "launchpad-client.json"),
    JSON.stringify(
      {
        clientId,
        shortName: saved.input?.identity?.shortName ?? "Harbor Heat",
        uploaded,
        galleryCount: galleryItems.length,
      },
      null,
      2,
    ),
    "utf8",
  );
  log(`Saved. Open http://127.0.0.1:3000/workspace/${clientId}/configuration?tab=media`);
  log(`Launch: http://127.0.0.1:3000/workspace/${clientId}/launch`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
