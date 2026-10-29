import type { ApiShippingBranch } from "./api";

export type BranchWithDistance = ApiShippingBranch & { distanceKm: number };

function distanceInKilometers(latitude: number, longitude: number, branchLatitude: number, branchLongitude: number): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(branchLatitude - latitude);
  const longitudeDelta = radians(branchLongitude - longitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(latitude)) * Math.cos(radians(branchLatitude)) * Math.sin(longitudeDelta / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function findNearestBranches(
  branches: ApiShippingBranch[],
  latitude: number,
  longitude: number,
  limit = 5,
): BranchWithDistance[] {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || limit <= 0) return [];

  return branches
    .flatMap((branch) => {
      if (typeof branch.latitude !== "number" || typeof branch.longitude !== "number") return [];
      return [{
        ...branch,
        distanceKm: distanceInKilometers(latitude, longitude, branch.latitude, branch.longitude),
      }];
    })
    .sort((left, right) => left.distanceKm - right.distanceKm)
    .slice(0, limit);
}