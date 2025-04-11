<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import mapboxgl, {
    type Map,
    type Marker,
    type MapMouseEvent,
  } from 'mapbox-gl';
  import 'mapbox-gl/dist/mapbox-gl.css';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';

  let params = $derived(page.url.searchParams);
  let paramEntries = $derived.by(() => [...params.entries()]);

  class Location {
    public readonly marker: Marker;
    constructor(marker: Marker) {
      this.marker = marker;
    }

    readonly coords = $derived.by(() => this.marker.getLngLat());

    readonly lng = $derived(this.coords.lng);
    readonly lat = $derived(this.coords.lat);

    private customLabel = $state('');

    readonly label = $derived(this.customLabel || `${this.lat}, ${this.lng}`);

    public isEditingLabel = $state(false);

    readonly setCustomLabel = (label: string) => {
      this.customLabel = label;
    };
  }

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

  let map: Map;
  let mapContainer: HTMLElement;
  let hasGeolocation = $state(false);
  let input = $state('');
  let isValidInput = $state(false);
  let locations = $state<Array<Location>>([]);
  let averageLocationMarker: Marker | null = null;
  let addLocationMarker: Marker | null = $state(null);
  let isDrawerOpen = $state(false);

  const averageLocation = $derived.by(() => {
    if (locations.length < 2) {
      return null;
    }

    let long = 0;
    let lat = 0;
    let west = Infinity;
    let south = Infinity;
    let east = -Infinity;
    let north = -Infinity;
    locations.forEach((location) => {
      const { lng, lat: markerLat } = location;
      long += lng;
      lat += markerLat;
      west = Math.min(west, lng);
      south = Math.min(south, markerLat);
      east = Math.max(east, lng);
      north = Math.max(north, markerLat);
    });

    return {
      long: long / locations.length,
      lat: lat / locations.length,
      bounds: {
        west,
        south,
        east,
        north,
      },
    };
  });

  $effect(() => {
    if (averageLocationMarker) {
      averageLocationMarker.remove();
    }
    if (!averageLocation) {
      if (locations.length === 1) {
        map.setCenter(locations[0].coords);
        map.setZoom(9);
      }
      return;
    }
    let { long, lat, bounds } = averageLocation;
    averageLocationMarker = new mapboxgl.Marker({ color: '#C00' })
      .setLngLat([long, lat])
      .addTo(map);
    map.setCenter([long, lat]);
    map.fitBounds([bounds.west, bounds.south, bounds.east, bounds.north], {
      padding: 40,
    });
  });

  const onMapClick = (e: MapMouseEvent) => {
    if (addLocationMarker) {
      let target = e.originalEvent.target;
      if (
        target instanceof Element &&
        target.closest('.add-location-marker') ===
          addLocationMarker.getElement()
      ) {
        let coords = addLocationMarker.getLngLat();
        addLocation(coords.lng, coords.lat);
      }
      addLocationMarker.remove();
      addLocationMarker = null;
    } else {
      addLocationMarker = new mapboxgl.Marker({
        color: '#0C0',
        className: 'add-location-marker',
      })
        .setLngLat(e.lngLat)
        .addTo(map);
    }
  };

  onMount(() => {
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
  });

  onDestroy(() => {
    if (map) {
      map.off('click', onMapClick);
      map.remove();
    }
  });

  const parseLongLat = (val: string): { long: number; lat: number } | null => {
    const decimalMatch = val.match(decimalPattern);
    if (decimalMatch) {
      let lat = parseFloat(`${decimalMatch[1]}${decimalMatch[2]}`);
      let long = parseFloat(`${decimalMatch[3]}${decimalMatch[4]}`);
      return { long, lat };
    }

    const degreesMinSecMatch = val.match(degreesMinSecPattern);
    if (degreesMinSecMatch) {
      let [
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
      let latDeg = parseInt(latDegStr, 10);
      let latMin = parseInt(latMinStr, 10);
      let latSec = parseFloat(latSecStr);
      let lonDeg = parseInt(lonDegStr, 10);
      let lonMin = parseInt(lonMinStr, 10);
      let lonSec = parseFloat(lonSecStr);

      let lat =
        (latDeg + latMin / 60 + latSec / 3600) *
        (latDir.toLowerCase() === 'n' ? 1 : -1);
      let long =
        (lonDeg + lonMin / 60 + lonSec / 3600) *
        (lonDir.toLowerCase() === 'e' ? 1 : -1);
      console.log(`deg/min/sec lat: ${lat}, long: ${long}`);
      return { long, lat };
    }

    const degreesMinDecimalMatch = val.match(degreesMinDecimalPattern);
    if (degreesMinDecimalMatch) {
      let [, latDegStr, latMinStr, latDir, lonDegStr, lonMinStr, lonDir] =
        degreesMinDecimalMatch;

      let latDeg = parseInt(latDegStr, 10);
      let latMin = parseInt(latMinStr, 10);
      let lonDeg = parseInt(lonDegStr, 10);
      let lonMin = parseInt(lonMinStr, 10);

      let lat =
        (latDeg + latMin / 60) * (latDir.toLowerCase() === 'n' ? 1 : -1);
      let long =
        (lonDeg + lonMin / 60) * (lonDir.toLowerCase() === 'e' ? 1 : -1);
      console.log(`deg/min lat: ${lat}, long: ${long}`);
      return { long, lat };
    }

    return null;
  };

  const addLocation = (long: number, lat: number) => {
    let marker = new mapboxgl.Marker().setLngLat([long, lat]).addTo(map);
    locations.push(new Location(marker));
  };

  const removeLocation = (location: Location) => {
    location.marker.remove();
    locations = locations.filter((l) => l !== location);
  };

  const onUseMyLocation = () => {
    window.navigator.geolocation.getCurrentPosition((position) => {
      addLocation(position.coords.longitude, position.coords.latitude);
    });
  };

  const setInput = (val: string) => {
    isValidInput = Boolean(parseLongLat(val));
    input = val;
  };

  const onAddLocation = () => {
    const { long, lat } = parseLongLat(input) || {};
    if (long && lat) {
      addLocation(long, lat);
      input = '';
    }
  };

  const takeFocus = (el: HTMLElement) => {
    el.focus();
  };

  const onLabelKeypress = (event: KeyboardEvent, location: Location) => {
    if (event.key === 'Enter') {
      location.isEditingLabel = false;
    }
  };

  const onMouseEnter = (location: Location) => {
    location.marker.addClassName('scale-marker');
  };

  const onMouseLeave = (location: Location) => {
    location.marker.removeClassName('scale-marker');
  };

  const navTo = (key: string, value: string) => {
    goto(`?${key}=${value}`);
  };
</script>

<div class="grid h-screen w-screen grid-cols-6 grid-rows-layout">
  <div class="col-span-6 p-4">
    <h1 class="text-2xl font-bold">
      Welcome to <abbr title="Average Location Finder">A.L.F.</abbr>
    </h1>
  </div>
  <div class="relative col-span-full h-full">
    <div
      class={[
        'shadow-md, absolute z-[1] h-full bg-base-100',
        isDrawerOpen
          ? 'w-[80%] sm:w-[60%] md:w-[50%] lg:w-[30%] 2xl:w-[20%]'
          : 'w-0',
        'p-4',
      ]}
    >
      <button
        class="btn absolute right-[-40px] rounded-l-none"
        onclick={() => (isDrawerOpen = !isDrawerOpen)}
      >
        {#if isDrawerOpen}
          &lsaquo;
        {:else}
          &rsaquo;
        {/if}
      </button>
      {#if isDrawerOpen}
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
        {#if hasGeolocation}
          <button class="btn" onclick={onUseMyLocation}>
            Use my location
          </button>
        {/if}
        {#each locations as location}
          <div
            class="mb-2 flex flex-row content-center items-center rounded-md bg-slate-700 p-2"
            onmouseenter={() => onMouseEnter(location)}
            onmouseleave={() => onMouseLeave(location)}
            role="listitem"
          >
            {#if location.isEditingLabel}
              <div class="join w-full">
                <input
                  type="text"
                  class="input join-item input-bordered grow"
                  bind:value={() => location.label, location.setCustomLabel}
                  use:takeFocus
                  onkeypress={(e) => onLabelKeypress(e, location)}
                />
                <button
                  class="btn join-item"
                  onclick={() => (location.isEditingLabel = false)}
                >
                  Save
                </button>
              </div>
            {:else}
              <p class="flex-grow text-base font-bold">
                {location.label}
              </p>
              <div class="dropdown">
                <button tabindex="0" aria-label="Location menu" class="btn m-1">
                  <svg
                    width="24px"
                    height="24px"
                    viewBox="0 0 24 24"
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    xmlns:xlink="http://www.w3.org/1999/xlink"
                  >
                    <g
                      stroke="none"
                      stroke-width="1"
                      fill="none"
                      fill-rule="evenodd"
                    >
                      <rect id="Container" x="0" y="0" width="24" height="24">
                      </rect>
                      <path
                        d="M12,6 C12.5522847,6 13,5.55228475 13,5 C13,4.44771525 12.5522847,4 12,4 C11.4477153,4 11,4.44771525 11,5 C11,5.55228475 11.4477153,6 12,6 Z"
                        id="shape-03"
                        stroke="#FFFFFF"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-dasharray="0,0"
                      >
                      </path>
                      <path
                        d="M12,13 C12.5522847,13 13,12.5522847 13,12 C13,11.4477153 12.5522847,11 12,11 C11.4477153,11 11,11.4477153 11,12 C11,12.5522847 11.4477153,13 12,13 Z"
                        id="shape-03"
                        stroke="#FFFFFF"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-dasharray="0,0"
                      >
                      </path>
                      <path
                        d="M12,20 C12.5522847,20 13,19.5522847 13,19 C13,18.4477153 12.5522847,18 12,18 C11.4477153,18 11,18.4477153 11,19 C11,19.5522847 11.4477153,20 12,20 Z"
                        id="shape-03"
                        stroke="#FFFFFF"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-dasharray="0,0"
                      >
                      </path>
                    </g>
                  </svg>
                </button>
                <ul
                  class="menu dropdown-content z-[1] w-52 rounded-box bg-base-100 p-2 shadow"
                >
                  <li>
                    <button onclick={() => (location.isEditingLabel = true)}>
                      Edit Label
                    </button>
                  </li>
                  <li>
                    <button onclick={() => removeLocation(location)}
                      >Remove</button
                    >
                  </li>
                </ul>
              </div>
            {/if}
          </div>
        {/each}
        {#if averageLocation}
          <div class="mb-2 flex flex-row rounded-md bg-slate-500 p-4">
            <h2 class="text-lg font-bold">Average Location:</h2>
            <p>{averageLocation.lat}, {averageLocation.long}</p>
          </div>
        {/if}

        <h4>Query params:</h4>
        <ul>
          {#each paramEntries as [key, value]}
            <li>
              <span class="font-bold">{key}:</span>
              {value}
            </li>
          {/each}
        </ul>
        <div>
          <button onclick={() => navTo('peach', 'pit')}>peachy</button>
          <button onclick={() => navTo('silly', 'dog')}>zuko</button>
          <button onclick={() => navTo('late', 'night')}>???</button>
        </div>
      {/if}
    </div>
    <div class="h-full w-full" bind:this={mapContainer}></div>
  </div>
</div>
