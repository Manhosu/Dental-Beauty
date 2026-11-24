# Relatório de Andamento — Atendimento Automático da Dental Beauty

Olá! Segue um resumo, em linguagem simples, de como está o desenvolvimento do seu atendimento automático no WhatsApp integrado ao sistema Clinicorp.

## O que o sistema vai fazer

Um atendente virtual (robô) no WhatsApp que:
- Conversa com o paciente, entende o que ele precisa (por texto ou áudio) e identifica a especialidade desejada (implante, lentes, ortodontia, etc.).
- Mostra os horários livres e **agenda direto na Clinicorp**, com a garantia de que dois pacientes nunca vão pegar o mesmo horário.
- Envia materiais (fotos, vídeos, tabela de preços) automaticamente.
- Passa a conversa para um atendente humano quando necessário (casos delicados, negociação, ou a pedido do paciente) — e o robô se cala enquanto a pessoa atende.
- Faz lembretes e campanhas automáticas: confirmação de consulta (para reduzir falta), parabéns de aniversário, retorno de limpeza após 6 meses e reativação de pacientes.

## O que já está pronto ✅

- **Agendamento completo e testado de verdade:** o sistema já conversa com a Clinicorp, **mostra os horários livres reais**, **marca a consulta** e **cancela/libera a vaga** — tudo direto na Clinicorp, com a garantia de que dois pacientes nunca pegam o mesmo horário. Fizemos um teste real de marcação (criamos e cancelamos na hora, sem deixar nada na sua agenda) e funcionou. ✔
- **Dados reais reconhecidos:** unidade "Dental Beauty", os profissionais e as especialidades já vêm direto do seu sistema.
- **Lembrete de aniversário:** já puxa a lista de aniversariantes do dia da Clinicorp (com nome e telefone) para enviar a felicitação.
- **Catálogo automático:** o robô oferece as especialidades e os profissionais reais da clínica, sempre atualizados.
- **Base sólida e testada:** toda a parte central foi construída com testes automáticos e cuidado com a proteção de dados dos pacientes (LGPD).

## O que está pronto para ser ligado 🔌

- A **plataforma de atendimento (Chatbotify)** já foi analisada e tem tudo o que precisamos: robô com inteligência artificial, base de conhecimento, transferência para humano e automações. Deixamos um **guia completo de configuração** pronto.
- Já preparamos as instruções para conectar os números de WhatsApp e o passo a passo para colocar o sistema no ar.

## Como vamos testar sem incomodar os pacientes 🧪

Os números de Recepção, Atendimento e Orçamento já recebem mensagens de pacientes reais, então **não** vamos ligar a inteligência artificial neles enquanto testamos (o robô poderia responder um paciente de verdade). O plano combinado:

- Usamos o número de **Disparos** como ambiente de teste (ele não recebe mensagens de pacientes). Ligamos a IA completa nele temporariamente para validar a conversa, a triagem e o agendamento.
- Os outros números ficam **conectados, mas com a IA desligada** até a validação terminar.
- Quando estiver tudo certo, ligamos a IA nos números reais em um horário de baixo movimento e devolvemos o número de Disparos à sua função normal.

Cada número terá seu papel:
- **Atendimento Lead:** robô completo que atende novos interessados.
- **Recepção:** robô focado em quem já é paciente / já veio à clínica.
- **Orçamento:** automações de resgate e atendimento fora do horário comercial.
- **Disparos:** envios em massa; quando um lead responde, o atendimento continua pelo fluxo do Atendimento Lead.

## O que precisamos de você (cliente) 🙏

Os números já foram conectados ✅ e o acesso ao agendamento já está funcionando ✅. Agora só faltam duas coisas suas:

1. **Profissionais no agendamento online:** hoje o link de agendamento está com **3 profissionais** ativos (Lívia – Protesista, Fábio – Odontopediatria e Adriana – Ortodontia). O robô só consegue agendar com quem estiver ativado aí. Se quiser incluir **mais profissionais/especialidades**, é só adicioná-los na configuração do **Agendamento Online da Clinicorp** e nos dizer quem entra.

2. **Materiais para a IA enviar:** os vídeos, fotos e áudios que vão ser enviados conforme o tipo de lead (ex.: vídeo específico para crianças com autismo, implante unitário x protocolo). Quando terminar de selecionar, é só mandar.

## Próximos passos

1. Você nos diz quais profissionais devem entrar no agendamento online e nos manda os materiais.
2. Montamos e testamos o robô (conversa, triagem, agendamento) com segurança no número de **Disparos**.
3. Configuramos textos, preços, materiais e as automações de lembrete/campanha.
4. Ligamos a IA nos números reais em horário de baixo movimento e acompanhamos os primeiros atendimentos.

## Observação importante sobre segurança

Recomendamos **trocar a senha** da plataforma de atendimento e o **código de acesso** da Clinicorp depois que tudo estiver configurado, por segurança — já que essas informações foram compartilhadas durante o desenvolvimento.

---

Qualquer dúvida, estamos à disposição. Assim que recebermos os itens acima, conseguimos avançar rápido para deixar o atendimento automático funcionando. 🚀
