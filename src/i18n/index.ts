/**
 * Everything i18n, for Astro pages and components. Islands import from
 * ./paths and ./ui directly instead: this barrel also re-exports the Malay
 * text of every tool, which has no business in a browser bundle.
 */
export * from './paths';
export { ui, type UiStrings } from './ui';
export { localizeTool, localizeVariant, categoryLabel } from './tools';
