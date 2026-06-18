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

### ⚠️ Pendência técnica crítica (Ipanema x Clinicorp)
A API da Clinicorp com a credencial atual retorna **apenas a unidade Recreio** (`business id 6247357829611520`). **Ipanema não aparece** em `business/list`. Como Ipanema é unidade real com agenda própria, **confirmar com o cliente** se Ipanema é outra conta/unidade no Clinicorp (precisaria de credencial/`code_link`/business próprios) — senão a marcação em Ipanema não cai no lugar certo.

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
