<script lang="ts">
  export type IconName =
    | 'marker'
    | 'avg-marker'
    | 'add-marker'
    | 'target-marker'
    | 'all-locations'
    | 'hamburger'
    | 'dots-stacked'
    | 'pencil'
    | 'trash';

  interface Props {
    name: IconName;
  }

  const { name }: Props = $props();
  let dimensions = { width: 0, height: 0 };
  switch (name) {
    case 'all-locations':
      dimensions = { width: 40, height: 40 };
      break;
    case 'hamburger':
      dimensions = { width: 32, height: 20 };
      break;
    case 'dots-stacked':
      dimensions = { width: 24, height: 24 };
      break;
    case 'pencil':
      dimensions = { width: 20, height: 20 };
      break;
    case 'trash':
      dimensions = { width: 18, height: 20 };
      break;
    default:
      dimensions = { width: 28, height: 40 };
  }
  let { width, height } = dimensions;
</script>

<svg class="icon" viewBox="0 0 {width} {height}" {width} {height}>
  <use href="#{name}" />
</svg>
