<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import mapboxgl, { type Map } from 'mapbox-gl';
  import 'mapbox-gl/dist/mapbox-gl.css';

  const hasGeolocation = 'geolocation' in navigator;
  let map: Map;
  let mapContainer: HTMLElement;
  let long: number;
  let lat: number;
  let zoom: number;

  long = -74.5;
  lat = 40;
  zoom = 9;

  onMount(() => {
    map = new mapboxgl.Map({
      container: mapContainer,
      accessToken:
        'pk.eyJ1IjoiYXN0ZXdhcnRtYXBzIiwiYSI6ImNtNThqemZvdTNzeGQyaW9oZHNndmhtNnEifQ.2ogFryXUJhplTnN9tj82Sw',
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [long, lat],
      zoom: zoom,
    });

    onDestroy(() => {
      map.remove();
    });
  });
</script>

<div>
  <h1>Welcome to SvelteMap</h1>
  {#if hasGeolocation}
    <button
      class="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700"
      on:click={() => {
        navigator.geolocation.getCurrentPosition((position) => {
          long = position.coords.longitude;
          lat = position.coords.latitude;
          map.setCenter([long, lat]);
        });
      }}
    >
      Use my location
    </button>
  {/if}
</div>

<div class="w-ful h-screen" bind:this={mapContainer}></div>
