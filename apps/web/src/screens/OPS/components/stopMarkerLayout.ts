import type { TripStop } from "../../../operations/operationsApi";

const overlappingStopDistanceMeters = 20;

export function createStopMarkerOffsets(stops: TripStop[]) {
  return stops.map((stop, index): [number, number] | undefined => {
    const nearbyIndexes = stops.flatMap((candidate, candidateIndex) =>
      distanceMeters(stop.latitude, stop.longitude, candidate.latitude, candidate.longitude) <= overlappingStopDistanceMeters
        ? [candidateIndex]
        : []);
    if (nearbyIndexes.length < 2) return undefined;

    const rank = nearbyIndexes.indexOf(index);
    const spread = Math.min(34, Math.max(16, 10 + nearbyIndexes.length * 2));
    const angle = -Math.PI / 2 + rank * (Math.PI * 2 / nearbyIndexes.length);
    return [Math.round(Math.cos(angle) * spread), Math.round(Math.sin(angle) * spread)];
  });
}

function distanceMeters(firstLatitude: number, firstLongitude: number, secondLatitude: number, secondLongitude: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(secondLatitude - firstLatitude);
  const longitudeDelta = radians(secondLongitude - firstLongitude);
  const firstLatitudeRadians = radians(firstLatitude);
  const secondLatitudeRadians = radians(secondLatitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitudeRadians) * Math.cos(secondLatitudeRadians) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}
