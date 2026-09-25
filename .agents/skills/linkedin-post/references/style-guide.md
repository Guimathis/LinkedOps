# Guia de Estilo e Economia de Adjetivos (LinkedIn)

Este guia define as regras de redação técnica e escolha de vocabulário para posts no LinkedIn no estilo de Guilherme Mathias.

---

## 🚫 Regra de Ouro: Economia Rígida de Adjetivos

IAs tendem a inflar textos com adjetivos desnecessários, adjetivos de intensidade ("extremamente", "super", "incrivelmente"), jargões corporativos e falsa modéstia ("um simples projeto"). 

**No estilo deste repositório, corte o excesso e seja direto.**

### 1. Elimine a Falsa Modéstia
- ❌ *"Desenvolvi um simples projeto"* ➔ ✅ *"Desenvolvi um projeto"*
- ❌ *"Criei uma pequena biblioteca"* ➔ ✅ *"Criei uma biblioteca"*
- ❌ *"Fiz um teste básico"* ➔ ✅ *"Fiz um teste"*

### 2. Elimine Jargões e Adjetivos Redundantes
- ❌ *"Dashboard analítico"* ➔ ✅ *"Dashboard"*
- ❌ *"Pipeline robusto e eficiente"* ➔ ✅ *"Pipeline"* (ou dê números concretos: *"Pipeline que executa em 45 segundos"*)
- ❌ *"Solução escalável e inovadora"* ➔ ✅ *"Solução com processamento assíncrono"*
- ❌ *"Visão consolidada e estratégica"* ➔ ✅ *"Visão unificada"* ou descreva o dado real
- ❌ *"Arquitetura moderna e poderosa"* ➔ ✅ *"Arquitetura orientada a eventos"*
- ❌ *"Ferramenta indispensável"* ➔ ✅ *"Ferramenta"*

### 3. Fatos e Dados no Lugar de Qualificadores
Em vez de dizer que algo é "rápido", "robusto", "complexo" ou "grande", mostre o dado concreto ou a tecnologia:
- Em vez de: *"Tratei grandes volumes de dados"* ➔ Use: *"Processei 100 mil registros por lote"*
- Em vez de: *"Implementei um sistema de alta performance"* ➔ Use: *"Implementei cache distribuído com Redis reduzindo a latência para 12ms"*

---

## ✍️ Tom de Voz

1. **Pragmático e Prático**: Fale como um engenheiro que acabou de sair do terminal e quer compartilhar uma lição aprendida ou arquitetura testada.
2. **Humano e Colaborativo**: Abertura para debater trade-offs técnicos. Nunca assuma tom de "palestrante que sabe tudo".
3. **Fluidez na Primeira Pessoa**:
   - *"Ando estudando..."*
   - *"Resolvi colocar a mão na massa e..."*
   - *"Cansado de copiar e colar... resolvi criar..."*
   - *"O problema não é o serviço que caiu. É o que acontece com quem depende dele."*

---

## 📐 Estrutura Padrão de Parágrafos

- **Linhas curtas e respiradas**: Dê espaçamento duplo entre parágrafos para facilitar leitura em telas de smartphones.
- **Destaque visual sutil**: Use poucos emojis com propósito de categorização (ex: `🔎`, `⚖️`, `📡`, `🚪`, `1º:`, `2º:`).
- **Sem formatação incompatível**: O LinkedIn não suporta títulos markdown `#` ou negritos `**texto**` diretamente no feed; o `publisher.js` converte listas em `• `, mas use pontuação clara para títulos e cabeçalhos inline.
