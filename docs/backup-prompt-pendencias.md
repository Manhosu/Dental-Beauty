# Reconstrução do Agente — o que temos e o que falta

Contexto: em 19/07/2026 a conta antiga de Disparos ((21) 92000-2328) foi excluída no Chatbotify e **levou junto o agente "Atendimento Lead (TESTE)"** (prompt ~18k, 13 mídias, 1 documento, config de Requisições HTTP) **e as 25 automações de follow-up**. Verificadas as 4 contas restantes: nenhuma tem o agente.

## ✅ Recuperado / disponível
| Item | Onde | Estado |
|---|---|---|
| **Prompt do agente (18 seções, ~12k)** | [chatbotify/agente-lead-prompt-RECUPERADO.md](chatbotify/agente-lead-prompt-RECUPERADO.md) | Extraído do transcript da sessão. Termina certo (# RESUMO DO ATENDIMENTO). |
| Prompt base antigo (6.6k, 18/06) | [chatbotify/agente-lead-prompt.md](chatbotify/agente-lead-prompt.md) | Referência secundária |
| **13 mídias** | pasta `midias-followup/` (local, gitignored) | Arquivos intactos |
| Descrições + regras de cada mídia | [followup — memória do projeto] e histórico | Reescrever é rápido |
| **Textos das 25 automações** | [plano-followup-leads.md](plano-followup-leads.md) · [kit-templates-followup.md](kit-templates-followup.md) | Completos e aprovados |
| Textos das réguas (adulto+infantil) | [textos-reguas-APROVADO.md](textos-reguas-APROVADO.md) | Completos e aprovados |
| Backend (Render) | repo | **Intacto** — 120 testes |

## ⚠️ Falta reescrever no prompt (não foi capturado literalmente)
1. **`# IDIOMA`** — atender em PT/ES/EN/FR, respondendo no idioma do paciente.
2. **`# NPS PÓS-CONSULTA`** — pesquisa 0–10; **9–10** → agradecer + enviar o link do Google Maps
   `https://g.page/r/CQZuDgYFDS09EBM/review`; **7–8** → agradecer + perguntar o que melhorar;
   **0–6** → desculpar-se + handoff para humano.
3. **`# CRM` (versão ampliada)** — criar contato no pipeline em "Em atendimento D0"; mover para
   "Agendado / Não agendado [especialidade]"; registrar nas observações: Canal, Campanha,
   Especialidade, Status, Motivo, Código Clinicorp, Bairro; aplicar tag da campanha.
4. **`# MÍDIAS` (bloco de envio por URL)** — instrução de incluir a URL exata da mídia na resposta
   (a plataforma troca URL→arquivo), 1 mídia por mensagem, respeitar a regra de cada mídia.
5. **`# AGENDAMENTO` — exemplo de tool-call** (inserir antes de "Só RESPONDA depois..."):
   `EXEMPLO (marcação correta): paciente diz "pode ser 9:30" → você NÃO escreve nada ainda → chama "Marcar agendamento" { professionalId, nome, telefone, date: AAAA-MM-DD, fromTime: "09:30", toTime } → só APÓS o retorno "confirmed" você responde a confirmação. Se responder texto antes de chamar a ferramenta, está ERRADO.`

## 🔧 Reconfigurar no painel (além do prompt)
- **Modelos:** credenciais OpenAI (provedor gpt) — a conta nova está "sem modelo de IA configurado".
- **Requisições HTTP:** endpoints do nosso backend (disponibilidade, marcar, cancelar) + header `X-Api-Key`.
- **Mídias:** re-upload dos 13 arquivos + descrição e regra de cada um.
- **Documentos:** re-subir o PDF de apoio.
- **Automações (25):** recriar — ⚠️ as contas estão **sem módulo ativo** (limite de **2 automações/conta**);
  é preciso ativar o módulo na página de Assinatura antes.

## 📌 Lição / processo
Passar a **salvar o prompt no repo a cada alteração relevante** (o backup estava 1 mês desatualizado
quando o agente foi perdido). Este arquivo + o RECUPERADO passam a ser a fonte de verdade.
