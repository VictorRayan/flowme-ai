# Balys AI Experience, Connector Skills, and Onboarding Upgrade Plan

## Contexto

Este plano consolida os ajustes pedidos para Balys AI, chat, conectores, suporte, tutoriais, login e navegação. O objetivo é transformar Balys em uma experiência mais bonita, menos ansiosa, mais confiável no idioma escolhido e muito mais capaz com Gmail, Google Docs, Google Sheets, Google Drive, prioridades e fontes cruzadas.

Referências de benchmarking consideradas:

- Claude Google Workspace connectors: Gmail, Google Calendar e Google Drive conectados para buscar emails, gerenciar agenda, trabalhar com documentos e salvar arquivos dentro da conversa.
- Claude Research + Workspace: respostas cruzando emails, calendário, documentos e web para sínteses mais completas.
- Spreadsheet agents modernos: entendimento de layout, fórmulas, múltiplas abas, células, tabelas imperfeitas e edição precisa, especialmente para fluxos financeiros.
- GPT for Sheets/Docs e ferramentas similares: comandos naturais dentro de planilhas/documentos, com geração, análise, enriquecimento e formatação.
- Duolingo stories/tutorials: leitura leve, progressão visual, cor viva, cards escaneáveis e sensação de avanço.

## Status da Implementação — 2026-06-24

Implementado neste pass:

- Chat do Balys com renderer rico/sanitizado para markdown e HTML seguro.
- Loader principal em três pontos animados, reduzindo sensação de travamento.
- Ícone/avatares do Balys maiores e mais legíveis.
- Fonte do chat atualizada com Plus Jakarta Sans.
- Empty state com balões de sugestões clicáveis para foco, calendário, goals, Gmail, Sheets, clima e produtividade.
- Chips de action com ícones reais de Gmail, Docs, Sheets, Drive, Slack e actions internas.
- Inferência automática de actions mesmo sem slash command para Gmail, Sheets, Docs, Drive, clima, imagem, lembretes e priorização.
- Prompt de idioma reforçado para seguir o idioma configurado, exceto pedido explícito do usuário.
- `answer-satisfaction` agent antes da resposta final, revisando idioma, profundidade, clareza e contexto faltante.
- Skills/prompting avançado para Sheets, Docs e Gmail: análise, drafting, layout, abas, categorias, atas, acionáveis e confirmação quando faltar informação.
- Card/CTA no chat quando a resposta indicar necessidade de conectar/reconectar fonte.
- Foto do perfil Google no avatar das mensagens do usuário e no menu lateral.
- Ícones do menu lateral com cores mais vivas por seção.
- Remoção de "Solicitar cancelamento" de Configurações.
- Suporte ajustado para texto livre e funil de cancelamento progressivo sem erro seco.
- Tutoriais atualizados com cards vivos e guias novos para Gmail, Sheets, Docs e Suporte, em pt-BR e en-US.
- Tela de login com fundo pseudo-3D em flow, copy "Your productivity ecosystem", botão Google melhorado e remoção do aviso explícito de Calendar.

Validação executada:

- `npx jest __tests__/lib/tutorials-content.test.ts __tests__/lib/connector-agent-prompts.test.ts __tests__/lib/answer-satisfaction.test.ts __tests__/api/support-chat.test.ts --runInBand`
- `npm run build`

Hardening futuro recomendado:

- Criar Playwright visual/responsivo específico para chat, login, tutoriais e menu.
- Transformar o card de conector ausente em conexão direta por provider, com retomada automática da última mensagem após OAuth.
- Implementar agregador dedicado `context.gather_priority_sources` para priorização cruzada com deduplicação formal.
- Adicionar métricas internas do `answer-satisfaction` agent para medir correções e retries.

## Princípios

- Balys responde para pessoas comuns, não para desenvolvedores.
- O usuário nunca deve ver `**`, tags HTML cruas, IDs técnicos, JSON bruto, escopos OAuth ou mensagens internas de ferramenta.
- A action marcada pelo usuário é uma instrução determinística, não uma sugestão.
- Se o usuário não marcar action, Balys ainda deve inferir a ferramenta correta por intenção.
- Se falta conexão, o chat deve oferecer um CTA visual para conectar a fonte sem perder a conversa atual.
- Se falta contexto para agir com segurança, Balys deve perguntar de forma curta e humana.
- Qualquer escrita em Gmail, Docs, Sheets ou agenda precisa de confirmação quando houver risco de alteração destrutiva, envio indevido, sobrescrita ou ambiguidade.
- Respostas devem seguir o idioma configurado na UI, exceto quando o usuário pedir explicitamente outro idioma na própria mensagem.

## Status Inicial Observado

- `app/app/ai/page.tsx` já renderiza `BalysMarkdown`, `selectedAction`, thinking timeline, avatars e `connectorIntent`.
- `components/markdown/BalysMarkdown.tsx` suporta apenas markdown parcial: code fence, bold e inline code. Ele ainda deixa escapar formatação pobre para listas, headings, links, tabelas e artefatos de markdown.
- `components/ai/CommandPalette.tsx` já tem actions, mas o chip enviado fica pequeno e genérico.
- `app/api/ai/chat/route.ts` já tem `connectorIntent`, roteamento de primeira ferramenta e step budget maior para Gmail/Docs/Sheets/Drive.
- Docs de conectores já definem contratos para Gmail, Docs, Sheets e Drive, mas precisam evoluir para skills complexas e validações mais duras.
- `app/api/support/chat/route.ts` usa uma knowledge base simples e um funil de cancelamento; o erro mostrado no suporte precisa de investigação e correção.
- `app/app/settings/page.tsx` mostra "Solicitar cancelamento" fora do funil de suporte.
- `app/(auth)/login/page.tsx` ainda tem uma tela simples e o aviso explícito de Calendar.

## Fase 1: Chat Visual, Markdown Rico e Loader

### Objetivo

Deixar a resposta do Balys visualmente polida, sem markdown cru, com loader de typing e presença visual mais forte.

### Checklist

- [ ] Substituir `BalysMarkdown` por um renderer seguro e completo.
- [ ] Suportar headings, parágrafos, listas, listas numeradas, links, blockquotes, tabelas simples, separadores, código e callouts.
- [ ] Sanitizar HTML se o modelo retornar HTML, permitindo apenas tags seguras.
- [ ] Impedir que tags cruas como `<div>`, `<br>`, `<html>` ou artefatos `**` apareçam como texto quando eram intenção de formatação.
- [ ] Criar componentes visuais para resposta: seções, bullet groups, action items, warnings, next steps e receipts.
- [ ] Trocar o loader principal por três pontos animados em estilo typing.
- [ ] Remover `CircularProgress` da bolha principal de resposta carregando.
- [ ] Aumentar o `BalysIcon` no header, avatar do assistente, empty state e loading state.
- [ ] Revisar espaçamento, largura e bordas das bolhas para leitura em desktop e mobile.
- [ ] Trocar a fonte do chat para uma tipografia mais intencional e elegante, alinhada ao brand kit.
- [ ] Adicionar balões de sugestões clicáveis no empty state do Balys.
- [ ] Ao clicar em uma sugestão, preencher o input e enviar para Balys ou preencher o input com foco, conforme a ação for segura.
- [ ] Variar sugestões por contexto, idioma e plano: Calendar, Goals, Today, produtividade, conselho, clima/tempo, Gmail, Docs, Sheets e foco semanal.
- [ ] Usar ícones reais nas sugestões e visual mais vivo, com chip/card compacto e responsivo.
- [ ] Não mostrar sugestões que dependem de conector indisponível sem indicar "Connect first" ou roteá-las para o card de conexão.
- [ ] Permitir sugestões curtas e acionáveis, como "What should I focus on today?", "Review my week", "Summarize today's emails", "Plan my next goal step" e "What should I move on my calendar?".

### Arquivos Prováveis

- `components/markdown/BalysMarkdown.tsx`
- `components/brand/BalysIcon.tsx`
- `app/app/ai/page.tsx`
- `app/globals.css`
- `app/theme.ts` ou equivalente, se existir

### Critérios de Aceite

- [ ] Resposta com markdown complexo aparece bonita e sem caracteres crus.
- [ ] Resposta com HTML simples aparece segura e formatada.
- [ ] Loader mostra três pontos animados enquanto Balys processa.
- [ ] Avatar e ícone do Balys ficam legíveis em 390x844, 768x1024 e desktop.
- [ ] Empty state mostra sugestões úteis, clicáveis e alinhadas ao Flow Me.
- [ ] Clicar em uma sugestão dispara ou prepara a conversa sem quebrar attachments, action state ou histórico.
- [ ] Nenhuma bolha causa overflow horizontal.

### Testes

- [ ] Testes unitários do renderer para markdown, HTML seguro, tags bloqueadas e texto simples.
- [ ] Tests unitários para geração de sugestões por idioma, plano e disponibilidade de conectores.
- [ ] Playwright em mobile/tablet/desktop cobrindo chat vazio, resposta carregando e resposta rica.
- [ ] Playwright cobrindo clique em sugestão, preenchimento/envio e layout responsivo das sugestões.

## Fase 2: Idioma Forçado e Qualidade da Resposta

### Objetivo

Garantir que Balys respeite sempre o idioma configurado e passe por uma etapa de autocrítica antes de responder quando a tarefa pedir profundidade.

### Checklist

- [ ] Centralizar a resolução de idioma em `app/api/ai/chat/route.ts`.
- [ ] Injetar no system prompt uma regra forte: "Respond in the configured UI language unless the latest user message explicitly asks for another language."
- [ ] Passar `language`, `uiLang` e `notification_language` de forma consistente.
- [ ] Adicionar pós-validação de idioma: detectar resposta em idioma errado e pedir correção automática antes de devolver ao usuário.
- [ ] Criar `lib/ai/answer-satisfaction.ts` com avaliador de qualidade da resposta.
- [ ] O avaliador deve checar: objetivo atendido, uso correto de ferramentas, idioma, superficialidade, necessidade de pergunta, ações confirmadas e risco de alucinação.
- [ ] Se a resposta falhar, Balys deve corrigir internamente uma vez antes de responder.
- [ ] Se faltar contexto essencial, Balys deve perguntar ao usuário em vez de fingir completude.
- [ ] Registrar métricas internas de retry/correção sem expor ao usuário.

### Critérios de Aceite

- [ ] Usuário com UI em português recebe resposta em português mesmo que o modelo tente inglês.
- [ ] Usuário que pede "explain in English" recebe resposta em inglês naquela mensagem.
- [ ] Respostas rasas para tarefas analíticas são reprocessadas antes da saída.
- [ ] Balys pergunta quando falta informação para alterar email, doc, sheet ou agenda.

### Testes

- [ ] Unit tests para detector de idioma e fallback.
- [ ] Tests do satisfaction agent com casos: resposta rasa, idioma errado, tool receipt ausente, contexto insuficiente.
- [ ] Tests do chat route garantindo correção antes da resposta final.

## Fase 3: Actions, Ícones Reais e Conexão no Chat

### Objetivo

Melhorar a seleção e invocação de actions, tanto explícitas quanto inferidas, e oferecer conexão direta quando a conta não estiver autenticada.

### Checklist

- [ ] Criar um registry visual único para actions: Gmail, Sheets, Docs, Drive, Slack, Calendar, Notes, Finance, Weather, Council, Image, Reminder.
- [ ] Usar ícones reais da action no chip da mensagem enviada.
- [ ] Aumentar chip e ícone de selected action.
- [ ] Melhorar o pending action chip antes do envio.
- [ ] Persistir ícone, label, action e source no histórico.
- [ ] Reforçar inferência automática de action sem slash command.
- [ ] Criar classificador de intenção para detectar Gmail, Sheets, Docs, Drive, Slack, Calendar, Finance, Notes e prioridades.
- [ ] Se recurso exigir conector ausente, renderizar no chat um card de conexão com ícone real, nome da fonte e botão "Connect Google Sheets", "Connect Gmail", "Connect Slack", etc.
- [ ] O botão deve abrir o OAuth/conexão mantendo `return_to=/app/ai`, thread ativa e contexto da mensagem.
- [ ] Ao voltar do OAuth, restaurar a conversa atual, reexecutar ou oferecer "Continue where we stopped".
- [ ] Diferenciar conector inexistente, conector inativo e token expirado/rejeitado.

### Arquivos Prováveis

- `components/ai/CommandPalette.tsx`
- `app/app/ai/page.tsx`
- `app/api/ai/chat/route.ts`
- `app/api/auth/google/connect/route.ts`
- `app/api/auth/google/callback/route.ts`
- `app/api/connectors/route.ts`
- `lib/ai/shadow-router.ts`
- `lib/ai/tools/registry.ts`
- `lib/i18n.ts`

### Critérios de Aceite

- [ ] `/gmail` mostra ícone de Gmail bonito e legível.
- [ ] `/sheets` mostra ícone de Sheets bonito e legível.
- [ ] "adicione uma despesa na minha planilha" invoca Sheets mesmo sem slash command.
- [ ] "responda o email da Ana" invoca Gmail mesmo sem slash command.
- [ ] Conector ausente gera card clicável no chat, não erro seco.
- [ ] Após conectar, o usuário volta para o mesmo chat.

## Fase 4: Skill Avançada de Google Sheets

### Objetivo

Transformar Sheets em uma skill de analista financeiro/dados, capaz de entender planilhas reais, múltiplas abas, orientação vertical/horizontal, fórmulas, layouts e edições naturais.

### Checklist

- [ ] Expandir `docs/connectors/google-sheets.md` com contrato de "Spreadsheet Analyst Agent".
- [ ] Criar ou evoluir `lib/ai/agents/sheets-agent.ts`.
- [ ] Mapear workbook: abas, dimensões, ranges usados, headers, frozen rows, filtros, formatação, fórmulas e tabelas prováveis.
- [ ] Detectar orientação de tabela: vertical, horizontal, matriz, calendário, dashboard e blocos separados.
- [ ] Detectar campos financeiros comuns: data, descrição, categoria, subcategoria, valor, moeda, conta, cartão, status, recorrência, observação.
- [ ] Para "adicione uma despesa X de valor Y", inferir coluna correta, categoria provável, data padrão e moeda.
- [ ] Perguntar apenas informações indispensáveis: data, conta, categoria, planilha/aba quando ambíguo ou valor ausente.
- [ ] Preservar formatação da linha anterior, validações de dados, fórmulas e totais.
- [ ] Inserir linhas no local correto sem sobrescrever totalizadores.
- [ ] Criar modo `plan`, `analyze`, `edit`, `append_row`, `formula_fix`, `format`, `reconcile`.
- [ ] Exigir confirmação para mudanças destrutivas, grandes ou ambíguas.
- [ ] Retornar receipt humano: "Adicionei R$ 89,90 em Alimentação na aba Junho."
- [ ] Nunca mostrar A1 ranges, sheet IDs ou spreadsheet IDs ao usuário, exceto se ele pedir explicitamente detalhes técnicos.

### Casos Que Devem Funcionar

- [ ] "adicione uma despesa de 89,90 do mercado na planilha de gastos"
- [ ] "lança Uber 32 reais ontem no meu financeiro"
- [ ] "classifica esses gastos por categoria"
- [ ] "qual despesa ficou perigosa esse mês?"
- [ ] "corrige a fórmula do total"
- [ ] "cria uma aba de resumo mensal"
- [ ] "analisa a Finance 2026 e me diga o que cortar"
- [ ] "tem alguma linha duplicada?"
- [ ] "transforma essa planilha bagunçada em uma tabela limpa"

### Testes

- [ ] Unit tests para inferência de layout.
- [ ] Unit tests para categorização de despesa.
- [ ] Unit tests para seleção de aba.
- [ ] Tests de tool routing: pedido financeiro natural -> Sheets agent.
- [ ] Tests de não sobrescrever totalizadores/fórmulas.
- [ ] Tests de pergunta quando valor, data ou planilha estão ambíguos.

## Fase 5: Skill Avançada de Google Docs

### Objetivo

Transformar Docs em uma skill de escrivão/editor, capaz de criar, estruturar, formatar e editar documentos bonitos e úteis.

### Checklist

- [ ] Expandir `docs/connectors/google-docs.md` com contrato de "Docs Editorial Agent".
- [ ] Evoluir `lib/ai/agents/docs-agent.ts`.
- [ ] Criar modelos internos para ata, briefing, proposta, resumo executivo, plano de ação, relatório, memo e follow-up.
- [ ] Para "crie uma ata sobre reunião Y", buscar contexto em reunião, calendário, emails e docs quando autorizado.
- [ ] Estruturar documentos com título, contexto, participantes, decisões, tópicos, action items, responsáveis, prazos e próximos passos.
- [ ] Aplicar estilos via Google Docs API: headings, bullets, checklists quando suportado, negrito, tabelas simples e espaçamento.
- [ ] Preservar idioma, tom e propósito.
- [ ] Perguntar informações faltantes: audiência, reunião alvo, tom, data, responsáveis ou fonte.
- [ ] Diferenciar criar novo doc, editar doc existente, resumir doc e formatar doc.
- [ ] Retornar link do documento criado ou editado de forma humana.

### Casos Que Devem Funcionar

- [ ] "crie uma ata da reunião com João de ontem"
- [ ] "transforma minhas anotações em um documento bonito"
- [ ] "cria um briefing executivo sobre esse projeto"
- [ ] "adicione uma seção de riscos no documento X"
- [ ] "reorganize esse doc em tópicos e acionáveis"
- [ ] "faça um follow-up em formato de documento"

### Testes

- [ ] Tests de template de ata.
- [ ] Tests de roteamento natural para Docs sem slash.
- [ ] Tests de criação com idioma correto.
- [ ] Tests de edição com confirmação quando ambígua.
- [ ] Tests de não expor document IDs.

## Fase 6: Skill Avançada de Gmail

### Objetivo

Transformar Gmail em uma skill real de análise, drafting, follow-up e contexto, não só listagem de emails.

### Checklist

- [ ] Expandir `docs/connectors/gmail.md` com contrato de "Gmail Analyst and Drafting Agent".
- [ ] Garantir que `gmail.search_messages` é apenas descoberta.
- [ ] Garantir que `gmail.read_message` sempre lê corpo antes de resumir/analisar.
- [ ] Criar fluxo de drafting com destinatários, CC, assunto, tom, corpo e objetivo.
- [ ] Marcar múltiplas pessoas quando necessário, com confirmação antes de criar draft.
- [ ] Resolver pessoas por email anterior, thread, nome visível e contexto.
- [ ] Perguntar quando faltar destinatário, tom, objetivo, prazo ou autorização.
- [ ] Criar drafts em plain text bem formatado, já que Gmail literaliza markdown.
- [ ] Suportar: resumir thread, extrair pendências, preparar resposta, follow-up educado, cobrança, recusa, confirmação de agenda, encaminhamento.
- [ ] Nunca enviar email automaticamente.
- [ ] Retornar receipt: "Preparei um rascunho para Ana sobre contrato."

### Casos Que Devem Funcionar

- [ ] "o que a Ana respondeu sobre o contrato?"
- [ ] "responda dizendo que vou revisar hoje"
- [ ] "crie um follow-up para todo mundo dessa thread"
- [ ] "quais emails importantes eu ainda não respondi?"
- [ ] "me explica o email do Felipe Vale Freire"
- [ ] "draft em inglês para remarcar a reunião"

### Testes

- [ ] Search -> read body -> answer.
- [ ] Follow-up depois de listagem usa o message ID interno correto.
- [ ] Draft nunca envia email.
- [ ] Draft pergunta destinatário quando ambíguo.
- [ ] Draft sem markdown literal.
- [ ] Resposta respeita idioma configurado ou pedido pelo usuário.

## Fase 7: Prioridades, Projetos, Hoje e Semana com Fontes Cruzadas

### Objetivo

Perguntas de foco, projetos e priorização devem cruzar fontes conectadas e memória do usuário.

### Checklist

- [ ] Criar intent `priority_planning`.
- [ ] Quando o usuário perguntar "o que devo priorizar hoje/semana?", buscar fontes relevantes.
- [ ] Fontes possíveis: goals, today, calendar, reminders, meetings, Gmail, Docs, Sheets, Drive, notes, finance e perfil/memória.
- [ ] Respeitar permissões e conectores disponíveis.
- [ ] Se uma fonte não estiver conectada, seguir com as disponíveis e oferecer conexão como melhoria.
- [ ] Criar ferramenta agregadora `context.gather_priority_sources`.
- [ ] Deduplicar sinais: mesmo projeto citado em email, doc e reunião deve virar um item consolidado.
- [ ] Classificar por urgência, impacto, energia, dependências, prazos e alinhamento com goals.
- [ ] Explicar o que considerar e o que ignorar por agora.
- [ ] Produzir resposta curta com 3 prioridades, motivo e primeiro próximo passo.

### Testes

- [ ] Pergunta de prioridade invoca agregador.
- [ ] Fontes ausentes não quebram resposta.
- [ ] Goals pesam mais que ruído de email.
- [ ] Eventos do dia e deadlines aparecem corretamente.
- [ ] Balys pergunta quando o horizonte temporal estiver ambíguo.

## Fase 8: Avatar Google e Rapport

### Objetivo

Mostrar foto real do usuário nas mensagens e em local conveniente no menu.

### Checklist

- [ ] Investigar onde Supabase armazena `avatar_url` do Google.
- [ ] Expor `user.avatar_url`, `full_name` e email em endpoint de perfil leve.
- [ ] Usar foto no avatar das mensagens enviadas pelo usuário.
- [ ] Usar fallback com inicial quando não houver foto.
- [ ] Mostrar foto no menu lateral ou header do app com tooltip/email.
- [ ] Não salvar imagem externa sem necessidade; usar URL do provedor quando disponível.

### Testes

- [ ] Avatar mostra foto quando existe.
- [ ] Avatar usa fallback estável sem foto.
- [ ] Mobile não quebra layout.

## Fase 9: Menu, Tutoriais e Login

### Objetivo

Deixar a plataforma mais viva, com navegação mais clara, tutoriais atualizados e login com animação 3D em "flow".

### Checklist de Menu

- [ ] Revisar `app/app/layout.tsx`.
- [ ] Melhorar paleta dos ícones do menu com cores específicas por área.
- [ ] Usar benchmark visual de Google, Gemini, ChatGPT e MemoreAI sem copiar marca.
- [ ] Manter contraste e foco acessível.
- [ ] Evitar menu monocromático morto.

### Checklist de Tutoriais

- [ ] Atualizar conteúdo em `lib/tutorials/content.ts`.
- [ ] Cobrir Balys actions, Gmail, Docs, Sheets, Drive, Calendar, Goals, Today, Finance, Support, WhatsApp, Meetings, Reminders e Reviews.
- [ ] Criar progressão em cards vivos: "Start", "Practice", "Try with Balys".
- [ ] Usar cores mais vivas e ícones maiores.
- [ ] Melhorar leitura com títulos curtos e descrições práticas.
- [ ] Adicionar exemplos de prompts reais.
- [ ] Garantir pt-BR e en-US.

### Checklist de Login

- [ ] Revisar `app/(auth)/login/page.tsx`.
- [ ] Criar fundo com animação 3D ou pseudo-3D em fluxo, alinhado ao brand kit.
- [ ] Trocar texto para "Productivity Ecosystem" ou equivalente.
- [ ] Remover aviso "By signing in, you grant Flow Me access to your Google Calendar".
- [ ] Melhorar botão Google com ícone mais chamativo e estado hover/focus.
- [ ] Garantir performance e fallback caso WebGL/3D não carregue.

### Testes

- [ ] Playwright para menu em desktop/mobile.
- [ ] Playwright para tutoriais em mobile/tablet/desktop.
- [ ] Playwright para login sem overflow e com botão visível.
- [ ] Se usar canvas/WebGL, teste visual básico para canvas não vazio.

## Fase 10: Configurações e Suporte

### Objetivo

Remover cancelamento explícito de Configurações e corrigir suporte para processar texto livre com Balys.

### Checklist de Settings

- [ ] Remover botão "Solicitar cancelamento" da seção Assinatura em `app/app/settings/page.tsx`.
- [ ] Manter "Atualizar pagamento", "Ver faturas" e informação de plano.
- [ ] Direcionar dúvidas de cancelamento apenas pelo funil de suporte.
- [ ] Testar Pro, Free e provider sem portal.

### Checklist de Suporte

- [ ] Reproduzir erro "Complete the previous step to continue."
- [ ] Corrigir lógica que trata texto livre como etapa inválida de funil quando deveria responder ou guiar.
- [ ] Permitir que Balys Support processe dúvidas livres sobre funcionalidades.
- [ ] Categorizar intenção: billing, connectors, onboarding, AI credits, usage, troubleshooting, cancellation, feature education.
- [ ] Só aplicar bloqueio de funil quando o usuário tenta avançar no cancelamento fora da ordem.
- [ ] Melhorar resposta com fontes de knowledge base e próximos passos.
- [ ] Criar estados visuais de loading, erro recuperável e resposta.

### Testes

- [ ] Texto livre "cancelar assinatura" inicia funil corretamente.
- [ ] Texto livre "como conecto Gmail?" responde sem erro.
- [ ] Tentativa de pular etapa do funil retorna erro contextual.
- [ ] UI mostra erro no chat sem quebrar fluxo.

## Fase 11: Segurança, Permissões e Confirmações

### Objetivo

Manter confiança e evitar alterações perigosas em conectores.

### Checklist

- [ ] Todas as ações de escrita em Gmail, Docs, Sheets e Calendar exigem tool receipt confirmado.
- [ ] Ações destrutivas pedem confirmação explícita.
- [ ] Logs não expõem tokens, bodies sensíveis completos ou IDs ao usuário.
- [ ] UI de conectar conta usa "Connect account", não "OAuth" ou "scope".
- [ ] Erros de token diferenciam: não conectado, reconectar, permissão insuficiente, provider indisponível.
- [ ] Garantir que restricted scopes Gmail/Drive têm uso real correspondente no produto.

## Sequência Recomendada de Implementação

1. Chat UI foundation: renderer rico, loader typing, avatar/ícone maior, fonte e selected action chip.
2. Idioma forçado e answer satisfaction guardrail.
3. Connector missing auth cards e retorno para o mesmo chat.
4. Gmail skill avançada, porque o review do Google e o print expõem Gmail claramente.
5. Sheets skill avançada, começando por append de despesa e layout mapping.
6. Docs skill avançada, começando por criação de atas e documentos estruturados.
7. Priority planning com fontes cruzadas.
8. Suporte e remoção do cancelamento em settings.
9. Tutoriais e menu visual.
10. Login com animação 3D.

## Checklist Mestre

- [ ] Balys renderiza respostas bonitas sem markdown cru.
- [ ] Loader principal é typing dots.
- [ ] Ícone do Balys está maior e legível.
- [ ] Empty state do Balys tem balões de sugestões clicáveis conectados ao flow do Flow Me.
- [ ] Idioma configurado é respeitado com autocorreção.
- [ ] Gmail tem análise, leitura de corpo, drafting e múltiplos destinatários.
- [ ] Sheets entende layouts, abas, categorias, fórmulas e edições financeiras.
- [ ] Docs cria e edita documentos bonitos com estrutura.
- [ ] Conector ausente mostra CTA visual dentro do chat.
- [ ] Fonte do chat foi atualizada.
- [ ] Answer satisfaction agent revisa e corrige respostas rasas.
- [ ] Perguntas de prioridade cruzam goals, agenda, emails, docs, sheets, reuniões, lembretes e notas.
- [ ] Action chip usa ícone real, maior e mais bonito.
- [ ] Balys invoca actions automaticamente sem slash command.
- [ ] Foto Google aparece nas mensagens do usuário e no menu.
- [ ] Menu tem ícones mais vivos e contrastados.
- [ ] Settings não mostra "Solicitar cancelamento" explicitamente.
- [ ] Support aceita texto livre e categoriza ajuda.
- [ ] Tutorials foram atualizados para funcionalidades atuais.
- [ ] Login tem fundo 3D em flow, copy atualizada e botão Google melhor.
- [ ] Testes unitários, integração e Playwright cobrem as mudanças.
- [ ] `npm test`, `npm run build` e Playwright relevante passam antes do deploy.

## Riscos e Decisões

- [ ] Decidir se o renderer aceita HTML do modelo ou se converte tudo para markdown/AST seguro.
- [ ] Decidir qual fonte entra no brand kit final antes de alterar globalmente o chat.
- [ ] Decidir se o answer satisfaction agent usa modelo barato por padrão e sobe para modelo forte em tarefas de alto risco.
- [ ] Decidir se conectar conector pelo chat deve reexecutar automaticamente a última mensagem ou pedir clique em "Continuar".
- [ ] Decidir se Gmail `gmail.modify` permanece ou se a skill será limitada a read-only + draft se o Google review ficar pesado.
- [ ] Decidir se login 3D usa Three.js real ou animação CSS/canvas leve para reduzir risco de performance.

## Definição de Pronto

- [ ] O usuário consegue mandar mensagens comuns sem slash e Balys escolhe a action correta.
- [ ] O usuário consegue conectar uma fonte faltante sem perder a conversa.
- [ ] Gmail, Docs e Sheets respondem com base em dados reais lidos por ferramentas.
- [ ] As respostas são visualmente bonitas, no idioma certo e sem artefatos crus.
- [ ] O suporte ajuda com texto livre e mantém cancelamento dentro do funil.
- [ ] Tutoriais, menu e login passam a impressão de produto vivo, premium e confiável.
- [ ] O conjunto passa testes automatizados e validação responsiva.
