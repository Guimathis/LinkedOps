---
title: "Sealed Classes no Java: Modelagem Fechada e Segurança no Compilador"
tags:
  - backend
  - java
  - java17
  - softwareengineering
  - cleanarchitecture
media: "assets/2026-10-14-sealed-classes-java/diagram.png"
visibility: "PUBLIC"
published_at: "2026-10-14T23:10:12.065Z"
linkedin_post_urn: "urn:li:share:7516274186718257152"
---

As Sealed Classes foram oficializadas no Java 17, mas você já reparou como quase ninguém usa esse recurso no dia a dia? 🔒

No desenvolvimento com Java, é comum modelarmos regras de negócio com herança aberta ou enums. Mas e quando o sistema precisa representar um conjunto fechado de variantes, onde cada uma carrega dados e estruturas diferentes?

Historicamente, a orientação a objetos no Java sempre foi aberta: qualquer classe no mesmo pacote pode estender sua classe base, a menos que você a declare como final — o que proíbe qualquer extensão.

Sem uma forma de limitar hierarquias, os times acabam caindo em três abordagens comuns:

- Interfaces abertas com validações de instanceof e casts espalhados, sem garantia de que novos subtipos não quebrem premissas existentes.
- Enums com atributos nulos, forçando um único modelo a representar variantes com dados incompatíveis (como tentar concentrar dados de Pix, Boleto e Cartão em um único objeto).
- Blocos switch ou if/else com cláusula default lançando exceções em runtime, transferindo para produção a validação de que todos os fluxos foram tratados.

As Sealed Classes (e interfaces) resolvem esse problema na raiz da linguagem. Elas permitem fechar a hierarquia de tipos, definindo explicitamente no código quais classes têm autorização para estendê-las.

Como elas funcionam na prática:

1. 🔒 Cláusula permits: A declaração base define diretamente seus subtipos autorizados (ex: public sealed interface Pagamento permits Pix, Boleto, Cartao). Nenhuma outra classe fora dessa lista pode implementá-la.

2. 🧩 Subclasses com intenção obrigatória: Cada classe autorizada deve declarar se encerra a hierarquia (final), se mantém a restrição (sealed) ou se abre para novas extensões (non-sealed).

3. 📦 Combinação com Records: Combinar sealed interfaces com records permite modelar variantes imutáveis onde cada tipo possui seu próprio payload, sem campos nulos ou acoplamento desnecessário.

4. 🎯 Exaustividade no switch: O compilador passa a conhecer todos os subtipos possíveis. Ao cobrir as variantes em expressões switch, a cláusula default torna-se desnecessária. E se uma nova subclasse for criada no futuro, o build quebra onde ela não foi tratada.

5. 🛡️ Segurança de domínio no build: O design fica protegido contra extensões indevidas criadas acidentalmente por outros módulos ou novos fluxos.

Por que ainda são pouco utilizadas? Grande parte dos projetos backend ainda opera com padrões pré-Java 17, modelando tudo em torno de entidades mutáveis do JPA ou serviços abertos. Em domínios com eventos, máquinas de estado e integrações de pagamento, sealed classes eliminam código defensivo e transferem validações do runtime para o compilador.

Você já conhecia ou utiliza Sealed Classes no seu dia a dia com Java 17 ou 21? Ou na sua arquitetura esse recurso ainda passa despercebido nas code reviews?
