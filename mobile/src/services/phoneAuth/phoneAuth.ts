/*
 * Metro picks `phoneAuth.web.ts` in the browser and `phoneAuth.native.ts` on phones.
 * This file only exists so TypeScript has one module to resolve.
 */
export * from './phoneAuth.native';
