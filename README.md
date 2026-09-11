# LinkedIn Content as Code (GitOps)

Publicação automatizada e versionamento de conteúdo técnico no LinkedIn utilizando princípios de GitOps e Content as Code.

---

## 📁 Estrutura de Diretórios

```text
git-linkedin-posts/
├── docs/
│   ├── PRD-linkedin-content-as-code.md   # Especificação técnica e de produto
│   └── review-log.md                     # Log de revisão e retrospectiva
├── posts/
│   ├── drafts/                           # Rascunhos e ideias em desenvolvimento
│   ├── queue/                            # Posts prontos para publicação
│   └── published/                        # Posts já publicados com URN gravado
├── assets/                               # Imagens, diagramas e documentos
├── scripts/
│   ├── publisher.js                      # Script principal de parsing, validação e envio (Node.js)
│   ├── publisher.py                      # Script alternativo em Python
│   ├── publisher.test.js                 # Testes unitários do publisher
│   └── requirements.txt                  # Dependências opcionais para Python
├── history.json                          # Log histórico de IDs e hashes de posts
├── package.json                          # Scripts de execução e testes (Node.js)
├── .env.example                          # Exemplo de configuração de segredos locais
└── README.md
```

---

## 🚀 Como Usar (Fase 1: MVP Local)

### 1. Pré-requisitos
- Node.js v18+ (recomendado v20+) ou Python 3.10+
- Credenciais da API do LinkedIn (OAuth 2.0 Access Token e Person/Org URN)

### 2. Configuração de Variáveis de Ambiente
Copie o arquivo de exemplo e preencha suas chaves:
```bash
cp .env.example .env
```
Edite o `.env`:
```env
LINKEDIN_ACCESS_TOKEN="seu_token_oauth_aqui"
LINKEDIN_AUTHOR_URN="urn:li:person:SEU_URN_AQUI"
```

### 3. Escrevendo uma Publicação
Crie um arquivo `.md` em `posts/queue/` com o cabeçalho YAML Frontmatter:

```markdown
---
title: "Título de Referência do Post"
tags:
  - backend
  - arquitetura
media: "assets/caminho/diagrama.png" # opcional
canonical_url: "https://meu-artigo.com" # opcional
visibility: "PUBLIC" # PUBLIC ou CONNECTIONS
---

Seu conteúdo em Markdown aqui...
- Item com marcador que será transformado em bullet Unicode
```

### 4. Executando em Modo Simulação (Dry-Run)
Para validar formatação, contagem de caracteres (< 3.000) e verificar assets sem enviar à rede social:

```bash
# Via npm:
npm run dry-run

# Ou especificando um arquivo direto:
node scripts/publisher.js posts/queue/2026-09-15-query-opt.md --dry-run
```

### 5. Executando os Testes Unitários
```bash
npm test
```

### 6. Publicando no LinkedIn
Quando o arquivo estiver pronto e as credenciais configuradas:
```bash
npm run publish
# ou
node scripts/publisher.js posts/queue/2026-09-15-query-opt.md
```

---

## 🤖 Automação Básica (Fase 2: GitHub Actions)

Com a Fase 2, o repositório conta com um pipeline automatizado em [`.github/workflows/publish.yml`](.github/workflows/publish.yml) que é engatilhado sempre que um post é adicionado ou alterado na pasta `posts/queue/` na branch `main`.

### 1. Configuração dos Segredos no GitHub
Para que a Action publique no seu perfil:
1. No seu repositório no GitHub, vá em **Settings** > **Secrets and variables** > **Actions**.
2. Clique em **New repository secret** e adicione:
   - `LINKEDIN_ACCESS_TOKEN`: Seu token OAuth 2.0 gerado no LinkedIn Developer Portal.
   - `LINKEDIN_AUTHOR_URN`: Seu URN de autor (ex: `urn:li:person:XXXXXXX` obtido via `npm run whoami`).
   - `LINKEDIN_VERSION` *(opcional)*: Versão da API (padrão: `202608`).

### 2. Fluxo de Publicação via Git
1. Crie uma branch com seu post:
   ```bash
   git checkout -b post/meu-novo-artigo
   # crie posts/queue/meu-post.md
   git add posts/queue/meu-post.md
   git commit -m "feat(post): add meu-post"
   git push origin post/meu-novo-artigo
   ```
2. Abra um Pull Request para a branch `main`.
3. Ao realizar o **Merge do PR na branch `main`**, a GitHub Action é disparada automaticamente:
   - Executa os testes unitários (`npm test`).
   - Processa os arquivos pendentes em `posts/queue/`.
   - Publica o post no LinkedIn.

### 3. Disparo Manual
Você também pode disparar a publicação manualmente a qualquer momento pela interface do GitHub:
- Vá na aba **Actions** > selecione **LinkedIn Content as Code — Publish Pipeline** > clique em **Run workflow**.

---

## 🔄 Ciclo de Vida Automático & Idempotência (Fase 3: GitOps Bot)

Na Fase 3, o pipeline atua de forma totalmente autônoma para gerenciar o estado dos posts:

### 1. O que acontece após a publicação bem-sucedida?
1. **Enriquecimento de Metadados:**  
   O arquivo Markdown recebe automaticamente os campos no Frontmatter:
   ```yaml
   published_at: "2026-09-11T13:45:00.000Z"
   linkedin_post_urn: "urn:li:share:7123456789012345678"
   ```
2. **Arquivamento Atômico:**  
   O arquivo é removido de `posts/queue/` e transferido para `posts/published/`.
3. **Log Histórico (`history.json`):**  
   Um registro com `file_path`, `title`, `content_hash` (SHA-256), `linkedin_urn` e `published_at` é gravado no índice histórico.
4. **Git Commit Automático:**  
   O bot do GitHub Actions faz commit e push das alterações para a branch `main` usando a tag `[skip ci]`, garantindo que o ciclo se encerre sem disparar loops infinitos de CI.

### 2. Prevenção de Duplicatas (Idempotência Dupla)
- **Nível 1 (Arquivo):** Se um arquivo já possuir `linkedin_post_urn`, o pipeline ignora a publicação e registra um aviso.
- **Nível 2 (Histórico):** Se o hash SHA-256 do texto já constar em `history.json`, o pipeline aborta a publicação para evitar duplicatas, mesmo que o arquivo seja renomeado.

---

## 🎨 Mídia Avançada: Imagens & Carrosséis em PDF (Fase 4)

Com a Fase 4, o **LinkedOps** realiza o upload automatizado em 2 etapas para qualquer asset de mídia referenciado no campo `media:` do Frontmatter:

### 1. Suporte a Imagens
- **Formatos suportados:** `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`.
- **Pipeline:**
  1. Inicializa o upload via `POST /rest/images?action=initializeUpload`.
  2. Envia o buffer binário via `PUT <uploadUrl>` com o Content-Type correspondente.
  3. Vincula o `urn:li:image:...` no post via `content.media`.

### 2. Suporte a Documentos e Carrosséis em PDF
- **Formato:** `.pdf`.
- **Como funciona no LinkedIn:** Arquivos PDF anexados a publicações são renderizados nativamente pelo LinkedIn como **Carrosséis deslizáveis**, proporcionando alta retenção e engajamento.
- **Pipeline:**
  1. Inicializa o upload via `POST /rest/documents?action=initializeUpload`.
  2. Envia o arquivo binário via `PUT <uploadUrl>` com `Content-Type: application/pdf`.
  3. Vincula o `urn:li:document:...` no post via `content.media`.

### 3. Exemplo de Post com Carrossel em PDF
```markdown
---
title: "Guia Rápido: Boas Práticas de Engenharia"
tags:
  - engineering
  - architecture
media: "assets/sample-carousel.pdf"
canonical_url: "https://github.com/Guimathis/LinkedOps"
visibility: "PUBLIC"
---

Carrosséis em PDF são ideais para tutoriais técnicos e guias visuais passo a passo! 📑
Confira o material completo no carrossel acima.
```



