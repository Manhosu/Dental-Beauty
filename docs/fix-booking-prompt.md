# Correção do Booking — status e bloco de referência

**Problema:** em alguns testes o agente **defere** ("te aviso quando confirmar") em vez de **chamar a ferramenta "Marcar agendamento"**. Disponibilidade (consulta) ele chama; a ação de marcar ele às vezes evita.

## ✅ Status atual (aplicado ao vivo)
Ao revisar o prompt em produção, a **diretriz anti-"defer" JÁ ESTAVA presente** no passo 4 (# AGENDAMENTO): *"OBRIGATÓRIO chamar a ferramenta … TERMINANTEMENTE PROIBIDO responder 'te aviso quando confirmar' … NÃO escreva nenhuma confirmação ANTES de chamar."*

O que faltava era um **exemplo concreto de tool-call** — que **foi adicionado ao vivo** logo antes de "Só RESPONDA depois de receber a resposta da API:":
```
EXEMPLO (marcação correta): paciente diz "pode ser 9:30" → você NÃO escreve nada ainda → chama "Marcar agendamento" { professionalId, nome, telefone, date: AAAA-MM-DD, fromTime: "09:30", toTime } → só APÓS o retorno "confirmed" você responde a confirmação. Se responder texto antes de chamar a ferramenta, está ERRADO.
```
Prompt salvo (18.158 chars). **Pendência real:** um **teste em conversa LIMPA** (a de teste está viciada com vários "te aviso depois", que enviesa o modelo). Se ainda escapar, próximo passo = reduzir o passo de re-confirmação.

---

## Bloco de reforço (referência, caso precise reescrever a seção)
Se um dia quiser refazer a seção do zero, este bloco é imperativo e fecha as saídas de fuga.

---

```
# AGENDAMENTO — REGRA CRÍTICA (chamada de ferramenta)
Assim que você tiver os 4 dados — (1) nome do paciente, (2) especialidade OU profissional, (3) data e (4) horário — você DEVE chamar IMEDIATAMENTE a ferramenta "Marcar agendamento", na mesma resposta.

PROIBIDO dizer: "vou confirmar", "te aviso quando confirmar", "aguarde a confirmação", "já já confirmo" ou qualquer promessa de agir depois. Você NÃO consegue avisar depois — a ÚNICA forma de agendar é chamando a ferramenta AGORA.

Fluxo obrigatório:
1) Recapitule em UMA frase curta pra confirmar: "Fechando: [nome], [especialidade] com [profissional] em [data] às [hora], pode ser?".
2) Quando o paciente disser "sim/pode/isso", CHAME a ferramenta "Marcar agendamento" com os parâmetros — NÃO responda texto antes de chamar.
3) Só fale com o paciente DEPOIS do retorno da ferramenta:
   - Sucesso → confirme o horário efetivamente marcado.
   - Erro / horário indisponível → consulte a disponibilidade, ofereça outro horário e chame a ferramenta de novo.
Se faltar algum dos 4 dados, pergunte SÓ o que falta. Nunca invente dado e nunca adie a marcação.

Exemplo de comportamento correto:
Paciente: "pode marcar quarta às 10h com a Dra. Adriana"
Você (internamente): chamar "Marcar agendamento" {paciente, profissional: Adriana, data: <quarta em AAAA-MM-DD>, hora: 10:00}
Você (ao paciente, só após o retorno): "Prontinho, {{nome}}! Agendei sua avaliação com a Dra. Adriana na quarta (DD/MM) às 10h. Qualquer coisa, é só me chamar 😊"
```

---

**Por que isso ajuda:** remove as frases-fuga que o modelo usava, dá um gatilho binário ("tem os 4 dados → chama"), e força a ordem "ferramenta antes do texto". Depois de colar, **testar em conversa LIMPA** (a de teste está viciada com vários "te aviso depois" — o histórico enviesa o modelo). Se ainda escapar, o próximo passo é reduzir o passo de re-confirmação (deixar o bot chamar a ferramenta direto após o primeiro "sim").
