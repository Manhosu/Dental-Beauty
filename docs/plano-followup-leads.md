# Plano das automações de Follow-up — Atendimento Lead

**Passo a passo EXATO do wizard** (CRM → Automações → **Nova Automação**):
1. **Rótulo:** o nome (ex.: "FUP Implante D1") · **Pipeline:** `Atendimento Lead`
2. **Etapa que vai escutar:** a etapa da especialidade (ex.: `Não agendado Implante e prótese`)
3. **Quando executar:** clique **`Por Tempo`** → escolha a faixa **`1 – 7 dias`** (ou **`> 7 dias`** quando for o **D10**) → **Próximo**
4. **Ação:** `Enviar WhatsApp` → **Próximo**
5. **Mensagem:** Tipo = **`Mensagem Personalizada`** → cole o **texto** da tabela → **anexe a mídia** (arquivo da pasta `midias-followup/`) → **Próximo**
6. **Agendamento:** defina o **tempo de espera EXATO** = o nº de **Dias** da linha (1, 2, 4, 7 ou 10) + horário de envio → **Salvar/Criar**

> São **5 automações por especialidade** (uma por linha), todas na mesma etapa "Não agendado [especialidade]", mudando só o **nº de dias** (passo 6) e o **texto/mídia** (passo 5).
> Mídias já convertidas p/ `.mp4` (WhatsApp) na pasta **`midias-followup/`**. Onde diz "—" não há mídia.

---

## 🦷 Implante — etapa "Não agendado Implante e prótese"
| Dias | Texto | Mídia |
|---|---|---|
| **1** | Oi, [Nome]! Vi que você pediu informações sobre implante dentário 😊 Fiquei à disposição pra te explicar direitinho como funciona, valores e formas de pagamento. Quer que eu te envie um resumão ou prefere já ver horários disponíveis? | `implante-antes-depois.jpg` |
| **2** | Olá! Muita gente acha que implante é algo complicado, mas hoje o procedimento é bem mais tranquilo do que parece 🙂 Inclusive, a avaliação é o primeiro passo pra ver se é indicado no seu caso. Nossa estrutura é bem completa para te Receber! Posso reservar seu horário? | `estrutura-clinica.mp4` |
| **4** | Oi, [Nome]! Essa semana atendemos vários pacientes que também tinham receio de fazer implante… e saíram super tranquilos 😊 Cada caso é único, por isso a avaliação faz toda diferença. Olha esse depoimento de nossa paciente 1 ano após o Tratamento. Quer que eu veja um horário pra você? | `implante-depoimento-rose.mp4` |
| **7** | Oi, [Nome]! Passando aqui porque já faz 1 semana que você entrou em contato sobre implante 🙂 Queria saber se ainda faz sentido pra você ou se ficou alguma dúvida que eu possa te ajudar. | `implante-antes-depois-2.jpg` |
| **10** | Oi, [Nome]! Vou encerrar seu atendimento por aqui pra não ficar te incomodando 😊 Mas se ainda quiser cuidar disso, me chama que te ajudo com tudo, tá? | — |

## ✨ Lentes — etapa "Não agendado Lentes"
| Dias | Texto | Mídia |
|---|---|---|
| **1** | Oi, [Nome]! Vi que você se interessou por lentes de contato dental ✨ Elas são ótimas pra transformar o sorriso de forma rápida e natural. Quer ver alguns casos reais ou prefere já agendar uma avaliação? | `lentes-antes-depois.jpg` |
| **2** | Olá! Uma dúvida comum é se fica artificial… e a resposta é: não 😊 Hoje conseguimos resultados bem naturais e personalizados para cada sorriso. Se quiser, te mostro mais exemplos. | `lentes-antes-depois-2.jpg` |
| **4** | Oi, [Nome]! Cada sorriso que fazemos é planejado exclusivamente pro paciente ✨ Nada de padrão: avaliamos formato do rosto, cor, proporção e expectativa. Possuímos uma estrutura completa para te atender. Quer um horário para avaliação? | `estrutura-clinica.mp4` |
| **7** | Oi, [Nome]! Já tem 1 semana desde que você perguntou sobre lentes 🙂 Queria saber se ainda pensa em melhorar o sorriso ou se posso te ajudar com alguma dúvida. | — |
| **10** | Oi, [Nome]! Vou finalizar seu atendimento por aqui pra não te incomodar 😊 Mas quando quiser retomar seu plano para transformar o sorriso, é só me chamar! | — |

## 🦷 Ortodontia — etapa "Não agendado Ortodontia"
| Dias | Texto | Mídia |
|---|---|---|
| **1** | Oi, [Nome]! Vi seu interesse em aparelho 😊 Hoje temos opções bem mais discretas e confortáveis para alinhar seu sorriso. Quer que eu te explique as opções ou prefere já ver horários? | `ortodontia-tipos-aparelhos.png` |
| **2** | Oi, [Nome]! Muita gente acha que aparelho é só estética, mas ele também ajuda na mastigação, encaixe dos dentes e saúde bucal 🙂 A avaliação é essencial pra indicar o melhor tipo para você! Estamos com uma estrutura completa para te atender. Posso reservar seu horário? | `estrutura-clinica.mp4` |
| **4** | Oi, [Nome]! Temos pacientes começando tratamento ortodôntico toda semana e se adaptando super bem 😊 Se quiser, posso reservar um horário para sua avaliação. | — |
| **7** | Oi, [Nome]! Já faz 1 semana que você entrou em contato sobre aparelho 🙂 Nosso atendimento alinhado a tecnologia e ao conhecimento, trás mais segurança a seus procedimentos. Ainda tem interesse em alinhar seu sorriso ou posso te ajudar com alguma dúvida? | `ortodontia-invisalign.mp4` |
| **10** | Oi, [Nome]! Vou encerrar seu atendimento por aqui pra não te incomodar 😊 Mas fico à disposição quando quiser retomar seu tratamento ortodôntico! | — |

## 🧚 Odontopediatria — etapa "Não agendado Odontopediatria"
| Dias | Texto | Mídia |
|---|---|---|
| **1** | Oi, [Nome]! Vi que você entrou em contato sobre atendimento infantil 😊 Aqui temos um cuidado especial pra deixar a criança tranquila, segura e confortável. Além de uma estrutura bem lúdica. Quer ver como funciona ou já agendar? | `odonto-estrutura.mp4` |
| **2** | Oi, [Nome]! A primeira experiência da criança no dentista faz toda diferença 🙂 Por isso nosso atendimento é bem acolhedor, lúdico e pensado para os pequenos. Posso reservar um horário? | `odonto-primeira-consulta.mp4` |
| **4** | Oi, [Nome]! Muitos pais ficam surpresos com o quanto os pequenos ficam à vontade quando o atendimento é feito do jeito certo 😊 Se quiser, te mostro como funciona a consulta. | `odonto-atendimento-crianca.mp4` |
| **7** | Oi, [Nome]! Já faz 1 semana que você procurou atendimento para o(a) [Nome da criança] 🙂 Somos referência em atendimentos de crianças com Transtorno do Espectro Autista (TEA). Queria saber se ainda precisa ou se posso te ajudar com alguma dúvida. | `odonto-tea.mp4` |
| **10** | Oi, [Nome]! Vou finalizar por aqui pra não te incomodar 😊 Mas quando precisar cuidar do sorriso do(a) [Nome da criança], estamos à disposição! | — |

## 🩺 Clínico Geral — etapa "Não agendado clínica geral"
| Dias | Texto | Mídia |
|---|---|---|
| **1** | Oi, [Nome]! Vi que você buscou atendimento odontológico 😊 Se quiser, posso te ajudar com uma avaliação completa para entender o que você precisa. Nossa estrutura é bem completa para te Receber. Quer que eu veja um horário? | `estrutura-clinica.mp4` |
| **2** | Oi, [Nome]! Às vezes deixamos pra depois, mas uma avaliação ajuda a evitar problemas maiores 🙂 Se quiser, posso te passar os horários disponíveis. Qual sua necessidade hoje? | — |
| **4** | Oi, [Nome]! Trabalhamos com especialistas alinhado a tecnologia de ponta. Tudo para que seu Tratamento ocorra como imaginado. 😊 Aqui na Dental beauty, possuímos Radiologia, para seu maior Conforto! Posso te encaixar no melhor horário para você? | `geral-centro-cirurgico.mp4` |
| **7** | Oi, [Nome]! Já faz 1 semana desde seu contato 🙂 Ainda precisa de atendimento odontológico ou posso te ajudar com alguma dúvida? | — |
| **10** | Oi, [Nome]! Vou encerrar seu atendimento por aqui pra não te incomodar 😊 Mas fico à disposição quando precisar cuidar do seu sorriso! | — |
