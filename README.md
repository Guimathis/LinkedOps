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
