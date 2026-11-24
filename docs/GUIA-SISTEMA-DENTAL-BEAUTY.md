# 📘 Guia do Sistema — Dental Beauty / Oral Multi

Manual didático do sistema de atendimento com IA no WhatsApp. Guarde este documento para consultar sempre que tiver uma dúvida.

---

## 1. Visão geral

O sistema tem **3 partes** que trabalham juntas:

1. **Atendente virtual (IA)** — conversa com o paciente no WhatsApp 24h, tira dúvidas e conduz ao agendamento.
2. **Integração com a Clinicorp** — a IA consulta os horários **reais** da sua agenda e **marca/cancela** a avaliação direto na Clinicorp.
3. **Réguas automáticas** — o sistema envia mensagens sozinho em datas certas (aniversário, lembrete de consulta e retorno pós-atendimento).

---

## 2. O atendente virtual (IA)

**O que ele faz sozinho:**
- Dá as boas-vindas e entende o que o paciente procura.
- Identifica o **bairro** → direciona para a **unidade certa** (Recreio ou Ipanema).
- Explica **como funciona a avaliação** e informa **só o valor da avaliação** (nunca preço de tratamento, regra do CRO).
- Adapta o tom para **público infantil** (Dental Beauty Kids).
- Oferece **horários reais** da agenda e **marca a consulta**.
- Passa para um **atendente humano** quando necessário — já com um **resumo da conversa**.

**Onde editar o que a IA fala:** painel do Chatbotify → **Agentes** → conta **"Disparos"** → **Configurar Agente** → aba **Prompt do Agente**.
> ⚠️ O agente aparece na conta de WhatsApp **"Disparos"**. Se o seletor do topo estiver em outra conta, aparece "Nenhum agente" — é só trocar para Disparos.

---

## 3. Agenda (Clinicorp)

- A IA lê a **disponibilidade real** do Agendamento Online da Clinicorp e oferece **até 3 horários** por vez.
- Ao confirmar, ela **cria o agendamento na Clinicorp** automaticamente.
- **Importante:** só aparecem os profissionais que estão **publicados no Agendamento Online** da Clinicorp. Para a IA oferecer mais profissionais, basta adicioná-los lá (a recepção vê todos normalmente pela Clinicorp).

---

## 4. As réguas automáticas ⭐

As réguas são **100% automáticas**: o sistema dispara sozinho, no número **"Disparos"**, todo dia no horário programado (09h). **Você não precisa criar nem escolher número a cada envio** — só ligar ou desligar.

### 4.1 🎂 Aniversário
Todo dia, o sistema pega os aniversariantes do dia (da Clinicorp) e envia uma mensagem de parabéns.
- Pode ser **texto** ou **imagem**, com **arte diferente para adulto e para criança** (o sistema separa pela idade).

### 4.2 🔔 Lembrete / confirmação (no-show)
Um dia antes da consulta, envia uma mensagem confirmando a presença ("responda Sim/Não"). Reduz faltas.

### 4.3 🔄 Retorno pós-procedimento (o "de 6 em 6 meses")
Este é o mais inteligente. Funciona assim:
1. O sistema olha os agendamentos **passados** que constam como **"Atendido" (CHECKOUT)** na Clinicorp.
2. Calcula o prazo de retorno **conforme o procedimento** e, quando chega a data, **convida o paciente de volta**.

**Prazos por procedimento (configuráveis):**

| Procedimento | Retorno |
|---|---|
| Limpeza, Clareamento, Restauração, Canal, Implante, Ortodontia, Invisalign, Odontopediatria, Lente/Faceta | **6 meses** |
| Coroa / Prótese | **12 meses** |
| Tratamento Periodontal | **3 meses** |

**➕ Como adicionar/mudar um prazo ou procedimento:** esses prazos ficam configurados no motor do sistema. Para **incluir um novo procedimento** ou **mudar um prazo** (ex.: "quero que clareamento vire 4 meses"), é só me avisar com o procedimento + o prazo que eu ajusto — leva poucos minutos. *(Não precisa mexer em nada tecnicamente do seu lado.)*

### 4.4 Ligar / desligar as réguas
As réguas podem ser **pausadas** ou **religadas** a qualquer momento (hoje elas estão **pausadas** a seu pedido). Cada régua (aniversário, lembrete, retorno) pode ser ligada **individualmente**. É só me avisar qual quer ligar e a partir de quando.

---

## 5. Disparos manuais (campanhas)

Diferente das réguas automáticas, o **disparo manual** é quando **você** quer mandar uma mensagem pontual (uma promoção, um aviso) para uma **lista** de contatos.
- É feito no **painel do Chatbotify**, escolhendo o **número** de envio e a **lista**.
- ⚠️ Recomendação: use os **números de disparo dedicados** (não-oficiais e descartáveis) para campanhas em massa — assim, se algum for bloqueado, não afeta o número principal da recepção.
- *(Passo a passo detalhado com prints: em anexo/complemento.)*

---

## 6. Captura de dados e formulários (funil por número)

A IA preenche **automaticamente**, durante a conversa, os dados do lead no cadastro (CRM):
- **Origem/campanha** (ex.: veio do Facebook — a IA lê a frase do anúncio).
- **Agendou? Sim/Não** e, se não, **o motivo**.
- Especialidade/objetivo, unidade/bairro.

Cada número (**Recepção**, **Atendimento Lead**, **Orçamento**) tem seu **funil (pipeline) próprio**, e o lead caminha pelas etapas automaticamente. Os relatórios saem do próprio painel (ou exportados para um dashboard, ex.: Google Looker Studio, gratuito).

> ℹ️ Sobre origem de campanha no WhatsApp **não-oficial**: a captura automática do clique de anúncio é limitada; o confiável é a IA **ler a frase de entrada** do lead ("vim do Facebook, quero implante") ou usar **links/números distintos por campanha**.

---

## 7. Mídias por tipo de lead

A IA pode **enviar a mídia certa** conforme o caso (vídeo do espaço infantil, caso de implante, antes/depois de lente etc.).
- Para ativar: as artes/vídeos precisam estar **finalizados**, **em `.mp4`** (o `.MOV` do iPhone não sobe) e **identificados** (de preferência com o uso no título, ex.: `infantil-espaco-kids`).
- Cada mídia é cadastrada no agente com uma **descrição/regra de quando enviar**.

---

## 8. WhatsApp: oficial × não-oficial

| | Não-oficial (QR/código) | Oficial (Meta API) |
|---|---|---|
| Custo de conexão | Grátis | Cadastro/verificação na Meta |
| Estabilidade | Pode cair (reconectar pelo código) | Estável, não cai |
| Ligação por WhatsApp | ❌ não | ✅ sim (~R$0,0143/min) |
| Atender quem te chama | Grátis | **Grátis** (janela de 24h) |
| Disparo/marketing (você inicia) | — | Utilidade ~R$0,03 · Marketing ~R$0,31 por msg |

**Recomendação:** **recepção no oficial** (estável + ligação) e **disparos em números não-oficiais** descartáveis.

**Reconectar um número não-oficial que caiu:** no celular, remova o aparelho antigo (WhatsApp → Aparelhos conectados → Desconectar), feche as abas de WhatsApp Web e reconecte no Chatbotify pelo **código** ("Conectar com número de telefone").

---

## 9. Perguntas frequentes

- **A IA marca sozinha?** Sim — ela consulta a agenda real e cria o agendamento na Clinicorp na hora da confirmação.
- **Preciso criar cada envio das réguas?** Não. As réguas são automáticas; você só liga/desliga.
- **Como incluo um novo prazo de retorno?** Me avisa o procedimento + o prazo que eu configuro.
- **A IA fala preço de tratamento?** Não — apenas o valor da **avaliação** (regra do CRO). Tratamento → sempre direciona para a avaliação.
- **Ipanema faz radiografia?** Não — Ipanema faz só **fotos**. (A IA já está ajustada para isso.)
- **Um número no WhatsApp oficial ainda funciona no app comum?** Não — ao virar oficial, o número passa a ser "de API".

---

*Qualquer dúvida nova, é só chamar — este guia vai sendo atualizado conforme o sistema evolui.* 🦷
