import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const packageInfo = require('../../../package.json');

export const PRODUCT_NAME = 'QuickTeam';
export const PRODUCT_VERSION = packageInfo.version;
export const PUBLICATION_DATE = '2026-08-15';
export const SITE_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export function canonicalUrl(pathname) {
  return new URL(pathname, SITE_ORIGIN).toString();
}
