<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import mapboxgl, { type Map, type MapMouseEvent } from 'mapbox-gl';
  import 'mapbox-gl/dist/mapbox-gl.css';
  import { goto } from '$app/navigation';
  import { parseLngLat, roundLatLng } from '$lib/utilities';
  import type {
    ILocation,
    ILocationData,
    ISerializedLocationData,
    LocationsData,
  } from '$lib/types';
  import { v4 as uuid } from 'uuid';
  import { browser } from '$app/environment';
  import Location from '$lib/components/location.svelte';
  import Icon from '$lib/components/icon.svelte';
  import type { IAverageLocation } from '$lib/types';
  import AverageMarker from '$lib/components/average-marker.svelte';
  import AddMarker from '$lib/components/add-marker.svelte';
  import CurrentLocationMarker from '$lib/components/current-location-marker.svelte';
  import type { PageProps } from './$types';

  /**
   * The application state (the selected points on the map) is persisted in the
   * query string of the URL. The query string is encoded as a base64 string to
   * avoid issues with special characters in the URL. The query string is
   * updated whenever the state changes, and the state is initialized from the
   * query string when the page loads.
   *
   * We'll store this data in this query parameter key.
   */
  const queryParamDataKey = 'd';

  /**
   * Encodes the given locations data as a base64 string and returns it, URI
   * ready. The data is serialized before encoding.
   *
   * @param data - The locations data to encode.
   */
  const encodeParam = (data: LocationsData) => {
    // Remove the ids from the data before encoding
    const serializedData: ISerializedLocationData[] = data.map(
      ({ lng, lat, label }) => ({ lng, lat, label }),
    );
    let encoded = btoa(JSON.stringify(serializedData));
    return encodeURIComponent(encoded);
  };

  /**
   * Decodes the given base64 string and returns the locations data. The data is
   * deserialized after decoding. If the data is invalid, an empty array is
   * returned.
   *
   * @param data - The base64 string to decode into locations data.
   */
  const decodeParam = (data: string): LocationsData => {
    try {
      return data
        ? (
            JSON.parse(
              atob(decodeURIComponent(data)),
            ) as ISerializedLocationData[]
          ).map((data) => ({
            ...data,
            id: uuid(),
          }))
        : [];
    } catch (e) {
      console.error('Error decoding param:', e);
      return [];
    }
  };

  /**
   * The locations data state
   */
  let locationsData = $state(new Array<ILocationData>());

  /**
   * Holds the mapbox map instance. This is initialized in onMount and
   * destroyed in onDestroy.
   */
  let map: Map | null = $state(null);

  /**
   * The map container element. This is bound to the div in the markup and used
   * to initialize the mapbox map instance.
   */
  let mapContainer: HTMLElement;

  /**
   * Whether the user has geolocation available in their browser. This is
   * initialized in onMount and used to conditionally render the "Use my
   * location" button.
   */
  let hasGeolocation = $state(false);

  /**
   * The input value for the "Add location" input field. This is bound to the
   * input field in the markup and used to add a new location when the user
   * clicks the "Add" button. The input is validated to ensure it is a valid
   * latitude and longitude pair before enabling the "Add" button.
   */
  let input = $state('');

  /**
   * Whether the input value is a valid latitude and longitude pair. This is
   * used to enable or disable the "Add" button. The input is validated using
   * the parseLngLat function from the utilities module.
   */
  let isValidInput = $state(false);

  /**
   * Whether the drawer is open or closed. This is used to toggle the drawer
   * open and closed when the user clicks the "Toggle menu" button. The drawer
   * is initially closed.
   */
  let isDrawerOpen = $state(false);

  /**
   * The coordinates of the location to add. This is set when the user clicks on
   * the map to add a new location. The coordinates are used to render the "Add
   * location" marker on the map. If the user clicks on the map again, the
   * coordinates are cleared and the marker is removed.
   */
  let addLocationCoords: ILocation | null = $state(null);

  /**
   * The coordinates of the user's current location. This is set when the user
   * clicks the "Use my location" button. The coordinates are used to render the
   * "Current location" marker on the map. If the user clicks the button again,
   * the coordinates are cleared and the marker is removed. The coordinates are
   * obtained using the Geolocation API. If the user denies permission to access
   * their location, the coordinates are not set and the marker is not rendered.
   */
  let currentLocationCoords: ILocation | null = $state(null);

  /**
   * The default zoom level for the map when centering on a location. This is
   * used when the user clicks the "View all locations" button or the "Go to
   * average location" button.
   */
  const defaultZoomLevel = 12;

  /**
   * To handle clicks on location delete buttons, we listen for clicks on the
   * document and check if the click was on an element with the
   * `data-location-id` attribute. If it was, we remove the location with that
   * id from the locations data state.
   *
   * @param e the click event
   */
  const onDocumentClick = (e: MouseEvent) => {
    let id = (e.target as Element)
      .closest('[data-location-id]')
      ?.getAttribute('data-location-id');
    if (id) {
      removeLocation(id);
      return;
    }
  };

  let { data }: PageProps = $props();

  onMount(() => {
    // Initialize the locations data state from the query string in the URL. If
    // the query string is invalid, the locations data state is initialized to
    // an empty array.
    const urlParams = new URLSearchParams(window.location.search);
    locationsData.splice(
      0,
      locationsData.length,
      ...decodeParam(urlParams.get(queryParamDataKey) || ''),
    );

    // Initialize the mapbox map instance and add a click handler to the map.
    map = new mapboxgl.Map({
      container: mapContainer,
      accessToken: data.accessToken,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [-74.5, 40],
      zoom: 9,
    });
    map.on('click', onMapClick);

    // Check if the user has geolocation available in their browser.
    hasGeolocation = 'geolocation' in window.navigator;

    // Listen for clicks on the document 
    document.addEventListener('click', onDocumentClick);

    // If a average location is calculated, center the map on it and fit the
    // bounds to show all locations.
    if (averageLocation) {
      onViewAllLocations(averageLocation);
    }
  });

  onDestroy(() => {
    if (map) {
      map.off('click', onMapClick);
      map.remove();
    }
    if (browser) {
      document.removeEventListener('click', onDocumentClick);
    }
  });

  /**
   * Calculates the average location of all locations in the locations data
   * state. If there are less than 2 locations, null is returned. The average
   * location is calculated by averaging the latitude and longitude of all
   * locations, and calculating the bounds of the locations. The bounds are used
   * to fit the map to show all locations when the user clicks the "View all
   * locations" button.
   */
  const averageLocation = $derived.by<IAverageLocation | null>(() => {
    if (locationsData.length < 2) {
      return null;
    }

    let long = 0;
    let lat = 0;
    let west = Infinity;
    let south = Infinity;
    let east = -Infinity;
    let north = -Infinity;
    locationsData.forEach((location) => {
      const { lng, lat: markerLat } = location;
      long += lng;
      lat += markerLat;
      west = Math.min(west, lng);
      south = Math.min(south, markerLat);
      east = Math.max(east, lng);
      north = Math.max(north, markerLat);
    });

    return {
      lng: long / locationsData.length,
      lat: lat / locationsData.length,
      bounds: {
        west,
        south,
        east,
        north,
      },
    };
  });

  /**
   * Handles clicks on the map. If the click is not on a location marker, the
   * add location marker is toggled on or off at the clicked coordinates. If the
   * click is on a location marker, the add location marker is removed.
   *
   * @param e - The map mouse event containing the clicked coordinates and the
   * original event.
   */
  const onMapClick = (e: MapMouseEvent) => {
    let target = e.originalEvent.target as Element;
    // Only add the add location marker if the click did not happen on a
    // location marker.
    if (
      !target.closest(
        '.add-marker, .location-marker, .average-marker, .current-location-marker',
      )
    ) {
      if (addLocationCoords) {
        addLocationCoords = null;
      } else {
        addLocationCoords = {
          lng: e.lngLat.lng,
          lat: e.lngLat.lat,
        };
      }
    } else {
      addLocationCoords = null;
    }
  };

  /**
   * Adds a new location to the locations data state with the given coordinates
   * and optional label.
   *
   * @param coords - The coordinates of the new location to add.
   * @param label - An optional label for the new location.
   */
  const addLocation = (coords: ILocation, label?: string) => {
    locationsData.push({ ...coords, label: label || '', id: uuid() });
    persistToQueryString();
  };

  /**
   * Handles clicks on the add location marker which adds the new location to
   * the locations data state and removes the add location marker.
   *
   * @param coords - The coordinates of the location to add.
   */
  const onAddMarkerClick = (coords: ILocation) => {
    addLocation(coords);
    addLocationCoords = null;
  };

  /**
   * Removes the location with the given id from the locations data state.
   *
   * @param id - The id of the location to remove.
   */
  const removeLocation = (id: string) => {
    let idx = locationsData.findIndex((d) => d.id === id);
    locationsData.splice(idx, 1);
    persistToQueryString();
  };

  /**
   * Updates the label of the given location data in the locations data state
   * and persists the updated state to the query string.
   *
   * @param data - The location data to update.
   * @param label - The new label for the location.
   */
  const updateLocationLabel = (data: ILocationData, label: string) => {
    let idx = locationsData.findIndex((d) => d === data);
    if (idx !== -1) {
      locationsData[idx].label = label;
      persistToQueryString();
    }
  };

  /**
   * Clears all locations from the locations data state and persists the updated
   * state to the query string.
   */
  const clearAllLocations = () => {
    locationsData.splice(0, locationsData.length);
    persistToQueryString();
  };

  /**
   * Toggles the current location marker on or off. If the marker is on, it is
   * removed. If the marker is off, the user's current location is obtained
   * using the Geolocation API and the marker is added to the map. If the user
   * denies permission to access their location, the marker is not added to the
   * map.
   */
  const onUseMyLocation = () => {
    if (currentLocationCoords) {
      currentLocationCoords = null;
    } else {
      window.navigator.geolocation.getCurrentPosition((position) => {
        currentLocationCoords = {
          lng: position.coords.longitude,
          lat: position.coords.latitude,
        };
        map?.setCenter(currentLocationCoords);
        map?.setZoom(defaultZoomLevel);
      });
    }
  };

  /**
   * Centers the map on the given average location and fits the bounds to show
   * all locations. This is used when the user clicks the "View all locations"
   * button. If the map is not initialized, this function does nothing.
   *
   * @param data - The average location data to center the map on and fit the
   * bounds to.
   */
  const onViewAllLocations = (data: IAverageLocation) => {
    if (map) {
      const { bounds } = data;
      map.setCenter(data);
      map.fitBounds([bounds.west, bounds.south, bounds.east, bounds.north], {
        padding: 80,
      });
    }
  };

  /**
   * Centers the map on the given average location and sets the zoom level to
   * the default zoom level. This is used when the user clicks the "Go to
   * average location" button. If the map is not initialized, this function does
   * nothing.
   *
   * @param data - The average location data to center the map on and set the
   * zoom level to.
   */
  const onGoToAverageLocation = (data: IAverageLocation) => {
    if (map) {
      map.setCenter(data);
      map.setZoom(defaultZoomLevel);
    }
  };

  /**
   * Sets the input value for the "Add location" input field and validates it.
   * If the input is a valid latitude and longitude pair, the "Add" button is
   * enabled. If the input is invalid, the "Add" button is disabled.
   *
   * @param val - The new input value to set.
   */
  const setInput = (val: string) => {
    isValidInput = Boolean(parseLngLat(val));
    input = val;
  };

  /**
   * Adds a new location to the locations data state with the coordinates parsed
   * from the input value and clears the input value. If the input value is not
   * a valid latitude and longitude pair, this function does nothing.
   */
  const onAddLocation = () => {
    const coords = parseLngLat(input);
    if (coords) {
      addLocation(coords);
      input = '';
    }
  };

  /**
   * Sets the current location coordinates to null and adds a new location to
   * the locations data state with the given coordinates and the label "My
   * location".
   *
   * @param coords - The coordinates of the new location.
   */
  const onSetCurrentLocation = (coords: ILocation) => {
    currentLocationCoords = null;
    addLocation(coords, 'My location');
  };

  /**
   * Persists the locations data state to the query string in the URL.
   */
  const persistToQueryString = () => {
    // The query string is updated using the `goto` function from SvelteKit,
    // which replaces the current history entry with the new URL without
    // reloading the page.
    goto(`?${queryParamDataKey}=${encodeParam(locationsData)}`, {
      replaceState: true,
    });
  };
</script>

<div class="grid h-screen w-screen grid-cols-6 grid-rows-layout">
  <div class="relative col-span-full h-full">
    <div
      class={[
        'shadow-md, absolute z-[1] h-full bg-base-100',
        'w-[80vw] p-4 sm:w-[60vw] md:w-[50vw] lg:w-[30vw] 2xl:w-[20vw]',
        'transition-left duration-200 ease-in-out',
        isDrawerOpen
          ? 'left-0'
          : 'left-[-80vw] sm:left-[-60vw] md:left-[-50vw] lg:left-[-30vw] 2xl:left-[-20vw]',
      ]}
    >
      <button
        class="btn absolute right-[-65px] mt-4 rounded-l-none"
        onclick={() => (isDrawerOpen = !isDrawerOpen)}
        aria-label="Toggle menu"
      >
        <Icon name="hamburger" />
      </button>
      <div class="flex h-full flex-col justify-between">
        <div>
          <div class="join w-full pb-2">
            <input
              type="text"
              class="input join-item input-bordered grow"
              placeholder="Latitude, Longitude"
              bind:value={() => input, setInput}
            />
            <button
              class="btn join-item"
              disabled={!isValidInput}
              onclick={onAddLocation}
            >
              Add
            </button>
          </div>
          {#if map}
            {#each locationsData as data (data.id)}
              <Location
                {map}
                {data}
                deleteLocation={(id) => removeLocation(id)}
                saveLabel={(label: string) => updateLocationLabel(data, label)}
              />
            {/each}

            {#if addLocationCoords}
              <AddMarker
                {map}
                data={addLocationCoords}
                onClick={onAddMarkerClick}
              />
            {/if}
            {#if averageLocation}
              <AverageMarker {map} data={averageLocation} />
            {/if}
            {#if currentLocationCoords}
              <CurrentLocationMarker
                {map}
                data={currentLocationCoords}
                onClick={onSetCurrentLocation}
              />
            {/if}
          {/if}
        </div>
        <div class="mb-6">
          {#if averageLocation}
            <button
              type="button"
              class="btn relative mb-2 flex w-[calc(100%_+_82px)] justify-between pr-0"
              onclick={() => onGoToAverageLocation(averageLocation)}
            >
              <span>
                <strong>Average Location:</strong>
                <em>
                  {roundLatLng(averageLocation).lat},
                  {roundLatLng(averageLocation).lng}
                </em>
              </span>
              <span class="flex w-[66px] justify-center">
                <Icon name="avg-marker" />
              </span>
            </button>
            <button
              type="button"
              class="btn relative mb-2 flex w-[calc(100%_+_82px)] justify-between pr-0"
              onclick={() => onViewAllLocations(averageLocation)}
            >
              <span>View all locations</span>
              <span class="flex w-[66px] justify-center">
                <Icon name="all-locations" />
              </span>
            </button>
          {/if}
          {#if hasGeolocation}
            <button
              class={[
                'btn relative mb-2 flex w-[calc(100%_+_82px)] justify-between pr-0',
                currentLocationCoords ? 'current-location-marker' : '',
              ]}
              onclick={onUseMyLocation}
            >
              <span>Use my location</span>
              <span class="flex w-[66px] justify-center">
                <Icon name="target-marker" />
              </span>
            </button>
          {/if}
          {#if locationsData.length > 0}
            <button
              type="button"
              class="btn btn-error w-full"
              onclick={clearAllLocations}
            >
              Clear all locations
            </button>
          {/if}
        </div>
      </div>
    </div>
    <div class="h-full w-full" bind:this={mapContainer}></div>
  </div>
</div>
