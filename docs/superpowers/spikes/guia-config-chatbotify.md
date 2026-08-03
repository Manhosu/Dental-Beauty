# Guia de Configuração do Chatbotify (Arquitetura C)

Como configurar o atendimento na plataforma **chatbotify.com.br**, integrando com nosso **microserviço de agendamento Clinicorp** via Flow Builder. Pré-requisito: ao menos 1 número de WhatsApp conectado (ver `mensagem-cliente-conexao-whatsapp.md`).

> **Divisão de responsabilidades (Arquitetura C):**
> - **Chatbotify (no-code):** conversa, IA/triagem, base de conhecimento, mídias, handoff, supressão do bot, réguas (cron), CRM.
> - **Nosso microserviço (HTTP):** disponibilidade + agendamento atômico anti double-booking na Clinicorp. Endpoints:
>   - `GET  /agendamento/disponibilidade?date=YYYY-MM-DD[&professionalId=…]`
>   - `POST /agendamento/book` → 201 confirmado / 409 vaga ocupada / 502 falha
>   - `POST /agendamento/cancelar` `{ appointmentId }` (anti no-show)

---

## 1. Criar o Agente de IA
**Canais → Agentes → Novo Agente** (ou "Explorar Agentes Públicos" e adaptar).
- **Comportamento/Persona:** atendente da Dental Beauty; tom acolhedor; objetivo: triagem + agendamento.
- **Especialidades alvo** (vêm da Clinicorp): Avaliação Implante, Lentes, Odontopediatria, Ortodontia, Endodontia, Periodontia, Prótese, Clínica Geral, Bucomaxilo.
- Vincular o agente à **conta de WhatsApp** "Atendimento Lead" (e/ou Recepção).
- Ativar **Verificação de Mensagem de Agente** (aba Comportamento) para não responder a outros bots.

## 2. Base de Conhecimento (preços + mídias do Drive)
**Aba Documentos** do agente:
- Subir o **documento de treinamento da IA** e a **tabela de preços** (do Google Drive do cliente).
- Subir as **imagens/vídeos** (resultados autorizados, vídeos informativos) para a entrega dinâmica de mídia.
- Se usar Gemini + Google File Search, a ferramenta **🔍 Buscar em Documentos** fica ativa automaticamente.

## 3. Ferramentas do Agente (handoff, supressão, aniversário)
**Agentes → Ferramentas do Agente** — ativar e personalizar o "quando acionar":
- **🔔 Notificação / Atendimento Humano** → handoff para o CRC (objeções de pagamento, pedido explícito, casos complexos).
- **⏸️ Desabilitar Contato** → supressão do bot quando humano assume.
- **🎂 Salvar Aniversário** → alimenta a régua de aniversário.

## 4. Integração com o agendamento (Flow Builder + bloco HTTP)
O agente, ao concluir a triagem (especialidade + nome), deve **consultar disponibilidade** e **agendar** chamando nosso microserviço.

**Canais → Flow Builder → novo fluxo "Agendamento":**
1. **Bloco HTTP (GET disponibilidade):** `GET https://SEU_DOMINIO/agendamento/disponibilidade?date={{data_escolhida}}`. Guardar a resposta (`slots`) numa variável e oferecer os horários ao paciente.
2. Paciente escolhe horário → preencher variáveis do slot (profissional, cadeira, fromTime/toTime).
3. **Bloco HTTP (POST book):** `POST https://SEU_DOMINIO/agendamento/book` com corpo JSON:
   ```json
   {
     "slotId": "{{slot_id}}",
     "professionalId": "{{professional_id}}",
     "specialty": "{{especialidade}}",
     "patient": { "name": "{{nome}}", "phone": "{{telefone}}" },
     "date": "{{data_iso}}",
     "fromTime": "{{hora_inicio}}",
     "toTime": "{{hora_fim}}",
     "dentistPersonId": {{dentist_person_id}},
     "scheduleToId": {{chair_id}}
   }
   ```
   - **HTTP 201** → confirmar para o paciente ("Agendado! ✅").
   - **HTTP 409** → vaga ocupou (concorrência) → reoferecer a grade (voltar ao passo 1).
   - **HTTP 502** → falha temporária → pedir para tentar de novo / handoff.

> Observação: o microserviço garante o **anti double-booking** (lock atômico + confirmação só após a Clinicorp responder 200). O Flow Builder não precisa se preocupar com concorrência — basta tratar o 409.

## 5. Réguas (Flow Builder → ⏰ Gatilho Agendado)
Os dados vêm da Clinicorp **através do nosso microserviço** (endpoints prontos):

- **Aniversariantes** (✅ pronto): gatilho **diário** → **Bloco HTTP** `GET https://SEU_DOMINIO/pacientes/aniversariantes` → retorna `{ aniversariantes: [{ patientId, name, mobilePhone, ... }] }` → para cada item, disparar felicitação pelo número "Disparos".
- **Anti no-show:** gatilho T-24h e T-2h → buscar os agendamentos do dia (endpoint de próximos agendamentos — *pendente: confirmar o parâmetro de data do `/appointment/list` da Clinicorp*) → enviar confirmação (Sim/Não). Se "Não" → `POST /agendamento/cancelar` `{ "appointmentId": "{{id}}" }` (libera a vaga). O cancelamento **já está pronto**.
- **Follow-up limpeza (6 meses):** gatilho agendado + histórico de procedimentos (a expor sobre `/patient/list_appointments`) → disparo de lembrete.
- **Campanhas:** segmentar por procedimento histórico e disparar pelo número "Disparos".

### Endpoints de catálogo (para o agente conhecer as opções válidas — README §3.1)
- `GET /catalogo/especialidades` → `{ especialidades: [{ id, description, type, active }] }`
- `GET /catalogo/profissionais` → `{ profissionais: [{ id, name, cpf }] }`
Use no início da conversa (ou em cache) para o agente oferecer especialidades/profissionais reais da Dental Beauty.

## 6. Papéis por número (definição do cliente)
Os 4 números já estão conectados. Comportamento desejado:

- **Atendimento Lead** → **IA completa** que atende o lead (triagem + agendamento). É o agente principal.
- **Recepção** → IA focada em **pacientes já em tratamento / que já vieram à clínica** (não em leads novos).
- **Orçamento** → mais **automação/fluxos**: resgate de mensagens e atendimento **fora do horário comercial**.
- **Disparos** → apenas **disparos** (saída). Quando um lead **responde** a um disparo, o contato é **assumido pelo fluxo do Atendimento Lead** para finalizar o atendimento.

Automação adicional (Lead e Orçamento): para leads que **enviam mensagem e não respondem** depois, colocar num **fluxo de follow-up** e, mais adiante, numa **etapa de requalificação** que recebe novos envios.

## 7. Plano de testes da IA (sem afetar pacientes reais)
⚠️ Recepção, Lead e Orçamento recebem mensagens de **pacientes reais** — ligar a IA neles para testar faria o robô responder pacientes de verdade. Por isso:

1. **Banco de testes = número "Disparos".** Ele não recebe tráfego de entrada real. Ligar temporariamente a **IA completa do Lead** nesse número para validar conversa, triagem, catálogo e o agendamento de ponta a ponta — mensageando nós mesmos.
2. **Recepção / Lead / Orçamento:** ficam **conectados, mas com a IA desligada** até a validação terminar.
3. **Em paralelo**, o motor de agendamento é testado **direto pelos endpoints** (não precisa de WhatsApp) — então essa frente não fica bloqueada.
4. **Promoção para produção:** validado no Disparos, replicamos as configurações nos números reais (ligar IA no Lead/Recepção, montar automações do Orçamento) **em horário de baixo movimento**, e devolvemos o Disparos ao papel de só-disparo.

---

## Pendências antes de ligar o agendamento de ponta a ponta
1. **Código de acesso do Agendamento Online (Clinicorp)** — habilitar no painel da Clinicorp; sem ele a `disponibilidade` não retorna horários. → confirmar nome do parâmetro e mapear a resposta no `HttpClinicorpClient.getAvailability`.
2. **Deploy do microserviço** numa VPS com domínio HTTPS (ver `Dockerfile`/`docker-compose.yml`) para o Flow Builder conseguir chamá-lo.
3. **Confirmar** os campos do slot (chair_id/dentist_person_id) que a disponibilidade real retorna, para preencher o corpo do `book`.
