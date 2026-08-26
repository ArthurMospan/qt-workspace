// Лічильник рахує те, за що Firestore виставляє рахунок — а не те, скільки
// документів прийшло в коллбек.
//
// docs/ROADMAP.md називає цю дірку прямо: «nothing counts documents read, so
// "which screen spent it" can only be answered by reading code». Але наївний
// лічильник був би гіршим за його відсутність: снапшот із локального кешу
// коштує нуль, а після першого приєднання слухач тарифікується лише за те, що
// змінилось. `docs.length` на кожній доставці показав би число в рази більше за
// рахунок — і на нього почали б спиратись.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  billedDocumentCount,
  countRead,
  readMeterSnapshot,
  resetReadMeter,
} from '../src/lib/utils/readMeter.mjs';

const snapshot = ({ docs = 0, changes = null, fromCache = false }) => ({
  metadata: { fromCache },
  docs: Array.from({ length: docs }, (_, index) => ({ id: `doc-${index}` })),
  ...(changes === null ? {} : { docChanges: () => Array.from({ length: changes }, () => ({})) }),
});

test('доставка з кешу не коштує нічого', () => {
  assert.equal(billedDocumentCount(snapshot({ docs: 500, changes: 500, fromCache: true })), 0);
});

test('рахуються зміни, а не весь набір', () => {
  // Перше приєднання: змінилось усе, тобто це і є повний набір.
  assert.equal(billedDocumentCount(snapshot({ docs: 300, changes: 300 })), 300);
  // Далі приїхала одна відредагована задача — і рахунок за неї один документ,
  // хоч у коллбек прийшли всі триста.
  assert.equal(billedDocumentCount(snapshot({ docs: 300, changes: 1 })), 1);
});

test('джерело без docChanges падає назад на розмір набору', () => {
  assert.equal(billedDocumentCount(snapshot({ docs: 12, changes: null })), 12);
});

test('нічого не ламається на порожньому чи чужому вводі', () => {
  assert.equal(billedDocumentCount(null), 0);
  assert.equal(billedDocumentCount(undefined), 0);
  assert.equal(billedDocumentCount({}), 0);
  assert.equal(billedDocumentCount({ docChanges: () => { throw new Error('нема'); }, docs: [1, 2] }), 2);
});

test('підсумки групуються по джерелу і сортуються найширшим уперед', () => {
  resetReadMeter();
  countRead('useIssues', snapshot({ docs: 40, changes: 40 }));
  countRead('useIssues', snapshot({ docs: 40, changes: 2 }));
  countRead('useOrganizationIssues', snapshot({ docs: 900, changes: 900 }));
  countRead('useSprints', snapshot({ docs: 5, changes: 5, fromCache: true }));

  const result = readMeterSnapshot();
  assert.equal(result.documents, 942);
  assert.deepEqual(result.byScope.map(row => row.scope), ['useOrganizationIssues', 'useIssues']);
  assert.deepEqual(result.byScope[1], { scope: 'useIssues', documents: 42, deliveries: 2 });
  // Джерело, яке віддало тільки кеш, не зʼявляється взагалі — рахунку за нього
  // не було.
  assert.equal(result.byScope.some(row => row.scope === 'useSprints'), false);
  resetReadMeter();
});

test('найширші читання продукту під лічильником', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const wired = [
    ['src/lib/hooks/useOrganizationIssues.js', 'useOrganizationIssues'],
    ['src/lib/hooks/useIssues.js', 'useIssues'],
    ['src/lib/hooks/useAllMyTasks.js', 'useAllMyTasks'],
    ['src/lib/hooks/useSprints.js', 'useSprints'],
    ['src/lib/hooks/useWorkspaceAnalytics.js', 'useWorkspaceAnalytics'],
  ];
  for (const [path, scope] of wired) {
    assert.match(await read(path), new RegExp(String.raw`countRead\('${scope}'`), path);
  }
  // І ручка, через яку на це можна подивитись, існує там, де ці запити живуть.
  assert.match(await read('src/app/(app)/layout.js'), /exposeReadMeter\(\)/);
});
