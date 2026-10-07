import type { ApiCategory, ApiProduct } from "./api";

const STOP_WORDS = new Set([
  "а", "без", "бы", "в", "во", "для", "до", "же", "за", "и", "из", "или", "к", "как", "ли",
  "на", "над", "не", "ни", "но", "о", "об", "от", "по", "под", "при", "про", "с", "со", "у",
  "что", "это", "устройство", "the", "a", "an", "and", "or", "for", "from", "in", "into", "is", "of", "on",
  "s", "to", "with", "uchun", "bilan", "dan", "ga", "ni", "ning", "va", "yoki", "bu", "shu", "ham",
]);

const SYNONYMS: Record<string, string> = {
  "мужчина": "мужской",
  "мужчины": "мужской",
  "мужчин": "мужской",
  "мужчине": "мужской",
  "мужчиной": "мужской",
  "мужчинам": "мужской",
  "мужская": "мужской",
  "мужские": "мужской",
  "мужского": "мужской",
  "мужскому": "мужской",
  "мужскую": "мужской",
  "men": "мужской",
  "mens": "мужской",
  "erkak": "мужской",
  "erkaklar": "мужской",
  "erkakning": "мужской",
  "erkaklarni": "мужской",
  "erkaklarga": "мужской",
  "erkaklarda": "мужской",
  "женщина": "женский",
  "женщины": "женский",
  "женская": "женский",
  "женские": "женский",
  "женскую": "женский",
  "женского": "женский",
  "women": "женский",
  "womens": "женский",
  "female": "женский",
  "ayol": "женский",
  "ayollar": "женский",
  "ayollarni": "женский",
  "ayollarga": "женский",
  "куртки": "куртка",
  "куртку": "куртка",
  "курткой": "куртка",
  "jacket": "куртка",
  "jackets": "куртка",
  "coat": "куртка",
  "coats": "куртка",
  "пальто": "куртка",
  "курток": "куртка",
  "обувь": "обувь",
  "ботинки": "обувь",
  "ботинок": "обувь",
  "кроссовки": "обувь",
  "кроссовка": "обувь",
  "кеды": "обувь",
  "сапоги": "обувь",
  "туфли": "обувь",
  "shoes": "обувь",
  "shoe": "обувь",
  "sneakers": "обувь",
  "sneaker": "обувь",
  "boots": "обувь",
  "footwear": "обувь",
  "oyoq": "обувь",
  "poyabzal": "обувь",
  "телефон": "телефон",
  "телефоны": "телефон",
  "смартфон": "телефон",
  "смартфоны": "телефон",
  "мобильный": "телефон",
  "phone": "телефон",
  "phones": "телефон",
  "smartphone": "телефон",
  "smartphones": "телефон",
  "mobile": "телефон",
  "telefon": "телефон",
  "айфон": "iphone",
  "iphone": "iphone",
  "айфона": "iphone",
  "чехол": "case",
  "чехлы": "case",
  "чехла": "case",
  "чехле": "case",
  "чехлов": "case",
  "чехлом": "case",
  "чехлах": "case",
  "chexol": "case",
  "gilof": "case",
  "g'ilof": "case",
  "наушники": "headphones",
  "наушник": "headphones",
  "quloqchin": "headphones",
  "quloqchinlar": "headphones",
  "зарядка": "charger",
  "зарядное": "charger",
  "zaryadlovchi": "charger",
  "zaryad": "charger",
  "повербанк": "powerbank",
  "повербанки": "powerbank",
  "powerbank": "powerbank",
  "платье": "платье",
  "платья": "платье",
  "платьев": "платье",
  "dress": "платье",
  "dresses": "платье",
  "koylak": "платье",
  "koylaklar": "платье",
  "джинсы": "джинсы",
  "джинсов": "джинсы",
  "jeans": "джинсы",
  "сумка": "сумка",
  "сумки": "сумка",
  "сумок": "сумка",
  "рюкзак": "сумка",
  "рюкзаки": "сумка",
  "bag": "сумка",
  "bags": "сумка",
  "backpack": "сумка",
  "backpacks": "сумка",
  "косметика": "косметика",
  "крем": "косметика",
  "кремы": "косметика",
  "макияж": "косметика",
  "cosmetics": "косметика",
  "makeup": "косметика",
  "skincare": "косметика",
  "часы": "часы",
  "часов": "часы",
  "watch": "часы",
  "watches": "часы",
  "soat": "часы",
  "telefonlar": "телефон",
  "telefonni": "телефон",
  "oyoqkiyim": "обувь",
  "oyoqkiyimlar": "обувь",
  "krossovka": "обувь",
  "krossovkalar": "обувь",
  "sumka": "сумка",
  "sumkalar": "сумка",
  "kosmetika": "косметика",
  "soatlar": "часы",
  "зима": "qish",
  "зиму": "qish",
  "зимой": "qish",
  "зимний": "qish",
  "зимняя": "qish",
  "зимнее": "qish",
  "зимние": "qish",
  "зимнего": "qish",
  "зимнюю": "qish",
  "зимних": "qish",
  "зимним": "qish",
  "зимнему": "qish",
  "winter": "qish",
  "winters": "qish",
  "qishki": "qish",
  "qishda": "qish",
  "qishni": "qish",
  "qishga": "qish",
  "qishning": "qish",
  "kurtkalar": "kurtka",
  "kurtkani": "kurtka",
  "kurtkaga": "kurtka",
  "kurtkalarini": "kurtka",
  "kurtkadan": "kurtka",
};

const RUSSIAN_SUFFIXES = [
  "иями", "ями", "ами", "ого", "ему", "ыми", "ими", "ее", "ие", "ые", "ое", "ей", "ий", "ый",
  "ой", "ем", "ам", "ом", "ах", "ях", "ия", "ья", "ию", "ью", "ая", "яя", "ую", "юю", "ою",
  "ею", "ов", "ев", "ом", "ем", "ы", "и", "а", "я", "у", "ю", "е", "о", "ь",
];
const UZBEK_SUFFIXES = [
  "larining", "laridan", "lardan", "larning", "ingiz", "imiz", "larni", "ning", "dagi",
  "den", "tan", "ten", "lar", "ler", "dan", "ni", "ga", "ka", "qa", "da", "ta", "lik",
  "chi", "siz", "li", "ki",
];
const MARKETPLACE_QUERY_TERMS: Record<string, string> = {
  мужчина: "men",
  мужчины: "men",
  мужчин: "men",
  мужчине: "men",
  мужчиной: "men",
  мужчинам: "men",
  мужская: "men",
  мужские: "men",
  мужской: "men",
  мужскую: "men",
  мужского: "men",
  men: "men",
  mens: "men",
  erkak: "men",
  erkaklar: "men",
  erkaklarni: "men",
  erkaklarga: "men",
  женщина: "women",
  женщины: "women",
  женская: "women",
  женские: "women",
  женский: "women",
  женскую: "women",
  women: "women",
  womens: "women",
  ayol: "women",
  ayollar: "women",
  ayollarni: "women",
  куртка: "jacket",
  куртки: "jacket",
  куртку: "jacket",
  курткой: "jacket",
  курток: "jacket",
  kurtka: "jacket",
  kurtkalar: "jacket",
  kurtkani: "jacket",
  kurtkaga: "jacket",
  kurtkalarini: "jacket",
  jacket: "jacket",
  jackets: "jacket",
  coat: "coat",
  coats: "coat",
  пальто: "coat",
  зима: "winter",
  зиму: "winter",
  зимой: "winter",
  зимний: "winter",
  зимняя: "winter",
  зимнее: "winter",
  зимние: "winter",
  зимнюю: "winter",
  зимних: "winter",
  зимним: "winter",
  зимнему: "winter",
  winter: "winter",
  qish: "winter",
  qishki: "winter",
  qishda: "winter",
  qishni: "winter",
  qishga: "winter",
  qishning: "winter",
  kiyim: "clothing",
  kiyimlar: "clothing",
  одежда: "clothing",
  одежду: "clothing",
  clothing: "clothing",
  telefon: "phone",
  telefonlar: "phone",
  koylak: "dress",
  koylaklar: "dress",
  sumka: "bag",
  sumkalar: "bag",
  poyabzal: "shoes",
  oyoqkiyim: "shoes",
  oyoqkiyimlar: "shoes",
  krossovka: "sneakers",
  krossovkalar: "sneakers",
  soat: "watch",
  soatlar: "watch",
  kosmetika: "cosmetics",
  обувь: "shoes",
  ботинки: "shoes",
  кроссовки: "sneakers",
  кеды: "sneakers",
  сапоги: "boots",
  туфли: "shoes",
  shoes: "shoes",
  shoe: "shoes",
  sneakers: "sneakers",
  sneaker: "sneakers",
  boots: "boots",
  обуви: "shoes",
  смартфон: "smartphone",
  смартфоны: "smartphone",
  телефон: "phone",
  телефоны: "phone",
  айфон: "iphone",
  айфона: "iphone",
  чехол: "phone case",
  чехлы: "phone case",
  чехла: "phone case",
  чехле: "phone case",
  чехлов: "phone case",
  чехлом: "phone case",
  чехлах: "phone case",
  chexol: "phone case",
  gilof: "phone case",
  "g'ilof": "phone case",
  наушники: "headphones",
  наушник: "headphones",
  quloqchin: "headphones",
  quloqchinlar: "headphones",
  зарядка: "charger",
  зарядное: "charger",
  zaryadlovchi: "charger",
  zaryad: "charger",
  повербанк: "power bank",
  повербанки: "power bank",
  powerbank: "power bank",
  mobile: "phone",
  mobiles: "phone",
  phone: "phone",
  phones: "phone",
  smartphone: "smartphone",
  smartphones: "smartphone",
  платье: "dress",
  платья: "dress",
  dress: "dress",
  dresses: "dress",
  юбка: "skirt",
  юбки: "skirt",
  skirt: "skirt",
  skirts: "skirt",
  джинсы: "jeans",
  jeans: "jeans",
  брюки: "pants",
  pants: "pants",
  trousers: "pants",
  сумка: "bag",
  сумки: "bag",
  bag: "bag",
  bags: "bag",
  рюкзак: "backpack",
  рюкзаки: "backpack",
  backpack: "backpack",
  backpacks: "backpack",
  косметика: "cosmetics",
  макияж: "makeup",
  cosmetics: "cosmetics",
  makeup: "makeup",
  часы: "watch",
  watch: "watch",
  watches: "watch",
};

export type ProductSearchMatch = { product: ApiProduct; score: number; matchedTokens: number };

export function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/ё/g, "е")
    .replace(/['’`ʻʼ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeToken(token: string): string {
  const normalized = normalizeSearchText(token);
  if (!normalized) return "";
  const synonym = SYNONYMS[normalized];
  if (synonym) return synonym === normalized ? normalized : normalizeToken(synonym);

  if (/[а-я]/.test(normalized)) {
    const suffix = RUSSIAN_SUFFIXES.find((ending) => normalized.endsWith(ending) && normalized.length - ending.length >= 3);
    return suffix ? normalized.slice(0, -suffix.length) : normalized;
  }
  const suffix = UZBEK_SUFFIXES.find((ending) => normalized.endsWith(ending) && normalized.length - ending.length >= 3);
  return suffix ? normalized.slice(0, -suffix.length) : normalized;
}

export function tokenizeSearchText(value: string): string[] {
  return normalizeSearchText(value)
    .split(" ")
    .filter((token) => token && !STOP_WORDS.has(token))
    .map(normalizeToken)
    .filter(Boolean);
}

export function prepareMarketplaceQuery(value: string): string {
  const tokens = normalizeSearchText(value)
    .split(" ")
    .filter((token) => token && !STOP_WORDS.has(token))
    .map((token) => MARKETPLACE_QUERY_TERMS[token] ?? token);
  return tokens.join(" ");
}

function editDistanceAtMostTwo(first: string, second: string): number {
  if (first === second) return 0;
  if (Math.abs(first.length - second.length) > 2) return 3;
  let previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let row = 1; row <= first.length; row += 1) {
    const current = [row];
    let rowMinimum = row;
    for (let column = 1; column <= second.length; column += 1) {
      const cost = first[row - 1] === second[column - 1] ? 0 : 1;
      current[column] = Math.min(current[column - 1] + 1, previous[column] + 1, previous[column - 1] + cost);
      rowMinimum = Math.min(rowMinimum, current[column]);
    }
    if (rowMinimum > 2) return 3;
    previous = current;
  }
  return previous[second.length];
}

function tokensMatch(queryToken: string, fieldToken: string): boolean {
  if (queryToken === fieldToken) return true;
  if (Math.min(queryToken.length, fieldToken.length) >= 3
    && (queryToken.startsWith(fieldToken) || fieldToken.startsWith(queryToken))) return true;
  return Math.min(queryToken.length, fieldToken.length) >= 6 && editDistanceAtMostTwo(queryToken, fieldToken) <= 1;
}

function categorySearchText(product: ApiProduct, categories: ApiCategory[]): string {
  const names = [product.category?.nameRu, product.category?.nameUz];
  const visited = new Set<string>();
  let parentId = product.category?.parentId;
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = categories.find((category) => category.id === parentId);
    if (!parent) break;
    names.push(parent.nameRu, parent.nameUz);
    parentId = parent.parentId;
  }
  return names.filter(Boolean).join(" ");
}

function fieldTokens(value: string | null | undefined): string[] {
  return value ? tokenizeSearchText(value) : [];
}

export function productPopularity(product: ApiProduct): number {
  const match = product.orders?.toLocaleLowerCase().match(/[\d,.]+\s*[kкм]?/);
  if (!match) return 0;
  const count = Number(match[0].replace(/[,\s]/g, "").replace(/[kкм]$/i, "")) || 0;
  return /[kк]$/i.test(match[0]) ? count * 1000 : /м$/i.test(match[0]) ? count * 1_000_000 : count;
}

export function scoreProductSearch(
  product: ApiProduct,
  query: string,
  categories: ApiCategory[] = [],
  allowPartialMatches = false,
): ProductSearchMatch | null {
  const queryTokens = [...new Set(tokenizeSearchText(query))];
  if (!queryTokens.length) return query.trim() ? null : { product, score: 0, matchedTokens: 0 };

  const fields = [
    { weight: 10, tokens: fieldTokens(`${product.titleRu ?? ""} ${product.titleUz}`) },
    { weight: 5, tokens: fieldTokens(categorySearchText(product, categories)) },
    { weight: 3, tokens: fieldTokens(product.brandName) },
    { weight: 2, tokens: fieldTokens(product.attributes) },
    { weight: 1, tokens: fieldTokens(`${product.descriptionRu ?? ""} ${product.descriptionUz ?? ""}`) },
  ];

  let score = 0;
  let matchedTokens = 0;
  for (const queryToken of queryTokens) {
    let tokenScore = 0;
    let matchedTitle = false;
    for (const [fieldIndex, field] of fields.entries()) {
      const matches = field.tokens.some((fieldToken) => allowPartialMatches && fieldIndex === 0
        ? queryToken === fieldToken
          || (Math.min(queryToken.length, fieldToken.length) >= 3
            && (queryToken.startsWith(fieldToken) || fieldToken.startsWith(queryToken)))
          || (Math.min(queryToken.length, fieldToken.length) >= 6 && editDistanceAtMostTwo(queryToken, fieldToken) <= 1)
        : tokensMatch(queryToken, fieldToken));
      if (fieldIndex === 0 && matches) matchedTitle = true;
      if (matches) {
        tokenScore = Math.max(tokenScore, field.weight);
      }
    }
    if (allowPartialMatches && !matchedTitle) tokenScore = 0;
    if (tokenScore) {
      matchedTokens += 1;
      score += tokenScore;
      if (allowPartialMatches) score += Math.min(queryToken.length, 12) / 10;
    }
  }

  const requiredMatches = allowPartialMatches
    ? 1
    : queryTokens.length <= 2 ? queryTokens.length : Math.ceil(queryTokens.length * 0.75);
  if (matchedTokens < requiredMatches || product.inStock === false) return null;
  if (product.inStock === true) score += 0.25;
  if (!allowPartialMatches) score += Math.min(Math.log10(productPopularity(product) + 1), 5) / 100;

  return { product, score, matchedTokens };
}

export function searchProducts(products: ApiProduct[], query: string, categories: ApiCategory[] = []): ApiProduct[] {
  return products
    .map((product, index) => ({ match: scoreProductSearch(product, query, categories), index }))
    .filter((entry): entry is { match: ProductSearchMatch; index: number } => entry.match !== null)
    .sort((first, second) => second.match.score - first.match.score || first.index - second.index)
    .map(({ match }) => match.product);
}

export function searchSimilarProducts(products: ApiProduct[], query: string, categories: ApiCategory[] = []): ApiProduct[] {
  return products
    .map((product, index) => ({ match: scoreProductSearch(product, query, categories, true), index }))
    .filter((entry): entry is { match: ProductSearchMatch; index: number } => entry.match !== null)
    .sort((first, second) =>
      second.match.matchedTokens - first.match.matchedTokens
      || second.match.score - first.match.score
      || first.index - second.index
    )
    .map(({ match }) => match.product);
}

export function suggestCategories(categories: ApiCategory[], query: string): ApiCategory[] {
  const queryTokens = [...new Set(tokenizeSearchText(query))];
  if (!queryTokens.length) return [];
  const ranked = categories
    .map((category, index) => {
      const path = [category];
      const visited = new Set([category.id]);
      let parentId = category.parentId;
      while (parentId && !visited.has(parentId)) {
        visited.add(parentId);
        const parent = categories.find((item) => item.id === parentId);
        if (!parent) break;
        path.unshift(parent);
        parentId = parent.parentId;
      }
      const categoryTokens = tokenizeSearchText(path.map((item) => `${item.nameRu} ${item.nameUz}`).join(" "));
      const matched = queryTokens.filter((token) => categoryTokens.some((candidate) => tokensMatch(token, candidate))).length;
      return { category, index, matched };
    })
    .filter((entry) => entry.matched > 0)
    .sort((first, second) => second.matched - first.matched || first.index - second.index);
  const bestMatch = ranked[0]?.matched ?? 0;
  return ranked
    .filter((entry) => entry.matched === bestMatch)
    .slice(0, 4)
    .map(({ category }) => category);
}

export function inferMarketplaceCategoryId(query: string, categories: ApiCategory[]): string | undefined {
  const queryTokens = new Set(tokenizeSearchText(query));
  const jacketTokens = new Set(tokenizeSearchText("куртка jacket"));
  if (![...queryTokens].some((token) => jacketTokens.has(token))) return undefined;

  const maleTokens = new Set(tokenizeSearchText("мужской men erkak"));
  const femaleTokens = new Set(tokenizeSearchText("женский women ayol"));
  const wantsMen = [...queryTokens].some((token) => maleTokens.has(token));
  const wantsWomen = [...queryTokens].some((token) => femaleTokens.has(token));
  if (wantsMen === wantsWomen) return undefined;

  const candidates = categories.flatMap((category, index) => {
    const name = normalizeSearchText(`${category.nameRu} ${category.nameUz}`);
    if (!/(coat|jacket|куртк|пальто)/i.test(name)) return [];

    const path = [category];
    const visited = new Set([category.id]);
    let parentId = category.parentId;
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = categories.find((item) => item.id === parentId);
      if (!parent) break;
      path.unshift(parent);
      parentId = parent.parentId;
    }
    const pathTokens = new Set(tokenizeSearchText(path.map((item) => `${item.nameRu} ${item.nameUz}`).join(" ")));
    if (wantsMen && ![...pathTokens].some((token) => maleTokens.has(token))) return [];
    if (wantsWomen && ![...pathTokens].some((token) => femaleTokens.has(token))) return [];
    const directMatches = tokenizeSearchText(`${category.nameRu} ${category.nameUz}`)
      .filter((token) => jacketTokens.has(token)).length;
    return [{ category, depth: path.length, directMatches, index }];
  });

  return candidates
    .sort((first, second) =>
      second.directMatches - first.directMatches
      || second.depth - first.depth
      || first.index - second.index,
    )[0]?.category.id;
}

const NOISE_PHRASES = [
  /\b(?:free shipping|fast shipping|free delivery|wholesale|dropshipping|hot sale|flash sale|new arrival|official store|aliexpress)\b/gi,
  /\b(?:premium|top quality|high quality|best quality)\b/gi,
  /(?:бесплатная доставка|быстрая доставка|оптом|горячая распродажа|официальный магазин|новинка 20\d{2})/gi,
  /(?:送料無料|速卖通|批发|热卖)/gu,
];

export function productCardTitle(title: string, maxLength = 60): string {
  let clean = title;
  for (const phrase of NOISE_PHRASES) clean = clean.replace(phrase, " ");
  clean = clean
    .replace(/\b(?:202[0-9]|2030)\b/g, " ")
    .replace(/[|【】[\]{}<>]+/g, " ")
    .replace(/\s*[-–—,:;]+\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const seenTokens = new Set<string>();
  clean = clean.split(" ").filter((word) => {
    const normalizedWord = normalizeSearchText(word);
    if (!normalizedWord || STOP_WORDS.has(normalizedWord)) return false;
    const canonicalTokens = tokenizeSearchText(word);
    const canonicalWord = canonicalTokens.join(" ");
    if (canonicalWord && seenTokens.has(canonicalWord)) return false;
    if (canonicalWord) seenTokens.add(canonicalWord);
    return true;
  }).join(" ");
  if (Array.from(clean).length <= maxLength) return clean;
  const shortened = Array.from(clean).slice(0, maxLength + 1).join("");
  const wordBoundary = shortened.lastIndexOf(" ");
  return `${(wordBoundary > maxLength * 0.55 ? shortened.slice(0, wordBoundary) : shortened.slice(0, maxLength)).trim()}…`;
}
