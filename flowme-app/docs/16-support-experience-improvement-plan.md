# Plano de Melhoria da Experiência de Suporte e Cancelamento

## Estado da implementação — 22/06/2026

- [x] Funil autenticado e sequencial de gestão, recorrência e cancelamento.
- [x] Tela bilíngue com conversa visível, sugestões reduzidas e formulário oculto até a conclusão do funil.
- [x] Validação visual `100/10/10`, revisão antes do envio, receipt e erros públicos localizados.
- [x] Migration 060 com roles, auditoria, histórico de plano e eventos normalizados de receita.
- [x] Dashboard `/app/admin/cancellations` com fila, relato completo, decisão justificada e confirmação dupla de execução.
- [x] Cancelamento pelos adapters Stripe e Asaas; Apple/Google exigem a ação da loja.
- [x] Testes automatizados e build de produção executados com sucesso.
- [ ] Aplicar `060_support_experience.sql`, conceder roles internas e executar QA manual bilíngue/mobile.

## Objetivo

Transformar `/app/support` em uma experiência clara, responsiva e realmente bilíngue (`pt-BR` e `en-US`), com:

- perguntas rápidas que sempre produzem feedback visível;
- conversa com Balys Suporte como superfície principal;
- funil progressivo de retenção antes de disponibilizar a solicitação de cancelamento;
- solicitação detalhada, analisada e decidida por um manager da Flow Me;
- validação visual antes do envio;
- revisão explícita antes de abrir uma solicitação;
- erros seguros e localizados, sem mensagens técnicas do banco;
- estado da solicitação compreensível depois do envio.

## Diagnóstico Atual

- [x] O clique em uma pergunta rápida chama a API, mas a conversa aparece depois de uma lista extensa de chips e frequentemente fica fora da área visível.
- [x] `selectedPrompt` é calculado apenas pelo parâmetro inicial e nunca muda ao clicar; portanto, não há feedback de seleção.
- [x] Não há scroll/foco automático para a resposta nem estado de carregamento associado ao chip acionado.
- [x] As perguntas rápidas, labels, estados, datas e mensagens da página estão hardcoded em português.
- [x] A base de conhecimento tenta adivinhar inglês pelas palavras da pergunta em vez de usar o idioma configurado pelo usuário.
- [x] Os endpoints retornam mensagens de validação em inglês, como `reason must have at least 100 characters`.
- [x] Erros do Supabase podem ser enviados diretamente ao cliente.
- [x] Falhas ao carregar billing e solicitações são engolidas por `.catch(() => {})`, deixando a tela silenciosamente incompleta.
- [x] O botão de cancelamento permanece habilitado com campos inválidos e a validação só se torna evidente depois do request.
- [x] O formulário exige três textos longos ao mesmo tempo; a restrição de 100 caracteres está duplicada no banco e na API.
- [x] O formulário de cancelamento ocupa metade da tela mesmo quando o usuário só quer tirar uma dúvida.
- [x] Em mobile, perguntas, conversa e formulário formam uma página excessivamente longa e sem hierarquia.
- [x] Status internos como `open` e `in_review` e datas em `pt-BR` são exibidos sem respeitar o idioma da interface.

## Decisões de Produto

### Idioma

- [ ] A fonte de verdade será `ui_language`, usando `resolveUiLang` e `getUiLang` de `lib/i18n.ts`.
- [ ] A UI trabalhará com `pt` e `en`; contratos externos usarão `pt-BR` e `en-US` através de uma conversão centralizada.
- [ ] Nunca inferir o idioma pela frase digitada.
- [ ] Datas, estados, contadores, validações, respostas rápidas, alerts e CTAs devem usar o mesmo idioma.
- [ ] Mudança de `ui_language` deve atualizar a tela sem reload.

### Erros e logs

- [ ] APIs retornam códigos estáveis e detalhes estruturados, não mensagens do Supabase:
  - `SUPPORT_MESSAGE_INVALID`
  - `SUPPORT_UNAVAILABLE`
  - `CANCELLATION_REASON_REQUIRED`
  - `CANCELLATION_DETAILS_INVALID`
  - `CANCELLATION_ALREADY_OPEN`
  - `CANCELLATION_CREATE_FAILED`
- [ ] O cliente traduz códigos através do catálogo `UI[lang].support.errors`.
- [ ] O servidor pode incluir uma mensagem localizada como fallback para clientes externos, usando apenas locales suportados.
- [ ] Logs internos permanecem estruturados e independentes do idioma: route, code, request ID, user ID, locale e causa técnica.
- [ ] Nunca registrar texto completo do motivo de cancelamento, tokens ou payloads sensíveis.
- [ ] Mensagem técnica recebe um `request_id`; o usuário vê uma mensagem segura e pode informar esse código ao suporte.

### Cancelamento

- [ ] O fluxo deve sim dificultar artificialmente o cancelamento como “evitar cancelamentos impulsivos”. Deve exigir perguntas que detalham o motivo de cancelamento.
- [ ] Explicar com precisão que a solicitação interna não cancela imediatamente uma cobrança recorrente.
- [ ] Somente um usuário com role de manager da Flow Me pode acessar o painel, analisar a explicação e decidir entre cancelar, solicitar mais informações ou reter a assinatura.
- [ ] Uma decisão de cancelamento deve interromper a recorrência pelo provider abstrato e mudar o plano para Free somente quando a operação estiver confirmada.
- [ ] Manter no banco o histórico imutável de tempo em cada plano e os eventos normalizados de receita/reembolso necessários para métricas como ARPU e LTV.
- [ ] Não exibir a ação de cancelamento na entrada da tela. Ela é revelada apenas pelo funil contextual de suporte.
- [ ] Exigir motivo estruturado e explicação detalhada obrigatória:
  - preço;
  - problema técnico;
  - não estou usando;
  - expectativa não atendida;
  - privacidade;
  - outro.
- [ ] Preservar as perguntas detalhadas atuais e seus mínimos de `100/10/10` caracteres, com validação visual antes do request.
- [ ] Antes do envio, mostrar uma revisão com motivo, provider, efeito esperado e próximos passos.
- [ ] A dificuldade deve vir da progressão e da reflexão exigida, nunca de botões quebrados, erros ocultos, perda do texto ou informação falsa.
- [ ] Antes de produção, validar o fluxo com jurídico e com as regras de Stripe, Asaas, Apple e Google; compras controladas pelas lojas devem respeitar o mecanismo de cancelamento da própria loja.

## Arquitetura de i18n

### Catálogo de UI

- [ ] Adicionar `support` em `UI.en` e `UI.pt` no `lib/i18n.ts`.
- [ ] Cobrir:
  - cabeçalho e descrição;
  - categorias e perguntas rápidas;
  - composer e estados de conversa;
  - formulário, validação, confirmação e sucesso;
  - status de solicitações;
  - mensagens específicas por provider;
  - erros e ações de retry.
- [ ] Adicionar teste de paridade que falha se uma chave existir em um idioma e faltar no outro.

### Base de conhecimento

- [ ] Trocar `title/body` únicos por conteúdo localizado:

```ts
type LocalizedSupportContent = {
  pt: { title: string; body: string; quickQuestion: string };
  en: { title: string; body: string; quickQuestion: string };
};
```

- [ ] Manter `key` estável para cada tópico.
- [ ] Separar keywords por idioma.
- [ ] `answerSupportQuestion` recebe `lang` explicitamente.
- [ ] Adicionar `asaas` à apresentação de providers.
- [ ] Atualizar conteúdo de cobrança para Stripe + Asaas Pix, sem dizer que toda assinatura web é Stripe.

## Nova Experiência da Tela

### Estrutura

- [ ] Cabeçalho compacto com status do plano e acesso a solicitações abertas.
- [ ] Balys Suporte ocupa a superfície principal.
- [ ] A entrada inicial apresenta categorias de ajuda, sem card, formulário ou CTA de cancelamento.
- [ ] Cobrança aparece como `Gerir minha assinatura`; cancelamento só surge depois das respostas obrigatórias do funil.
- [ ] Depois de desbloqueado, o formulário abre em seção dedicada, stepper ou drawer; não permanece sempre ocupando metade da tela.
- [ ] Em mobile, usar uma única coluna e manter o composer acessível sem scroll excessivo.

### Perguntas rápidas

- [ ] Substituir 19 chips simultâneos por categorias e 4–6 sugestões relevantes:
  - Começar;
  - Balys e IA;
  - Organização;
  - Conectores;
  - Cobrança;
  - Privacidade.
- [ ] Cada pergunta usa um `question_key` estável em vez de depender do texto traduzido.
- [ ] Ao clicar:
  1. marcar o item selecionado;
  2. inserir a pergunta na conversa;
  3. exibir skeleton/“Balys está respondendo”;
  4. levar foco/scroll para a conversa;
  5. mostrar a resposta ou erro com retry no mesmo bloco.
- [ ] Bloquear duplo clique enquanto aquela pergunta estiver em andamento.
- [ ] Enter envia; Shift+Enter cria nova linha.
- [ ] Preservar histórico da sessão ao alternar para cancelamento e voltar.

### Conversa

- [ ] Timeline aparece acima das sugestões após a primeira interação.
- [ ] Diferenciar visualmente usuário e Balys, com labels acessíveis.
- [ ] Exibir fontes como links/chips humanos, nunca IDs internos.
- [ ] Quando a resposta não existir, oferecer escalonamento humano com contexto preservado.
- [ ] Uma falha não deve apagar a pergunta digitada.

### Funil PLG obrigatório

- [ ] A progressão controlada é:
  1. `Gerir minha assinatura` → Balys explica plano atual, cobrança e opções de gestão;
  2. `Pagamento e recorrência` → Balys explica provider, renovação, vencimento e meios de pagamento;
  3. `Cancelar assinatura` → Balys explica o processo de análise e oferece abrir a solicitação detalhada;
  4. formulário detalhado → revisão → envio para o manager.
- [ ] Cada resposta oferece somente as próximas ações pertinentes à etapa; `Cancelar assinatura` não aparece nas sugestões iniciais.
- [ ] Se o usuário escrever diretamente “quero cancelar”/“I want to cancel”, Balys inicia o mesmo funil em `Gerir minha assinatura`, preservando a intenção até a etapa final.
- [ ] O servidor, e não apenas a UI, controla a progressão por uma sessão de funil autenticada, com estágio, timestamps e expiração.
- [ ] A URL direta do formulário e requests manuais não podem ignorar as etapas obrigatórias.
- [ ] Ao concluir `Pagamento e recorrência`, o servidor libera a etapa de cancelamento; ao concluir sua explicação, libera o formulário.
- [ ] Voltar para tirar outra dúvida não perde o estágio já concluído dentro da sessão válida.
- [ ] Eventos do funil armazenam keys e timestamps, nunca o conteúdo livre da conversa em analytics.

## Fluxo de Cancelamento

### Etapa 1 — Motivo

- [ ] Motivo estruturado obrigatório.
- [ ] Explicação principal obrigatória com mínimo de 100 caracteres e contador visível.
- [ ] Feedback inline somente depois de interação (`touched`) ou tentativa de avançar.
- [ ] Indicadores visuais: neutro, válido e inválido; não depender apenas de cor.

### Etapa 2 — Como podemos ajudar

- [ ] Funcionalidades que decepcionaram e expectativa não atendida continuam obrigatórias, com mínimo de 10 caracteres cada.
- [ ] Perguntas complementares condicionais ao motivo podem ser adicionadas sem substituir os três relatos obrigatórios.
- [ ] Escolha de suporte humano com explicação clara.
- [ ] Mostrar opções de retenção e suporte antes da revisão; a escolha fica registrada para a análise do manager.

### Etapa 3 — Revisão antes do envio

- [ ] Resumo do que será enviado.
- [ ] Estado atual do plano/provider.
- [ ] Aviso explícito sobre cobrança e efeito da solicitação.
- [ ] Checkbox de ciência quando a assinatura também precisar ser cancelada na loja.
- [ ] Botões `Voltar e editar` e `Enviar solicitação`.
- [ ] O submit só fica habilitado quando a etapa atual estiver válida.

### Confirmação

- [ ] Substituir o formulário por um receipt visual com:
  - protocolo/request ID;
  - status localizado;
  - data localizada;
  - próximos passos;
  - ação para continuar conversando.
- [ ] Se já existir solicitação `open`/`in_review`, mostrar o status em vez de permitir duplicata.
- [ ] Draft local tem versão e TTL; limpar drafts incompatíveis ou antigos.

## Contratos de API

### `POST /api/support/chat`

- [ ] Novo body:

```json
{
  "question_key": "manage_subscription",
  "message": null,
  "locale": "pt-BR",
  "funnel_session_id": null
}
```

- [ ] Aceitar exatamente `question_key` ou `message`.
- [ ] Validar locale em `pt-BR | en-US`.
- [ ] Retornar resposta no locale pedido e fontes localizadas.
- [ ] Retornar `funnel_session_id`, `funnel_stage`, `next_actions` e `cancellation_form_available` quando o assunto for assinatura.
- [ ] Validar transições no servidor; uma `question_key` posterior não pode pular uma etapa.
- [ ] Manter compatibilidade temporária com `{ message }`.

### `POST /api/support/cancellation-requests`

- [ ] Novo body:

```json
{
  "reason_code": "technical_problem",
  "reason": "explicação detalhada com pelo menos 100 caracteres...",
  "disappointing_features": "...",
  "unmet_expectation": "...",
  "would_accept_human_support": true,
  "locale": "pt-BR",
  "source": "support_balys",
  "funnel_session_id": "..."
}
```

- [ ] Exigir uma sessão autenticada com todas as etapas do funil concluídas e ainda válida.
- [ ] Retornar `field_errors` por chave, nunca frases técnicas.
- [ ] Rejeitar uma segunda solicitação aberta com `409 CANCELLATION_ALREADY_OPEN`.
- [ ] Retornar receipt normalizado com `id`, `status`, `created_at` e próximos passos por provider.

### `GET /api/support/requests`

- [ ] Retornar valores de status normalizados; tradução fica no cliente.
- [ ] Expor somente campos necessários à timeline do usuário.
- [ ] Falha deve mostrar retry, não desaparecer silenciosamente.

## Banco de Dados

- [ ] Criar migration `060_support_experience.sql`.
- [ ] Adicionar `reason_code` à `subscription_cancellation_requests`.
- [ ] Preservar os checks de `100/10/10` caracteres e espelhar os mesmos limites no contrato da API e na UI.
- [ ] Manter as colunas atuais de explicação para compatibilidade e histórico.
- [ ] Criar `subscription_cancellation_funnel_sessions` com usuário, estágio atual, etapas concluídas, locale, origem e expiração.
- [ ] Adicionar à solicitação `funnel_session_id`, `decision`, `decision_reason`, `decided_by`, `decided_at`, `provider_action_status`, `provider_action_id`, `provider_action_error` e `provider_action_completed_at`.
- [ ] Expandir a máquina de estados sem confundir decisão com execução:
  - análise: `open` → `in_review` → `needs_info`;
  - decisão sem cancelamento: `retained` ou `rejected`;
  - decisão com cancelamento: `approved_cancel` → `canceling` → `canceled`;
  - falha externa: `provider_action_failed`, com retry para `canceling`.
- [ ] Criar `subscription_cancellation_request_events` como trilha imutável de abertura, atribuição, pedido de informação, decisão e execução.
- [ ] Criar histórico de plano com início/fim, provider, motivo da transição e solicitação de origem; não sobrescrever períodos encerrados.
- [ ] Persistir eventos normalizados de receita e reembolso, ligados ao usuário e ao período da assinatura, para ARPU/LTV sem depender de payload bruto do provider.
- [ ] Adicionar índice parcial para impedir mais de uma solicitação aberta por usuário:

```sql
CREATE UNIQUE INDEX ... ON subscription_cancellation_requests(user_id)
WHERE status IN (
  'open', 'in_review', 'needs_info', 'approved_cancel',
  'canceling', 'provider_action_failed'
);
```

- [ ] Definir migração de dados existentes para `reason_code = 'other'`.

## Dashboard de Management

### Acesso e fila

- [ ] Criar `/app/admin/cancellations`, separado do resumo operacional de billing atual.
- [ ] Introduzir roles persistidas e verificadas no servidor (`support_manager`, `billing_manager`, `admin`); o allowlist de IDs em variável de ambiente fica apenas como transição.
- [ ] RLS e APIs administrativas devem negar acesso sem a role apropriada, independentemente da UI.
- [ ] Exibir fila por status, idade/SLA, provider, plano, locale, responsável e risco de cobrança próxima.
- [ ] Permitir atribuição a um manager, filtros, busca e indicadores de solicitações novas, em análise e aguardando ação.

### Detalhe e decisão

- [ ] Mostrar a explicação completa, respostas adicionais, opção de suporte humano, trilha do funil e histórico de solicitações.
- [ ] Mostrar plano/provider, tempo como assinante, data da próxima cobrança, pagamentos/reembolsos normalizados e métricas auxiliares de retenção.
- [ ] Ações: assumir, pedir mais informações, registrar contato/oferta, reter/encerrar, negar com justificativa ou aprovar cancelamento.
- [ ] Toda decisão exige justificativa interna, identidade do manager, timestamp e evento de auditoria.
- [ ] O usuário recebe status e comunicação localizados; notas internas nunca são expostas.

### Execução do cancelamento

- [ ] A aprovação e a execução são ações separadas, com confirmação visual em duas etapas.
- [ ] Criar um serviço de domínio idempotente que use a porta de billing (`cancelSubscription`) e selecione Stripe/Asaas pelo provider da assinatura.
- [ ] Nenhuma rota ou componente administrativo chama SDKs Stripe/Asaas diretamente.
- [ ] Registrar tentativa, resposta normalizada e erro seguro; retry reutiliza a mesma chave de idempotência.
- [ ] Só encerrar o período de plano e aplicar Free após confirmação normalizada do provider/webhook conforme a política escolhida (`immediate` ou `period_end`).
- [ ] Para Apple/Google, orientar o fluxo obrigatório da loja e acompanhar a confirmação; não marcar como cancelado apenas pelo clique do manager.
- [ ] Em falha parcial, manter status explícito `provider_action_failed`, preservar o Pro enquanto houver direito ativo e criar alerta operacional.

### APIs administrativas

- [ ] Separar leitura, decisão e efeito externo:
  - `GET /api/admin/cancellation-requests` — fila e filtros;
  - `GET /api/admin/cancellation-requests/:id` — detalhe e histórico;
  - `PATCH /api/admin/cancellation-requests/:id` — atribuição e pedido de informação;
  - `POST /api/admin/cancellation-requests/:id/decision` — decisão justificada;
  - `POST /api/admin/cancellation-requests/:id/execute` — ação idempotente no provider.
- [ ] Nunca permitir que um simples PATCH de status finja que a cobrança foi interrompida.

## Observabilidade

- [ ] Instrumentar:
  - `support_quick_question_clicked`;
  - `support_answer_rendered`;
  - `support_answer_failed`;
  - `cancellation_started`;
  - `cancellation_reviewed`;
  - `cancellation_submitted`;
  - `cancellation_failed`;
  - `cancellation_funnel_stage_viewed`;
  - `cancellation_manager_decided`;
  - `cancellation_provider_action_completed`;
  - `cancellation_provider_action_failed`.
- [ ] Medir tempo até resposta, taxa de erro, perguntas sem resposta, abandono por etapa, retenção por decisão e tempo até resolução.
- [ ] Não enviar conteúdo livre do usuário para analytics.

## Plano de Implementação

### Fase 1 — Contratos, banco e testes

- [ ] Escrever testes de i18n, knowledge base e validação antes das mudanças.
- [ ] Definir keys estáveis de perguntas, motivos, status e erros.
- [ ] Criar migration 060 com sessões do funil, decisão, auditoria e histórico, mantendo os mínimos atuais.

### Fase 2 — Correção funcional do Balys Suporte

- [ ] Corrigir seleção ativa e visibilidade da conversa.
- [ ] Adicionar loading por pergunta, scroll/foco e retry.
- [ ] Fazer API e knowledge base receberem locale explícito.
- [ ] Remover inferência de idioma pelo conteúdo digitado.

### Fase 3 — Funil PLG e cancelamento detalhado

- [ ] Implementar a sequência obrigatória `Gerir assinatura` → `Pagamento e recorrência` → `Cancelar assinatura`.
- [ ] Persistir e validar a progressão no servidor e impedir bypass por URL/API.
- [ ] Implementar validação inline e progressão por etapas.
- [ ] Implementar revisão antes do submit.
- [ ] Prevenir solicitações duplicadas.
- [ ] Implementar receipt e status após envio.

### Fase 4 — Dashboard de management

- [ ] Implementar roles, fila, detalhe, atribuição, decisão e auditoria.
- [ ] Implementar execução idempotente pela abstração de providers.
- [ ] Implementar histórico de plano/receita e comunicação localizada ao usuário.

### Fase 5 — Redesign responsivo

- [ ] Reorganizar a página com conversa principal e cancelamento sob demanda.
- [ ] Reduzir perguntas rápidas e adicionar categorias.
- [ ] Validar desktop, tablet e mobile.

### Fase 6 — Erros, logs e acessibilidade

- [ ] Mapear todos os códigos para pt-BR/en-US.
- [ ] Remover mensagens técnicas de respostas públicas.
- [ ] Adicionar request IDs, logs estruturados e ações de retry.
- [ ] Verificar foco, teclado, screen reader, contraste e touch targets.

## Estratégia de Testes

### Unitários

- [ ] Paridade das traduções `support` em `pt` e `en`.
- [ ] Busca e resposta da knowledge base nos dois idiomas.
- [ ] Mapeamento de códigos de erro, status e providers.
- [ ] Validação de etapas e limites do formulário.
- [ ] Detecção de intenção de cancelamento em pt-BR e en-US.

### API

- [ ] Quick question por key em ambos os locales.
- [ ] Mensagem livre em ambos os locales.
- [ ] Locale inválido.
- [ ] Field errors estruturados.
- [ ] Nenhuma mensagem Supabase vazando para o cliente.
- [ ] Criação, duplicidade e leitura de solicitação.
- [ ] Ordem obrigatória do funil e rejeição de transições puladas.
- [ ] URL/request direto não libera nem envia o formulário sem sessão concluída.
- [ ] Autorização por role em todas as rotas de management.
- [ ] Decisão e execução no provider são separadas e idempotentes.
- [ ] Falha de provider não altera indevidamente o entitlement.
- [ ] Provider Stripe, Asaas, Apple e Google.

### E2E

- [ ] Clicar pergunta mostra loading e resposta visível sem scroll manual.
- [ ] A tela inicial não exibe cancelamento.
- [ ] `Gerir minha assinatura` revela `Pagamento e recorrência`, que revela `Cancelar assinatura`, que libera o formulário.
- [ ] Intenção livre de cancelamento entra no mesmo funil sem abrir o formulário diretamente.
- [ ] Trocar idioma atualiza toda a tela.
- [ ] Campos inválidos mostram feedback antes de qualquer request.
- [ ] Revisão aparece antes do submit.
- [ ] Sucesso substitui formulário por receipt.
- [ ] Falha permite retry sem perder o draft.
- [ ] Fluxos desktop e mobile em pt-BR/en-US.
- [ ] Manager visualiza o relato completo, decide com justificativa e acompanha a execução no provider.
- [ ] Auditoria e histórico de plano permanecem íntegros após cancelamento, retenção e retry.

## Critérios de Aceite

- [ ] Nenhum texto visível permanece hardcoded fora do catálogo bilíngue.
- [ ] Nenhum erro técnico do backend é exibido ao usuário.
- [ ] Toda pergunta rápida produz feedback visível em até um frame e resposta/erro no mesmo contexto.
- [ ] Nenhuma ação de cancelamento aparece na entrada inicial da experiência de suporte.
- [ ] O formulário só pode ser aberto e submetido após as três interações obrigatórias do funil, com validação também no backend.
- [ ] O usuário sabe por que o cancelamento ainda não pode ser enviado antes de clicar no botão.
- [ ] O usuário revisa consequências e conteúdo antes do submit.
- [ ] Os três relatos obrigatórios respeitam os mínimos `100/10/10` e mostram validação antes do request.
- [ ] Solicitações duplicadas são impedidas no banco e tratadas amigavelmente na UI.
- [ ] Manager autorizado consegue analisar, justificar a decisão e executar o cancelamento sem acoplamento direto a Stripe ou Asaas.
- [ ] Mudar um status interno nunca é suficiente para interromper cobrança ou remover entitlement.
- [ ] Histórico de plano, decisões, tentativas no provider e eventos de receita permanecem auditáveis para ARPU/LTV.
- [ ] Status, datas, providers e próximos passos são localizados.
- [ ] `npm test` e `npm run build` passam.
