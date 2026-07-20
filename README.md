# BBrain API

Backend principal do BBrain, plataforma de autoconhecimento e acompanhamento emocional assistida por IA. A API concentra regras sensíveis, autorização, persistência, providers e processamento de dados pessoais; não se posiciona como serviço clínico.

O estado atual do projeto combina NestJS, TypeScript, MongoDB e DDD pragmático. A API concentra
os fluxos implementados de autenticação, perfil reflexivo, chat com IA, uso diário, billing, histórico estruturado de bem-estar e entitlement de Insights.

## Stack

- NestJS
- TypeScript
- MongoDB
- Mongoose
- @nestjs/config
- @nestjs/event-emitter
- class-validator
- class-transformer
- lodash

## Arquitetura

O projeto separa domínio, casos de uso, infraestrutura, controllers e módulos.

O domínio não depende de NestJS, Mongoose, OpenAI ou qualquer detalhe de infraestrutura.
Entidades, objetos de valor, eventos e contratos de repositório vivem em contextos dentro de
`src/domain`.

Integrações externas, persistência, clients HTTP, schemas e mappers vivem em
`src/infrastructure`.

Módulos NestJS ficam em `src/modules` e fazem a composição entre infraestrutura,
providers e dependências da aplicação.

## Estrutura de Pastas

```txt
src/
  domain/
    core/
    billing/
    check-in/
    conversation/
    journal/
    memory/
    pattern-analysis/
    plans/
    risk-assessment/
    shared/
    summary/
    support-plan/
    usage/
    users/
    wellbeing-history/
    __tests__/
  use-cases/
    auth/
    billing/
    conversation/
    insights/
    plans/
    profile/
    wellbeing-history/
  infrastructure/
    chat/
    database/
      mongodb/
        schemas/
        repositories/
        mappers/
    events/
    gemini/
    http/
      guards/
    mock/
    openai/
    wellbeing-history/
    payments/
  controllers/
    dtos/
  modules/
  shared/
    services/
```

## DDD Pragmático

A base usa DDD de forma pragmática:

- `Entity` identifica objetos com identidade.
- `AggregateRoot` concentra eventos de domínio.
- `ValueObject` compara valores por igualdade estrutural.
- `DomainEvent` representa fatos relevantes do domínio.
- Repositórios de domínio expõem contratos sem acoplar o domínio ao MongoDB.

## Chat e IA

O fluxo de chat entra por `ChatController`, chama `SendChatMessageUseCase`, monta contexto canônico por `ConversationAgentContextBuilderService`, renderiza prompts em `infrastructure/chat`, chama uma implementação do port `ChatAgent` e contabiliza uso. O caminho ativo não lê nem grava `conversation_messages`.

Continuidade usa `ConversationState`, um snapshot estruturado em `conversation_states` com tópico atual, preocupações/necessidades curtas, disponibilidade de apoio, segurança, intenção da última resposta e código da pergunta pendente. A policy rejeita rótulos clínicos e trechos copiados. O estado só é lido/escrito com personalização, memória e armazenamento sensível permitidos; revogação apaga o estado da conversa. O TTL padrão é 24 horas.

`clientMessageId` é um UUID estável e cria uma claim em `conversation_exchange_ledgers`. O ledger armazena HMAC da requisição, status, risco/escopo, uso e timestamps com TTL; não armazena a mensagem nem a resposta. Reuso com outro conteúdo retorna `CLIENT_MESSAGE_ID_REUSED`; execução concorrente retorna `MESSAGE_PROCESSING`; replay concluído retorna `MESSAGE_ALREADY_PROCESSED`, pois não existe resposta durável para reproduzir. Uma lease vencida pode ser reivindicada.

O contrato do modelo propõe `conversationStateUpdate`, nunca `profileUpdate`. Parser, `ConversationStateUpdatePolicy` e domínio decidem qualquer write. `ConversationSafetyReplyPolicy` substitui respostas que confirmem autorrotulação de mania, inventem energia/necessidade de sono ou reforcem exclusividade; no fluxo “só você” com impulsividade/apoio ausente, delimita o BBrain e pergunta diretamente sobre risco imediato.

O provider de chat é selecionado em composition por `AI_CHAT_PROVIDER`, com `gemini` como padrão e opções `openai` e `mock`. Schemas, prompts e parsing técnico ficam em infraestrutura.

### Extração pós-resposta de Humor e Sono

`WellbeingObservationCaptureScheduler` executa fora do retorno HTTP. O fluxo usa port de extração estruturada, adapters OpenAI/Gemini/noop, router primary/fallback, prompt/schema/parser versionados, policy de domínio e repository Mongo.

```text
mensagem atual do usuário (somente em memória)
  → contexto estruturado com TTL, se consentido
  → claim HMAC sem conteúdo
  → resposta de chat
  → captura estruturada pós-resposta
  → parser + validação de domínio
  → shadow ou persistência idempotente
  → revisão/invalidação/projeção de Humor
```

`AI_OBSERVATION_EXTRACTION_ENABLED=true` habilita execução shadow. Writes exigem também `AI_OBSERVATION_EXTRACTION_PERSIST_ENABLED=true`; ambas as flags são `false` por padrão. Não habilite persistência sem evals reais, integração Mongo, revisão de privacidade e rollback.

Outputs de IA são não confiáveis. Somente relato direto do usuário pode originar observação; dados de terceiro, negação, desejo, hipótese e ficção são rejeitados. Números de Humor/Sono exigem evidência literal contextual. A citação existe apenas durante a validação da mensagem atual: `wellbeing_observations` persiste `evidence_fingerprint` por HMAC, não `evidence_quote`, e a API pública não expõe o fingerprint.

Não há worker durável, outbox, RAG, tool calling, loops agentic ou pipeline real de Insights neste momento.

### Histórico de bem-estar e Insights

`wellbeing_observations` é uma coleção aditiva com `mood_event`, `mood_daily_summary` e `sleep_record`. O aggregate preserva proveniência, revisões e concorrência otimista. O resumo de Humor é derivado, revisável e não transforma ausência em neutralidade.

Endpoints autenticados:

```text
GET    /wellbeing-history/observations
POST   /wellbeing-history/observations
PATCH  /wellbeing-history/observations/:observationId
DELETE /wellbeing-history/observations/:observationId?expectedRevision=N
GET    /insights
```

Histórico básico não é premium. `GET /insights` exige plano Pro efetivo e, enquanto não há geração longitudinal, retorna `insufficient_data` sem inventar conteúdo.

## MongoDB

O módulo `MongodbModule` configura a conexão MongoDB via `@nestjs/mongoose` e registra a base de
persistência inicial.

A implementação genérica `MongodbRepository` centraliza operações comuns de persistência. Schemas,
mappers e repositórios concretos ficam dentro de `src/infrastructure/database/mongodb`.

## Eventos

Eventos de domínio existem nos aggregates que modelam fatos relevantes. O adapter `EventDispatcherAdapter` publica eventos via `@nestjs/event-emitter`. Alterações em observações podem invalidar/reconstruir projeções no mesmo processo; não há outbox, fila durável ou reconciliação distribuída.

## Configuração

As configurações ficam em `src/config.ts` e são carregadas pelo `ConfigModule`.

O `ConfigModule` está com `ignoreEnvFile: true`; localmente, o script `start:local` carrega as
variáveis usando `env-cmd`.

Use `.env.example` como referência das variáveis necessárias para ambiente local.

As flags de extração são independentes:

```env
AI_OBSERVATION_EXTRACTION_ENABLED=false
AI_OBSERVATION_EXTRACTION_PERSIST_ENABLED=false
```

Com a primeira flag em `true` e a segunda em `false`, o extractor opera em shadow e não grava observações.

Configuração de retenção e fingerprint:

```env
CONVERSATION_FINGERPRINT_SECRET=replace-with-an-independent-random-secret
CONVERSATION_STATE_TTL_HOURS=24
CONVERSATION_EXCHANGE_LEDGER_TTL_HOURS=24
CONVERSATION_EXCHANGE_PROCESSING_LEASE_SECONDS=120
```

Em produção e staging, `CONVERSATION_FINGERPRINT_SECRET` é obrigatório no startup. Deve ser aleatório, independente do JWT e rotacionado por procedimento próprio; somente local/test possui fallback isolado.

## Rodando Localmente

Instale as dependências:

```bash
pnpm install
```

Suba o MongoDB local em Docker:

```bash
pnpm docker:up
```

O `.env` local deve apontar para o Mongo publicado na máquina:

```env
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE_NAME=bbrain
```

Compile o projeto:

```bash
pnpm build
```

Suba em modo local:

```bash
pnpm start:local
```

## Scripts

- `pnpm build`: compila a aplicação NestJS.
- Não há script separado de typecheck; `pnpm build` é a validação TypeScript disponível.
- `pnpm start`: inicia a aplicação.
- `pnpm start:dev`: inicia com watch mode.
- `pnpm start:prod`: executa o build gerado em `dist/main`.
- `pnpm start:local`: limpa `dist`, carrega `.env`, compila e sobe em watch mode.
- `pnpm docker:up`: sobe o MongoDB local em Docker.
- `pnpm docker:down`: para os containers locais do compose.
- `pnpm docker:logs`: acompanha os logs do MongoDB local.
- `pnpm format`: aplica Prettier nos arquivos TypeScript e Markdown.
- `pnpm test --runInBand`: executa a suíte Jest de forma serial.
- `pnpm run lint`: executa ESLint.
- `pnpm exec tsc --noEmit --pretty false`: typecheck explícito.

### Dados legados do ambiente pré-MVP

Não há script de migração para as transcrições literais existentes. A decisão operacional para este ambiente pré-MVP é recriar o banco antes do próximo uso. O schema e o repository de `conversation_messages` foram removidos; a API não executa exclusão global automaticamente.

## Stripe webhook

Em producao, crie um webhook da Stripe apontando para `https://api.bbrain.com/webhooks/stripe`.

Use `Snapshot events`, selecione apenas estes 6 eventos:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Coloque o signing secret em `STRIPE_WEBHOOK_SECRET`.

Nao use `thin events` nem a opcao de eventos minimos neste momento.
