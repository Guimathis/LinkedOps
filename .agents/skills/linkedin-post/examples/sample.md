---
title: "Circuit Breaker com Resilience4j em Microsserviços"
tags:
  - springboot
  - microservices
  - java
  - resilience4j
  - backend
media: "assets/2026-09-15/diagram.png"
canonical_url: "https://github.com/Guimathis/spring-cloud-microsservices"
visibility: "PUBLIC"
---

Em arquiteturas distribuídas, o fracasso de um serviço não pode significar a queda de todo o ecossistema. 🔍

O problema não é o serviço que caiu. É o que acontece com quem depende dele:
Imagine o exchange-service demorando 30 segundos para responder em vez de 50ms. O book-service chama ele em toda requisição:
• Cada thread do book-service fica presa aguardando resposta
• O pool de threads esgota
• O book-service para de atender, inclusive nos endpoints que não dependem do exchange
• O API Gateway acumula conexões pendentes e o sistema sai do ar

Esse é o efeito cascata.

Para evitar isso, utilizei o Circuit Breaker do Resilience4j com 3 estados:
1. Closed (Fechado): Fluxo normal de requisições.
2. Open (Aberto): Se a taxa de erro atingir o limite configurado (ex: 50%), o circuito abre e as chamadas recebem uma resposta de fallback instantânea.
3. Half-Open (Meio-Aberto): Após um período de espera, o circuito testa se o serviço dependente restabeleceu conexão antes de voltar a fechar.

O resultado é que o usuário recebe uma resposta de contingência em milissegundos em vez de um timeout.

E você, já enfrentou quedas em cascata na sua arquitetura? Como tratou a resiliência?
