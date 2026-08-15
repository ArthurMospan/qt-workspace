import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

import {
  CONTROLLED_HELP_FEATURES,
  HELP_ARTICLES,
  HELP_CATEGORIES,
  REQUIRED_HELP_COVERAGE,
} from '../src/lib/content/helpArticles.mjs';
import { AVAILABLE_INTEGRATIONS, INTEGRATIONS, PLANNED_INTEGRATIONS } from '../src/lib/content/integrations.mjs';
import { LEGAL_DOCUMENTS } from '../src/lib/content/legalDocuments.mjs';
import { PRODUCT_VERSION } from '../src/lib/content/product.mjs';
import { NEWS_ARTICLES, VERSION_HISTORY } from '../src/lib/content/releaseContent.mjs';
import { ONEB_SUPPORT_CONTACTS, isAllowedSupportHref } from '../src/lib/content/supportContacts.mjs';

const rootUrl = new URL('../', import.meta.url);
const flattenArticle = article => JSON.stringify(article).toLocaleLowerCase('uk-UA');

test('help center has one valid article for every required critical area', () => {
  assert.equal(HELP_ARTICLES.length, 20);
  assert.equal(new Set(HELP_ARTICLES.map(article => article.id)).size, HELP_ARTICLES.length);
  assert.equal(new Set(HELP_ARTICLES.map(article => article.slug)).size, HELP_ARTICLES.length);

  const categories = new Set(HELP_CATEGORIES.map(category => category.id));
  const articleIds = new Set(HELP_ARTICLES.map(article => article.id));
  const coverage = new Map();
  for (const article of HELP_ARTICLES) {
    assert.ok(categories.has(article.category), `${article.id} has a valid category`);
    assert.ok(article.title && article.summary && article.updatedAt);
    assert.ok(article.sections.length > 0, `${article.id} has useful sections`);
    assert.ok(article.relatedRoutes.every(route => route.startsWith('/')));
    assert.ok(article.relatedIds.every(id => articleIds.has(id)), `${article.id} has valid related articles`);
    for (const id of article.coverage) {
      assert.equal(coverage.has(id), false, `${id} is owned by only one article`);
      coverage.set(id, article.id);
    }
  }
  assert.deepEqual([...coverage.keys()].toSorted(), [...REQUIRED_HELP_COVERAGE].toSorted());
});

test('controlled product features cannot exist without a valid help article', async () => {
  const covered = new Set(HELP_ARTICLES.flatMap(article => article.coverage));
  assert.deepEqual(
    CONTROLLED_HELP_FEATURES.map(feature => feature.coverage).toSorted(),
    [...REQUIRED_HELP_COVERAGE].toSorted(),
  );
  for (const feature of CONTROLLED_HELP_FEATURES) {
    assert.ok(covered.has(feature.coverage), `${feature.id} has help coverage`);
    for (const source of feature.sources) await access(new URL(source, rootUrl));
  }
});

test('public content contains no placeholder promises and reports integrations honestly', () => {
  const publicText = [
    ...HELP_ARTICLES.map(flattenArticle),
    JSON.stringify(NEWS_ARTICLES).toLocaleLowerCase('uk-UA'),
    JSON.stringify(VERSION_HISTORY).toLocaleLowerCase('uk-UA'),
    JSON.stringify(LEGAL_DOCUMENTS).toLocaleLowerCase('uk-UA'),
  ].join(' ');
  assert.doesNotMatch(publicText, /tbd|coming soon|lorem ipsum|скоро буде|заповнити пізніше/);
  assert.ok(AVAILABLE_INTEGRATIONS.every(item => item.route));
  assert.ok(PLANNED_INTEGRATIONS.every(item => !item.route));
  assert.ok(INTEGRATIONS.every(item => ['available', 'planned'].includes(item.state)));
});

test('news and versions describe the package version from one source', async () => {
  const packageJson = JSON.parse(await readFile(new URL('package.json', rootUrl), 'utf8'));
  assert.equal(PRODUCT_VERSION, packageJson.version);
  assert.ok(NEWS_ARTICLES.some(article => article.version === PRODUCT_VERSION));
  assert.ok(VERSION_HISTORY.some(entry => entry.version === PRODUCT_VERSION));
  assert.ok(NEWS_ARTICLES.every(article => article.slug && article.publishedAt && article.sections.length));
});

test('support contacts are centralized, unique and safe to open', () => {
  assert.deepEqual(ONEB_SUPPORT_CONTACTS.map(contact => contact.id).toSorted(), ['email', 'telegram', 'viber']);
  assert.equal(new Set(ONEB_SUPPORT_CONTACTS.map(contact => contact.href)).size, ONEB_SUPPORT_CONTACTS.length);
  assert.ok(ONEB_SUPPORT_CONTACTS.every(contact => contact.label && contact.value && isAllowedSupportHref(contact.href)));
});
