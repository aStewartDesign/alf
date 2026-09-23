// 15.23456, -30.67890
// 47.610335, -122.542584 <- Bainbridge Island
// 46.824555, -117.206764 <- Pullman
// 42.349849, -71.163558 <- Boston

import type { ILocation } from './types';

// -43.625149, 172.652438 <- Christchurch
const decimalPattern = /(-?)(\d+\.\d+),\s*(-?)(\d+\.\d+)/i;
// 40°45'11"N, 73°58'59"W
const degreesMinSecPattern =
  /(\d+)°\s*(\d+)'\s*(\d+\.?\d+)"\s*([NS]),?\s*(\d+)°\s*(\d+)'\s*(\d+\.?\d+)"\s*([EW])/i;
// 33°52.08'S, 151°12.84'E
const degreesMinDecimalPattern =
  /(\d+)°\s*(\d+\.\d+)'\s*([NS]),?\s*(\d+)°\s*(\d+\.\d+)'\s*([EW])/i;

export const parseLngLat = (val: string): ILocation | null => {
  const decimalMatch = val.match(decimalPattern);
  if (decimalMatch) {
    const lat = parseFloat(`${decimalMatch[1]}${decimalMatch[2]}`);
    const lng = parseFloat(`${decimalMatch[3]}${decimalMatch[4]}`);
    return { lng, lat };
  }

  const degreesMinSecMatch = val.match(degreesMinSecPattern);
  if (degreesMinSecMatch) {
    const [
      ,
      latDegStr,
      latMinStr,
      latSecStr,
      latDir,
      lonDegStr,
      lonMinStr,
      lonSecStr,
      lonDir,
    ] = degreesMinSecMatch;
    const latDeg = parseInt(latDegStr, 10);
    const latMin = parseInt(latMinStr, 10);
    const latSec = parseFloat(latSecStr);
    const lonDeg = parseInt(lonDegStr, 10);
    const lonMin = parseInt(lonMinStr, 10);
    const lonSec = parseFloat(lonSecStr);

    const lat =
      (latDeg + latMin / 60 + latSec / 3600) *
      (latDir.toLowerCase() === 'n' ? 1 : -1);
    const lng =
      (lonDeg + lonMin / 60 + lonSec / 3600) *
      (lonDir.toLowerCase() === 'e' ? 1 : -1);
    return { lng, lat };
  }

  const degreesMinDecimalMatch = val.match(degreesMinDecimalPattern);
  if (degreesMinDecimalMatch) {
    const [, latDegStr, latMinStr, latDir, lonDegStr, lonMinStr, lonDir] =
      degreesMinDecimalMatch;

    const latDeg = parseInt(latDegStr, 10);
    const latMin = parseInt(latMinStr, 10);
    const lonDeg = parseInt(lonDegStr, 10);
    const lonMin = parseInt(lonMinStr, 10);

    const lat =
      (latDeg + latMin / 60) * (latDir.toLowerCase() === 'n' ? 1 : -1);
    const lng =
      (lonDeg + lonMin / 60) * (lonDir.toLowerCase() === 'e' ? 1 : -1);
    return { lng, lat };
  }

  return null;
};

/**
 * Rounds the latitude and longitude to 5 decimal places for display.
 *
 * @param {ILocation} location - The location object containing lat and lng.
 * @returns {ILocation} - A new location object with rounded lat and lng.
 */
export const roundLatLng = (location: ILocation): ILocation => {
  const lat = parseFloat(location.lat.toFixed(5));
  const lng = parseFloat(location.lng.toFixed(5));
  return { lat, lng };
};
