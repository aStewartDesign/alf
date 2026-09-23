import { MAPBOX_ACCESS_TOKEN } from '$app/env/private';

/**
 * Loads the Mapbox access token from the environment variables and returns it
 * as part of the page data.
 *
 * @returns An object containing the Mapbox access token.
 */
export function load() {
  return {
    accessToken: MAPBOX_ACCESS_TOKEN,
  };
}
