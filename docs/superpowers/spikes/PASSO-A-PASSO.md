# Passo a Passo — Concluir a Fase 0 (Setup + Spikes)

Guia completo para você (Windows 11 / PowerShell) preparar o ambiente e executar os dois spikes que faltam. Ao final, você terá mapeado as APIs reais da Clinicorp e do Chatbotify, e eu consigo escrever o plano da implementação HTTP dos clients.

> Tempo estimado: ~30 min de setup + ~1h por spike.
> Legenda: 🖥️ = comando no terminal · 🌐 = ação no navegador · ✍️ = anotar resultado.

---

## PARTE 0 — Preparar o ambiente local

### 0.1. Instalar o Node.js 20+
🌐 Baixe e instale o **Node 20 LTS ou superior**: https://nodejs.org
🖥️ Confirme no PowerShell:
```powershell
node --version   # deve mostrar v20.x ou maior
npm --version
```

### 0.2. Pegar o código
🖥️ Se ainda não tem o reppositório clonado em outra máquina, ele já está aqui em `c:\Workana\Dental Beauty`. Garanta que está na branch certa e atualizado:
```powershell
cd "c:\Workana\Dental Beauty"
git checkout feat/fase0-fundacao
git pull origin feat/fase0-fundacao
npm install
```

### 0.3. Subir um Redis (necessário só para rodar o app em runtime; os testes usam fakes)
Redis não roda nativo bem no Windows. Escolha **uma** opção:

- **Opção A — Docker (recomendado):**
  🖥️ ```powershell
  docker run -d --name redis -p 6379:6379 redis:7
  ```
- **Opção B — Memurai** (Redis para Windows): https://www.memurai.com (instala como serviço).
- **Opção C — Redis na nuvem (Upstash, grátis):** https://upstash.com → crie um banco → copie a `redis://...` URL.

> Para só rodar os **testes** você NÃO precisa de Redis. Para rodar o servidor/worker de verdade, precisa.

### 0.4. Criar o arquivo `.env` com as credenciais reais
🖥️ ```powershell
Copy-Item .env.example .env
notepad .env
```
✍️ Preencha assim (substitua pelos valores reais que o cliente passou):
```
NODE_ENV=development
PORT=3000
REDIS_URL=redis://localhost:6379
CLINICORP_API_BASE=https://sistema.clinicorp.com
CLINICORP_API_USER=oralmultiedentalbeautyoralmulti
CLINICORP_API_TOKEN=69d4de2f-6311-4fc8-a8c6-dbbbac9b85ff
CHATBOTIFY_API_BASE=
CHATBOTIFY_API_TOKEN=
```
> `CHATBOTIFY_API_BASE`/`TOKEN` ficam vazios por enquanto — você os descobre no Spike 2.
> ⚠️ O `.env` é ignorado pelo git (não vai pro repo). **Nunca** commite credenciais.
> ⚠️ Como o token/senha já circularam em texto puro, **rotacione-os** depois (item final).

### 0.5. Confirmar que tudo compila e os testes passam
🖥️ ```powershell
npm test
npx tsc -p tsconfig.json --noEmit
```
✅ Esperado: **34 testes passando** e `tsc` sem erros.

---

## PARTE 1 — Spike 1: Mapear a API da Clinicorp

Objetivo: descobrir o esquema de autenticação e os endpoints reais de **disponibilidade, agendamento, cancelamento, paciente e procedimentos**. Preencher [`2026-06-13-spike1-clinicorp.md`](2026-06-13-spike1-clinicorp.md).

### 1.1. Abrir a documentação interativa (Swagger)
🌐 Acesse: https://sistema.clinicorp.com/api-docs/
🌐 Procure o botão **"Authorize"** (cadeado, topo direito). Clique nele.
✍️ **Anote o esquema de auth que aparece** — é a informação mais importante. Pode ser:
- "API Key" com nome de header/query (ex: `token`, `subscriber`) →
- "Bearer" (OAuth2/JWT) →
- "Basic auth" (usuário + senha).

### 1.2. Identificar os endpoints na tela do Swagger
🌐 Na lista de endpoints, localize e **anote o método + path** de cada um destes (os nomes podem variar):

| Preciso de | Procure por (palavras-chave) |
|---|---|
| Disponibilidade de horários | `availability`, `available`, `schedule`, `agenda`, `slots` |
| Criar agendamento | `appointment` (POST), `agendamento` |
| Cancelar/liberar vaga | `appointment` (DELETE/PUT), `cancel` |
| Buscar paciente | `patient`, `paciente` |
| Listar procedimentos | `procedure`, `procedimento` |
| Profissionais / unidades | `professional`, `unit`, `dentista`, `unidade` |

✍️ Para cada um, anote: **método, path completo, e os parâmetros obrigatórios** (clique no endpoint para expandir).

### 1.3. Confirmar o esquema de auth com o script de sondagem
Eu já deixei um script que testa as formas de auth mais comuns automaticamente.

🖥️ Pegue um endpoint **de leitura** que você viu no Swagger (ex: o de disponibilidade ou o de procedimentos) e rode:
```powershell
node scripts/probe-clinicorp.mjs "/caminho/que/voce/viu/no/swagger"
```
Exemplo:
```powershell
node scripts/probe-clinicorp.mjs "/api/v1/procedure/list"
```
O script imprime o status HTTP de cada esquema de auth. **O que retornar `[200] ... <<< FUNCIONOU` é o correto.**
✍️ Anote qual esquema funcionou (ex: "Headers subscriber + token").

> Se nenhum der 200: o path provavelmente está errado — confira no Swagger. Você também pode testar direto pelo botão "Try it out" do Swagger depois de "Authorize".

### 1.4. Testar a disponibilidade de verdade
🖥️ Com o esquema certo e o path da disponibilidade, rode o probe nesse endpoint passando os filtros via query (profissional/unidade/especialidade), conforme os parâmetros que o Swagger pediu. Ex:
```powershell
node scripts/probe-clinicorp.mjs "/api/v1/appointment/availability?unit=1&specialty=implante"
```
✍️ **Cole a resposta JSON** (mascarando dados de paciente) no spike — preciso ver o formato exato dos campos (id do horário, profissional, unidade, início, etc.).

### 1.5. (Opcional, com cuidado) Testar criação de agendamento
Só se houver um ambiente de teste OU se puder usar um **horário/paciente descartável**.
🌐 Prefira fazer pelo Swagger ("Try it out") para ver request+response.
✍️ Anote o payload exigido e a resposta de sucesso (`200/201`) e a de conflito.
⚠️ **Cancele/desfaça** o agendamento de teste logo em seguida. NÃO use o script para isso.

### 1.6. Verificar a "Gestão de Webhook" da Clinicorp
🌐 No painel da Clinicorp (não na API), procure a área de **Gestão de Webhook**.
✍️ Anote: que **eventos** ela permite assinar (ex: agendamento criado/cancelado, paciente novo). Isso pode substituir parte do polling diário das réguas.

### 1.7. Preencher o documento do Spike 1
✍️ Abra [`2026-06-13-spike1-clinicorp.md`](2026-06-13-spike1-clinicorp.md) e preencha: autenticação, tabela de endpoints, exemplos de payload (mascarados), decisão webhook vs polling, e divergências em relação às nossas interfaces (`src/integrations/clinicorp/types.ts`).

---

## PARTE 2 — Spike 2: Mapear o Chatbotify

Objetivo: descobrir como o Chatbotify recebe (webhook) e envia mensagens, como suprime o bot no handoff, conectar os 4 números, e ver se transcreve áudio. Preencher [`2026-06-13-spike2-chatbotify.md`](2026-06-13-spike2-chatbotify.md).

### 2.1. Entrar na conta
🌐 Acesse o painel do Chatbotify e faça login:
- Usuário: `financeiro@dentalbeauty.com.br`
- Senha: (a que o cliente passou)
✍️ Dê uma volta no menu e anote as seções principais (ex: Canais/Channels, Integrações, Webhooks, API, Configurações).

### 2.2. Conectar os 4 números de WhatsApp
🌐 Procure a seção de **Canais / Conexões / WhatsApp**. Para cada número abaixo, siga o fluxo de conexão (geralmente leitura de QR Code ou WhatsApp Business API):

| Número | Papel no sistema |
|---|---|
| (21) 99128-2761 | Recepção (`reception`) |
| (21) 98121-7082 | Atendimento lead (`lead`) |
| (21) 92000-2328 | Disparos (`dispatch`) |
| (21) 97552-0232 | Orçamento (`quote`) |

✍️ Para cada número conectado, anote o **identificador da instância/canal** (instance ID) que o Chatbotify atribui — vamos usar no roteamento (`NumberRegistry`).

> Se a conexão exigir um plano pago / WhatsApp Business API oficial, **anote qual** e me avise — o cliente disse que assina o que for necessário.

### 2.3. Achar a configuração de Webhook (mensagens recebidas)
🌐 Procure em **Integrações / Webhooks / Desenvolvedor / API**. Você quer um campo onde colar uma **URL de webhook** que o Chatbotify chama quando chega mensagem.
✍️ Anote: existe webhook configurável? Quais eventos? Tem um "secret"/assinatura?

### 2.4. Capturar um payload real de mensagem recebida
Para alinhar nosso schema (`chatbotify.schema.ts`) ao formato real, capture uma mensagem de teste:

**Forma mais fácil (sem expor seu PC):**
🌐 Acesse https://webhook.site → ele te dá uma URL única.
🌐 Cole essa URL no campo de webhook do Chatbotify.
🌐 Envie uma mensagem de WhatsApp (texto) para um dos números conectados.
🖥️/🌐 Volte ao webhook.site e veja o **JSON que chegou**.
✍️ **Copie esse JSON inteiro** (mascarando telefone) para o spike. Repita com um **áudio** para ver como áudio chega.

**Forma alternativa (testar nosso próprio servidor):**
🖥️ Suba o servidor local e exponha com um túnel:
```powershell
# terminal 1: (precisa de um entrypoint; por ora use o webhook.site acima)
# terminal 2: túnel para localhost:3000
npx cloudflared tunnel --url http://localhost:3000
```
> Obs: o entrypoint de produção (juntar servidor+worker) ainda será feito na próxima fase; por isso, para o spike, **prefira o webhook.site**.

### 2.5. Achar a API de envio (disparo de mensagens)
🌐 Procure em **API / Documentação / Integrações** do Chatbotify: como **enviar** uma mensagem via API (endpoint, token de API, base URL).
✍️ Anote: base URL da API, como autentica (token/API key), endpoint de envio de texto e de mídia, e como se escolhe o número de origem.
✍️ Esses valores preenchem `CHATBOTIFY_API_BASE` e `CHATBOTIFY_API_TOKEN` no `.env`.

### 2.6. Mecanismo de supressão do bot (para o handoff)
🌐 Veja se há como **pausar/silenciar o bot** numa conversa (via API ou regra), para quando um humano assumir.
✍️ Anote como funciona (endpoint, flag, tag, etc.).

### 2.7. Transcrição de áudio (STT)
🌐 Veja se o Chatbotify **transcreve áudio** nativamente (alguns têm "transcrição"/"speech to text").
✍️ Anote: sim/não. Se **não**, vamos plugar um Whisper-class (Groq/OpenAI) na Fase 2.

### 2.8. Preencher o documento do Spike 2
✍️ Abra [`2026-06-13-spike2-chatbotify.md`](2026-06-13-spike2-chatbotify.md) e preencha tudo: payload de entrada, API de disparo, supressão do bot, mapa número↔instância, STT, e ferramentas a assinar.

---

## PARTE 3 — Me devolver os achados

Quando terminar (mesmo que parcialmente), me mande:

1. **Clinicorp:** qual esquema de auth funcionou + a tabela de endpoints + 1 exemplo de JSON de disponibilidade (mascarado).
2. **Chatbotify:** o JSON real de uma mensagem recebida (webhook.site) + base URL/endpoint de envio + se conecta os 4 números + se tem STT.
3. Os dois arquivos de spike preenchidos (ou colados aqui).

Com isso eu escrevo o **plano da Fase 1 completa**: implementação HTTP do `ClinicorpClient` e do `ChatbotifyClient`, adaptador real do lock no Redis, e o **entrypoint de produção** (webhook → fila → worker → roteamento → agendamento).

---

## PARTE 4 — Segurança (fazer ao final)

- 🔐 **Rotacionar o token da Clinicorp** (gerar um novo no painel) e a **senha do Chatbotify**, já que circularam em texto puro.
- 🔐 Confirmar que o `.env` **não** foi commitado: `git status` não deve listar `.env`.
- 🔐 Guardar as credenciais num gerenciador (1Password/Bitwarden), não em arquivos soltos.
