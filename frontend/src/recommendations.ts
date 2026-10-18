import { normalizeSearchText } from "./search";

export const HOME_RECOMMENDATION_KEYWORDS = [
  "phone",
  "home decor",
  "kitchen",
  "women fashion",
  "watch",
  "toys",
  "bag",
  "beauty",
  "sports",
  "shoes",
  "electronics",
  "pet supplies",
  "car accessories",
  "jewelry",
  "computer accessories",
] as const;

const MAX_SEARCH_INTERESTS = 20;
const HOME_RECOMMENDATION_QUERY_COUNT = 3;

export type SearchInterests = Record<string, number>;

export function recordSearchInterest(interests: SearchInterests, query: string): SearchInterests {
  const normalized = normalizeSearchText(query).slice(0, 100).trim();
  if (!normalized) return interests;

  const updated = {
    ...interests,
    [normalized]: Math.min(100, (interests[normalized] ?? 0) + 1),
  };
  return Object.fromEntries(
    Object.entries(updated)
      .sort((first, second) => second[1] - first[1])
      .slice(0, MAX_SEARCH_INTERESTS),
  );
}

export function parseSearchInterests(value: string | null): SearchInterests {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([query, count]) => query.length <= 100 && normalizeSearchText(query) === query
          && typeof count === "number" && Number.isFinite(count) && count > 0)
        .map(([query, count]) => [query, Math.min(100, Number(count))] as const)
        .sort((first, second) => second[1] - first[1])
        .slice(0, MAX_SEARCH_INTERESTS),
    ) as SearchInterests;
  } catch {
    return {};
  }
}

export function selectHomeRecommendationQueries(
  interests: SearchInterests,
  random: () => number = Math.random,
): string[] {
  const preferredQuery = Object.entries(interests)
    .filter(([query, count]) => normalizeSearchText(query) === query && count > 0)
    .sort((first, second) => second[1] - first[1])[0]?.[0];
  const categories = HOME_RECOMMENDATION_KEYWORDS.filter((query) => query !== preferredQuery);

  for (let index = categories.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [categories[index], categories[swapIndex]] = [categories[swapIndex], categories[index]];
  }

  return [
    ...(preferredQuery ? [preferredQuery] : []),
    ...categories.slice(0, HOME_RECOMMENDATION_QUERY_COUNT - Number(Boolean(preferredQuery))),
  ];
}
