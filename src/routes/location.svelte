<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import mapboxgl, { type Map, type Marker } from 'mapbox-gl';
  import { type ILocationData } from './utilities';

  interface Props {
    map: Map;
    data: ILocationData;
    deleteLocation: () => void;
    saveLabel: (label: string) => void;
  }

  const { map, data, deleteLocation, saveLabel }: Props = $props();

  const makePopupHtml = (label: string) => {
    const dom = document.createElement('div');
    dom.className = 'flex flex-row';
    const elLabel = document.createElement('p');
    elLabel.className = 'text-zinc-800 text-lg font-medium mr-2';
    elLabel.innerText = label;
    dom.appendChild(elLabel);
    const elDelete = document.createElement('button');
    elDelete.className = 'btn btn-xs btn-link';
    elDelete.innerText = 'Delete';
    elDelete.setAttribute('data-location-id', data.id);
    dom.appendChild(elDelete);
    return dom.outerHTML;
  };

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

    private customLabel = $state('');

    public isEditingLabel = $state(false);

    readonly label = $derived(
      this.isEditingLabel
        ? this.customLabel
        : this.customLabel || `${this.lat}, ${this.lng}`,
    );

    readonly setCustomLabel = (label: string) => {
      this.customLabel = label;
    };

    readonly setMarker = () => {
      const popup = new mapboxgl.Popup().setHTML(makePopupHtml(location.label));
      popup.on('open', () => popup.setHTML(makePopupHtml(location.label)));
      this._marker = new mapboxgl.Marker({
        className: 'location-marker',
      })
        .setLngLat([this.lng, this.lat])
        .setPopup(popup)
        .addTo(map);
    };
  }

  const location = new Location(data);
  console.log('loading location data:', data);
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
</script>

<div
  class="mb-2 flex flex-row content-center items-center rounded-md bg-slate-700 p-2"
  onmouseenter={onMouseEnter}
  onmouseleave={onMouseLeave}
  role="listitem"
>
  {#if location.isEditingLabel}
    <div class="join w-full">
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
          <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
            <rect id="Container" x="0" y="0" width="24" height="24"> </rect>
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
          <button onclick={deleteLocation}>Remove</button>
        </li>
      </ul>
    </div>
  {/if}
</div>
