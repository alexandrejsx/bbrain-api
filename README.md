# BBrain API

API NestJS do BBrain para autenticação, perfil, conversa, memória, histórico de Humor/Sono, planos e billing. MongoDB é a persistência. A arquitetura detalhada está em [`../docs/ai-architecture/README.md`](../docs/ai-architecture/README.md).

## Fluxo principal

```text
mensagem → ContextBuilder → ConversationAgent → safety → resposta
                                              ↘ processamento pós-conversa
                                                Current Context / Memory / Pattern

Daily Check-in → DailyCheckInAgent (FAST, somente Humor) → formulário estruturado de Sono → validação → Mood / Sleep
```

## Seeds de desenvolvimento

As seeds usam os últimos 30 dias do usuário indicado por `SEED_USER_ID` ou `SEED_USER_EMAIL`:

```bash
pnpm seeds:local mood
pnpm seeds:local sleep
```

Em produção, use `pnpm seeds:prod mood|sleep` com a configuração de ambiente já carregada e a confirmação explícita `SEED_PRODUCTION_CONFIRM=seed-bbrain-production`. A CLI rejeita URI remota no comando local, URI local no comando de produção e nomes de seed desconhecidos.

Quando autorizado, a continuidade imediata usa seis mensagens recentes por padrão (máximo configurável de oito) com TTL. Isso não é histórico permanente: informação antiga útil é consolidada e o conteúdo literal expira. O processamento posterior é local, assíncrono, idempotente e nunca bloqueia a resposta.

## IA

`AI_PROVIDER=openai|gemini` seleciona um dos dois providers. Modelos são configurados por papel:

```env
AI_PROVIDER=gemini
AI_EXTRACTION_MIN_CONFIDENCE=0.85
AI_MAX_RETRIES=1

OPENAI_MODEL_FAST=gpt-5.4-nano
OPENAI_MODEL_CONVERSATION=gpt-5.4-mini
OPENAI_MODEL_REASONING=gpt-5.4

GEMINI_MODEL_FAST=gemini-3.5-flash
GEMINI_MODEL_CONVERSATION=gemini-3.5-flash
GEMINI_MODEL_REASONING=gemini-3.1-pro-preview
```

Use `.env.example` para a configuração completa. O provider ativo precisa de sua respectiva API key. Nomes de modelos não aparecem nos agentes, extractors ou regras de negócio.

O Daily Check-in possui endpoints próprios em `/daily-check-in`, draft estruturado por usuário/data, Humor em texto livre e Sono enviado por `POST /daily-check-in/sleep`. O adiamento diário é persistido e o trial de sete dias é validado no backend. Ele não passa pelo fluxo de mensagens nem incrementa a quota do chat. Registros manuais em `/wellbeing-history/observations` continuam independentes de plano.

## Desenvolvimento

```bash
pnpm install
pnpm docker:up
pnpm start:dev
```

Validação:

```bash
pnpm lint
pnpm build
pnpm test --runInBand
```

Logs de IA contêm somente operação, provider, modelo/papel, duração, tokens, tentativa, sucesso e correlation id. Mensagens, respostas, prompts completos e dados emocionais não são logados.
