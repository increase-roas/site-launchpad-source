/**
 * Prepare a Sun Pool & Spa Supply demo client in local Launchpad.
 * Copies scraped live-site images into demo-resources/sun-pool (operator source
 * pack) and uploads them through the same Media-tab API used in the UI.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRAPE = path.resolve(
  ROOT,
  "..",
  "32-htl-website-template-astrobuild",
  "scraped-images-sun-pool",
);
const DEST = path.join(ROOT, "demo-resources", "sun-pool");
const API = "http://127.0.0.1:3000";

const R2 = path.join(SCRAPE, "pub-24055549503540b0b5ff19237b87d146.r2.dev");
const SITE = path.join(SCRAPE, "www.sunpoolandspasupply.com");

const SRC = {
  logoNav: path.join(R2, "logos", "logo-nav.png"),
  logoFooter: path.join(R2, "logos", "logo-footer.png"),
  logoInventory: path.join(R2, "logos", "logo-inventory.png"),
  appleTouch: path.join(SITE, "apple-touch-icon.png_v_20260710"),
  hero: path.join(SITE, "assets", "HERO_sun-pool-spa-hydropool-blue-led-hot-tub.webp"),
  hotTubs: path.join(SITE, "assets", "HOTTUBS_sun-pool-spa-six-person-hot-tub.webp"),
  swimSpas: path.join(SITE, "assets", "SWIMSPAS_sun-pool-spa-blue-led-swim-spa.webp"),
  showroom1: path.join(SITE, "assets", "SHOWROOM1_sun-pool-spa-storefront.webp"),
  showroom2: path.join(SITE, "assets", "SHOWROOM2_sun-pool-spa-interior.webp"),
  showroom3: path.join(SITE, "assets", "SHOWROOM3_sun-pool-spa-family-showroom.jpg"),
  product: path.join(R2, "products", "1786095533807-primary_hydropool-signature-679-platinum_interior-front.webp"),
  match: path.join(R2, "products", "1786095533807-gallery_hydropool-aquatrainer-14ax_lifestyle.webp"),
};

const LIBRARY_EXTRAS = [
  ["library-storefront.webp", SRC.showroom1, "Sun Pool Lakeside storefront", "12473 Woodside Ave, Suite C."],
  ["library-showroom-interior.webp", SRC.showroom2, "Sun Pool showroom interior", "Filled units on the Lakeside floor."],
  ["library-family-showroom.webp", SRC.showroom3, "Family in the Sun Pool showroom", "Live-site lifestyle photo."],
  ["library-signature-679.webp", SRC.product, "Hydropool Signature 679 Platinum", "Interior of a floor-model Signature 679."],
  [
    "library-aquatrainer.webp",
    path.join(R2, "products", "1786095533807-primary_hydropool-aquatrainer-14ax_top-down.webp"),
    "Hydropool AquaTrainer 14AX",
    "Top-down of the swim spa on the floor.",
  ],
  [
    "library-serenity-6600.webp",
    path.join(R2, "products", "1786095533807-primary_hydropool-serenity-6600_front-corner.webp"),
    "Hydropool Serenity 6600",
    "Entry Hydropool on the showroom floor.",
  ],
  [
    "library-comfort-2300s.webp",
    path.join(R2, "products", "1786095533807-primary_dreammaker-comfort-2300s-suite_front-corner.webp"),
    "DreamMaker Comfort 2300S Suite",
    "Plug-and-play starter spa.",
  ],
  [
    "library-cabana-3500l.webp",
    path.join(R2, "products", "1786095533807-primary_dreammaker-cabana-3500l-suite_front-corner.webp"),
    "DreamMaker Cabana 3500L Suite",
    "Full-body lounge Cabana on the floor.",
  ],
];

const FONTS = {
  display: "Bricolage Grotesque",
  body: "Instrument Sans",
  mono: "Spline Sans Mono",
  googleFontsUrl:
    "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&family=Instrument+Sans:wght@400;500;600;700&family=Spline+Sans+Mono:wght@400;500;700&display=swap",
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
  await mkdir(DEST, { recursive: true });
  const files = {
    logoNav: path.join(DEST, "logo-nav.png"),
    logoFooter: path.join(DEST, "logo-footer.png"),
    logoInventory: path.join(DEST, "logo-inventory.png"),
    favicon: path.join(DEST, "favicon.png"),
    ogImage: path.join(DEST, "og-image.webp"),
    hero: path.join(DEST, "hero.webp"),
    hotTubsHero: path.join(DEST, "hot-tubs-hero.webp"),
    swimSpasHero: path.join(DEST, "swim-spas-hero.webp"),
    hotTubs: path.join(DEST, "hot-tubs.webp"),
    swimSpas: path.join(DEST, "swim-spas.webp"),
    showroom: path.join(DEST, "showroom.webp"),
    product: path.join(DEST, "product.webp"),
    delivery: path.join(DEST, "delivery.webp"),
    match: path.join(DEST, "find-your-match.webp"),
  };
  const clear = { r: 0, g: 0, b: 0, alpha: 0 };
  await containPad(SRC.logoNav, files.logoNav, 800, 400, clear);
  await containPad(SRC.logoFooter, files.logoFooter, 800, 400, clear);
  await containPad(SRC.logoInventory, files.logoInventory, 800, 400, clear);
  await containPad(SRC.appleTouch, files.favicon, 512, 512, clear);
  await coverWebp(SRC.hero, files.ogImage, 1200, 630);
  await coverWebp(SRC.hero, files.hero, 1600, 900);
  await coverWebp(SRC.hotTubs, files.hotTubsHero, 1600, 900);
  await coverWebp(SRC.swimSpas, files.swimSpasHero, 1600, 900);
  await coverWebp(SRC.hotTubs, files.hotTubs, 1200, 800);
  await coverWebp(SRC.swimSpas, files.swimSpas, 1200, 800);
  await coverWebp(SRC.showroom1, files.showroom, 1200, 800);
  await coverWebp(SRC.product, files.product, 1200, 800);
  await coverWebp(SRC.showroom3, files.delivery, 1200, 800);
  await coverWebp(SRC.match, files.match, 1600, 900);
  for (const [name, src] of LIBRARY_EXTRAS) {
    await coverWebp(src, path.join(DEST, "library", name), 1600, 1200);
  }
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
  return { slot, storageUrl: url, itemId, filename: path.basename(filePath), byteSize: buffer.length };
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
      description: "Premium hot tubs for relaxation and recovery.",
      heroImage: urls.categoryHotTubs ?? "",
    },
    "swim-spas": {
      enabled: true,
      label: "Swim Spas",
      slug: "swim-spas",
      description: "Swim, exercise, and relax year-round in your own backyard.",
      heroImage: urls.categorySwimSpas ?? "",
    },
    saunas: { enabled: false, label: "Saunas", slug: "saunas", description: "", heroImage: "" },
    "cold-plunge": {
      enabled: false,
      label: "Cold Plunge",
      slug: "cold-plunge",
      description: "",
      heroImage: "",
    },
    "massage-chairs": {
      enabled: false,
      label: "Massage Chairs",
      slug: "massage-chairs",
      description: "",
      heroImage: "",
    },
  };

  return {
    identity: {
      businessName: "Sun Pool & Spa Supply",
      shortName: "Sun Pool",
      foundedYear: 1978,
      tagline: "The best hot tub and swim spa store in San Diego County. Real units on the floor.",
      siteUrl: "https://www.sunpoolandspasupply.com",
      schemaType: "Store",
    },
    contact: {
      phone: "+16195618587",
      smsPhone: "+16195618587",
      phoneDisplayOverride: "(619) 561-8587",
      email: "info@sunpoolandspasupply.com",
    },
    address: {
      street1: "12473 Woodside Ave",
      street2: "Suite C",
      city: "Lakeside",
      state: "CA",
      postalCode: "92040",
      country: "US",
      latitude: "32.857086",
      longitude: "-116.924479",
      googlePlaceId: "",
    },
    hours: [
      { day: "monday", isOpen: true, opensAt: "09:30", closesAt: "17:00" },
      { day: "tuesday", isOpen: true, opensAt: "09:30", closesAt: "17:00" },
      { day: "wednesday", isOpen: true, opensAt: "09:30", closesAt: "17:00" },
      { day: "thursday", isOpen: true, opensAt: "09:30", closesAt: "17:00" },
      { day: "friday", isOpen: true, opensAt: "09:30", closesAt: "17:00" },
      { day: "saturday", isOpen: true, opensAt: "09:00", closesAt: "17:00" },
      { day: "sunday", isOpen: true, opensAt: "10:00", closesAt: "14:00" },
    ],
    socialLinks: {
      facebook: "",
      instagram: "",
      youtube: "",
      tiktok: "",
      x: "",
      linkedin: "",
      googleBusiness: "",
    },
    brand: { theme: "luxury", fonts: FONTS },
    navigationItems: [
      { id: "nav-categories", type: "categories", label: "Products", href: "", inHeader: true, inFooter: true },
      { id: "nav-match", type: "link", label: "Find Your Match", href: "/find-your-match", inHeader: true, inFooter: true },
      { id: "nav-inventory", type: "link", label: "Inventory", href: "/inventory", inHeader: true, inFooter: true },
      { id: "nav-financing", type: "link", label: "Financing", href: "/financing", inHeader: true, inFooter: true },
      { id: "nav-visit", type: "link", label: "Visit Us", href: "/visit-us", inHeader: true, inFooter: true },
    ],
    categories,
    financing: {
      enabled: false,
      lenderName: "",
      lenderUrl: "",
      disclaimer: "",
      terms: "",
      ctaLabel: "Check my options",
      monthlyExample: "",
    },
    serviceAreas: "Lakeside, El Cajon, Santee, East County San Diego",
    homepageSections: [
      section("announcement", "section-announcement", {
        badge: "Evergreen Catalog",
        text: "Shop hot tubs",
        href: "/hot-tubs",
      }),
      section("hero", "section-hero", {
        eyebrow: "San Diego County",
        headline: "The Best Hot Tub & Swim Spa Store in San Diego County",
        highlight: "San Diego County",
        subheadline: "Real units on the floor. Serving East County since 1978.",
        promo: "Evergreen Catalog: There has never been a better time to buy a hot tub",
        bullets: "",
        backgroundImage: urls.hero ?? "",
        ctaLabel: "Shop Inventory",
        ctaHref: "/inventory",
        ctaLabel2: "Request Pricing",
        ctaHref2: "/find-your-match",
        leadHeading: "Get today's local price",
        leadSubtext: "Tell us what you're looking for and we'll text you current pricing and availability.",
        leadFootnote:
          "What happens next: we'll text you current pricing and availability, then you decide if a showroom visit makes sense. No pressure, no spam.",
      }),
      section("stats", "section-stats", {
        items: ["5★ | Highly rated service", "100% | Out-the-door pricing", "0 | Pressure on our floor", "1 | Visit is all it takes"].join("\n"),
      }),
      section("offercard", "section-offer", {
        eyebrow: "Open year-round in Lakeside",
        heading: "There has never been a better time to buy a hot tub",
        body: "Come see real units running on our floor, talk to the same family that has served East County, and get out-the-door pricing with nothing hidden.",
        bullets: [
          "Working models on the showroom floor — see and feel the jets before you buy",
          "Out-the-door pricing that includes delivery and professional installation",
          "Flexible financing available for all credit types",
          "Local service after the sale from the team that installed it",
        ].join("\n"),
        ctaLabel: "Shop Available Inventory",
        ctaHref: "/inventory",
        ctaLabel2: "Request Pricing",
        ctaHref2: "/find-your-match",
      }),
      section("products", "section-products", {
        eyebrow: "In stock · no waiting",
        heading: "Showroom Selection",
        body: "Explore selected showroom models and ask our team about current availability.",
        limit: "4",
        category: "",
        moreLabel: "See everything in stock",
        moreHref: "/inventory",
        disclaimer: "Subject to credit approval. Terms and availability vary — ask in store for current offers.",
      }),
      section("imagecards", "section-shop", {
        eyebrow: "Find your fit",
        heading: "What are you shopping for?",
        items: [
          `Hot Tubs | Premium hot tubs for relaxation and recovery. | /hot-tubs | ${urls.hotTubs ?? ""}`,
          `Swim Spas | Swim, exercise, and relax year-round in your own backyard. | /swim-spas | ${urls.swimSpas ?? ""}`,
          `Find Your Match | Not sure which fits? Take the 60-second quiz. | /find-your-match | ${urls.match ?? ""}`,
        ].join("\n"),
      }),
      section("reviews", "section-reviews", {
        eyebrow: "Reviews",
        heading: "Customer Reviews",
        items: [
          "Karen | 5 | I've used this supply store for many years as I service my own pool. I've learned to love this team! Joe, David and Paul are all incredibly knowledgeable and helpful. | Google Review | July 2026",
          "Andy | 5 | Worked with owner Joe. Great guy and really helped me out with getting the right hot tub. Can't wait for delivery and set up. Glad to keep business local. | Google Review | July 2026",
          "Meagan | 5 | I have been coming here for about 2 years and have learned so much about pool care! I am never afraid to ask questions and value their expertise! | Google Review | July 2026",
        ].join("\n"),
        aggregate: "4.7 | 48 | Google",
      }),
      section("comparison", "section-why", {
        eyebrow: "Why buy local",
        heading: "Why Choose Us",
        themLabel: "Everyone else",
        body: "We're a family-owned business dedicated to our community.",
        rows: [
          "Try before you buy | Real units on the floor to see and touch | Photos and specs on a screen",
          "Pricing | Out-the-door price in writing | Freight, crane, and setup surprises later",
          "Delivery & setup | Local crew that knows your area | Curbside drop-off — the rest is on you",
          "After the sale | A local team that answers the phone | A 1-800 number and a ticket queue",
        ].join("\n"),
      }),
      section("promise", "section-promise", {
        badgeValue: "100%",
        badgeLabel: "Local promise",
        heading: "Straight answers, no pressure",
        body: "We'd rather earn a neighbor than push a sale. Come in with questions and leave with real numbers — what you do next is up to you.",
        bullets: [
          "Out-the-door pricing in writing",
          "No pressure, no hard sell",
          "Local delivery and setup guidance",
          "Real people after the sale",
        ].join("\n"),
      }),
      section("ctaband", "section-financing", {
        eyebrow: "Easy financing",
        headline: "See Your Financing Options",
        subheadline:
          "Flexible monthly options can make the right spa fit your budget. Check your options in a couple of minutes — asking won't affect your credit.",
        footnote: "Subject to credit approval. Terms and availability vary — ask in store for current offers.",
        ctaLabel: "Check my options",
        ctaHref: "/find-your-match",
        ctaLabel2: "",
        ctaHref2: "",
      }),
      section("gallery", "section-gallery", {
        heading: "On the Lakeside floor",
        images: gallery ?? "",
      }),
      section("visit", "section-visit-band", {
        heading: "Visit the Lakeside showroom",
        body: "12473 Woodside Ave, Suite C. Real Hydropool and DreamMaker units filled and running — stop by Mon–Sat or Sunday until 2.",
        ctaLabel: "Get directions",
        ctaHref: "/visit-us",
      }),
      section("splitcards", "section-visit", {
        eyebrow: "Visit the showroom",
        heading: "Worth the drive",
        items: [
          "See them filled and running | Photos don't tell you how a shell fits your body or how strong the jets are. Ten minutes in the showroom answers what hours of research can't. | /inventory | yes | yes",
          "Talk to people who own them | Our team uses what we sell. Ask about maintenance, water care, and real running costs — you'll get straight answers, not a script. | /visit-us | no | no",
        ].join("\n"),
      }),
      section("steps", "section-steps", {
        eyebrow: "How it works",
        heading: "From first visit to first soak",
        steps: [
          "Come see them in person | Walk the floor, ask questions, and compare models side by side with someone who knows them.",
          "Get your out-the-door price | One number in writing — unit, delivery, and setup — so you can decide with zero guesswork.",
          "We handle the rest | Delivery, placement, and startup guidance, plus a local team you can actually call afterward.",
        ].join("\n"),
      }),
      section("faq", "section-faq", {
        eyebrow: "Got questions?",
        heading: "Good questions to ask",
        items: [
          "How much does a hot tub actually cost? | It depends on size, seating, and insulation — that's why we quote a single out-the-door number that includes delivery and setup, not a teaser price.",
          "What does delivery involve? | We'll help you confirm access, placement, and the pad or surface before scheduling, so delivery day has no surprises.",
          "What do I need to run one at home? | Most spas need a level surface and a dedicated electrical circuit — we'll walk you through exactly what your model needs before you buy.",
          "Can I finance it? | In many cases yes — ask in store and we'll walk you through the current financing options and what they'd look like monthly.",
        ].join("\n"),
      }),
      section("trust", "section-trust", {
        items: [
          "Family-owned since 1978",
          "Lakeside showroom",
          "Out-the-door pricing",
          "4.7★ from 48 Google reviews",
          "Local crew after the sale",
        ].join("\n"),
      }),
      section("bignumber", "section-years", {
        value: "47",
        label: "years serving East County",
        body: "Same family in Lakeside since 1978. The team that sells the spa is the team that answers the phone after delivery.",
      }),
      section("ctaband", "section-final", {
        eyebrow: "",
        headline: "Ready when you are",
        subheadline:
          "Come walk the floor, or start with a quick text — either way you'll get real local pricing without the runaround.",
        footnote: "",
        ctaLabel: "Request Pricing",
        ctaHref: "/find-your-match",
        ctaLabel2: "Text (619) 561-8587",
        ctaHref2: "sms:+16195618587",
      }),
    ],
    integrations: {
      d1: { enabled: false, config: { binding: "", databaseName: "" } },
      r2: { enabled: false, config: { binding: "", bucketName: "" } },
      ghl: { enabled: false, config: {} },
      meta: { enabled: false, config: {} },
      zaraz: { enabled: false, config: { endpoint: "", debug: "" } },
      sentry: { enabled: false, config: { dsn: "", environment: "" } },
    },
  };
}

async function main() {
  log("Preparing operator image pack…");
  const files = await prepareImages();
  log(`Wrote source pack to ${DEST}`);

  const existing = await trpc("clients.list", null);
  let client = existing
    .map(row => row.client)
    .find(row =>
      row.businessName === "Sun Pool & Spa Supply" &&
      row.shortName !== "theme-matrix-qa",
    );
  if (!client) {
    log("Creating Sun Pool demo client…");
    const created = await trpc("clients.createDraft", { businessName: "Sun Pool & Spa Supply" }, "POST");
    client = created.client;
  } else {
    log(`Reusing client ${client.id} (${client.shortName})`);
  }
  const clientId = client.id;
  log(`Client id=${clientId} shortName=${client.shortName}`);

  const uploaded = {};
  const jobs = [
    ["astro", "navLogo", files.logoNav, "Sun Pool & Spa Supply navigation logo", "Live-site wordmark from Cloudflare R2."],
    ["astro", "footerLogo", files.logoFooter, "Sun Pool & Spa Supply footer logo", "Matching footer mark from the live site."],
    ["astro", "inventoryLogo", files.logoInventory, "Sun Pool & Spa Supply inventory logo", "Brand mark used on inventory listings."],
    ["astro", "favicon", files.favicon, "Sun Pool & Spa Supply favicon", "Apple touch icon from the live site."],
    ["astro", "ogImage", files.ogImage, "Hydropool hot tub with blue LED lighting", "Social share image from the live hero."],
    ["astro", "categoryHotTubs", files.hotTubsHero, "Six-person hot tub on the Sun Pool floor", "Hot Tubs category hero from the live site."],
    ["astro", "categorySwimSpas", files.swimSpasHero, "Blue LED swim spa", "Swim Spas category hero from the live site."],
    ["client", "logo", files.logoNav, "Sun Pool & Spa Supply logo", "Client marketing logo."],
    ["client", "hero", files.hero, "Hydropool hot tub with blue LED lighting", "Homepage hero from sunpoolandspasupply.com."],
    ["client", "hotTubs", files.hotTubs, "Six-person showroom hot tub", "Hot tubs marketing photo."],
    ["client", "swimSpas", files.swimSpas, "Blue LED swim spa", "Swim spas marketing photo."],
    ["client", "showroom", files.showroom, "Sun Pool Lakeside storefront", "12473 Woodside Ave storefront."],
    ["client", "product", files.product, "Hydropool Signature 679 Platinum interior", "Floor model from the live inventory."],
    ["client", "delivery", files.delivery, "Family in the Sun Pool showroom", "Showroom lifestyle photo from the live site."],
  ];
  const libraryJobs = [
    [files.match, "Family swimming in a Hydropool AquaTrainer", "Find Your Match lifestyle photo."],
    ...LIBRARY_EXTRAS.map(([name, , alt, description]) => [
      path.join(DEST, "library", name),
      alt,
      description,
    ]),
  ];

  for (const [kind, slot, filePath, alt, description] of jobs) {
    const result = await uploadSlot(clientId, kind, slot, filePath, alt, description);
    uploaded[slot] = result.storageUrl;
  }

  const galleryItems = [];
  for (const [filePath, alt, description] of libraryJobs) {
    const result = await uploadSlot(clientId, "library", "library", filePath, alt, description);
    if (filePath === files.match) uploaded.match = result.storageUrl;
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
      hotTubs: uploaded.hotTubs ?? uploaded.categoryHotTubs,
      swimSpas: uploaded.swimSpas ?? uploaded.categorySwimSpas,
      match: uploaded.match,
      categoryHotTubs: uploaded.categoryHotTubs,
      categorySwimSpas: uploaded.categorySwimSpas,
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
        ADMIN_PASSWORD: "DemoShowroom!1978",
        ADMIN_SESSION_SECRET: "sun-pool-demo-session-secret-1978-lakeside",
      },
    },
    "POST",
  );
  await writeFile(
    path.join(DEST, "launchpad-client.json"),
    JSON.stringify(
      {
        clientId,
        shortName: saved.input?.identity?.shortName ?? "Sun Pool",
        theme: saved.input?.brand?.theme ?? "luxury",
        uploaded,
        galleryCount: galleryItems.length,
      },
      null,
      2,
    ),
    "utf8",
  );
  log(`Saved. Open http://127.0.0.1:3000/workspace/${clientId}`);
  log(`Media: http://127.0.0.1:3000/workspace/${clientId}/configuration?tab=media`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
