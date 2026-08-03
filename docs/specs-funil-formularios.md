# Specs COMPLETAS — Funis + Formulários + Follow-up (Drive do cliente, atualizado 2026-07-01)

Fonte: `Etapas funil.docx` + `Formulário personalizados por pipeline.docx`.

## 1. Funis (pipelines) por número — com cadência de follow-up

### Atendimento Leads — (21) 98121-7082
- **Em atendimento D0** (1ª msg — operador ou campanha)
- **Em atendimento D1** (msg 1 dia após — PROGRAMADA)
- **Em atendimento D2** (2 dias após — programada ou continuação)
- **Em atendimento D4** (4 dias após — programada ou continuação)
- **Em atendimento D6** (6 dias após — programada ou continuação)
- **Aniversariantes** (IA envia msg automática com foto; fica nessa etapa)
- **Agendado Retorno** (programar retorno da IA no período)
- **Agendado**: Odontopediatria · Lentes · Ortodontia · Implante e prótese · clínica geral
- **Não agendado**: [cada especialidade] → *entra em banco de dados da especialidade p/ disparos futuros*

### Orçamentos — (21) 97552-0232
- **Agendado Retorno** (programar retorno da IA)
- **D0** (1ª msg — operador) · **D1** · **D3** · **D7** · **D15** (todas PROGRAMADAS)
- **Orçamento Aprovado**
- **Não fechado**: Odonto · Lentes · Orto · Implante · Outros → *banco de dados p/ disparos futuros*

### Recepção — (21) 99128-2761
- Agendado · Agendamento · Reagendamento · Pendências/Verificar com dentista · Financeiro · Reclamação · Concluído

## 2. Formulários (campos personalizados que a IA preenche)

### Orçamento
Status do Funil · Tipo (Cliente novo/Antigo) · Mês do Orçamento · Especialidade (Implante protocolo/unitário/2+/Orto-Ortopedia/Odonto/Invisalign/Gerais/Lentes) · Código do Paciente (Clínico) · Status da Negociação (Em negociação/Agendado/Fechado/Solicitou retorno/Sem resposta/Não Fechado/Sem condições financeiras) · Valor (monetário) · Observações · Retorno Agendado (data/hora)

### Atendimento Lead
Status do Funil · **Canal de Entrada** (Formulário/Site/FB-IG/Comentário/Indicação/Parceria/Propaganda-Currículo-Engano/Não ident.) · **Campanhas/Parceiros** (Implante/Odonto recreio/Odonto ipanema/Lentes recreio/Lentes Ipanema/Eventos/Parceria Espaço Pontal/Indicação/…) · **Especialidade** (avaliação geral/Odonto/Orto infantil/Orto adulto/Clareamento/Lentes/Implante unitário/Implante Protocolo/Prótese/Periodontia/Canal/Frenectomia/Não ident.) · **Status da Negociação** (Em conversa/Em agendamento/Agendado 1 pessoa/Agendado 2+/Reagendamento/Retorno futuro/Sem acordo) · **Motivo Sem Acordo** (13 opções: Agendamento concluído/Proc. não atendido/Convênio/SUS/Já em tratamento/Financeiro/Mora distante/Sem tempo/Sem resposta-com interação/Sem resposta-só encaminhado/Retornará outra data/Click errado/Engano) · Data/Hora agendamento · Nome · Código clinicorp · Bairro · Observações (resumos)

### Recepção
Status do Funil · Nome · Código clinicorp · Data/hora agendamento

## 3. Requisitos de automação novos
- **Follow-up programado por etapa** (nurture/drip): D1/D2/D4/D6 (leads) e D1/D3/D7/D15 (orçamento) — mensagens automáticas X dias após a 1ª, OU continuação da conversa com retorno sobre o último assunto.
- **Banco de dados por especialidade** dos "não agendado/não fechado" → base para **disparos futuros** segmentados.
- **Resumo do paciente no perfil** (ao clicar no contato) — a IA já gera resumo; salvar em campo visível.
- **Visão macro do funil** (entrada → comparecimento → fechou/não + valor) → ganho por campanha.

## 4. Escopo de implementação (FASE 2 — extensão)
1. Criar os **3 pipelines** com todas as etapas.
2. Criar **~50 campos personalizados** (com listas de opção) nos 3 formulários.
3. Instruir a **IA a preencher** os campos + mover o contato pela etapa certa.
4. Montar o **motor de follow-up programado** (D1/D2/D4/D6 e D1/D3/D7/D15) — via flows (Aguardar/Condição) ou cron no backend.
5. **Segmentação por especialidade** (banco p/ disparos futuros).
6. **Resumo no perfil** + **relatório macro** (dashboard de campanha/conversão).
