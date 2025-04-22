<script lang="ts">
  import Icon from '$lib/components/icon.svelte';
  import type { ILocationData } from '$lib/types';

  interface Props {
    data: ILocationData;
  }

  const { data }: Props = $props();
</script>

<span class="current-location-marker marker" data-id={data.id}>
  <Icon name="target-marker" />
</span>
