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

  const queryParamDataKey = 'd';

  const encodeParam = (data: LocationsData) => {
    // Remove the ids from the data before encoding
    const serializedData: ISerializedLocationData[] = data.map(
      ({ lng, lat, label }) => ({ lng, lat, label }),
    );
    let encoded = btoa(JSON.stringify(serializedData));
    return encodeURIComponent(encoded);
  };
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

  let locationsData = $state(new Array<ILocationData>());

  let map: Map | null = $state(null);
  let mapContainer: HTMLElement;
  let hasGeolocation = $state(false);
  let input = $state('');
  let isValidInput = $state(false);
  let isDrawerOpen = $state(false);
  let addLocationCoords: ILocation | null = $state(null);
  let currentLocationCoords: ILocation | null = $state(null);
  const defaultZoomLevel = 12;

  const onDocumentClick = (e: MouseEvent) => {
    let id = (e.target as Element)
      .closest('[data-location-id]')
      ?.getAttribute('data-location-id');
    if (id) {
      removeLocation(id);
      return;
    }
    if ((e.target as Element).closest('[data-average-location]')) {
      navigator.share({
        title: 'Average Location',
        text: 'Check out our average location!',
        url: location.href,
      });
    }
  };

  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search);
    locationsData.splice(
      0,
      locationsData.length,
      ...decodeParam(urlParams.get(queryParamDataKey) || ''),
    );
    map = new mapboxgl.Map({
      container: mapContainer,
      accessToken:
        'pk.eyJ1IjoiYXN0ZXdhcnRtYXBzIiwiYSI6ImNtNThqemZvdTNzeGQyaW9oZHNndmhtNnEifQ.2ogFryXUJhplTnN9tj82Sw',
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [-74.5, 40],
      zoom: 9,
    });
    map.on('click', onMapClick);

    hasGeolocation = 'geolocation' in window.navigator;

    document.addEventListener('click', onDocumentClick);
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

  const addLocation = (coords: ILocation, label?: string) => {
    locationsData.push({ ...coords, label: label || '', id: uuid() });
    persistToQueryString();
  };

  const onAddMarkerClick = (coords: ILocation) => {
    addLocation(coords);
    addLocationCoords = null;
  };

  const removeLocation = (id: string) => {
    let idx = locationsData.findIndex((d) => d.id === id);
    locationsData.splice(idx, 1);
    persistToQueryString();
  };

  const updateLocationLabel = (data: ILocationData, label: string) => {
    let idx = locationsData.findIndex((d) => d === data);
    if (idx !== -1) {
      locationsData[idx].label = label;
      persistToQueryString();
    }
  };

  const clearAllLocations = () => {
    locationsData.splice(0, locationsData.length);
    persistToQueryString();
  };

  const onUseMyLocation = () => {
    window.navigator.geolocation.getCurrentPosition((position) => {
      if (currentLocationCoords) {
        currentLocationCoords = null;
      } else {
        currentLocationCoords = {
          lng: position.coords.longitude,
          lat: position.coords.latitude,
        };
        map?.setCenter(currentLocationCoords);
        map?.setZoom(defaultZoomLevel);
      }
    });
  };

  const onViewAllLocations = (data: IAverageLocation) => {
    if (map) {
      const { bounds } = data;
      map.setCenter(data);
      map.fitBounds([bounds.west, bounds.south, bounds.east, bounds.north], {
        padding: 80,
      });
    }
  };

  const onGoToAverageLocation = (data: IAverageLocation) => {
    if (map) {
      map.setCenter(data);
      map.setZoom(defaultZoomLevel);
    }
  };

  const setInput = (val: string) => {
    isValidInput = Boolean(parseLngLat(val));
    input = val;
  };

  const onAddLocation = () => {
    const coords = parseLngLat(input);
    if (coords) {
      addLocation(coords);
      input = '';
    }
  };

  const onSetCurrentLocation = (coords: ILocation) => {
    currentLocationCoords = null;
    addLocation(coords, 'My location');
  };

  const persistToQueryString = () => {
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
