import { describe, expect, it } from "vitest";
import { prepareMarketplaceQuery } from "./search";

describe("marketplace query normalization", () => {
  it.each(["t-shirt", "t shirt", "t-shirts", "t shirts"])(
    "normalizes %s consistently",
    (query) => {
      expect(prepareMarketplaceQuery(query)).toBe("t-shirt");
    },
  );

  it.each([
    ["кроссовки", "sneakers"],
    ["krossovkalar", "sneakers"],
    ["куртками", "куртками"],
    ["women jacket", "women jacket"],
    ["phone case", "phone case"],
  ])("normalizes known terms in %s", (query, expected) => {
    expect(prepareMarketplaceQuery(query)).toBe(expected);
  });
});
