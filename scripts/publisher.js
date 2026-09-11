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
 * Injeta ou atualiza campos no cabeçalho YAML Frontmatter
 */
export function injectFrontmatterMetadata(rawContent, fieldsToInject) {
  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error("Delimitadores de Frontmatter ('---') não encontrados para injeção.");
  }

  let frontmatter = match[1];
  const body = match[2];

  for (const [key, value] of Object.entries(fieldsToInject)) {
    const keyRegex = new RegExp(`^${key}:.*$`, 'm');
    const formattedValue = typeof value === 'string' ? `"${value}"` : value;
    if (keyRegex.test(frontmatter)) {
      frontmatter = frontmatter.replace(keyRegex, `${key}: ${formattedValue}`);
    } else {
      frontmatter = `${frontmatter.trimEnd()}\n${key}: ${formattedValue}`;
    }
  }

  return `---\n${frontmatter.trim()}\n---\n\n${body.trim()}\n`;
}

/**
 * Move o arquivo publicado para posts/published/, enriquece o Frontmatter e grava no history.json
 */
export function archivePublishedPost(filePath, { postUrn, metadata, contentHash, publishedAt = new Date().toISOString() }) {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  const fileName = path.basename(resolvedPath);
  const publishedDir = path.join(PROJECT_ROOT, 'posts', 'published');

  if (!fs.existsSync(publishedDir)) {
    fs.mkdirSync(publishedDir, { recursive: true });
  }

  const destinationPath = path.join(publishedDir, fileName);
  const rawContent = fs.readFileSync(resolvedPath, 'utf8');

  // Injeta metadados de publicação no frontmatter
  const enrichedContent = injectFrontmatterMetadata(rawContent, {
    published_at: publishedAt,
    linkedin_post_urn: postUrn
  });

  // Grava o arquivo com metadados em posts/published/
  fs.writeFileSync(destinationPath, enrichedContent, 'utf8');

  // Se o arquivo original estava em outra pasta (ex: posts/queue/), remove da fila
  if (resolvedPath !== destinationPath && fs.existsSync(resolvedPath)) {
    fs.unlinkSync(resolvedPath);
  }

  // Atualiza history.json
  const historyPath = path.join(PROJECT_ROOT, 'history.json');
  let history = [];
  if (fs.existsSync(historyPath)) {
    try {
      history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      if (!Array.isArray(history)) history = [];
    } catch {
      history = [];
    }
  }

  const alreadyLogged = history.some(item => item.linkedin_urn === postUrn || item.content_hash === contentHash);
  if (!alreadyLogged) {
    history.push({
      file_path: path.relative(PROJECT_ROOT, destinationPath).replace(/\\/g, '/'),
      title: metadata.title,
      content_hash: contentHash,
      linkedin_urn: postUrn,
      published_at: publishedAt,
      media_attached: Boolean(metadata.media)
    });
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2) + '\n', 'utf8');
  }

  return destinationPath;
}

/**
 * Validação de integridade e idempotência
 */
export function validatePost(filePath, metadata, contentHash = null) {
  // 1. Checagem de post já publicado no próprio arquivo
  if (metadata.linkedin_post_urn) {
    return {
      isValid: false,
      reason: `Arquivo já possui 'linkedin_post_urn' (${metadata.linkedin_post_urn}). Ignorando para evitar duplicação.`
    };
  }

  // 2. Checagem de idempotência no histórico history.json
  if (contentHash) {
    const historyPath = path.join(PROJECT_ROOT, 'history.json');
    if (fs.existsSync(historyPath)) {
      try {
        const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
        if (Array.isArray(history)) {
          const match = history.find(item => item.content_hash === contentHash);
          if (match) {
            return {
              isValid: false,
              reason: `Conteúdo já foi publicado anteriormente (${match.linkedin_urn} em ${match.published_at}). Ignorando por idempotência.`
            };
          }
        }
      } catch {
        // Ignora falha de leitura em validação não-crítica
      }
    }
  }

  // 3. Checagem de existência física de mídia
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
 * Consulta informações do usuário autenticado (OAuth OpenID/userinfo)
 */
export async function getProfileInfo() {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!token) {
    throw new Error('Variável LINKEDIN_ACCESS_TOKEN não configurada no arquivo .env.');
  }
  const response = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha ao consultar perfil [HTTP ${response.status}]: ${text}`);
  }
  return await response.json();
}

/**
 * Processa um arquivo de post individual
 */
export async function processPostFile(filePath, { isDryRun = false } = {}) {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Arquivo não encontrado: ${resolvedPath}`);
  }

  console.log(`\n📄 Processando arquivo: ${path.relative(PROJECT_ROOT, resolvedPath)}`);
  const rawContent = fs.readFileSync(resolvedPath, 'utf8');
  const { metadata, body } = parseFrontmatter(rawContent);

  const formatted = formatContent(metadata, body);
  const hash = calculateContentHash(formatted.commentary);

  const validation = validatePost(resolvedPath, metadata, hash);
  if (!validation.isValid) {
    console.warn(`⚠️  [AVISO] ${validation.reason}`);
    return { skipped: true, reason: validation.reason };
  }

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
    return { success: true, dryRun: true };
  }

  console.log('\n🚀 Publicando no LinkedIn...');
  const result = await publishToLinkedIn(formatted);
  console.log(`🎉 Sucesso! Post publicado com URN: ${result.postUrn}`);

  // Ciclo de vida automático (Fase 3): enriquece frontmatter, move arquivo e atualiza history.json
  const archivedPath = archivePublishedPost(resolvedPath, {
    postUrn: result.postUrn,
    metadata,
    contentHash: hash
  });
  console.log(`📦 Post arquivado com sucesso em: ${path.relative(PROJECT_ROOT, archivedPath)}`);
  console.log(`📝 Log de publicação registrado em history.json\n`);

  return { success: true, postUrn: result.postUrn, archivedPath, metadata, formatted };
}

/**
 * Função principal CLI
 */
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  if (args.includes('--whoami')) {
    console.log('\n🔍 Consultando perfil associado ao LINKEDIN_ACCESS_TOKEN...');
    try {
      const info = await getProfileInfo();
      console.log(`👤 Nome: ${info.name || `${info.given_name} ${info.family_name}`}`);
      if (info.email) console.log(`📧 Email: ${info.email}`);
      console.log(`🆔 ID de Usuário (sub): ${info.sub}`);
      console.log(`\n💡 Dica de configuração:`);
      console.log(`Para postar no seu Perfil Pessoal, configure no .env:`);
      console.log(`LINKEDIN_AUTHOR_URN="urn:li:person:${info.sub}"\n`);
      return;
    } catch (err) {
      console.error(`❌ [ERRO AO CONSULTAR PERFIL] ${err.message}`);
      process.exitCode = 1;
      return;
    }
  }

  const targetFileArg = args.find(arg => !arg.startsWith('--'));

  let targetFiles = [];
  if (targetFileArg) {
    targetFiles = [targetFileArg];
  } else {
    const queueDir = path.join(PROJECT_ROOT, 'posts', 'queue');
    if (fs.existsSync(queueDir)) {
      targetFiles = fs.readdirSync(queueDir)
        .filter(f => f.endsWith('.md'))
        .map(f => path.join(queueDir, f));
    }
  }

  if (targetFiles.length === 0) {
    console.log('ℹ️  Nenhum post pendente encontrado para processar.');
    return;
  }

  console.log(`🎯 Encontrado(s) ${targetFiles.length} arquivo(s) para processamento.`);
  let hasErrors = false;
  for (const file of targetFiles) {
    try {
      await processPostFile(file, { isDryRun });
    } catch (err) {
      console.error(`❌ [ERRO AO PROCESSAR ${path.basename(file)}] ${err.message}`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error(`❌ Erro fatal: ${err.message}`);
    process.exitCode = 1;
  });
}
