const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const source = readFileSync(resolve(__dirname, '../src/lib/import-dedupe.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const loaded = { exports: {} };
new Function('module', 'exports', compiled)(loaded, loaded.exports);
const { identityMatch, platformIds, checkDuplicates, resolveImport } = loaded.exports;
const album = (title = 'Album', artist = 'Artist', extra = {}) => ({ title, artist, release_year: 2026, ...extra });
const existing = (extra = {}) => ({ ...album(), id: 'old', canonical_key: 'artist-album-2026', musicbrainz_release_group_id: null, external_urls: {}, issues: [{ issue_number: 1, slug: 'issue-1', published_at: '2026-01-01', status: 'published' }], feedback: null, ...extra });

test('name normalization ignores case, punctuation and year without mixing artists', () => {
  assert.equal(identityMatch(album('ＬＯＶＥ — Album!'), album('love album', 'ARTIST', { release_year: 2025 })), 'exact');
  assert.equal(identityMatch(album(), album('Album', 'Someone Else')), null);
  assert.equal(identityMatch(album('AB'), album('CD')), null);
});
test('platform album IDs ignore locale, slug and tracking parameters, not track URLs', () => {
  assert.equal(identityMatch(album('One', 'A', { links: { apple_music: 'https://music.apple.com/us/album/a/123?i=456' } }), album('Two', 'B', { links: { apple_music: 'https://music.apple.com/tw/album/b/123' } })), 'exact');
  assert.deepEqual(platformIds(album('One', 'A', { links: { spotify: 'https://open.spotify.com/track/123', apple_music: 'https://music.apple.com/us/artist/a/123', bandcamp: 'https://a.bandcamp.com/track/a' } })), []);
  assert.equal(identityMatch(album('One', 'A', { links: { spotify: 'https://open.spotify.com/intl-de/album/AbC?si=x' } }), album('Two', 'B', { links: { spotify: 'https://open.spotify.com/album/AbC' } })), 'exact');
});
test('deluxe versions are possible, never auto-merged', () => {
  assert.equal(identityMatch(album('Album (Deluxe Edition)'), album()), 'possible');
  assert.equal(identityMatch(album('Album - Remastered'), album()), 'possible');
  assert.equal(identityMatch(album('Album（豪华版）'), album()), 'possible');
  assert.equal(identityMatch(album('Album Deluxe Edition'), album()), 'possible');
});
test('historical repeat is blocked until skipped or explicitly reused', () => {
  const input = [album(), album('New A'), album('New B')];
  const checks = checkDuplicates(input, [existing()]);
  assert.throws(() => resolveImport(input, checks, []), /重复/);
  assert.deepEqual(resolveImport(input, checks, [{ index: 0, action: 'include' }])[0], { index: 0, albumId: 'old' });
  assert.deepEqual(resolveImport(input, checks, [{ index: 0, action: 'skip' }]).map(a => a.index), [1, 2]);
});
test('drafts count as history, feedback alone does not block first recommendation', () => {
  assert.equal(checkDuplicates([album()], [existing({ issues: [{ issue_number: 1, slug: 'draft', published_at: '2026-01-01', status: 'draft' }] })])[0].needsDecision, true);
  const input = [album(), album('New')];
  const checks = checkDuplicates(input, [existing({ issues: [], feedback: { listening_status: 'listened', rating: 7.5, rating_status: 'rated' } })]);
  assert.equal(checks[0].needsDecision, false);
  assert.equal(resolveImport(input, checks, [])[0].albumId, 'old');
});
test('same-batch duplicates require dropping one, including both never bypasses', () => {
  const input = [album(), album('ALBUM'), album('New')];
  const checks = checkDuplicates(input, []);
  assert.throws(() => resolveImport(input, checks, [{ index: 0, action: 'include' }, { index: 1, action: 'include' }]), /两次/);
  assert.equal(resolveImport(input, checks, [{ index: 0, action: 'include' }, { index: 1, action: 'skip' }]).length, 2);
});
test('ambiguous history requires selecting a specific record', () => {
  const input = [album(), album('New')], checks = checkDuplicates(input, [existing(), existing({ id: 'other' })]);
  assert.throws(() => resolveImport(input, checks, [{ index: 0, action: 'include' }]), /多个/);
  assert.equal(resolveImport(input, checks, [{ index: 0, action: 'include', albumId: 'other' }])[0].albumId, 'other');
  assert.throws(() => resolveImport(input, checks, [{ index: 0, action: 'include', albumId: 'forged' }]), /不在/);
});
test('possible editions may remain separate or explicitly reuse', () => {
  const input = [album('Album (Deluxe)'), album('New')], checks = checkDuplicates(input, [existing()]);
  assert.throws(() => resolveImport(input, checks, []), /疑似/);
  assert.equal(resolveImport(input, checks, [{ index: 0, action: 'include' }])[0].albumId, null);
  assert.equal(resolveImport(input, checks, [{ index: 0, action: 'include', albumId: 'old' }])[0].albumId, 'old');
});
test('minimum count and invalid decisions are rejected', () => {
  const input = [album(), album('New')], checks = checkDuplicates(input, []);
  assert.throws(() => resolveImport(input, checks, [{ index: 0, action: 'skip' }]), /2–14/);
  for (const decisions of [[{ index: 99, action: 'skip' }], [{ index: 0, action: 'bogus' }], [{ index: 0, action: 'skip' }, { index: 0, action: 'include' }]]) assert.throws(() => resolveImport(input, checks, decisions), /无效/);
});

function exchangeWithCatalog(catalog, transactionError = null) {
  const calls = [];
  const client = { rpc: async (name, args) => {
    calls.push({ name, args });
    return name === 'get_import_catalog' ? { data: catalog, error: null } : { data: 'saved-issue', error: transactionError };
  } };
  const exchange = { exports: {} };
  const js = ts.transpileModule(readFileSync(resolve(__dirname, '../src/lib/exchange.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const dependencies = {
    'server-only': {},
    '@/lib/cover': {},
    '@/lib/export-policy': {},
    '@/lib/supabase/admin': { createAdminClient: () => client },
    '@/lib/import-dedupe': loaded.exports,
  };
  new Function('module', 'exports', 'require', js)(exchange, exchange.exports, name => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`);
    return dependencies[name];
  });
  return { ...exchange.exports, calls };
}
const issuePayload = () => ({ schema_version: 'friday-records-v2', warnings: [], issue: { issue_number: 99, publish_date: '2026-10-17', title: 'Test' }, albums: [album(), album('New A'), album('New B')] });

test('server rechecks unresolved duplicates before invoking write RPC', async () => {
  const { importIssue, calls } = exchangeWithCatalog({ albums: [existing()], fingerprint: 'fresh' });
  await assert.rejects(importIssue('owner', issuePayload(), [], 'fresh'), /重复/);
  assert.deepEqual(calls.map(c => c.name), ['get_import_catalog']);
});
test('server rejects expired preview and transaction-time catalog changes', async () => {
  const stale = exchangeWithCatalog({ albums: [], fingerprint: 'new' });
  await assert.rejects(stale.importIssue('owner', issuePayload(), [], 'old'), /重新检查/);
  assert.equal(stale.calls.length, 1);
  const race = exchangeWithCatalog({ albums: [], fingerprint: 'fresh' }, { message: 'IMPORT_CATALOG_CHANGED' });
  await assert.rejects(race.importIssue('owner', issuePayload(), [], 'fresh'), /重新检查/);
});
test('server serializes only retained albums, reuses ID and leaves original input intact', async () => {
  const payload = issuePayload(), original = JSON.stringify(payload);
  const reuse = exchangeWithCatalog({ albums: [existing()], fingerprint: 'fresh' });
  assert.equal(await reuse.importIssue('owner', payload, [{ index: 0, action: 'include' }], 'fresh'), 'saved-issue');
  assert.equal(reuse.calls[1].name, 'import_friday_issue_reviewed');
  assert.equal(reuse.calls[1].args.p_payload.albums[0].existing_album_id, 'old');
  assert.equal(reuse.calls[1].args.p_payload.catalog_fingerprint, 'fresh');
  const skip = exchangeWithCatalog({ albums: [existing()], fingerprint: 'fresh' });
  await skip.importIssue('owner', payload, [{ index: 0, action: 'skip' }], 'fresh');
  assert.deepEqual(skip.calls[1].args.p_payload.albums.map(a => a.title), ['New A', 'New B']);
  assert.equal(JSON.stringify(payload), original);
});

const validAlbum = () => ({ ...album(), release_date: null, tags: ['Art Pop'], recommendation_type: 'taste_match', cover: { musicbrainz_release_group_id: null, fallback_url: null }, links: {} });
test('album-only JSON accepts one album and preserves an unknown date as null', () => {
  const { parseAlbumBatch } = exchangeWithCatalog({ albums: [], fingerprint: 'fresh' });
  const parsed = parseAlbumBatch(JSON.stringify({ schema_version: 'friday-records-albums-v1', albums: [validAlbum()] }));
  assert.equal(parsed.albums.length, 1);
  assert.equal(parsed.albums[0].release_date, null);
  assert.equal(parsed.albums[0].recommendation_reason, '');
  assert.deepEqual(parsed.albums[0].review_sources, []);
});
test('append JSON rejects issue metadata, wrong format, empty and overlarge batches', () => {
  const { parseAlbumBatch } = exchangeWithCatalog({ albums: [], fingerprint: 'fresh' });
  const base = { schema_version: 'friday-records-albums-v1', albums: [validAlbum()] };
  assert.throws(() => parseAlbumBatch(JSON.stringify({ ...base, issue: {} })), /不应包含 issue/);
  assert.throws(() => parseAlbumBatch(JSON.stringify({ ...base, schema_version: 'friday-records-v2' })), /追加专辑/);
  for (const albums of [[], Array.from({ length: 15 }, validAlbum)]) assert.throws(() => parseAlbumBatch(JSON.stringify({ ...base, albums })), /1 到 14/);
});
test('media summary needs a source; calendar dates and release years must agree', () => {
  const { parseAlbumBatch } = exchangeWithCatalog({ albums: [], fingerprint: 'fresh' });
  const parse = changes => parseAlbumBatch(JSON.stringify({ schema_version: 'friday-records-albums-v1', albums: [{ ...validAlbum(), ...changes }] }));
  assert.throws(() => parse({ review_summary: 'Claims without evidence' }), /来源/);
  assert.throws(() => parse({ release_date: '2026-02-30' }), /有效日期/);
  assert.throws(() => parse({ release_date: '2025-01-01' }), /对应/);
  assert.throws(() => parse({ title: '   ' }), /不能为空/);
  assert.throws(() => parse({ tags: [] }), /标签/);
});
test('legacy full import keeps its strict protocol, while manual creation allows a minimal draft', () => {
  const { parseImportedIssue } = exchangeWithCatalog({ albums: [], fingerprint: 'fresh' });
  const raw = JSON.stringify({ schema_version: 'friday-records-v2', issue: { issue_number: 23, publish_date: '2026-10-17', title: 'Draft' }, albums: [validAlbum()] });
  assert.throws(() => parseImportedIssue(raw), /2 到 14/);
  assert.equal(parseImportedIssue(raw, true).albums[0].release_date, null);
});
test('append allows one retained album but never permits one already in target issue', () => {
  const input = [album()], checks = checkDuplicates(input, [existing()]);
  assert.equal(resolveImport(input, checks, [{ index: 0, action: 'include' }], { minimum: 1, targetSlug: 'other-issue' }).length, 1);
  assert.throws(() => resolveImport(input, checks, [{ index: 0, action: 'include' }], { minimum: 1, targetSlug: 'issue-1' }), /目标专栏/);
  assert.throws(() => resolveImport(input, checks, [{ index: 0, action: 'skip' }], { minimum: 1 }), /没有可保存/);
});
