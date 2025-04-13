<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import mapboxgl, {
    type Map,
    type Marker,
    type MapMouseEvent,
  } from 'mapbox-gl';
  import 'mapbox-gl/dist/mapbox-gl.css';
  import { goto } from '$app/navigation';
  import {
    parseLongLat,
    type ILocationData,
    type ISerializedLocationData,
    type LocationsData,
  } from './utilities';
  import Location from './location.svelte';
  import { v4 as uuid } from 'uuid';
  import { browser } from '$app/environment';

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
  let averageLocationMarker: Marker | null = null;
  let addLocationMarker: Marker | null = $state(null);
  let isDrawerOpen = $state(false);

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

  const averageLocation = $derived.by(() => {
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
      long: long / locationsData.length,
      lat: lat / locationsData.length,
      bounds: {
        west,
        south,
        east,
        north,
      },
    };
  });

  const makePopupHtml = (label: string) => {
    const dom = document.createElement('div');
    dom.className = 'flex flex-row';
    const elLabel = document.createElement('p');
    elLabel.className = 'text-zinc-800 text-lg font-medium mr-2';
    elLabel.innerText = label;
    dom.appendChild(elLabel);
    const elBtn = document.createElement('button');
    elBtn.className = 'btn btn-xs btn-link';
    elBtn.innerText = 'Share';
    elBtn.setAttribute('data-average-location', 'true');
    dom.appendChild(elBtn);
    return dom.outerHTML;
  };

  $effect(() => {
    if (!map) {
      return;
    }
    if (averageLocationMarker) {
      averageLocationMarker.remove();
    }
    if (!averageLocation) {
      if (locationsData.length === 1) {
        map.setCenter(locationsData[0]);
        map.setZoom(9);
      }
      return;
    }
    let { long, lat, bounds } = averageLocation;
    const popup = new mapboxgl.Popup().setHTML(
      makePopupHtml(`Average Location: ${lat}, ${long}`),
    );
    averageLocationMarker = new mapboxgl.Marker({
      className: 'average-location-marker',
      color: '#C00',
    })
      .setLngLat([long, lat])
      .setPopup(popup)
      .addTo(map);
    map.setCenter([long, lat]);
    map.fitBounds([bounds.west, bounds.south, bounds.east, bounds.north], {
      padding: 40,
    });
  });

  const onMapClick = (e: MapMouseEvent) => {
    let target = e.originalEvent.target as Element;
    if (addLocationMarker) {
      if (
        target.closest('.add-location-marker') ===
        addLocationMarker.getElement()
      ) {
        let coords = addLocationMarker.getLngLat();
        addLocation(coords.lng, coords.lat);
      }
      addLocationMarker.remove();
      addLocationMarker = null;
    }
    // Only add the add location marker if the click did not happen on a
    // location marker.
    else if (!target.closest('.location-marker, .average-location-marker')) {
      addLocationMarker = new mapboxgl.Marker({
        color: '#0C0',
        className: 'add-location-marker',
      })
        .setLngLat(e.lngLat)
        .addTo(map!);
    }
  };

  const addLocation = (lng: number, lat: number) => {
    locationsData.push({ lng, lat, label: '', id: uuid() });
    persistToQueryString();
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

  const persistToQueryString = () => {
    goto(`?${queryParamDataKey}=${encodeParam(locationsData)}`, {
      replaceState: true,
    });
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
        class="btn absolute right-[-39px] rounded-l-none"
        onclick={() => (isDrawerOpen = !isDrawerOpen)}
      >
        {#if isDrawerOpen}
          &lsaquo;
        {:else}
          &rsaquo;
        {/if}
      </button>
      <div class={isDrawerOpen ? '' : 'offscreen'}>
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
        {#if map}
          {#each locationsData as data}
            <Location
              {map}
              {data}
              deleteLocation={() => removeLocation(data.id)}
              saveLabel={(label: string) => updateLocationLabel(data, label)}
            />
          {/each}
        {/if}
        {#if averageLocation}
          <div class="mb-2 flex flex-row rounded-md bg-slate-500 p-4">
            <h2 class="text-lg font-bold">Average Location:</h2>
            <p>{averageLocation.lat}, {averageLocation.long}</p>
          </div>
        {/if}
      </div>
    </div>
    <div class="h-full w-full" bind:this={mapContainer}></div>
  </div>
</div>
