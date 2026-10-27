/**
 * Distance Calculation Utilities
 * Uses the Haversine formula to compute great-circle distance between two GPS coordinates.
 */

/**
 * Calculates distance in kilometers between two GPS coordinate points using Haversine formula.
 *
 * @param lat1 Latitude of point 1 (e.g. Farm location)
 * @param lon1 Longitude of point 1 (e.g. Farm location)
 * @param lat2 Latitude of point 2 (e.g. Buyer location)
 * @param lon2 Longitude of point 2 (e.g. Buyer location)
 * @returns Distance in kilometers rounded to 1 decimal place
 */
export function getDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const EARTH_RADIUS_KM = 6371; // Earth's mean radius in kilometers

  const dLat = degreesToRadians(lat2 - lat1);
  const dLon = degreesToRadians(lon2 - lon1);

  const lat1Rad = degreesToRadians(lat1);
  const lat2Rad = degreesToRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) *
      Math.sin(dLon / 2) *
      Math.cos(lat1Rad) *
      Math.cos(lat2Rad);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  // Round to 1 decimal place (e.g. 12.4 km)
  return Math.round(distance * 10) / 10;
}

/**
 * Converts degrees to radians
 */
function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Formats kilometers into readable string (e.g. "8.4 km" or "850 m")
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Determines if a farm is within the 50 km doorstep delivery limit
 */
export function isDeliverable(distanceKm: number, maxKm = 50): boolean {
  return distanceKm <= maxKm;
}

export default {
  getDistanceKm,
  formatDistance,
  isDeliverable,
};
