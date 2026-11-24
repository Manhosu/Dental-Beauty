# Mensagem para o cliente — Conexão dos WhatsApp no Chatbotify

> Copie o bloco abaixo e envie ao cliente. Via recomendada: QR Code (rápida, usa os WhatsApp atuais).

---

Oi! Pra começarmos a configurar o atendimento automático, preciso que você **conecte os números de WhatsApp** na plataforma (Chatbotify). É rápido e você faz pelo computador + celular. Segue o passo a passo:

**O que você vai precisar:** os 4 celulares (ou chips) com os WhatsApp abaixo, cada um em mãos na hora de conectar.

**1) Entrar na plataforma (no computador)**
- Acesse: https://chatbotify.com.br/login
- E-mail: `financeiro@dentalbeauty.com.br`
- Senha: (a sua senha)

**2) Ir na área de números**
- No menu à esquerda, clique em **CANAIS → Contas de WhatsApp**.
- Clique no botão **"Nova Conta de Whatsapp"**.

**3) Escolher o tipo de conexão**
- Selecione **"API não oficial (Uazapi)"** (é a opção de QR Code, mais simples).
- Dê um **nome** para a conta para sabermos qual número é. Use exatamente estes nomes:
  - Para o (21) 99128-2761 → nome: **Recepção**
  - Para o (21) 98121-7082 → nome: **Atendimento Lead**
  - Para o (21) 92000-2328 → nome: **Disparos**
  - Para o (21) 97552-0232 → nome: **Orçamento**

**4) Ler o QR Code com o celular daquele número**
- A tela vai mostrar um **QR Code**.
- No celular **daquele número**, abra o **WhatsApp** → toque em **⋮ (ou Configurações)** → **Aparelhos conectados** → **Conectar um aparelho**.
- Aponte a câmera para o QR Code na tela do computador.
- Aguarde aparecer **"Conectado"**.

**5) Repetir para os 4 números**
- Volte ao passo 2 e repita para cada um dos 4 números, sempre usando o **celular certo** e o **nome certo** da lista acima.

**Observações:**
- Se em algum momento a plataforma pedir para **assinar um plano/módulo** para ativar a conta, me avise **antes de pagar** que eu confirmo o que é necessário (você comentou que pode assinar, mas quero garantir que é o módulo certo).
- Os WhatsApp continuam funcionando normalmente no celular — essa conexão não desativa nada.
- Quando terminar, me manda um print da tela **CANAIS → Contas de WhatsApp** mostrando os 4 conectados. Aí eu sigo com a configuração do atendimento.

Qualquer dúvida em algum passo, me chama que eu te ajudo. 🙏

---

## Notas internas (não enviar ao cliente)
- Via alternativa **API oficial (Meta)**: mais robusta e sem risco de bloqueio, mas exige Facebook Business Manager + verificação (mais demorado). Se o cliente preferir produção robusta, conduzir por essa via depois.
- Após conexão, anotar o **instance ID** de cada conta (CANAIS → Contas de WhatsApp → abrir a conta) para alimentar o `NumberRegistry` / Flow Builder.
- Próximo passo técnico (arquitetura C): confirmar bloco HTTP de saída no Flow Builder e expor nosso microserviço de agendamento Clinicorp para ser chamado por ele.
