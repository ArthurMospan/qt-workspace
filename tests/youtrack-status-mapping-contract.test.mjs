import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('YouTrack discovery, UI and importer preserve manual status mappings', async () => {
  const [discovery, card, route, importer] = await Promise.all([
    read('../src/lib/server/youtrackIntegration.js'),
    read('../src/components/integrations/YouTrackImportCard.jsx'),
    read('../src/app/api/integrations/youtrack/import/route.js'),
    read('../src/lib/server/youtrackImporter.js'),
  ]);

  assert.match(discovery, /targetStatuses:\s*workflowStatuses\.map/);
  assert.match(card, /suggestYouTrackStatusMappings\(result\.projects, result\.targetStatuses\)/);
  assert.match(card, /Кожен із них можна змінити вручну/);
  assert.match(card, /statusMappings,/);
  assert.match(route, /statusMappings:\s*body\.statusMappings/);
  assert.match(importer, /statusMappings:\s*sanitizedStatusMappings/);
  assert.match(importer, /resolveYouTrackStatus\(stateName, workflow\.statuses, explicitStatusId\)/);
  assert.match(importer, /hiddenStatusIds\.has\(explicitStatusId\)/);
  assert.match(importer, /mappingVersion:\s*3/);
});

test('YouTrack work items remain imported as time logs and update the issue mirror', async () => {
  const importer = await read('../src/lib/server/youtrackImporter.js');
  assert.match(importer, /client\.workItems\(issue\.id\)/);
  assert.match(importer, /importWorkItems\(\{ job, issueId: saved\.issueId/);
  assert.match(importer, /FieldValue\.increment\(spentMinutesDelta\)/);
  assert.match(importer, /spentMinutesMirrorVersion:\s*1/);
});
