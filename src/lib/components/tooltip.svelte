<script lang="ts">
  import { computePosition, arrow } from '@floating-ui/dom';
  import { onMount, type Snippet } from 'svelte';
  import { v4 as uuid } from 'uuid';

  interface Props {
    text?: string;
    tooltipSnippet?: Snippet<[]>;
    targetSelector?: string;
  }

  const { text, tooltipSnippet, targetSelector }: Props = $props();
  const id = uuid();
  let elTooltip: HTMLDivElement;
  let elArrow: HTMLDivElement;

  const update = (elTarget: Element) => {
    computePosition(elTarget, elTooltip, {
      placement: 'top',
      middleware: [arrow({ element: elArrow })],
    }).then(({ x, y, placement, middlewareData: { arrow } }) => {
      Object.assign(elTooltip.style, {
        left: `${x}px`,
        top: `${y}px`,
      });

      const staticSide: string | undefined = {
        top: 'bottom',
        right: 'left',
        bottom: 'top',
        left: 'right',
      }[placement.split('-')[0]];

      Object.assign(
        elArrow.style,
        {
          left: arrow?.x != null ? `${arrow.x}px` : '',
          top: arrow?.y != null ? `${arrow.y}px` : '',
          right: '',
          bottom: '',
        },
        staticSide ? { [staticSide]: '-4px' } : {},
      );
    });
  };

  onMount(() => {
    let elTarget = elTooltip.parentElement;
    if (targetSelector) {
      elTarget = document.querySelector(targetSelector);
    }

    if (!elTarget) {
      throw new Error(`Target element not found: ${targetSelector}`);
    }

    elTarget.setAttribute('aria-describedby', id);

    const showTooltip = () => {
      elTooltip.style.display = 'block';
      update(elTarget);
    };
    const hideTooltip = () => {
      if (elTooltip) {
        elTooltip.style.display = 'none';
      }
    };

    const events: Array<[keyof HTMLElementEventMap, () => void]> = [
      ['mouseenter', showTooltip],
      ['mouseleave', hideTooltip],
      ['focus', showTooltip],
      ['blur', hideTooltip],
    ];

    for (let [event, handler] of events) {
      elTarget.addEventListener(event, handler);
    }
    hideTooltip();
  });
</script>

<div role="tooltip" class="tooltip" {id} bind:this={elTooltip}>
  {#if text}
    {text}
  {/if}
  {#if tooltipSnippet}
    {@render tooltipSnippet()}
  {/if}

  <div class="tooltip-arrow" bind:this={elArrow}></div>
</div>
