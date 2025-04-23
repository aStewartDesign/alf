<script lang="ts">
  import Icon from '$lib/components/icon.svelte';
  import mapboxgl, { type Map, type Marker } from 'mapbox-gl';
  import type { ILocation } from '$lib/types';
  import { onMount, onDestroy } from 'svelte';
  import Tooltip from './tooltip.svelte';
  import { roundLatLng } from '$lib/utilities';

  interface Props {
    data: ILocation;
    map: Map;
  }

  const { data, map }: Props = $props();

  let elMarker: HTMLSpanElement;
  let marker: Marker | null = null;

  onMount(() => {
    marker = new mapboxgl.Marker({
      element: elMarker,
    })
      .setLngLat(data)
      .addTo(map);
  });

  onDestroy(() => {
    if (marker) {
      marker.remove();
    }
  });

  $effect(() => {
    if (marker) {
      marker.setLngLat(data);
    }
  });

  const displayLngLat = roundLatLng(data);
</script>

<div class="offscreen">
  <span class="average-marker marker" bind:this={elMarker}>
    {#snippet tooltipSnippet()}
      <p><strong>AverageLocation</strong></p>
      <p><em>{displayLngLat.lat}, {displayLngLat.lng}</em></p>
    {/snippet}
    <Tooltip className="flex-col" {tooltipSnippet} />
    <Icon name="avg-marker" />
  </span>
</div>
