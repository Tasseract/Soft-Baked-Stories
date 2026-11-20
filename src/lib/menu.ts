export type Option = {
  id: string;
  label: string;
  price: number;
  /** Mix & match boxes: the two flavors (product ids) in this pairing */
  mix?: [string, string];
};

export type Product = {
  id: string;
  name: string;
  description: string;
  image: string;
  category: string;
  options: Option[];
  active?: boolean;
};

/** "S'mores Banana Muffins" → "S'mores Banana", for flavor pickers */
export const flavorName = (name: string) => name.replace(/\s+muffins?$/i, "").trim() || name;

/** The same pairing always gets the same id, whichever flavor was picked first */
export const mixId = (a: string, b: string) => "mix-" + [a, b].sort().join("--");

const DEFAULT_NAMES: Record<string, string> = {
  "choco-lava-muffin": "Choco Lava",
  "carrot-muffin": "Carrot",
  "banana-muffin": "Banana",
  "smores-banana-muffin": "S'mores Banana",
};

function mixOption(a: string, b: string, price: number): Option {
  return { id: mixId(a, b), label: `${DEFAULT_NAMES[a]} + ${DEFAULT_NAMES[b]}`, price, mix: [a, b] };
}

export const isMixProduct = (p: Pick<Product, "options">) => p.options.some((o) => o.mix);

// The original menu: seeds the database and stands in if the database can't be reached
export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: "choco-lava-muffin",
    name: "Choco Lava Muffins",
    description:
      "Rich. Fudgy. Irresistible. Loaded with chocolate chips inside and out for the ultimate chocolate experience.",
    image: "/images/choco-lava-muffin.png",
    category: "Muffins",
    options: [
      { id: "pc", label: "Per piece", price: 55 },
      { id: "box", label: "Box", price: 120 },
    ],
  },
  {
    id: "carrot-muffin",
    name: "Carrot Muffins",
    description:
      "Sweet, creamy, and comforting. A soft carrot muffin crowned with luscious cream cheese frosting for the perfect bakery-style indulgence.",
    image: "/images/carrot-muffin.png",
    category: "Muffins",
    options: [
      { id: "pc", label: "Per piece", price: 75 },
      { id: "box", label: "Box", price: 150 },
    ],
  },
  {
    id: "banana-muffin",
    name: "Banana Muffins",
    description:
      "Classic comfort in every bite. Moist banana cake packed with chocolate chips and finished with crunchy almond slices.",
    image: "/images/banana-muffin.png",
    category: "Muffins",
    options: [
      { id: "pc", label: "Per piece", price: 55 },
      { id: "box", label: "Box", price: 120 },
    ],
  },
  {
    id: "smores-banana-muffin",
    name: "S'mores Banana Muffins",
    description:
      "Soft, fluffy muffin topped with toasted marshmallows, rich chocolate, and crunchy graham bits.",
    image: "/images/smores-banana-muffin.png",
    category: "Muffins",
    options: [
      { id: "pc", label: "Per piece", price: 80 },
      { id: "box", label: "Box", price: 150 },
    ],
  },
  {
    id: "smores-banana-bread",
    name: "S'mores Banana Bread",
    description:
      "Moist and soft banana bread topped with toasted marshmallows, melted chocolate, and crunchy graham pieces for the perfect sweet and gooey bite.",
    image: "/images/smores-banana-bread.png",
    category: "Breads",
    options: [{ id: "loaf", label: "Loaf", price: 185 }],
  },
  {
    id: "banana-bread",
    name: "Banana Bread",
    description:
      "Soft, moist, and freshly baked banana bread made with ripe bananas for a naturally sweet and rich flavor, with a lightly golden crust and a tender, comforting center.",
    image: "/images/banana-bread.png",
    category: "Breads",
    options: [{ id: "loaf", label: "Loaf", price: 120 }],
  },
  {
    id: "mix-and-match-box",
    name: "Mix & Match Box",
    description: "Can't pick just one? Choose two muffin flavors and we'll pack them together in one box.",
    image: "/images/placeholder.svg",
    category: "Muffins",
    options: [
      mixOption("smores-banana-muffin", "banana-muffin", 120),
      mixOption("smores-banana-muffin", "choco-lava-muffin", 120),
      mixOption("smores-banana-muffin", "carrot-muffin", 150),
      mixOption("carrot-muffin", "banana-muffin", 120),
      mixOption("carrot-muffin", "choco-lava-muffin", 120),
    ],
  },
];

export function findOption(products: Product[], productId: string, optionId: string) {
  const product = products.find((p) => p.id === productId);
  const option = product?.options.find((o) => o.id === optionId);
  return product && option ? { product, option } : null;
}

export const peso = (n: number) =>
  "₱" + n.toLocaleString("en-PH", { maximumFractionDigits: 2 });

export const PLACEHOLDER_IMAGE = "/images/placeholder.svg";

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

