import { MAPBOX_ACCESS_TOKEN } from '$app/env/private';

export function load() {
  return {
    accessToken: MAPBOX_ACCESS_TOKEN,
  };
}
