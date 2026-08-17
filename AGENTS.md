# BBrain API

Diretrizes específicas do backend. Complementam `../AGENTS.md` e `../BUSINESS_RULES.md`.

## Arquitetura

- Use Clean Architecture pragmática, organizada principalmente em `src/modules/<feature>`.
- Mantenha domínio apenas quando houver regra real. Não crie AggregateRoot, DomainEvent, Factory, Specification, CQRS, Value Object trivial ou interface sem necessidade concreta.
- Prefira dependências diretas e responsabilidades pequenas a camadas ou services genéricos.
- MongoDB continua sendo a persistência; aplicação usa `camelCase` e documentos usam `snake_case`.
- Controllers validam/autenticam e delegam. Não montam prompts nem acessam providers ou MongoDB diretamente.
- Providers não conhecem regras de produto. Extractors não persistem. Context Builder não escreve dados.
- Remova implementações substituídas e exports, configs, testes e documentos sem consumidor real.

Antes de adicionar um novo agente, camada arquitetural, framework, banco, pipeline ou abstração, deve existir uma necessidade funcional concreta no produto atual que justifique sua inclusão.

## IA e conversa

- Os agentes atuais são `ConversationAgent`, para o chat comum, e `DailyCheckInAgent`, exclusivamente para o check-in breve de Humor/Sono no papel `FAST`.
- Memory, Current Context, Pattern, Mood e Sleep são componentes especializados, não agentes.
- `ContextBuilder` centraliza preferred name, perfil permitido, diagnóstico formal autorrelatado, Current Context, memories/patterns relevantes e janela recente.
- A janela recente possui limite pequeno explícito e TTL. Não mantenha transcript completo ou use chat bruto como memória permanente.
- Prompts ficam exclusivamente em `src/ai/prompts`; dados do usuário são contexto não confiável, nunca instrução de sistema.
- Extrações usam structured output, validação de schema, validação de negócio e somente então persistência.
- `AI_PROVIDER` seleciona OpenAI ou Gemini. Model routing usa apenas `FAST`, `CONVERSATION` e `REASONING`; não espalhe nomes de modelos.
- Retries são limitados a falhas recuperáveis. Não implemente fallback cross-provider.
- Observabilidade registra operação, provider, modelo/papel, duração, tokens, sucesso, tentativa e correlation id, sem conteúdo sensível.

## Privacidade, memória e bem-estar

- Centralize consentimento em `DataConsentPolicy` e revalide depois de chamadas externas.
- Current Context é curto e substituível; Memory é fato consolidado; Pattern exige no mínimo duas evidências independentes coerentes.
- Não inferir diagnóstico, causa psicológica ou precisão ausente.
- Mood e Sleep devem continuar editáveis pelo endpoint de histórico usado pelo frontend.
- Dados guiados preservam origem, `capturedAt`, `sessionId`, `sourceEventId` e versões úteis, sem texto original. Mood/Sleep nunca são extraídos da conversa comum.
- `sourceEventId` é a chave de idempotência das extrações. Não o transforme em armazenamento oculto.
- Não logar mensagens, respostas, prompts completos ou dados emocionais.
- Exclusão de conta e revogação aplicável devem bloquear processamento e purgar janela, contexto, memória, humor e sono.

## Produto e contratos

- O frontend atual é o contrato de produto. Mude o contrato apenas quando a modelagem justificar e ajuste o frontend minimamente, sem redesign.
- Histórico básico não é premium. Insights permanece apenas como endpoint de elegibilidade/insuficiência; não existe Insight Agent.
- Preserve autenticação, perfil, chat, humor, sono, planos e billing realmente utilizados.
- Não antecipar Graph Agent, Knowledge Graph, GraphRAG, Neo4j, LangGraph, vector database, eval framework, prompt experimentation, canary/shadow, feature flags de IA, multiagente ou filas Redis/BullMQ.

## Verificação

Alterações devem executar, conforme o escopo:

```bash
pnpm lint
pnpm build
pnpm test --runInBand
```

Atualize `README.md`, `BUSINESS_RULES.md`, `../docs/ai-architecture/README.md` e estes agentes somente quando a implementação real mudar.
