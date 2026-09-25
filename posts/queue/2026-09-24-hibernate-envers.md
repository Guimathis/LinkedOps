---
title: "Hibernate Envers: Auditoria e Versionamento de Entidades JPA"
tags:
  - backend
  - java
  - hibernate
  - springboot
  - databases
media: "assets/2026-09-24-hibernate-envers/diagram.png"
visibility: "PUBLIC"
---

Até pouco tempo atrás, eu nunca tinha ouvido falar no Hibernate Envers. 🔍

No desenvolvimento com Java e Spring Boot, é comum lidarmos com mapeamento de entidades, cache e migrations com Flyway ou Liquibase. Mas e quando o sistema precisa responder: quem alterou este registro, quando alterou e qual era o valor exato antes da modificação?

Rastrear alterações é um requisito frequente em regras de conformidade e investigações de suporte técnico. Sem uma ferramenta dedicada, muitos times acabam adotando três caminhos:

- Colunas básicas como "updated_at" e "updated_by", que registram apenas o último estado e descartam todo o histórico intermediário.
- Triggers manuais no banco de dados, que amarram a lógica ao dialeto SQL e dificultam testes automatizados.
- Tabelas de log mantidas manualmente na aplicação, gerando código repetitivo e risco de esquecer de registrar alterações em novos fluxos.

O Hibernate Envers resolve esse problema na camada de persistência. Ele é um módulo oficial do Hibernate projetado especificamente para auditoria e histórico temporal de entidades JPA.

Como ele funciona na prática:

1. 🏷️ Anotação @Audited: Basta adicionar a anotação na classe da entidade (ou apenas nos atributos específicos que precisam de rastreamento).

2. 🗄️ Tabelas espelho automáticas: Para cada entidade auditada, o Envers gera uma tabela com sufixo "_AUD" (como "pedido_aud") e uma tabela central de controle de revisões ("REVINFO").

3. 📝 Registro por transação: A cada INSERT, UPDATE ou DELETE, o Envers intercepta a operação e salva o snapshot do estado com o identificador da revisão e o tipo de alteração (inclusão, modificação ou remoção).

4. ⏱️ Consultas históricas com AuditReader: A API AuditReader permite recuperar o estado exato de qualquer entidade em um instante específico do tempo ou em uma revisão determinada.

5. 👤 Metadados de auditoria: Com @RevisionEntity e @RevisionListener, é possível gravar na revisão dados adicionais do contexto, como o usuário autenticado ou o correlation ID da requisição.

A ferramenta evita a necessidade de criar tabelas de log manuais ou triggers customizadas para atender requisitos de rastreabilidade.

Você já conhecia ou utiliza o Hibernate Envers nos seus projetos? Ou na sua arquitetura vocês utilizam JaVers, triggers no banco ou tabelas manuais de histórico?
