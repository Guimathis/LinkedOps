#!/usr/bin/env node
/**
 * LinkedIn Content as Code — Publisher Script (Node.js)
 * Parsing, formatação e publicação na LinkedIn REST API.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Carregador simples de .env sem dependências externas
function loadEnv() {
  const envPath = path.join(PROJECT_ROOT, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

/**
 * Parser de Frontmatter YAML simplificado e autossuficiente
 */
export function parseFrontmatter(fileContent) {
  const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error("Arquivo Markdown inválido: cabeçalho Frontmatter ('---') não encontrado.");
  }

  const rawYaml = match[1];
  const body = match[2].trim();
  const metadata = {};

  const lines = rawYaml.split(/\r?\n/);
  let currentKey = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Item de lista
    if (trimmed.startsWith('- ') && currentKey) {
      if (!Array.isArray(metadata[currentKey])) {
        metadata[currentKey] = [];
      }
      const item = trimmed.slice(2).trim().replace(/^['"]|['"]$/g, '');
      metadata[currentKey].push(item);
      continue;
    }

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx !== -1) {
      const key = trimmed.slice(0, colonIdx).trim();
      let value = trimmed.slice(colonIdx + 1).trim();

      if (value === '') {
        currentKey = key;
        metadata[key] = [];
      } else {
        currentKey = null;
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        metadata[key] = value;
      }
    }
  }

  return { metadata, body };
}

/**
 * Transforma o Markdown para o formato aceito pelo LinkedIn:
 * 1. Converte marcadores de lista '- ' ou '* ' em bullets Unicode '• '
 * 2. Adiciona link canônico (se houver)
 * 3. Converte tags em hashtags ao final
 * 4. Valida limite de 3.000 caracteres
 */
export function formatContent(metadata, body) {
  if (!metadata.title) {
    throw new Error("Campo obrigatório 'title' ausente no Frontmatter.");
  }

  // 1. Transformar marcadores de lista em bullets Unicode
  let formattedBody = body
    .split('\n')
    .map(line => {
      const bulletMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
      if (bulletMatch) {
        return `${bulletMatch[1]}• ${bulletMatch[2]}`;
      }
      return line;
    })
    .join('\n');

  // 2. Adicionar link canônico se presente e não mencionado explicitamente
  if (metadata.canonical_url && !formattedBody.includes(metadata.canonical_url)) {
    formattedBody += `\n\n🔗 Link de referência:\n${metadata.canonical_url}`;
  }

  // 3. Adicionar hashtags a partir de tags
  if (Array.isArray(metadata.tags) && metadata.tags.length > 0) {
    const hashtags = metadata.tags
      .map(tag => {
        const cleaned = tag.replace(/^#/, '').trim();
        return cleaned ? `#${cleaned}` : '';
      })
      .filter(Boolean)
      .join(' ');

    if (hashtags) {
      formattedBody += `\n\n${hashtags}`;
    }
  }

  // 4. Validar limite de caracteres
  const charCount = formattedBody.length;
  if (charCount > 3000) {
    throw new Error(`Publicação excede o limite de 3.000 caracteres do LinkedIn (${charCount} caracteres).`);
  }

  return {
    title: metadata.title,
    visibility: metadata.visibility || 'PUBLIC',
    commentary: formattedBody,
    media: metadata.media || null,
    charCount
  };
}

/**
 * Validação de integridade e idempotência
 */
export function validatePost(filePath, metadata) {
  // Checagem de post já publicado
  if (metadata.linkedin_post_urn) {
    return {
      isValid: false,
      reason: `Arquivo já possui 'linkedin_post_urn' (${metadata.linkedin_post_urn}). Ignorando para evitar duplicação.`
    };
  }

  // Checagem de existência física de mídia
  if (metadata.media) {
    const mediaPath = path.resolve(PROJECT_ROOT, metadata.media);
    if (!fs.existsSync(mediaPath)) {
      throw new Error(`Arquivo de mídia não encontrado no caminho relativo especificado: ${metadata.media}`);
    }
  }

  return { isValid: true };
}

/**
 * Calcula hash SHA-256 do conteúdo
 */
export function calculateContentHash(content) {
  return crypto.createHash('sha256').update(content.trim()).digest('hex');
}

/**
 * Publica post via LinkedIn REST API
 */
export async function publishToLinkedIn({ commentary, visibility }) {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const authorUrn = process.env.LINKEDIN_AUTHOR_URN;
  const apiVersion = process.env.LINKEDIN_VERSION || '202608';

  if (!token || !authorUrn) {
    throw new Error('Variáveis de ambiente LINKEDIN_ACCESS_TOKEN e/ou LINKEDIN_AUTHOR_URN não configuradas.');
  }

  const endpoint = 'https://api.linkedin.com/rest/posts';
  const payload = {
    author: authorUrn,
    commentary: commentary,
    visibility: visibility === 'CONNECTIONS' ? 'CONNECTIONS' : 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: []
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'LinkedIn-Version': apiVersion,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (response.status === 201) {
    const postUrn = response.headers.get('x-restli-id') || response.headers.get('x-linkedin-id') || 'URN_CREATED';
    return { success: true, postUrn, status: response.status };
  } else {
    const errorText = await response.text();
    throw new Error(`Falha na chamada da API do LinkedIn [HTTP ${response.status}]: ${errorText}`);
  }
}

/**
 * Função principal CLI
 */
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const targetFileArg = args.find(arg => !arg.startsWith('--'));

  let filePath = targetFileArg;
  if (!filePath) {
    // Busca automática por arquivo na pasta queue
    const queueDir = path.join(PROJECT_ROOT, 'posts', 'queue');
    if (fs.existsSync(queueDir)) {
      const files = fs.readdirSync(queueDir).filter(f => f.endsWith('.md'));
      if (files.length > 0) {
        filePath = path.join(queueDir, files[0]);
      }
    }
  }

  if (!filePath) {
    console.log('Uso: node scripts/publisher.js [caminho/do/post.md] [--dry-run]');
    console.log('Nenhum arquivo especificado e nenhum arquivo .md encontrado em posts/queue/.');
    process.exitCode = 1;
    return;
  }

  const resolvedPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`[ERRO] Arquivo não encontrado: ${resolvedPath}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n📄 Processando arquivo: ${path.relative(PROJECT_ROOT, resolvedPath)}`);
  const rawContent = fs.readFileSync(resolvedPath, 'utf8');
  const { metadata, body } = parseFrontmatter(rawContent);

  const validation = validatePost(resolvedPath, metadata);
  if (!validation.isValid) {
    console.warn(`⚠️  [AVISO] ${validation.reason}`);
    return;
  }

  const formatted = formatContent(metadata, body);
  const hash = calculateContentHash(formatted.commentary);

  console.log(`📌 Título: "${formatted.title}"`);
  console.log(`🔒 Visibilidade: ${formatted.visibility}`);
  console.log(`📏 Contagem de caracteres: ${formatted.charCount} / 3.000`);
  if (formatted.media) {
    console.log(`🖼️  Mídia referenciada: ${formatted.media} (validada fisicamente)`);
  }
  console.log(`🔑 SHA-256: ${hash.slice(0, 16)}...`);

  if (isDryRun) {
    console.log('\n--- [MODO DRY-RUN: CONTEÚDO FINAL DO POST] ---');
    console.log(formatted.commentary);
    console.log('----------------------------------------------');
    console.log('✅ Dry-run concluído com sucesso. Nenhuma requisição externa foi realizada.\n');
    return;
  }

  console.log('\n🚀 Publicando no LinkedIn...');
  try {
    const result = await publishToLinkedIn(formatted);
    console.log(`🎉 Sucesso! Post publicado com URN: ${result.postUrn}`);
  } catch (err) {
    console.error(`❌ [ERRO AO PUBLICAR] ${err.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error(`❌ Erro fatal: ${err.message}`);
    process.exitCode = 1;
  });
}
