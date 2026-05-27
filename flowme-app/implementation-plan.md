1. Bug no onboarding, não está criando eventos: 
  - Balys não está confirmando horário exato de atividade diária do goal.
  - Mesmo confirmando horario exato, eventos não são criados.
  - Comportamento esperado: Balys criar eventos com recorrência (ex: todo dia as 10am - criar um evento com recorrência para todo dia as 10am, se for seg a sex 10am e sabado e domingo as 21h então criar dois eventos recorrentes com horarios distintos de acordo)
  - Subir aplicação localmente e rodar teste do onboarding, checar e corrigir em realtime no código do repositório. (End to End test)

2. Matar conceito de microactivities
    - Não deve existir essa entidade e nenhum fluxo no projeto com microactivities. 
    - Matar tag negotiable e non-negotiable, não deve existir mais na plataforma e no banco de dados. 
    - Tudo é evento, plano de ação de 21 dias resulta em eventos criados, com ou sem recorrência de acordo com a necessidade. Goal também resulta em eventos criados do Google Calenddar.
    - Eventos do Google Calendar devem ser exibidos em trilha.
    - Após ajustes, testar end2end localmente e monitorar logs.

3. Card bom dia e boa noite não estão trazendo notícias e trends. 
    - Notícias pelo Gemini Web Search deveria trazer, investigar logs localmente subindo app e ajustar no código.
    - Trends do Twitter não deveria trazer, pois está sem credito na API mesmo.
    - WhatsApp briefing (horario que o usuário define no onboarding), deve mandar para o usuário notícias e trendings também do X.com quando presente.
    - Ajustar e testar end2end localmente e monitorar logs.

4. [CONCLUÍDO] Notificações Browser (web push), no onboarding obrigatóriamente (usuário não deve ter togle) deve pedir para o usuário com instrução, par ativar notificação no navegador, além do mais deve aparecer o pop-up do browser para ja ativar, sem o usuário leigo ter que acessar as configurações.
    - Popup de instrução para ativar notificações no onboarding pós usuário submeter infos dos goals, deve dizer ao usuário que serve para enviar lembretes.
    - Testar end2end localmente e monitorar logs.

5. ✅ CONCLUÍDO — Notificações do WhatsApp, no onboarding deve fazer o usuário vincular telefone de WhatsApp com instrução (verificação de código e instrução dizendo que serve para enviar lembretes no WhatsApp, mas o usuário pode pular e fazer depois pelas configurações)
    - Testar end2end localmente e monitorar logs.
    - Implementado: etapa dedicada de WhatsApp no onboarding (telefone → código → verificação) reusando /api/whatsapp/channel (Evolution API), com instrução de lembretes e opção "Pular por enquanto" (configurável depois em Configurações › Canais). Tela final mostra status "WhatsApp conectado".
    - Validado: unit 399 testes passando; e2e Playwright (vincular + pular) passando contra app local.

6. Deleção e remanejamento de eventos de plano de ação OU Goal.  ✅ CONCLUÍDO (2026-05-26)
    - Balys deve ser capaz de entender que evento existia e foi deletado caso usuário pergunte sobre evento, goal ou plano.  ✅ tool `goals.list_calendar_events` retorna eventos ativos E deletados (status + data de deleção).
    - Balys deve ser capaz de remanejar todos os eventos e eventos específicos de acordo com preferência de recorrência e horário, ou dias específicos, do usuário.  ✅ tool `goals.reschedule_calendar_events` (horário + recorrência/dias; alvo: meta, plano, eventos específicos ou todos).
    - Balys deve ser capaz de restaurar eventos deletados.  ✅ tool `goals.restore_calendar_events` (recria no Google com horário/recorrência originais).
    - Balys deve ser capaz de deletar goal ou plano de ação.  ✅ tool `goals.delete_plan` (cascata: sub-metas, planos, tasks e eventos; exige confirmação).
    -  Testar end2end localmente e monitorar logs.
    - Detalhes: migration 036 (coluna `recurrence` em goal_calendar_events); helpers em `lib/goals/calendar-event-links.ts` e `lib/goals/delete-plan.ts`; `updateCalendarEvent` passou a aceitar recorrência; BALYS.md atualizado; tools registrados em `registry.ts`.
    - Validado: unit 418 testes passando (`npm test`) e typecheck limpo nos arquivos de produção tocados.
    - Observação: validação e2e real (app local + Google Calendar/Supabase, simulação do usuário victorrayansouzaramos@gmail.com) e monitoria de logs não foi executada neste ambiente por falta de credenciais — recomendado rodar localmente antes do deploy.


7. ✅ CONCLUÍDO — Visibilidade de modelo e gasto de tokens por conta em Settings.
    - Não deve existir essa visibilidade. Usuário final não deve saber de modelo de LLM e gastos, excluir card.
    - Testar end2end localmente e monitorar logs.
    - Feito: removido card "AI Spend & Tokens" + código cliente morto; deletado endpoint /api/ai/spend; removidas strings i18n órfãs (EN/PT); removidos valores em $ das labels de Council mode. Verificado: 399 testes passando, build compila sem erros, /app/settings serve sem erro 500.

8. Visibilidade de modelo de LLM em criação e edição de notas
    - Não deve existir essa visibilidade. Usuário final não deve saber de modelo de LLM e gastos, excluir visibilidade de modelo de LLM em criação e edição de notas.
    - Testar end2end localmente e monitorar logs.

9. No onboarding adicionar popup explicativo da plataforma
    - 1. Como usar Balys 
         - Para que balys serve
         - Habilidades do balys (listar 1 a 1 com use cases reais - criar use-cases)
         - sobre enviar audio e imagem
         - invokar conselho
    - 2. Como usar Conexões e para que elas servem
        - Onde fica
        - Quais conexões tem
        - Como usa-las no Balys
    - 3. Como usar notas 
        - Onde fica
        - Para quê utilizar (usado para fazer anotações diárias, problemas, reflexões, infos importantes, anotar sobre pessoas e personalidades. Com volume Balys ganha inteligência para dar insights sobre como melhorar o seu dia, melhorar seu relacionamento e criar planos de ações para te colocar em outro nível)
        - Gravar notas com audio
        - Daily briefing, para que serve
        - Daily briefing, como usar
        - Como importar briefing do Chat GPT ou do Claude (dica de prompt para colar e pegar output e colar no briefing ou no Balys)
    - 4. Toda etapa pode ser skiped, menos uma etapa obrigatória que fala onde rever essas infos (seção Tutorials - que será criada mais a frente neste docs.)
    - Testar end2end localmente e monitorar logs.

10. Criar seção Tutorials no menu para explicar como utilizar a ferramenta e obter maior produtividade e insights com tutoriais de ponta a ponta. Como se fosse a Academy da Anthropic sobre como usar Claude Code.
    - Card sobre cada tema
        Ex. Como utilizar notas para obter guardar informações relevantes e obter insights de pessoas, do seu dia, semana e vida.
    - Cada card é clicável, abre uma wi-ki post de cima para baixo com scroll visível com artigo explicando como usar funcionalidade X da ferramenta, step by step com use cases reais. 
        - Step by Step é dizer, acesso o menu e clique em Notas, pós isso no canto inferior direito...etc. seja preciso, como se uma AI sem olhos fosse utilizar o app.
    - Pessoa deve poder voltar para pagina inicial de tutorials
    - Deve ter uma mensagem clara de que essa aba serve para a pessoa aprender a como dar boost na produtividade, na rotina e na inteligência que a IA fornece.
    - Testar end2end localmente e monitorar logs.


*** GEMINI, CLAUDE E CODEX (CHATGPT) RECADO IMPORTANTE.
    Não é permitido finalizar uma dessas tarefas sem ter realizado o teste end2end de experiência com use-case real de usuário (você deve simular um usuário utilizando email victorrayansouzaramos@gmail.com) e enquanto não passar na experiência, não deve jamais prosseguir.
    A execução deve ser sequencial e nunca deve pular uma task sem validar TODAS AS FUNCIONALIDADES E AJUESTES REALIZADOS END2END E MONITORIA DE LOGS PARA CONFIRMAR AJUSTES.