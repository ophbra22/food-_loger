/** @jest-environment node */
const {test, expect} = require('@jest/globals');
const {mkdtempSync, writeFileSync, rmSync} = require('node:fs');
const {tmpdir} = require('node:os');
const path = require('node:path');
const {loadNycConfig} = require('@istanbuljs/load-nyc-config');

async function withConfig(yaml, run) {
  const dir = mkdtempSync(path.join(tmpdir(), 'biteflow-nyc-'));
  try {
    writeFileSync(path.join(dir, 'package.json'), '{"private":true}');
    writeFileSync(path.join(dir, '.nycrc.yaml'), yaml);
    writeFileSync(path.join(dir, 'base.yaml'), 'all: true\ninclude:\n  - src/**/*.ts\n');
    await run(dir);
  } finally { rmSync(dir, {recursive:true, force:true}); }
}

test('coverage YAML loader preserves extends, arrays, booleans and numeric thresholds', async () => {
  await withConfig('extends: ./base.yaml\ncheck-coverage: true\nlines: 85\nexclude:\n  - "**/__tests__/**"\n', async cwd => {
    expect(await loadNycConfig({cwd})).toEqual({cwd, all:true, include:['src/**/*.ts'], checkCoverage:true, lines:85, exclude:['**/__tests__/**']});
  });
});

test('coverage configuration rejects JavaScript YAML tags instead of accepting non-data objects', async () => {
  await withConfig('include: !!js/regexp /private/\n', async cwd => {
    await expect(loadNycConfig({cwd})).rejects.toThrow(/unknown tag/i);
  });
});

test('invalid YAML remains an actionable parse error', async () => {
  await withConfig('include: [unterminated\n', async cwd => {
    await expect(loadNycConfig({cwd})).rejects.toThrow();
  });
});
