import { test } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, formatContent, validatePost, calculateContentHash, processPostFile, injectFrontmatterMetadata, getMimeType } from './publisher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

test('parseFrontmatter extrai metadados e corpo corretamente', () => {
  const sample = `---
title: "Título de Teste"
tags:
  - java
  - backend
media: "assets/2026-09-15/diagram.png"
visibility: "PUBLIC"
---

Texto do post aqui.
- Ponto 1
- Ponto 2`;

  const { metadata, body } = parseFrontmatter(sample);
  assert.strictEqual(metadata.title, 'Título de Teste');
  assert.deepStrictEqual(metadata.tags, ['java', 'backend']);
  assert.strictEqual(metadata.media, 'assets/2026-09-15/diagram.png');
  assert.strictEqual(metadata.visibility, 'PUBLIC');
  assert.ok(body.includes('Texto do post aqui.'));
});

test('formatContent substitui listas por bullets Unicode e anexa hashtags', () => {
  const metadata = {
    title: 'Post com Tags',
    tags: ['devops', 'cloud'],
    canonical_url: 'https://example.com/artigo'
  };
  const body = `Introdução:
- Item A
- Item B

Conclusão.`;

  const result = formatContent(metadata, body);
  assert.ok(result.commentary.includes('• Item A'));
  assert.ok(result.commentary.includes('• Item B'));
  assert.ok(result.commentary.includes('#devops #cloud'));
  assert.ok(result.commentary.includes('https://example.com/artigo'));
  assert.ok(result.charCount <= 3000);
});

test('formatContent lança erro se o post exceder 3.000 caracteres', () => {
  const metadata = { title: 'Post Gigante' };
  const hugeBody = 'A'.repeat(3001);
  assert.throws(() => formatContent(metadata, hugeBody), /3\.000 caracteres/);
});

test('validatePost identifica post já publicado', () => {
  const metadata = {
    title: 'Já Publicado',
    linkedin_post_urn: 'urn:li:share:123456789'
  };
  const res = validatePost('fake-path.md', metadata);
  assert.strictEqual(res.isValid, false);
  assert.ok(res.reason.includes('urn:li:share:123456789'));
});

test('calculateContentHash gera SHA-256 consistente', () => {
  const text = 'Mensagem de teste';
  const hash1 = calculateContentHash(text);
  const hash2 = calculateContentHash(text);
  assert.strictEqual(hash1, hash2);
  assert.strictEqual(hash1.length, 64);
});

test('processPostFile executa com sucesso em modo dry-run', async () => {
  const samplePath = path.join(PROJECT_ROOT, 'tests', 'fixtures', 'test-post.md');
  const res = await processPostFile(samplePath, { isDryRun: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.dryRun, true);
});

test('injectFrontmatterMetadata adiciona novos campos e preserva corpo', () => {
  const sample = `---
title: "Post de Teste"
tags:
  - java
---

Corpo do artigo aqui.`;

  const enriched = injectFrontmatterMetadata(sample, {
    published_at: '2026-09-11T12:00:00Z',
    linkedin_post_urn: 'urn:li:share:987654321'
  });

  assert.ok(enriched.includes('published_at: "2026-09-11T12:00:00Z"'));
  assert.ok(enriched.includes('linkedin_post_urn: "urn:li:share:987654321"'));
  assert.ok(enriched.includes('Corpo do artigo aqui.'));
  assert.ok(enriched.startsWith('---\n'));
});

test('getMimeType identifica tipos MIME de imagens e PDFs corretamente', () => {
  assert.strictEqual(getMimeType('foto.png'), 'image/png');
  assert.strictEqual(getMimeType('foto.jpg'), 'image/jpeg');
  assert.strictEqual(getMimeType('foto.jpeg'), 'image/jpeg');
  assert.strictEqual(getMimeType('animacao.gif'), 'image/gif');
  assert.strictEqual(getMimeType('banner.webp'), 'image/webp');
  assert.strictEqual(getMimeType('documento.pdf'), 'application/pdf');
  assert.strictEqual(getMimeType('arquivo.desconhecido'), 'application/octet-stream');
});

test('processPostFile com mídia em PDF executa dry-run com anexo simulado', async () => {
  const samplePdfPost = path.join(PROJECT_ROOT, 'tests', 'fixtures', 'test-carousel.md');
  const res = await processPostFile(samplePdfPost, { isDryRun: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.dryRun, true);
});
