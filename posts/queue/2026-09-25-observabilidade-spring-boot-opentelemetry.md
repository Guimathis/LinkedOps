---
title: "Implementando a tríade de Observabilidade em Microsserviços com Spring Boot e OpenTelemetry"
tags:
  - Observabilidade
  - OpenTelemetry
  - Grafana
  - GrafanaLoki
  - GrafanaTempo
media: "assets/2026-09-25-observabilidade/carrossel-observabilidade.pdf"
visibility: "PUBLIC"
---

Implementando a tríade de Observabilidade em Microsserviços com Spring Boot e OpenTelemetry:

• Prometheus: coleta e monitoramento de métricas

• Tempo: rastreamento distribuído (tracing) das requisições

• Loki: centralização e consulta de logs no Grafana



Para validar a resiliência, rodei um teste de carga com o Postman:
  • 12.170 requisições processadas
  • Vazão média de 163 req/s
  • Tempo médio de resposta de 54 ms (p95 de 135 ms e p99 de 278 ms)
  • 0,00% de taxa de falhas



Ter essa correlação direta entre logs, métricas e traces faz toda a diferença para investigar gargalos e falhas com rapidez.
