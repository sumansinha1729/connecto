/*
 * Metro picks `engine.web.ts` in the browser and `engine.native.ts` on phones.
 * This file only exists so TypeScript has one module to resolve.
 */
export * from './engine.native';
