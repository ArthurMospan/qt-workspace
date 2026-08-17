import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('an unsaved invoice preview never exposes a provisional number or export actions', async () => {
  const billing = await read('../src/components/workspace/BillingTab.jsx');
  const preview = billing.slice(
    billing.indexOf('function InvoicePreview'),
    billing.indexOf('// ── MAIN COMPONENT'),
  );
  const draftBuilder = billing.slice(
    billing.indexOf('const buildInvoice'),
    billing.indexOf('// ── Save invoice'),
  );

  assert.doesNotMatch(
    billing,
    /function invoiceNumber|Math\.random\(\)|draftNumber|server-assigned/,
  );
  assert.doesNotMatch(draftBuilder, /\bnumber\s*:/);
  assert.match(
    billing,
    /setInvoicePreviewState\(\{[\s\S]{0,100}projectKey: billingProjectKey,[\s\S]{0,100}kind: 'draft',[\s\S]{0,100}invoice: buildInvoice\(\)/,
  );
  assert.match(
    preview,
    /Офіційний номер рахунку з’явиться після збереження\./,
  );
  assert.equal(
    preview.match(/if \(!canExport\) return;/g)?.length,
    2,
    'both print and copy handlers must fail closed for an unsaved preview',
  );
  // Every way an invoice can leave the screen sits in the same branch: copy,
  // the spreadsheet menu and print are offered together or not at all, and an
  // unsaved draft is offered a Закрити instead of any of them.
  assert.match(
    preview,
    /footer=\{[\s\S]{0,80}canExport \? \([\s\S]{0,500}Копіювати[\s\S]{0,400}ExportMenu[\s\S]{0,250}Друкувати[\s\S]{0,250}Закрити/,
  );
  // The menu offers no PDF of its own: «Друкувати» already produces one from
  // the designed invoice rather than from a bare table.
  assert.match(preview, /formats=\{\['xlsx', 'csv'\]\}/);
});

test('saved history opens the persisted snapshot and exports its server number', async () => {
  const billing = await read('../src/components/workspace/BillingTab.jsx');
  const history = billing.slice(
    billing.indexOf("{tab === 'history'"),
    billing.indexOf('{/* RIGHT: always-visible invoice summary rail'),
  );

  assert.match(
    billing,
    /const showSavedInvoice = invoice => \{[\s\S]{0,180}setInvoicePreviewState\(\{[\s\S]{0,100}projectKey: billingProjectKey,[\s\S]{0,100}kind: 'saved',[\s\S]{0,100}invoice,/,
  );
  assert.match(history, /title="Переглянути збережений рахунок"/);
  assert.match(history, /onClick=\{\(\) => showSavedInvoice\(inv\)\}/);
  assert.match(billing, /invoice=\{invoicePreview\.invoice\}/);
  assert.match(billing, /isSaved=\{invoicePreview\.kind === 'saved'\}/);
  assert.doesNotMatch(billing, /invoice=\{buildInvoice\(\)\}/);
  // The window spans the footer, which now carries a third control.
  assert.match(
    billing,
    /title=\{dialogTitle\}[\s\S]{0,2000}\{canExport \? \([\s\S]{0,200}\{officialNumber\}/,
  );
  assert.match(billing, /`РАХУНОК \$\{officialNumber\}`/);
  assert.match(billing, /<title>\$\{officialNumber\}<\/title>/);
});
