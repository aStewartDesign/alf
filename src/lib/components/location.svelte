<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import mapboxgl, { type Map, type Marker } from 'mapbox-gl';
  import { type ILocation, type ILocationData } from '$lib/types';
  import Icon from '$lib/components/icon.svelte';
  import Tooltip from './tooltip.svelte';
  import { roundLatLng } from '$lib/utilities';

  interface Props {
    map: Map;
    data: ILocationData;
    deleteLocation: (id: string) => void;
    saveLabel: (label: string) => void;
  }

  const { map, data, deleteLocation, saveLabel }: Props = $props();

  let elLocationMarker: HTMLSpanElement;

  class Location {
    private _marker: Marker | null = null;
    public get marker() {
      return this._marker;
    }
    private readonly data: ILocationData;
    constructor(data: ILocationData) {
      this.data = data;
    }

    get coords() {
      return {
        lng: this.data.lng,
        lat: this.data.lat,
      };
    }

    readonly lng = $derived(this.coords.lng);
    readonly lat = $derived(this.coords.lat);

    readonly roundLatLng = $derived.by(() => roundLatLng(this.coords));

    readonly roundLng = $derived(this.roundLatLng.lng);
    readonly roundLat = $derived(this.roundLatLng.lat);

    private customLabel = $state('');

    public isEditingLabel = $state(false);

    readonly label = $derived(
      this.isEditingLabel
        ? this.customLabel
        : this.customLabel || `${this.roundLat}, ${this.roundLng}`,
    );

    readonly setCustomLabel = (label: string) => {
      this.customLabel = label;
    };

    readonly setMarker = () => {
      this._marker = new mapboxgl.Marker({
        className: 'location-marker',
        element: elLocationMarker,
      })
        .setLngLat([this.lng, this.lat])
        .addTo(map);
    };
  }

  const location = new Location(data);
  location.setCustomLabel(data.label);
  onMount(() => {
    location.setMarker();
  });

  onDestroy(() => {
    location.marker?.remove();
  });

  const takeFocus = (el: HTMLInputElement) => {
    el.focus();
    el.select();
  };

  const onLabelKeypress = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleLabelSave();
    }
  };

  const onMouseEnter = () => {
    location.marker?.addClassName('scale-marker');
  };

  const onMouseLeave = () => {
    location.marker?.removeClassName('scale-marker');
  };

  const handleLabelSave = () => {
    saveLabel(location.label);
    location.isEditingLabel = false;
  };

  const goToLocation = (coords: ILocation) => {
    map.setCenter(coords);
  };
</script>

<div class="offscreen">
  {#snippet tooltipSnippet()}
    <span>{location.label}</span>
    <button class="btn btn-xs" onclick={() => deleteLocation(data.id)}>
      <Icon name="trash" />
    </button>
  {/snippet}
  <span class="location-marker marker" bind:this={elLocationMarker}>
    <Tooltip {tooltipSnippet} />
    <Icon name="marker" />
  </span>
</div>

<div
  class="mb-2 flex flex-row content-center items-center rounded-md bg-slate-700"
  onmouseenter={onMouseEnter}
  onmouseleave={onMouseLeave}
  role="listitem"
>
  {#if location.isEditingLabel}
    <div class="join m-2 w-full">
      <input
        type="text"
        class="input join-item input-bordered grow"
        bind:value={() => location.label, location.setCustomLabel}
        use:takeFocus
        onkeypress={onLabelKeypress}
      />
      <button class="btn join-item" onclick={handleLabelSave}> Save </button>
    </div>
  {:else}
    <button
      class="flex-grow p-2 text-left text-base font-bold"
      onclick={() => goToLocation(location.coords)}
    >
      {location.label}
    </button>
    <div class="dropdown">
      <button
        tabindex="0"
        aria-label="Location menu"
        class="btn btn-xs m-1 h-max py-2"
      >
        <Icon name="dots-stacked" />
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
          <button onclick={() => deleteLocation(data.id)}>Remove</button>
        </li>
      </ul>
    </div>
  {/if}
</div>
