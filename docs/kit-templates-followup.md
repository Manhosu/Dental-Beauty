# Kit de Templates — Follow-up de Leads (WhatsApp API Oficial / Meta)

Guia pronto para **submeter os 25 follow-ups como templates** no painel oficial (WhatsApp Manager / BSP).
Cada template segue o mesmo padrão; é só copiar os campos.

## Campos de cada template
- **Nome** (obrigatório, minúsculo, sem espaço): use o sugerido (`fup_<especialidade>_d<dia>`).
- **Categoria:** `MARKETING` (são mensagens de reengajamento).
- **Idioma:** `Português (BR)` / `pt_BR`.
- **Cabeçalho (Header):** `MÍDIA` — tipo **IMAGEM** (.jpg/.png) ou **VÍDEO** (.mp4), conforme indicado. Onde diz "— (sem cabeçalho)", deixe **só texto**. Na submissão, suba o arquivo de exemplo (mesma arte da pasta `midias-followup/`).
- **Corpo (Body):** o texto abaixo. `{{1}}` = **nome do paciente** (a plataforma preenche no envio).
- **Exemplo de `{{1}}`** (a Meta pede um valor de amostra): `Maria`.
- **Botão (opcional, recomendado):** botão de **Resposta rápida** `Ver horários` — ajuda na conversão. Opcional; se quiser aprovar mais rápido, pode omitir.
- **Rodapé (opcional):** `Dental Beauty` ou algo como `Responda SAIR para não receber` (boa prática de opt-out em marketing).

> ⚠️ **Ajuste nos textos infantis (Odontopediatria D7 e D10):** o texto aprovado usava `[Nome da criança]`. Como esse dado nem sempre está cadastrado, isso viraria uma 2ª variável sem valor garantido e **reprovaria/quebraria** o envio. Troquei por **"seu filho(a)"** — mesma ideia, sem variável extra. Se preferirem capturar o nome da criança e usar `{{2}}`, dá pra fazer, mas aí precisa garantir o preenchimento sempre.

> 💡 **Regras da Meta que os textos já respeitam:** `{{1}}` aparece no meio da frase (não no começo/fim), sem variáveis coladas. Marketing tem custo por envio e o paciente pode optar por sair.

---

## 🦷 IMPLANTE — etapa "Não agendado Implante e prótese"

### 1) `fup_implante_d1`
- **Cabeçalho:** IMAGEM → `implante-antes-depois.jpg`
- **Corpo:**
```
Oi, {{1}}! Vi que você pediu informações sobre implante dentário 😊 Fiquei à disposição pra te explicar direitinho como funciona, valores e formas de pagamento. Quer que eu te envie um resumão ou prefere já ver horários disponíveis?
```

### 2) `fup_implante_d2`
- **Cabeçalho:** VÍDEO → `estrutura-clinica.mp4`
- **Corpo:**
```
Olá! Muita gente acha que implante é algo complicado, mas hoje o procedimento é bem mais tranquilo do que parece 🙂 Inclusive, a avaliação é o primeiro passo pra ver se é indicado no seu caso. Nossa estrutura é bem completa para te Receber! Posso reservar seu horário?
```

### 3) `fup_implante_d4`
- **Cabeçalho:** VÍDEO → `implante-depoimento-rose.mp4`
- **Corpo:**
```
Oi, {{1}}! Essa semana atendemos vários pacientes que também tinham receio de fazer implante… e saíram super tranquilos 😊 Cada caso é único, por isso a avaliação faz toda diferença. Olha esse depoimento de nossa paciente 1 ano após o Tratamento. Quer que eu veja um horário pra você?
```

### 4) `fup_implante_d7`
- **Cabeçalho:** IMAGEM → `implante-antes-depois-2.jpg`
- **Corpo:**
```
Oi, {{1}}! Passando aqui porque já faz 1 semana que você entrou em contato sobre implante 🙂 Queria saber se ainda faz sentido pra você ou se ficou alguma dúvida que eu possa te ajudar.
```

### 5) `fup_implante_d10`
- **Cabeçalho:** — (sem cabeçalho)
- **Corpo:**
```
Oi, {{1}}! Vou encerrar seu atendimento por aqui pra não ficar te incomodando 😊 Mas se ainda quiser cuidar disso, me chama que te ajudo com tudo, tá?
```

---

## ✨ LENTES — etapa "Não agendado Lentes"

### 6) `fup_lentes_d1`
- **Cabeçalho:** IMAGEM → `lentes-antes-depois.jpg`
- **Corpo:**
```
Oi, {{1}}! Vi que você se interessou por lentes de contato dental ✨ Elas são ótimas pra transformar o sorriso de forma rápida e natural. Quer ver alguns casos reais ou prefere já agendar uma avaliação?
```

### 7) `fup_lentes_d2`
- **Cabeçalho:** IMAGEM → `lentes-antes-depois-2.jpg`
- **Corpo:**
```
Olá! Uma dúvida comum é se fica artificial… e a resposta é: não 😊 Hoje conseguimos resultados bem naturais e personalizados para cada sorriso. Se quiser, te mostro mais exemplos.
```

### 8) `fup_lentes_d4`
- **Cabeçalho:** VÍDEO → `estrutura-clinica.mp4`
- **Corpo:**
```
Oi, {{1}}! Cada sorriso que fazemos é planejado exclusivamente pro paciente ✨ Nada de padrão: avaliamos formato do rosto, cor, proporção e expectativa. Possuímos uma estrutura completa para te atender. Quer um horário para avaliação?
```

### 9) `fup_lentes_d7`
- **Cabeçalho:** — (sem cabeçalho)
- **Corpo:**
```
Oi, {{1}}! Já tem 1 semana desde que você perguntou sobre lentes 🙂 Queria saber se ainda pensa em melhorar o sorriso ou se posso te ajudar com alguma dúvida.
```

### 10) `fup_lentes_d10`
- **Cabeçalho:** — (sem cabeçalho)
- **Corpo:**
```
Oi, {{1}}! Vou finalizar seu atendimento por aqui pra não te incomodar 😊 Mas quando quiser retomar seu plano para transformar o sorriso, é só me chamar!
```

---

## 🦷 ORTODONTIA — etapa "Não agendado Ortodontia"

### 11) `fup_ortodontia_d1`
- **Cabeçalho:** IMAGEM → `ortodontia-tipos-aparelhos.png`
- **Corpo:**
```
Oi, {{1}}! Vi seu interesse em aparelho 😊 Hoje temos opções bem mais discretas e confortáveis para alinhar seu sorriso. Quer que eu te explique as opções ou prefere já ver horários?
```

### 12) `fup_ortodontia_d2`
- **Cabeçalho:** VÍDEO → `estrutura-clinica.mp4`
- **Corpo:**
```
Oi, {{1}}! Muita gente acha que aparelho é só estética, mas ele também ajuda na mastigação, encaixe dos dentes e saúde bucal 🙂 A avaliação é essencial pra indicar o melhor tipo para você! Estamos com uma estrutura completa para te atender. Posso reservar seu horário?
```

### 13) `fup_ortodontia_d4`
- **Cabeçalho:** — (sem cabeçalho)
- **Corpo:**
```
Oi, {{1}}! Temos pacientes começando tratamento ortodôntico toda semana e se adaptando super bem 😊 Se quiser, posso reservar um horário para sua avaliação.
```

### 14) `fup_ortodontia_d7`
- **Cabeçalho:** VÍDEO → `ortodontia-invisalign.mp4`
- **Corpo:**
```
Oi, {{1}}! Já faz 1 semana que você entrou em contato sobre aparelho 🙂 Nosso atendimento alinhado a tecnologia e ao conhecimento, trás mais segurança a seus procedimentos. Ainda tem interesse em alinhar seu sorriso ou posso te ajudar com alguma dúvida?
```

### 15) `fup_ortodontia_d10`
- **Cabeçalho:** — (sem cabeçalho)
- **Corpo:**
```
Oi, {{1}}! Vou encerrar seu atendimento por aqui pra não te incomodar 😊 Mas fico à disposição quando quiser retomar seu tratamento ortodôntico!
```

---

## 🧚 ODONTOPEDIATRIA — etapa "Não agendado Odontopediatria"

### 16) `fup_odontopediatria_d1`
- **Cabeçalho:** VÍDEO → `odonto-estrutura.mp4`
- **Corpo:**
```
Oi, {{1}}! Vi que você entrou em contato sobre atendimento infantil 😊 Aqui temos um cuidado especial pra deixar a criança tranquila, segura e confortável. Além de uma estrutura bem lúdica. Quer ver como funciona ou já agendar?
```

### 17) `fup_odontopediatria_d2`
- **Cabeçalho:** VÍDEO → `odonto-primeira-consulta.mp4`
- **Corpo:**
```
Oi, {{1}}! A primeira experiência da criança no dentista faz toda diferença 🙂 Por isso nosso atendimento é bem acolhedor, lúdico e pensado para os pequenos. Posso reservar um horário?
```

### 18) `fup_odontopediatria_d4`
- **Cabeçalho:** VÍDEO → `odonto-atendimento-crianca.mp4`
- **Corpo:**
```
Oi, {{1}}! Muitos pais ficam surpresos com o quanto os pequenos ficam à vontade quando o atendimento é feito do jeito certo 😊 Se quiser, te mostro como funciona a consulta.
```

### 19) `fup_odontopediatria_d7`
- **Cabeçalho:** VÍDEO → `odonto-tea.mp4`
- **Corpo:** *(ajustado: "seu filho(a)" no lugar de "[Nome da criança]")*
```
Oi, {{1}}! Já faz 1 semana que você procurou atendimento para o seu filho(a) 🙂 Somos referência em atendimentos de crianças com Transtorno do Espectro Autista (TEA). Queria saber se ainda precisa ou se posso te ajudar com alguma dúvida.
```

### 20) `fup_odontopediatria_d10`
- **Cabeçalho:** — (sem cabeçalho)
- **Corpo:** *(ajustado: "seu filho(a)" no lugar de "[Nome da criança]")*
```
Oi, {{1}}! Vou finalizar por aqui pra não te incomodar 😊 Mas quando precisar cuidar do sorriso do seu filho(a), estamos à disposição!
```

---

## 🩺 CLÍNICO GERAL — etapa "Não agendado clínica geral"

### 21) `fup_clinico_geral_d1`
- **Cabeçalho:** VÍDEO → `estrutura-clinica.mp4`
- **Corpo:**
```
Oi, {{1}}! Vi que você buscou atendimento odontológico 😊 Se quiser, posso te ajudar com uma avaliação completa para entender o que você precisa. Nossa estrutura é bem completa para te Receber. Quer que eu veja um horário?
```

### 22) `fup_clinico_geral_d2`
- **Cabeçalho:** — (sem cabeçalho)
- **Corpo:**
```
Oi, {{1}}! Às vezes deixamos pra depois, mas uma avaliação ajuda a evitar problemas maiores 🙂 Se quiser, posso te passar os horários disponíveis. Qual sua necessidade hoje?
```

### 23) `fup_clinico_geral_d4`
- **Cabeçalho:** VÍDEO → `geral-centro-cirurgico.mp4`
- **Corpo:**
```
Oi, {{1}}! Trabalhamos com especialistas alinhado a tecnologia de ponta. Tudo para que seu Tratamento ocorra como imaginado. 😊 Aqui na Dental beauty, possuímos Radiologia, para seu maior Conforto! Posso te encaixar no melhor horário para você?
```

### 24) `fup_clinico_geral_d7`
- **Cabeçalho:** — (sem cabeçalho)
- **Corpo:**
```
Oi, {{1}}! Já faz 1 semana desde seu contato 🙂 Ainda precisa de atendimento odontológico ou posso te ajudar com alguma dúvida?
```

### 25) `fup_clinico_geral_d10`
- **Cabeçalho:** — (sem cabeçalho)
- **Corpo:**
```
Oi, {{1}}! Vou encerrar seu atendimento por aqui pra não te incomodar 😊 Mas fico à disposição quando precisar cuidar do seu sorriso!
```

---

## Resumo de mídia por template
| # | Template | Cabeçalho |
|---|---|---|
| 1 | fup_implante_d1 | IMG implante-antes-depois.jpg |
| 2 | fup_implante_d2 | VÍDEO estrutura-clinica.mp4 |
| 3 | fup_implante_d4 | VÍDEO implante-depoimento-rose.mp4 |
| 4 | fup_implante_d7 | IMG implante-antes-depois-2.jpg |
| 5 | fup_implante_d10 | — |
| 6 | fup_lentes_d1 | IMG lentes-antes-depois.jpg |
| 7 | fup_lentes_d2 | IMG lentes-antes-depois-2.jpg |
| 8 | fup_lentes_d4 | VÍDEO estrutura-clinica.mp4 |
| 9 | fup_lentes_d7 | — |
| 10 | fup_lentes_d10 | — |
| 11 | fup_ortodontia_d1 | IMG ortodontia-tipos-aparelhos.png |
| 12 | fup_ortodontia_d2 | VÍDEO estrutura-clinica.mp4 |
| 13 | fup_ortodontia_d4 | — |
| 14 | fup_ortodontia_d7 | VÍDEO ortodontia-invisalign.mp4 |
| 15 | fup_ortodontia_d10 | — |
| 16 | fup_odontopediatria_d1 | VÍDEO odonto-estrutura.mp4 |
| 17 | fup_odontopediatria_d2 | VÍDEO odonto-primeira-consulta.mp4 |
| 18 | fup_odontopediatria_d4 | VÍDEO odonto-atendimento-crianca.mp4 |
| 19 | fup_odontopediatria_d7 | VÍDEO odonto-tea.mp4 |
| 20 | fup_odontopediatria_d10 | — |
| 21 | fup_clinico_geral_d1 | VÍDEO estrutura-clinica.mp4 |
| 22 | fup_clinico_geral_d2 | — |
| 23 | fup_clinico_geral_d4 | VÍDEO geral-centro-cirurgico.mp4 |
| 24 | fup_clinico_geral_d7 | — |
| 25 | fup_clinico_geral_d10 | — |

> Arquivos de mídia: pasta `midias-followup/` (já convertidos para .mp4/.jpg/.png, dentro dos limites da Meta).
