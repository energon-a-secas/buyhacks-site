// ── Product data extracted from lucianoadonis.github.io/pages/shopping.md ────
const IMG = "https://minibooks.lucianoadonis.com/images/shopping";

export const PRODUCTS = [
  // ── Organization ──────────────────────────────────────────────────────────
  {
    id: 1, slug: "label-maker",
    name: "Label Maker", brand: "Brother P-Touch PTH110",
    category: "organization",
    tags: ["labels", "organization", "containers"],
    description: "Perfect for categorizing and keeping things in order.",
    image: `${IMG}/label-maker.png`,
    tips: [
      "Letters and symbols can be personalized with borders.",
      "Variety of colors available.",
      "Can do wonders for organizing Food Storage Containers.",
      "Some tapes can be added to clothes.",
    ],
    note: "There is a slight tape waste between prints; more of a product issue than a configuration problem.",
    verdict: "recommended",
  },
  {
    id: 2, slug: "transparent-boxes",
    name: "Transparent Boxes", brand: "Wenco",
    category: "organization",
    tags: ["storage", "organization", "containers"],
    description: "Clear boxes so you can see what's inside without opening them.",
    image: `${IMG}/plastic-box-wenco.png`,
    tips: [
      "Even with transparent boxes, labels are a game-changer when stacked or stored at angles.",
    ],
    verdict: "recommended",
  },

  // ── Cleaning & Lifestyle ──────────────────────────────────────────────────
  {
    id: 3, slug: "air-fryer",
    name: "Air Fryer", brand: "Instant Vortex Mini",
    category: "cleaning-lifestyle",
    tags: ["kitchen", "cooking", "appliance"],
    description: "Can revive bread and make it feel fresh. What else do you want?",
    image: `${IMG}/instant-vortex-mini-air-fryer.png`,
    tips: [
      "Incredible for frying other foods too.",
    ],
    verdict: "recommended",
  },
  {
    id: 4, slug: "cordless-vacuum",
    name: "Cordless Vacuum", brand: "Eufy S11",
    category: "cleaning-lifestyle",
    tags: ["cleaning", "vacuum", "cordless"],
    description: "Freedom from cords. Straightforward cleaning.",
    image: `${IMG}/eufy-cordless-vacuum-s11.png`,
    tips: [
      "Cleaning the dirt from the container is straightforward.",
      "Double filters for better air quality.",
      "More than enough for most needs.",
    ],
    verdict: "recommended",
  },
  {
    id: 5, slug: "robot-vacuum",
    name: "Robot Vacuum", brand: "Eufy Twin Turbo X8",
    category: "cleaning-lifestyle",
    tags: ["cleaning", "vacuum", "robot", "smart-home"],
    description: "Multiple options; comes down to what you need.",
    image: `${IMG}/eufy-twin-turbo-x8.png`,
    tips: [
      "If you have a pet, you'll need a bigger dust container (over $200).",
      "Laser navigation helps a lot in big open spaces.",
    ],
    verdict: "recommended",
  },
  {
    id: 6, slug: "smart-scale",
    name: "Smart Scale", brand: "Eufy Smart Scale",
    category: "cleaning-lifestyle",
    tags: ["health", "fitness", "tracking"],
    description: "Detailed metrics about your body — fat, muscle, water, and more.",
    image: `${IMG}/eufy-scale.png`,
    tips: [
      "Syncs with your phone via the Eufy Health App.",
      "Track history and progress over time.",
      "Supports multiple user profiles.",
    ],
    verdict: "recommended",
  },
  {
    id: 7, slug: "kindle",
    name: "E-Reader", brand: "Kindle",
    category: "cleaning-lifestyle",
    tags: ["reading", "books", "portable"],
    description: "Easy on the eyes and offers a ton of convenience.",
    image: `${IMG}/kindle.png`,
    tips: [
      "The book you're reading shows up as the cover.",
      "Battery lasts a long time.",
      "Upload documents and convert them to EPUB.",
      "In Latin America, contact support to enable cover display or pay to remove ads.",
    ],
    verdict: "recommended",
  },

  // ── Work Tech ─────────────────────────────────────────────────────────────
  {
    id: 8, slug: "magic-trackpad",
    name: "Magic Trackpad", brand: "Apple",
    category: "work-tech",
    tags: ["mouse", "trackpad", "mac", "productivity"],
    description: "Large surface area for comfortable use and multi-touch gestures.",
    image: `${IMG}/apple-trackpad.png`,
    tips: [
      "Great for drawing on a shared screen.",
    ],
    verdict: "recommended",
  },
  {
    id: 9, slug: "airpods-pro",
    name: "AirPods Pro 2nd Gen", brand: "Apple",
    category: "work-tech",
    tags: ["headphones", "audio", "noise-cancellation", "wireless"],
    description: "No cords. Transparency mode. Excellent noise cancellation.",
    image: `${IMG}/airpods-pro-second-generation.png`,
    tips: [
      "Transparency feature lets you listen to music comfortably.",
      "Noise cancellation is excellent for focusing.",
    ],
    verdict: "recommended",
  },
  {
    id: 10, slug: "curved-monitor",
    name: "Curved Monitor 34\"", brand: "Samsung Ultrawide",
    category: "work-tech",
    tags: ["monitor", "ultrawide", "productivity", "desk"],
    description: "You won't work at the same level with just one screen.",
    image: `${IMG}/curved-monitor-samsung-ultrawide.png`,
    tips: [
      "Curved design reduces eye strain.",
      "Ultrawide is great for multitasking and side-by-side coding.",
      "Reduces the need for multiple monitors, saving desk space.",
    ],
    verdict: "recommended",
  },
  {
    id: 11, slug: "laser-printer",
    name: "Laser Printer", brand: "HP Neverstop 1200W",
    category: "work-tech",
    tags: ["printer", "laser", "office"],
    description: "The best choice if you're tired of unreliable printers.",
    image: `${IMG}/laser-printer-hp-neverstop.png`,
    tips: [
      "Uses toner (powder), not ink — more durable, no dried-out cartridges.",
      "Thousands of pages per toner refill.",
      "No color, but you won't miss it unless printing kids' homework.",
      "Extra paper storage container keeps pages dust-free.",
    ],
    verdict: "recommended",
  },
  {
    id: 12, slug: "magnetic-cables",
    name: "Magnetic Charging Cables", brand: "Ankndo",
    category: "work-tech",
    tags: ["cables", "charging", "usb", "accessories"],
    description: "One cable to rule them all — magnetic tips for Micro USB, USB-C, and Lightning.",
    image: `${IMG}/magnetic-cables.png`,
    tips: [
      "Standardize charging for multiple devices.",
      "Multiple cable lengths and tip types included.",
      "Perfect for less tech-savvy users — no fiddling with different cables.",
    ],
    verdict: "recommended",
  },

  // ── Specific But Useful ───────────────────────────────────────────────────
  {
    id: 13, slug: "dji-om5",
    name: "Smartphone Gimbal", brand: "DJI OM 5",
    category: "specific-useful",
    tags: ["gimbal", "camera", "video", "stabilizer"],
    description: "Selfie stick on steroids — smartphone gimbal stabilizer.",
    image: `${IMG}/dji-om-5.png`,
    tips: [
      "Triple motors for ultra-smooth recordings.",
      "Built-in extension rod and base for group pictures.",
      "Smart gesture recognition via the app.",
      "Dynamic automatic tracking keeps you in frame.",
    ],
    verdict: "recommended",
  },

  // ── AliExpress Finds ──────────────────────────────────────────────────────
  {
    id: 14, slug: "foam-dispenser",
    name: "Foam Washing Machine", brand: "AliExpress",
    category: "aliexpress",
    tags: ["cleaning", "soap", "bathroom"],
    description: "Forget soap dispensers — the foam dispenser works perfectly.",
    image: `${IMG}/aliexpress-foam-machine.png`,
    tips: [
      "Much less hassle than traditional soap dispensers.",
    ],
    verdict: "recommended",
  },
  {
    id: 15, slug: "solar-light",
    name: "Garage Solar Light", brand: "Amaryllis",
    category: "aliexpress",
    tags: ["lighting", "solar", "garage", "outdoor"],
    description: "Exceeded expectations. Works better than imagined.",
    image: `${IMG}/amaryllis-solar-light.png`,
    tips: [],
    verdict: "recommended",
  },
  {
    id: 16, slug: "rechargeable-lights",
    name: "Rechargeable Hallway Lights", brand: "AliExpress",
    category: "aliexpress",
    tags: ["lighting", "rechargeable", "hallway"],
    description: "No more bumping into furniture in the dark.",
    image: null,
    tips: [
      "Pair with Magnetic Charging Cables (Ankndo) for easy recharging.",
    ],
    verdict: "recommended",
  },
  {
    id: 17, slug: "extendable-arm",
    name: "Extendable Arm", brand: "AliExpress",
    category: "aliexpress",
    tags: ["mount", "phone", "tablet", "desk"],
    description: "Versatile and adjustable arm for mounting devices or accessories.",
    image: `${IMG}/aliexpress-extendable-arm.png`,
    tips: [
      "Useful for holding phones, tablets, or small cameras.",
      "Clamps to desks, tables, or other surfaces.",
    ],
    verdict: "recommended",
  },
  {
    id: 18, slug: "coin-cutter",
    name: "Coin Cutter", brand: "AliExpress",
    category: "aliexpress",
    tags: ["tools", "cutter", "utility"],
    description: "Convenient for opening boxes and other things.",
    image: `${IMG}/aliexpress-coin-cutter.png`,
    tips: [],
    verdict: "recommended",
  },

  // ── House Tools & Items ───────────────────────────────────────────────────
  {
    id: 19, slug: "cordless-screwdriver",
    name: "Cordless Screwdriver", brand: "Makita",
    category: "house-tools",
    tags: ["tools", "screwdriver", "cordless", "diy"],
    description: "Like a first aid kit, but for furniture and anything with screws.",
    image: `${IMG}/makita-cordless-screwdriver.png`,
    tips: [
      "Battery lasts a long time.",
      "Not a huge investment and your hands will thank you.",
    ],
    verdict: "recommended",
  },
  {
    id: 20, slug: "screwdriver-set",
    name: "Screwdriver Set", brand: "Ugreen",
    category: "house-tools",
    tags: ["tools", "screwdriver", "precision"],
    description: "Simple and efficient. The spring mechanism is quite amazing.",
    image: `${IMG}/ugreen-screwdriver-set.png`,
    tips: [
      "38 tips included for every situation.",
    ],
    verdict: "recommended",
  },
  {
    id: 21, slug: "coolguard-paint",
    name: "CoolGuard Paint", brand: "CoolGuard",
    category: "house-tools",
    tags: ["paint", "roof", "temperature", "home"],
    description: "Roof paint that reduces temperatures by up to 15 C.",
    image: null,
    tips: [
      "One coat lowers perceived heat inside rooms.",
      "Decreases indoor temperature by 4 C compared to outside at 32 C.",
    ],
    verdict: "recommended",
  },

  // ── Tried But... (mixed/skip) ─────────────────────────────────────────────
  {
    id: 22, slug: "stream-deck",
    name: "Stream Deck MK.2", brand: "Elgato",
    category: "tried-but",
    tags: ["gadget", "streaming", "automation", "productivity"],
    description: "Cool gadget, but not that useful unless you're into gaming or streaming.",
    image: `${IMG}/elgato-streamdeck-mk2.png`,
    tips: [
      "Customize buttons with themes and assign tasks.",
      "Often more effective to simplify your workflow instead.",
    ],
    verdict: "mixed",
  },
  {
    id: 23, slug: "cololight-strip",
    name: "ColoLight Strip", brand: "LifeSmart",
    category: "tried-but",
    tags: ["lighting", "led", "smart-home", "decor"],
    description: "Good product if you like lights and bright colors, but it isn't for everyone.",
    image: `${IMG}/lifesmart-cololight-strip.png`,
    tips: [
      "Extensible — no welding needed, uses defined connectors.",
    ],
    note: "Price is high but understandable.",
    verdict: "mixed",
  },
  {
    id: 24, slug: "drone-mavic-air",
    name: "Drone", brand: "DJI Mavic Air 1 Fly More Combo",
    category: "tried-but",
    tags: ["drone", "camera", "outdoor", "video"],
    description: "Great gadget for outdoor enthusiasts — if you actually go outside.",
    image: null,
    tips: [
      "Three batteries provide ~30 minutes total flight time.",
      "Wind and battery health reduce actual flight time.",
      "Recording quality is excellent.",
    ],
    verdict: "mixed",
  },
];

export const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "organization", label: "Organization" },
  { id: "cleaning-lifestyle", label: "Cleaning & Lifestyle" },
  { id: "work-tech", label: "Work Tech" },
  { id: "specific-useful", label: "Specific But Useful" },
  { id: "aliexpress", label: "AliExpress Finds" },
  { id: "house-tools", label: "House Tools" },
  { id: "tried-but", label: "Tried But..." },
];

export const VERDICT_LABELS = {
  recommended: "Recommended",
  mixed: "Mixed Feelings",
  skip: "Skip",
};

/** Find related products by tag intersection (min 2 shared tags). */
export function getRelatedProducts(slug) {
  const product = PRODUCTS.find((p) => p.slug === slug);
  if (!product) return [];
  return PRODUCTS
    .filter((p) => p.slug !== slug)
    .map((p) => ({
      ...p,
      shared: p.tags.filter((t) => product.tags.includes(t)).length,
    }))
    .filter((p) => p.shared >= 2)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, 3);
}
