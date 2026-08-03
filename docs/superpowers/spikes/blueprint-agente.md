# Blueprint do Agente — Dental Beauty (extraído do material do cliente)

Fonte: pasta Drive "IA - em criação" (manual completo, Excel de profissionais, etapas de funil, formulário de orçamento). Lido em 2026-06-18.

## Identidade
- **Clínica:** Dental Beauty — "Bem-estar, modernidade e cuidado em cada sorriso".
- **Tom:** acolhedor, familiar, educado, "clínica diferenciada".
- **Contato principal:** (21) 98121-7082.
- Instagram: @clinicadentalbeauty (adulto), @fadabrunela (infantil).

## Unidades (2 unidades físicas reais)
- **Recreio:** Rua Almirante Ary Rongel, 511. Radiologia digital no local (fotos + raio-X na avaliação), 300m², sala de cirurgia. **Faz todos os procedimentos.**
- **Ipanema:** Rua Visconde de Pirajá, 550 – sala 215 – TOP Center. **Só faz:** odontopediatria, ortopedia, lentes de contato dental, prótese, clareamento. (Demais → exclusivamente Recreio.)

### ✅ Modelo de unidades (resolvido com o cliente, 2026-06-19)
**Tudo na mesma conta/agenda da Clinicorp** (um único `subscriber`, um `business id 6247357829611520`, um `code_link 60903`). **Não há credencial separada para Ipanema.** A unidade é derivada do **nome do profissional**:
- Nome contém "Ipanema" → unidade **Ipanema**; senão → **Recreio** (padrão).
- Profissional que atende nas duas unidades tem **dois cadastros** (ex.: "Fábio - Odontopediatria - Recreio" e "Fábio - Odontopediatria - Ipanema").
- **Convenção para novos profissionais:** incluir a unidade no nome (`... - Recreio` / `... - Ipanema`). Assim o sistema classifica automaticamente, sem configuração extra.
- O backend deriva e expõe `unit` por profissional (catálogo) e por horário (disponibilidade).

## Regra bairro → unidade
A IA pergunta o **bairro** e direciona:
- **Bairros de Ipanema:** Leblon, Ipanema, Copacabana, Leme, Botafogo, Flamengo, Tijuca, São Conrado, Rocinha, Lagoa, Jardim Botânico, Catete, Laranjeiras, Centro, Glória → **oferecer Ipanema** (se o procedimento for atendido lá).
- Demais bairros, ou procedimento não atendido em Ipanema → **Recreio**.
- Se o paciente não informar o bairro, perguntar qual unidade prefere e seguir.

## Roteamento especialidade → profissional → unidade
(combina o Excel "profissionais e preferências" + o manual)

| Profissional | Especialidades | Unidades |
|---|---|---|
| Adriana | Ortodontia, Ortopedia, Clareamento, Invisalign | Recreio (Ipanema: agenda ainda não aberta) |
| Alinne | Lentes, Prótese, Clareamento | Recreio e Ipanema |
| Fábio | Odontopediatria, Ortopedia | Recreio e Ipanema (cadastros separados) |
| Haylane | Prótese, Implante, Lentes | só Recreio |
| Lívia | Prótese, Implante | só Recreio |
| Sérgio Sinzato | Implante (Bucomaxilo) | só Recreio |
| Thaynara | Clínica Geral, Periodontia | Recreio |

## Preços de CONSULTA/AVALIAÇÃO (os únicos que o robô pode enviar)
> Regra CRO: enviar **apenas** valor de consulta/avaliação. **Nunca** valor de tratamento/orçamento sem avaliação.
- **Geral:** Recreio R$200 (inclui fotos e radiologias) · Ipanema R$300.
- **Alguns casos:** Ipanema R$400 · Recreio R$550 (inclui fotos e radiologias).
- **Infantil (Recreio):** novos R$289 (avaliação) / com limpeza R$389 · antigos R$360.
- **Infantil (Ipanema):** R$389 (avaliação geral + limpeza).
- (Tabela completa por especialidade no manual — usar valores de avaliação por unidade.)

## Estrutura de funil (pipelines por número)
- **Atendimento Lead (98121-7082):** Em atendimento · Retorno agendado · Agendado [Odontopediatria/Lentes/Ortodontia/Implante e prótese/Clínica geral] · Não agendado [mesmas].
- **Orçamento (97552-0232):** Agendado Retorno · **D0 · D1 · D3 · D7 · D15** (régua de follow-up) · Orçamento Aprovado · Não fechado [Odonto/Lentes/Ortodontia/Implante/Outros].
- **Recepção (99128-2761):** Agendamento · Reagendamento · Aniversariantes · Pendências/Verificar com dentista · Financeiro · Reclamação · Concluído.

## Formulário de Negociação/Orçamento (campos)
Tipo · Mês do Orçamento · Especialidade (Implante protocolo/unitário/+2 dentes, Ortodontia/Ortopedia, Odontopediatria, Invisalign, Gerais, Lentes) · Código do Paciente (Clínico) · Status (Em negociação/Agendado/Fechado/Solicitou retorno/Sem resposta/Não fechado/Sem condições financeiras) · Valor · Observações · Retorno Agendado (data/hora).

## Réguas
Ver [reguas-e-campanhas.md](reguas-e-campanhas.md). Gatilho = procedimento executado (status "Atendido").

## Mídias por tipo de lead
Pasta Drive "Fotos e vídeos - em criação" (em produção). Enviar material conforme o caso (ex.: vídeo p/ crianças com autismo; implante unitário x protocolo). A IA classifica o tipo de lead e envia a mídia correspondente.

## Provedor de IA — RESOLVIDO (2026-06-22)
**OpenAI** (modelo **gpt-4.1**, sem raciocínio — trocado de gpt-5 porque o gpt-5 "pensa antes" e demorava ~60s no WhatsApp; gpt-4.1 responde na hora e é mais barato). Buffer de mensagens reduzido de 15s → 5s. Configurado e validado no agente "Atendimento Lead (TESTE)" (conta WhatsApp Disparos): card mostra "🤖 IA Ativa" / "OpenAI: Conectado ✓".
- **Gemini ficou inviável:** o Google passou a obrigar chaves do Gemini API vinculadas a conta de serviço (formato novo `AQ.Ab8...`), e o validador do Chatbotify **só aceita o formato antigo `AIza...`**, que o Google não gera mais para o Gemini. Suporte IA do Chatbotify estava com erro; e-mail humano (contato@chatbotify.com.br) sugerido em paralelo.
- **Custo:** pay-as-you-go OpenAI (cliente pôs ~US$5, sem recarga automática). Se precisar baratear, trocar para GPT-5 Mini/Nano.
- **Segurança:** chave `sk-proj-...` foi exposta no chat — orientado o cliente a rotacionar depois.
- **Handoff:** número do atendente (Atendimento Lead) `5521981217082` adicionado nas "Números para Notificação".
- **Saudação:** prompt instruído a abrir a primeira mensagem com "Olá! Seja bem-vindo(a) à Dental Beauty 😊".

## CRM, pré-preenchimento e resumo (item 2) — 2026-06-22
Pedidos do cliente: (a) o robô pré-preencher o cadastro/CRM do Lead pela conversa; (b) gerar resumo do atendimento no fim.
- **Pipeline criado no CRM do Chatbotify:** **"Atendimento Lead"** (marcado **PADRÃO**/Ativo), 4 etapas: **Em atendimento (10%) → Retorno agendado (37%) → Não agendado (63%) → Agendado (100%, Final/ganho)**. Cada etapa tem "Descrição para IA" odontológica para o sistema classificar o lead na coluna certa. Antes disso o CRM estava vazio (nenhum pipeline).
- **Agente (prompt) instruído** a usar o **Agente Especialista Pipeline/CRM** (ferramentas: Criar/Atualizar/Consultar Contato no Pipeline, Qualificar Lead quente/morno/frio + valor) para registrar e mover o lead em segundo plano, e a gerar **resumo** (nome, nº, bairro/unidade, objetivo/especialidade, o que foi tratado, próximo passo) ao finalizar/transferir.
- **Pendente/limitação:** o criador de pipeline só configura ETAPAS — não vi onde criar **campos personalizados** (Especialidade, Unidade, Bairro) que o cliente quer no "formulário". O robô já registra nome/telefone + estágio + temperatura; campos extras exigem configurar "campos personalizados de contato" (a confirmar com o cliente).

### Os 3 funis do CRM criados (2026-06-22) — pipelines são POR CONTA de WhatsApp
- **Atendimento Lead** (conta Disparos): Em atendimento · Retorno agendado · Não agendado · Agendado (final).
- **Orçamento** (conta orcamento 97552-0232): Agendado Retorno · D0 · D1 · D3 · D7 · D15 · Não fechado · Orçamento Aprovado (final). A régua D0→D15 é o follow-up pós-orçamento.
- **Recepção** (conta Recepcao 99128-2761): Agendamento · Reagendamento · Aniversariantes · Pendências/Verificar com dentista · Financeiro · Reclamação · Concluído (final).
- Cada etapa tem "Descrição para IA". Observação do Chatbotify: pipeline é criado sob a CONTA selecionada no seletor de contexto (topo); por isso cada funil foi criado trocando a conta. A última etapa é sempre marcada como "Final" (ganho/conclusão).

### Validação do agente Atendimento Lead (teste real WhatsApp, 2026-06-22)
Testado no número Disparos: ✅ saudação, ✅ fluxo bairro→objetivo→profissional+valor→agendar, ✅ regra CRO (recusa preço de tratamento), ✅ roteamento de profissional (Dra. Adriana p/ ortodontia), ✅ preço da avaliação (Recreio R$200), ✅ captura/qualificação de lead no CRM. Modelo final **gpt-4.1** (o gpt-4o-mini era rápido mas pulava etapas do fluxo). Ajustes finais no prompt: saudação só na 1ª msg + não reperguntar info já dada; e registrar o lead direto numa coluna do pipeline.
