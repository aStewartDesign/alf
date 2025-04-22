export interface ILocation {
  lat: number;
  lng: number;
}

export interface ISerializedLocationData extends ILocation {
  label: string;
}
export interface ILocationData extends ISerializedLocationData {
  id: string;
}
export type LocationsData = Array<ILocationData>;

export interface IAverageLocation extends ILocation {
  bounds: {
    west: number;
    east: number;
    north: number;
    south: number;
  };
}
