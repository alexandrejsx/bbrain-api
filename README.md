# BBrain API

API NestJS do BBrain para autenticação, perfil, conversa, memória, histórico de Humor/Sono, planos e billing. MongoDB é a persistência. A arquitetura detalhada está em [`../docs/ai-architecture/README.md`](../docs/ai-architecture/README.md).

## Fluxo principal

```text
mensagem → ContextBuilder → ConversationAgent → safety → resposta
                                              ↘ processamento pós-conversa
                                                Current Context / Memory / Pattern / Mood / Sleep
```

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
