# README.md - Documento de Contexto do Projeto
## Agente Inteligente de Atendimento Odontológico (Chatbotify + Clinicorp)

Este documento centraliza todas as regras de negócio, especificações técnicas e fluxos operacionais para o desenvolvimento do sistema automatizado de triagem, conversão e régua de relacionamento da clínica odontológica.

---

## 1. Visão Geral do Projeto
Desenvolvimento de uma camada de software robusta baseada em código puro (**Full Code: TypeScript / Node.js**) atuando como a inteligência centralizada do ecossistema de atendimento. O sistema conecta nativamente a plataforma de atendimento **Chatbotify** ao ERP clínico **Clinicorp** via API Pública, automatizando o funil de agendamentos e a comunicação ativa pós-consulta.

---

## 2. Arquitetura de Integração e Stack Tecnológica
* **Hub de Atendimento & Interface Humana:** Chatbotify (com instâncias dedicadas de WhatsApp Business).
* **Camada de Código Integrador:** Next.js / Node.js estruturado em TypeScript.
* **Infraestrutura de Servidor:** VPS dedicada estável para escuta de Webhooks, controle de filas de mensagens e execução de rotinas programadas (Cron Jobs).
* **Persistência e Cache:** Logs estruturados para auditoria contínua de agendamentos e verificação de falhas de sincronização.

---

## 3. Escopo Funcional de Ponta a Ponta

### 3.1. Atendimento Conversacional e Pré-qualificação (Camada de IA)
* **Processamento de Linguagem Natural (NLP):** O agente interpretará mensagens de texto e áudio para classificar intenções ambíguas de pacientes leigos.
* **Extração de Entidades:** Identificação automática do nome preferencial do paciente e triagem exata da especialidade odontológica desejada (ex: Implante, Prótese Protocolo, Ortodontia, Clareamento).
* **Entrega Dinâmica de Mídias:** Envio automatizado via WhatsApp de materiais educativos e ricos armazenados na base de conhecimento (imagens de resultados autorizados, vídeos informativos e tabelas referenciais de preços).

### 3.2. Mecanismo Síncrono de Agendamento Inteligente
* **Consulta de Disponibilidade:** O código consome a API Pública da Clinicorp em tempo real para exibir na tela do WhatsApp as grades de horários livres, filtradas por profissional, unidade e especialidade.
* **Mitigação de Concorrência (*Double-Booking*):** Bloqueio atômico de horários. O agendamento só é confirmado no WhatsApp após o retorno positivo (`HTTP 200/201`) do registro nativo na Clinicorp.

### 3.3. Handoff Estruturado para o Atendente Humano (CRC)
* **Gatilhos de Escalação:** O atendimento é imediatamente transferido para a equipe humana em casos de solicitações complexas, objeções de pagamento agressivas ou pedido explícito do usuário.
* **Preservação de Contexto:** O operador humano recebe no painel do Chatbotify o histórico da triagem resumido, o procedimento de interesse identificado e os dados do lead coletados pela IA.
* **Supressão do Bot:** Desativação automática do comportamento do robô na conversa ativa até que o atendente marque o ticket como concluído.

### 3.4. Réguas de Relacionamento e Campanhas Automatizadas (Cron-Engine)
Uma rotina programada faz buscas assíncronas diárias na API da Clinicorp para disparar eventos automáticos na API do Chatbotify:
1.  **Follow-up de Limpeza (Pós-Procedimento):** Identifica pacientes que realizaram o procedimento de limpeza e agenda um disparo automático de lembrete para nova consulta após **6 meses**.
2.  **Redução de No-Show (Lembrete Ativo):** Disparos automáticos em **T-24h e T-2h** exigindo confirmação de presença (Sim/Não). Respostas negativas liberam a vaga de forma síncrona na Clinicorp.
3.  **Aniversariantes:** Consulta diária e felicitações customizadas automatizadas.
4.  **Campanhas de Banco de Dados:** Disparos de campanhas e reengajamento segmentados por procedimentos históricos executados pelo paciente.

## 4. Diretrizes para Geração de Código (Instruções Claude Code)
1.  **Clean Code:** Desenvolva middlewares reutilizáveis para o tratamento de erros (`try/catch` centralizados) e validações com `Zod` para as requisições de Webhooks vindas do Chatbotify.
2.  **Segurança e Logs:** Garanta o mascaramento de dados sensíveis de pacientes (LGPD) nos arquivos de logs do servidor.
3.  **Resiliência:** Implemente mecanismos de *retry* exponencial em caso de instabilidades temporárias ou *rate limit* da API Clinicorp.

---

## 5. Desenvolvimento

### Documentação do projeto
- **Design ponta a ponta:** [docs/superpowers/specs/2026-06-13-agente-odontologico-design.md](docs/superpowers/specs/2026-06-13-agente-odontologico-design.md)
- **Plano de implementação (Fase 0 + Agendamento):** [docs/superpowers/plans/2026-06-13-fase0-fundacao-e-agendamento.md](docs/superpowers/plans/2026-06-13-fase0-fundacao-e-agendamento.md)

### Pré-requisitos
- **Node.js 20+**
- **Redis** rodando localmente (para filas BullMQ e lock de agendamento em runtime). A maior parte dos testes usa *fakes* e **não** exige Redis.

### Setup
```bash
cp .env.example .env     # preencha os segredos (NUNCA commite o .env)
npm install
npm test                 # roda a suíte (Vitest)
```

### Variáveis de ambiente
Veja `.env.example`. Segredos sensíveis (token Clinicorp, credenciais Chatbotify) vão **somente** no `.env`, que é ignorado pelo git. Validados em runtime por Zod (`src/config/env.ts`).

### Estrutura
- `src/config` — env validado por Zod
- `src/lib` — utilitários transversais (erros, retry exponencial, logger com máscara LGPD)
- `src/domain` — `NumberRegistry` (roteamento número↔papel de WhatsApp)
- `src/http` — servidor Fastify, schema/rota de webhook do Chatbotify
- `src/queue` — conexão Redis, filas BullMQ e worker `inbound`
- `src/integrations` — interfaces de contrato dos clients Clinicorp/Chatbotify (implementação HTTP definida após os spikes)
- `src/scheduling` — lock atômico Redis e `SchedulingEngine` (confirmação síncrona anti double-booking)

### Scripts
- `npm test` — executa todos os testes
- `npm run test:watch` — modo watch
- `npm run build` — compila TypeScript
- `npm run lint` / `npm run format` — ESLint / Prettier

> **Pendências de Fase 0 (spikes):** mapear a API real da Clinicorp e a conta do Chatbotify — ver `docs/superpowers/spikes/`. A implementação HTTP dos clients depende desses achados.