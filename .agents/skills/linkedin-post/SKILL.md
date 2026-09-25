---
name: linkedin-post
description: >-
  Cria e formata posts técnicos para o LinkedIn no padrão GitOps (LinkedOps) e salva em posts/queue/ para revisão local, sem comitar. Use esta skill SOMENTE quando o usuário solicitar explicitamente a criação, rascunho ou redação de um post para o LinkedIn ou ao chamar comandos como /linkedin-post ou /post-linkedin.
---

# LinkedIn Post Creator (LinkedOps)

Esta skill guia a elaboração, formatação, geração de mídia e validação de publicações técnicas para o LinkedIn, utilizando a infraestrutura do repositório **LinkedOps**.

---

## 🎯 Regras Fundamentais

1. **Estado de Revisão (Queue)**: O arquivo gerado DEVE ser salvo em `posts/queue/YYYY-MM-DD-<slug>.md`.
2. **Sem Commits no Git**: NUNCA execute `git commit` ou `git push`. O post deve permanecer no working tree local como arquivo pendente para revisão manual do usuário.
3. **Validação Obrigatória**: Antes de finalizar, execute o script de dry-run para validar o frontmatter, mídias e limite de caracteres:
   ```bash
   node scripts/publisher.js posts/queue/YYYY-MM-DD-<slug>.md --dry-run
   ```
4. **Economia Rígida de Adjetivos**: Elimine adjetivos vazios, qualificadores dispensáveis e falsa modéstia. Consulte [Style Guide](./references/style-guide.md).

---

## 📋 Fluxo de Execução

### Passo 1: Compreensão do Tema e Coleta de Evidências
- Identifique o assunto do post solicitado pelo usuário.
- Se o post fizer referência a um projeto, estudo, repositório ou código local, inspecione os arquivos relevantes antes de escrever. Colete fatos concretos: nomes reais de classes, anotações, bibliotecas, comandos de terminal e métricas.
- Se o usuário não forneceu detalhes suficientes, faça perguntas rápidas ou assuma o escopo técnico diretamente com base nos arquivos locais.

### Passo 2: Redação do Conteúdo (Tom Guilherme Mathias)
Siga a estrutura narrativa validada nas publicações de referência:

1. **Gancho inicial**: Pergunta técnica provocativa ou constatação direta sobre um problema real (com um emoji sutil, ex: 🔍, 👀, 🔧).
2. **Cenário & Dor técnica**: Explique o contexto ou a consequência prática do problema antes de falar da solução. Mostre a causa e o efeito (ex: efeito cascata de conexões presas, retrabalho manual de arquivos entre projetos, etc.).
3. **O que foi feito / Solução**: Apresente a implementação em tópicos limpos (use `1º, 2º, 3º` ou marcadores temáticos com emojis como `🔎 Eureka:`, `⚖️ LoadBalancer:`, `📡 Feign:`, `🚪 Gateway:`).
4. **CTA (Call to Action)**: Finalize com uma pergunta técnica aberta incentivando a troca entre desenvolvedores (ex: *"E você, como lida com X no seu dia a dia?"*).
5. **Links úteis**: Se houver repositórios ou artigos de referência, cite-os de forma limpa.
6. **Hashtags**: Inclua de 4 a 8 hashtags técnicas específicas no final do post ou através do campo `tags` no Frontmatter.

### Passo 3: Mídia (Ideias ou Geração)
- Avalie se a publicação ganha valor com apoio visual:
  - **Imagem conceitual / Diagrama**: Gere a imagem (ou proponha o diagrama) e salve em `assets/<slug>/<arquivo>.png` ou `assets/<slug>.png`.
  - **Carrossel em PDF**: Se o conteúdo for um passo a passo extenso, estruture o roteiro de slides em PDF e indique o arquivo em `assets/`.
- Se uma imagem for gerada ou já existir, preencha o campo `media:` no Frontmatter. Se for post apenas de texto, omita o campo ou deixe-o ausente.

### Passo 4: Formatação do Frontmatter e Persistência
Crie o arquivo em `posts/queue/YYYY-MM-DD-<slug>.md` utilizando a data atual (ex: 2026-09-24) e o formato:

```markdown
---
title: "Título Descritivo do Post"
tags:
  - backend
  - java
  - springboot
media: "assets/meu-post/diagrama.png" # opcional (se houver arquivo físico existente)
canonical_url: "https://github.com/Guimathis/meu-repo" # opcional
visibility: "PUBLIC" # PUBLIC ou CONNECTIONS
---

Conteúdo do post aqui...
```

> [!WARNING]
> O publisher converte automaticamente marcadores `- ` ou `* ` em bullets Unicode `• ` e adiciona as `tags` como hashtags ao final. O limite total incluindo hashtags e canonical_url é de **3.000 caracteres**.

### Passo 5: Validação com Dry-Run
Execute:
```powershell
node scripts/publisher.js posts/queue/YYYY-MM-DD-<slug>.md --dry-run
```
Verifique a saída:
- `charCount`: Deve ser inferior a 3.000 caracteres.
- Se houver `media`, garanta que o arquivo físico realmente existe no caminho relativo.
- Se houver qualquer erro no dry-run, ajuste o arquivo imediatamente.

### Passo 6: Apresentação ao Usuário
Apresente ao usuário:
1. Caminho do arquivo criado em `posts/queue/`.
2. Contagem de caracteres e status da validação do dry-run.
3. Ideias ou assets de mídia anexados/gerados.
4. Lembrete de que o arquivo está apenas em staging local (uncommitted) pronto para revisão.
