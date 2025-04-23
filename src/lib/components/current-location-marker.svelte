<script lang="ts">
  import Icon from '$lib/components/icon.svelte';
  import mapboxgl, { type Map, type Marker } from 'mapbox-gl';
  import type { ILocation } from '$lib/types';
  import { onMount, onDestroy } from 'svelte';
  import Tooltip from './tooltip.svelte';

  interface Props {
    data: ILocation;
    map: Map;
    onClick: (coords: ILocation) => void;
  }

  const { data, map, onClick }: Props = $props();

  let elMarker: HTMLSpanElement;
  let marker: Marker | null = null;
  const coords = { ...data };

  onMount(() => {
    marker = new mapboxgl.Marker({
      element: elMarker,
    })
      .setLngLat(data)
      .addTo(map);
    marker.getElement().focus();
  });

  onDestroy(() => {
    if (marker) {
      marker.remove();
    }
  });
</script>

<div class="offscreen">
  <button
    type="button"
    class="current-location-marker marker"
    onclick={() => onClick(coords)}
    bind:this={elMarker}
  >
    <Tooltip text="Tap to add your location" />
    <Icon name="target-marker" />
  </button>
</div>
