import { describe, expect, it } from "vitest";
import { findNearestBranches, type BranchWithDistance } from "./nearestBranches";

const branches = [
  { id: "far", name: "Far branch", region: "Region", locality: "Far town", address: "Far street", latitude: 41, longitude: 70 },
  { id: "near", name: "Near branch", region: "Region", locality: "Nearby", address: "Near street", latitude: 40.01, longitude: 69.99 },
  { id: "missing-coordinates", name: "Unknown", region: "Region", locality: "Unknown", address: "Unknown street", latitude: null, longitude: null },
];

describe("findNearestBranches", () => {
  it("returns only geolocated branches sorted by distance", () => {
    const nearest = findNearestBranches(branches, 40, 70);

    expect(nearest.map(({ id }) => id)).toEqual(["near", "far"]);
    expect(nearest[0].distanceKm).toBeLessThan(nearest[1].distanceKm);
  });

  it("limits the number of returned branches", () => {
    const nearest: BranchWithDistance[] = findNearestBranches(branches, 40, 70, 1);

    expect(nearest).toHaveLength(1);
    expect(nearest[0].id).toBe("near");
  });
});