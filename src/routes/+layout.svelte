<script lang="ts">
  import '../app.css';
  import IconSprite from '$lib/components/icon-sprite.svelte';
  let { children } = $props();
</script>

<IconSprite />
{@render children()}
