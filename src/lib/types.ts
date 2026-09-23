/**
 * Basic location data with latitude and longitude properties.
 */
export interface ILocation {
  lat: number;
  lng: number;
}

/**
 * Serialized location data that extends the basic location data with a label
 * property.
 */
export interface ISerializedLocationData extends ILocation {
  label: string;
}

/**
 * Location data that extends the serialized location data with an id property.
 */
export interface ILocationData extends ISerializedLocationData {
  id: string;
}
/**
 * An array of location data objects, each containing latitude, longitude,
 * label, and id properties.
 */
export type LocationsData = Array<ILocationData>;

/**
 * An interface that extends the basic location data with bounds properties
 * representing the west, east, north, and south boundaries of a geographical
 * area that contains the location.
 */
export interface IAverageLocation extends ILocation {
  bounds: {
    west: number;
    east: number;
    north: number;
    south: number;
  };
}
