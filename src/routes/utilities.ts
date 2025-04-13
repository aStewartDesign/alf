export interface ILocationData {
  lng: number;
  lat: number;
  label: string;
}
export type LocationsData = Array<ILocationData>;

// 15.23456, -30.67890
// 47.610335, -122.542584 <- Bainbridge Island
// 46.824555, -117.206764 <- Pullman
// 42.349849, -71.163558 <- Boston
// -43.625149, 172.652438 <- Christchurch
const decimalPattern = /(-?)(\d+\.\d+),\s*(-?)(\d+\.\d+)/i;
// 40°45'11"N, 73°58'59"W
const degreesMinSecPattern =
  /(\d+)°\s*(\d+)'\s*(\d+\.?\d+)"\s*([NS]),?\s*(\d+)°\s*(\d+)'\s*(\d+\.?\d+)"\s*([EW])/i;
// 33°52.08'S, 151°12.84'E
const degreesMinDecimalPattern =
  /(\d+)°\s*(\d+\.\d+)'\s*([NS]),?\s*(\d+)°\s*(\d+\.\d+)'\s*([EW])/i;

export const parseLongLat = (
  val: string,
): { long: number; lat: number } | null => {
  const decimalMatch = val.match(decimalPattern);
  if (decimalMatch) {
    const lat = parseFloat(`${decimalMatch[1]}${decimalMatch[2]}`);
    const long = parseFloat(`${decimalMatch[3]}${decimalMatch[4]}`);
    return { long, lat };
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
    const long =
      (lonDeg + lonMin / 60 + lonSec / 3600) *
      (lonDir.toLowerCase() === 'e' ? 1 : -1);
    console.log(`deg/min/sec lat: ${lat}, long: ${long}`);
    return { long, lat };
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
    const long =
      (lonDeg + lonMin / 60) * (lonDir.toLowerCase() === 'e' ? 1 : -1);
    console.log(`deg/min lat: ${lat}, long: ${long}`);
    return { long, lat };
  }

  return null;
};
