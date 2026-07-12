# Réguas de Relacionamento e Campanhas — Especificação (cliente)

Definições passadas pelo cliente (2026-06-17). Subsistema configurado no **Flow Builder do Chatbotify** (cron/gatilho agendado), consumindo dados da Clinicorp via nosso microserviço.

## Gatilho de finalização ("alta")
Decisão do cliente: **"procedimento executado pelo profissional = alta"**. Quando o procedimento consta como **executado/realizado** no Clinicorp, considera-se concluído e dispara a régua no prazo.
- Fonte técnica: agendamentos com **status `CHECKOUT` ("4-Atendido")** + procedimento/especialidade. (Status confirmados via `/appointment/status_list`: CONFIRMED, ARRIVED, IN_SESSION, **CHECKOUT**, LATE, CALL...)
- Pendência: nome do parâmetro de data do `/appointment/list` (listagem por período) — a confirmar no Swagger/suporte.

## Réguas por procedimento (procedimento executado → meses → disparo)
| Procedimento | Prazo de retorno |
|---|---|
| Limpeza | 6 meses |
| Clareamento | 6 meses |
| Restaurações | 6 meses |
| Canal | 6 meses |
| Coroa / Prótese | 12 meses |
| Implante | 12 meses (ajustado de 6m pelo cliente em 2026-07) |
| Tratamento Periodontal | 3 meses |
| Ortodontia adulto | 6 meses |
| Invisalign | 6 meses |
| Odontopediatria | 6 meses |
| Lente de Contato / Faceta | 6 meses |

## Réguas por inatividade
- **Sem retorno há 12 meses** → reengajamento.
- **Sem consulta há 6 meses** → reengajamento.

## Campanhas programadas (data + frase de lista, arte de pasta)
Pedido do cliente: deixar campanhas **programadas** que buscam **data + frase numa lista** e a **arte numa pasta**, para envio automático (eles ainda estão produzindo arte/frases).
- Viável no Flow Builder: **gatilho agendado** lê uma fonte (planilha/lista com data+mensagem) e a mídia (link/pasta) → dispara pelo número "Disparos".
- Cliente mantém a lista + a pasta de artes; o sistema lê e envia na data marcada.

## Roteamento de unidade (Recreio x Ipanema) — RESOLVIDO
Regra do cliente (já no início do material de treinamento da IA): a IA **identifica o bairro** do paciente → indica a **unidade** → oferece horários. Se o paciente não responder o bairro, a IA **pergunta qual unidade** é melhor e segue o agendamento.
- ✅ **Modelo confirmado (2026-06-19):** tudo na **mesma conta/agenda** da Clinicorp (mesmo `business id 6247357829611520`, mesmo `code_link`). A unidade é derivada do **nome do profissional** (contém "Ipanema" → Ipanema; senão Recreio). Profissional em duas unidades = dois cadastros. Convenção para novos: incluir `- Recreio`/`- Ipanema` no nome. O backend já deriva e expõe `unit` no catálogo e na disponibilidade.

## Roteamento especialidade → profissional
- Fonte: **Excel "profissionais e preferências agendamento"** (na pasta do Drive do cliente) — regras de quem é responsável por cada avaliação. Necessário para a IA escolher o profissional certo por especialidade.

## Regras de preço (CRO)
- Enviar **apenas valores de consulta/avaliação**. **Nunca** valores de orçamento/tratamento sem avaliação (regra do CRO). Tratamento → sempre direcionar para avaliação. O contorno da objeção de "não ter preço" já está no material de treinamento.
