/**
 * Shared LQIP (low-quality image placeholder) data URLs for next/image
 * `placeholder="blur"`. Inlined as base64 so the chunk paints instantly
 * before the full image decodes — kills the flash-of-blank-tile on big
 * full-bleed components (Hero, PageHero, EditorialOverlay, etc).
 *
 * If the brand palette changes, regenerate with sharp:
 *   await sharp({ create: { width: 1, height: 1, channels: 3,
 *                           background: { r: 17, g: 17, b: 17 } } })
 *     .jpeg({ quality: 30 }).toBuffer().then(b => 'data:image/jpeg;base64,' + b.toString('base64'))
 */

/** Near-black 1×1 JPEG. Used on hero / dark editorial sections so the
 *  page background blends into the image while it loads. */
export const BLUR_DARK =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKpgD//Z";

/** Cream-toned 1×1 JPEG. Used on light editorial / category banner
 *  blocks where the surrounding section uses the cream palette. */
export const BLUR_CREAM =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/APuiD//Z";
