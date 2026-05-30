# Slack — Plano de Implementação

> Conectar o Slack ao Flowme para que o **Balys** possa ler e agir no Slack do usuário.

## Decisões (definidas com o time)

| Decisão | Escolha | Implicação |
|---|---|---|
| **Modelo de acesso** | Cada usuário conecta o seu Slack via **OAuth** (multi-tenant) | Igual Gmail/Drive hoje. App Slack precisa de **distribuição pública** habilitada. |
| **Abordagem técnica** | **Connector nativo** com `@slack/web-api` | Segue o padrão atual do codebase. Sem infra nova. |
| **Capacidades** | **Leitura + escrita** (escrita com confirmação) | Precisa de scopes de leitura **e** escrita. |

### Por que connector nativo e não MCP?
O pedido original era "conexão com MCP do Slack", mas, vendo o tradeoff, optamos pelo connector nativo porque:

1. **O codebase não tem cliente MCP** — toda integração externa hoje é client nativo (`googleapis`, `@google/generative-ai`, `evolution-client`) + o framework de Tools do Balys (`lib/ai/tools/`). Adicionar MCP seria infra e padrão novos só pra um provedor.
2. **Multi-tenant não casa com MCP server single-token** — a maioria dos Slack MCP servers usa **um token fixo por instância**. Como cada usuário conecta o **próprio** workspace via OAuth, precisaríamos de um MCP server por usuário (inviável) ou um server que aceite token por requisição (não é o padrão MCP).
3. **OAuth por usuário já existe** — o fluxo de connectors (Gmail/Drive) já resolve OAuth, refresh e storage por usuário. Reaproveitamos 90%.

> Se no futuro quiserem padronizar em MCP (ex.: expor as próprias tools do Flowme **como** um MCP server pra outros clientes), isso é um épico separado e não bloqueia este plano.

---

## Como funciona hoje (base que vamos reaproveitar)

| Camada | Arquivo | O que faz |
|---|---|---|
| Schema | `supabase/migrations/014_connectors.sql` | `connector_type` ENUM (`gmail`, `google_docs`, `google_sheets`, `google_drive`) + tabela `connectors` (RLS por `user_id`, `config` JSONB com `linked_account_id`). |
| OAuth | `app/api/auth/google/connect/route.ts` + `callback/route.ts` | Gera URL de autorização, recebe callback, troca `code` por tokens, persiste e marca `linked_accounts.is_active`. |
| Tokens | `lib/google/google-auth.ts` (`getValidGoogleToken`) | Lê token por `linked_account_id`, checa expiração (margem 5min) e faz refresh. |
| Client externo | `lib/whatsapp/evolution-client.ts` | Padrão de módulo wrapper de API externa (headers, `post`/`get`, erros). |
| Tools do Balys | `lib/ai/tools/Tool.ts` (`defineTool`, `ToolContext`, `ToolResult`) | Contrato de tool: `name`, `inputSchema` (zod), `isReadOnly`, `call(args, ctx)`. |
| Registro | `lib/ai/tools/registry.ts` (`ALL_TOOLS`, `TOOL_DOMAIN_PREFIXES`) | Lista de tools e prefixo por domínio. |
| Tools de connector | `lib/ai/tools/connectors-tools.ts` | `getGoogleAccountId(ctx)` resolve o `linked_account_id` do connector ativo; tools chamam a API com o token. |
| UI | `app/app/connectors/page.tsx` | Adicionar connector, escolher `type`, autorizar (OAuth), reconectar, renomear, remover. |

`ToolContext` (de `lib/ai/tools/Tool.ts`):
```ts
type ToolContext = {
  supabase: any;
  user: { id: string; email?: string | null; ... };
  timezone: string;
  nowIso: string;
  threadId?: string;
  preferredConnectorType?: 'gmail' | 'google_drive' | 'google_docs' | 'google_sheets';
  onProgress?: (event: { type: string; [key: string]: unknown }) => void;
};
```

---

## ⚠️ O que VOCÊ precisa fazer fora do código

> **Setup ÚNICO do time, não dos usuários.** Igual ao Claude: a Anthropic criou um app "Claude" no Slack uma vez e habilitou distribuição pública; cada usuário final só clica em "Conectar Slack" e autoriza via OAuth — nunca abre o painel do Slack. Aqui o app "Flowme / Balys" é criado por vocês **uma única vez** (~30 min). Cada usuário do Flowme depois tem exatamente a mesma UX do Claude: botão de conectar → tela de consentimento do Slack → pronto.
>
> **Alternativa: broker de OAuth (Composio/Nango/Pipedream)** — pula esse setup mas adiciona vendor pago no stack, o consentimento do usuário aparece com o nome do broker em vez de "Flowme", e dados do Slack passam por terceiro (LGPD). Não recomendado para vocês.

Estas etapas **dependem de você** (não dá pra fazer só no repositório):

### 1. Criar o app no Slack
- Acesse **https://api.slack.com/apps → Create New App → From scratch**.
- Nome (ex.: "Flowme / Balys"), workspace de desenvolvimento.

### 2. Configurar OAuth & Permissions
- **Redirect URLs** (Slack exige **HTTPS**, exceto que **não aceita `http://localhost`**):
  - Produção: `https://app.flow-me.online/api/auth/slack/callback`
  - Dev: use um túnel HTTPS (ngrok/cloudflared) → `https://<seu-tunnel>/api/auth/slack/callback`
    > **Importante:** sem HTTPS o OAuth do Slack não funciona localmente. Já que vocês usam Traefik, dá pra expor um subdomínio de staging com TLS, ou usar ngrok no dev.
- **User Token Scopes** (vamos usar token de usuário `xoxp` para agir como o usuário):
  - Leitura: `channels:history`, `groups:history`, `im:history`, `mpim:history`, `channels:read`, `groups:read`, `im:read`, `mpim:read`, `users:read` (NOTE: `search:read` é proibido para apps do Slack Marketplace — usamos read-de-canal/thread em vez de busca global)
  - Escrita: `chat:write`
- (Opcional) **Bot Token Scopes** se quiser que o Balys poste **como bot** em vez de como o usuário: `chat:write`, `channels:read`, `users:read`. Decidir na Fase 5.

### 3. Habilitar distribuição pública
- **Settings → Manage Distribution → Activate Public Distribution.**
- Sem isso, só o seu workspace consegue instalar. Como cada usuário conecta o próprio Slack, **é obrigatório**.
- Listar no **Slack Marketplace** é **opcional** (e tem revisão da Slack). Distribuição pública sozinha já permite que qualquer workspace instale via seu link OAuth.

### 4. Pegar credenciais e me passar (em segredo, via secret manager — **não** colar no chat/PR)
- **Client ID**, **Client Secret**, **Signing Secret** (este último só se formos usar eventos/webhooks no futuro).

### 5. Definir variáveis de ambiente (`.env.local` / secrets do deploy)
```
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
SLACK_REDIRECT_URI=https://app.flow-me.online/api/auth/slack/callback
# Opcional, só se ativarmos token rotation:
# SLACK_TOKEN_ROTATION=true
```

### 6. (Decisão de produto sua) Token rotation
- Por padrão, tokens do Slack **não expiram**. Se ativar **token rotation** no app, access tokens expiram em 12h e usamos refresh tokens (mais seguro, mais código). Recomendo **começar sem rotation** e ativar depois. Validar com segurança/LGPD.

---

## Arquitetura proposta (espelha Gmail/Drive)

```
Usuário → /app/connectors → "Adicionar Slack"
   → POST /api/connectors (type='slack')
   → /api/auth/slack/connect?connector_id=... (gera state, redireciona pro Slack)
   → Slack consent → /api/auth/slack/callback
        → troca code por token (oauth.v2.access)
        → grava user_slack_tokens + linked_accounts.is_active
        → connectors.config.linked_account_id = <id>
   → volta pra /app/connectors?connector_connected=...

Balys (chat) → tool slack.* → getSlackAccountId(ctx) → token válido
   → @slack/web-api (search/conversations/chat) → ToolResult
```

---

## Plano de implementação (sequencial, com TDD + e2e)

> Regra do repositório: **toda fase tem teste** (`npm test` verde) e, ao final, **validação e2e local** simulando um usuário real antes de considerar pronta.

### Fase 0 — Setup externo (você) + dependência
- [ ] Concluir a seção "O que você precisa fazer fora" (app Slack, scopes, distribuição, env).
- [ ] `npm i @slack/web-api`.
- [ ] Documentar as envs em `.env.local.example`.

### Fase 1 — Schema
- [ ] Migration `038_slack_connector.sql`:
  - `ALTER TYPE public.connector_type ADD VALUE IF NOT EXISTS 'slack';`
  - Tabela `user_slack_tokens` (espelha `user_google_tokens`):
    ```sql
    CREATE TABLE public.user_slack_tokens (
      linked_account_id UUID PRIMARY KEY REFERENCES public.linked_accounts(id) ON DELETE CASCADE,
      access_token   TEXT NOT NULL,        -- xoxp do usuário
      refresh_token  TEXT,                 -- só se token rotation ligado
      expiry         TIMESTAMPTZ,          -- null = não expira
      slack_team_id  TEXT,
      slack_team_name TEXT,
      slack_user_id  TEXT,
      scopes         TEXT,
      created_at     TIMESTAMPTZ DEFAULT now(),
      updated_at     TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE public.user_slack_tokens ENABLE ROW LEVEL SECURITY;
    -- policies espelhando user_google_tokens (acesso via linked_accounts do dono)
    NOTIFY pgrst, 'reload schema';
    ```
  > Confirmar no repo como `user_google_tokens` guarda os tokens (texto puro x cripto) e **seguir o mesmo padrão** — não introduzir storage menos seguro.

### Fase 2 — Client Slack (`lib/slack/slack-client.ts`)
- [ ] Wrapper sobre `@slack/web-api` no estilo do `evolution-client.ts`:
  - `getSlackClient(token): WebClient`
  - `searchMessages(client, query, count)` → `client.search.messages`
  - `listConversations(client, types)` → `client.conversations.list`
  - `readThread(client, channel, ts)` → `client.conversations.replies`
  - `readHistory(client, channel, limit)` → `client.conversations.history`
  - `getUserInfo(client, userId)` → `client.users.info`
  - `postMessage(client, channel, text, thread_ts?)` → `client.chat.postMessage`
  - Normalizar saída (autor, texto, ts, canal, permalink) e tratar erros (`!result.ok`).
- [ ] Teste `__tests__/lib/slack-client.test.ts` (mock do `WebClient`).

### Fase 3 — OAuth (connect + callback)
- [ ] `app/api/auth/slack/connect/route.ts`: monta `https://slack.com/oauth/v2/authorize` com `client_id`, `user_scope` (lista da Fase 0), `redirect_uri`, `state` (base64 JSON `{user_id, linked_account_id, connector_id, return_to}` — espelhar o state do Google).
- [ ] `app/api/auth/slack/callback/route.ts`: valida `state`, troca `code` em `https://slack.com/api/oauth.v2.access`, lê `authed_user.access_token` (xoxp), `team.id/name`, `authed_user.id`, grava `user_slack_tokens`, ativa `linked_accounts`, seta `connectors.config.linked_account_id`, redireciona.
- [ ] Reusar a infra de `linked_accounts` que o `/api/connectors/[id]/connect` já usa (criar o connect/disconnect específico de Slack análogos aos do Google).
- [ ] Testes `__tests__/api/auth-slack.test.ts` (state inválido → erro; troca ok → persiste; erro do Slack → mensagem).

### Fase 4 — Token helper (`lib/slack/slack-auth.ts`)
- [ ] `getValidSlackToken(linkedAccountId, { supabase, user })` espelhando `getValidGoogleToken`:
  - lê `user_slack_tokens`; se `expiry` e perto de expirar **e** houver `refresh_token`, faz refresh (`oauth.v2.access` com `grant_type=refresh_token`) e regrava.
  - se não há `expiry` (rotation off), retorna o token direto.
- [ ] Teste `__tests__/lib/slack-auth.test.ts` (sem expiry; expirado+refresh; sem refresh → erro claro).

### Fase 5 — Tools do Balys (`lib/ai/tools/slack-tools.ts`)
Helpers: `getSlackAccountId(ctx)` (connector `type='slack'` ativo → `config.linked_account_id`; fallback `linked_accounts` provider `slack`) e `getConnectedSlackClient(linkedAccountId, ctx)`.

Tools (prefixo `slack.`):
- [ ] `slack.list_channels` (read) — lista canais/DMs acessíveis.
- [ ] `slack.read_channel` (read) — histórico recente de um canal.
- [ ] `slack.read_thread` (read) — respostas de uma thread.
- [ ] `slack.get_user` (read) — dados de um usuário (nome, fuso).
- [ ] `slack.send_message` (**write**, `isReadOnly:false`) — posta em canal/DM ou responde thread.
  - **Escrita com confirmação:** seguir o padrão do Balys para ações de risco (o `shadow-router` já pontua `risk`; ações de escrita devem exigir confirmação explícita antes de enviar — replicar o que `goals.delete_plan` faz).
- [ ] Cada tool: erro amigável se Slack não conectado ("Conecte o Slack em Conexões").
- [ ] Teste `__tests__/lib/slack-tools.test.ts` (client mockado: happy path de cada tool, sem connector → erro, write exige confirmação).

### Fase 6 — Registro
- [ ] Em `lib/ai/tools/registry.ts`: importar as tools, adicionar ao `ALL_TOOLS`, e `slack: 'slack.'` em `TOOL_DOMAIN_PREFIXES`.
- [ ] Atualizar a descrição/uso do Balys (BALYS.md / system prompt) listando as capacidades de Slack e a regra de confirmação para escrita.

### Fase 7 — UI de Conexões
- [ ] `app/app/connectors/page.tsx`: adicionar `'slack'` ao union `ConnectorType`, ícone/cor/label (PT/EN) e o item no dropdown de "Adicionar".
- [ ] `lib/google/linked-account-kind.ts` (ou equivalente): incluir `slack` nos padrões de nome/identificação de linked account.

### Fase 8 — Tipos compartilhados e i18n
- [ ] Atualizar `preferredConnectorType` em `ToolContext` se fizer sentido incluir `'slack'`.
- [ ] Strings PT/EN da UI de conexão do Slack.

### Fase 9 — Testes + e2e
- [ ] `npm test` verde (unit de client, auth, tools).
- [ ] **e2e (obrigatório antes de marcar pronto):** subir o app local, conectar um Slack de teste via OAuth (com túnel HTTPS), e validar no chat do Balys:
  - "lista meus canais" → retorna canais/DMs acessíveis
  - "resume as últimas 20 mensagens do canal #geral" → lê histórico e resume
  - "resume a thread tal" → lê e resume
  - "manda no canal #geral: ..." → **pede confirmação** e só então posta
- [ ] Monitorar logs (erros de scope/rate limit) durante o e2e.

---

## Scopes — resumo rápido

| Capacidade | Scope (user token `xoxp`) | Observação |
|---|---|---|
| ~~Buscar mensagens~~ | `search:read` | ❌ **NÃO usar** — banido para apps do Marketplace. Substituído por `read_channel` + `read_thread` quando o usuário sabe onde olhar. |
| Ler histórico | `channels:history`, `groups:history`, `im:history`, `mpim:history` | Por tipo de conversa. |
| Listar conversas | `channels:read`, `groups:read`, `im:read`, `mpim:read` | |
| Dados de usuário | `users:read` | |
| Postar/responder | `chat:write` | Posta **como o usuário** (user token). Para postar **como bot**, usar bot token + bot no canal. |

> Decisão de produto: postar **como o usuário** (user token) é o mais natural pra um assistente pessoal. Se preferirem um "Balys bot" visível, trocamos para bot token na Fase 5 (muda scopes e UX).

---

## Arquivos

**Criar**
| Arquivo | Função |
|---|---|
| `supabase/migrations/038_slack_connector.sql` | ENUM `slack` + tabela `user_slack_tokens` |
| `lib/slack/slack-client.ts` | Wrapper `@slack/web-api` |
| `lib/slack/slack-auth.ts` | `getValidSlackToken` (+ refresh) |
| `app/api/auth/slack/connect/route.ts` | Início do OAuth |
| `app/api/auth/slack/callback/route.ts` | Callback do OAuth |
| `lib/ai/tools/slack-tools.ts` | Tools do Balys |
| `__tests__/lib/slack-client.test.ts` | |
| `__tests__/lib/slack-auth.test.ts` | |
| `__tests__/lib/slack-tools.test.ts` | |
| `__tests__/api/auth-slack.test.ts` | |

**Modificar**
| Arquivo | Mudança |
|---|---|
| `lib/ai/tools/registry.ts` | Registrar tools + prefixo `slack.` |
| `app/app/connectors/page.tsx` | Tipo, ícone, label, dropdown |
| `lib/google/linked-account-kind.ts` | Reconhecer `slack` |
| `app/api/connectors/route.ts` | `VALID_TYPES` incluir `'slack'` |
| `.env.local.example` | Vars do Slack |
| `package.json` | `@slack/web-api` |
| BALYS.md / system prompt | Capacidades + regra de confirmação na escrita |

---

## Segurança / LGPD / limites

- **Tokens são secrets** — armazenar como o repo já faz para `user_google_tokens` (mesmo nível de proteção/RLS). Nunca logar token nem colar em PR/chat.
- **Dados pessoais** — mensagens do Slack contêm dados de terceiros. Tratar como sensível (LGPD): não persistir conteúdo além do necessário, não usar em exemplos com dados reais.
- **Rate limits** — `search.messages` tem limite mais agressivo; `conversations.history` é paginado. Implementar tratamento de `429`/`Retry-After` no client.
- **Escrita** — sempre confirmar antes de postar (evita o Balys mandar mensagem indevida em canal errado).
- **Revogação** — no disconnect, chamar `auth.revoke` e apagar `user_slack_tokens`.

---

## Checklist "pronto pra mergear"
- [ ] App Slack criado, distribuição pública ON, scopes corretos, redirect HTTPS válido.
- [ ] Envs configuradas (dev + prod).
- [ ] Migration aplicada no Supabase.
- [ ] `npm test` verde (client, auth, tools, rota OAuth).
- [ ] e2e: conectar Slack real + listar canais + ler thread + postar (com confirmação) funcionando.
- [ ] Logs monitorados sem erro de scope/rate limit.
- [ ] BALYS.md atualizado.

---

## Estimativa (referência)
- Fase 0 (você, externo): ~30–60 min no painel do Slack + túnel HTTPS no dev.
- Fases 1–6 (core): ~1–1,5 dia.
- Fases 7–9 (UI + testes + e2e): ~0,5–1 dia.
