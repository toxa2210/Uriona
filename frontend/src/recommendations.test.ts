import { describe, expect, it } from "vitest";
import { parseSearchInterests, recordSearchInterest, selectHomeRecommendationQueries } from "./recommendations";

describe("homepage recommendations", () => {
  it("records repeated searches with normalized query text", () => {
    const first = recordSearchInterest({}, "  Телефон  ");
    const second = recordSearchInterest(first, "телефон");

    expect(second).toEqual({ телефон: 2 });
  });

  it("prioritizes the most frequently searched term and mixes other categories", () => {
    const interests = { phone: 1, "home decor": 4 };
    const queries = selectHomeRecommendationQueries(interests, () => 0);

    expect(queries).toHaveLength(3);
    expect(queries[0]).toBe("home decor");
    expect(new Set(queries).size).toBe(3);
    expect(queries.filter((query) => query in interests)).toHaveLength(1);
  });

  it("returns random distinct categories when there is no search history", () => {
    const queries = selectHomeRecommendationQueries({}, () => 0);

    expect(queries).toHaveLength(3);
    expect(new Set(queries).size).toBe(3);
  });

  it("bounds persisted query lengths and counters", () => {
    const interests = parseSearchInterests(JSON.stringify({ phone: 10000, ["x".repeat(101)]: 12 }));

    expect(interests).toEqual({ phone: 100 });
  });
});
