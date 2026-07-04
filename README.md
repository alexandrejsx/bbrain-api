# BBrain API

Backend principal do BBrain, uma plataforma de acompanhamento psicológico digital com IA,
diário, humor, sono, rotina, memória longitudinal e fluxos sensíveis de produto.

O estado atual do projeto combina NestJS, TypeScript, MongoDB e DDD pragmático. A API concentra
os fluxos implementados de autenticação, perfil reflexivo, chat com IA, uso diário e billing.

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
    __tests__/
  use-cases/
    auth/
    billing/
    conversation/
    plans/
    profile/
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

O fluxo real de chat entra por `ChatController`, chama `SendChatMessageUseCase`, monta um contexto
canônico por `ConversationAgentContextBuilderService`, renderiza prompts em `infrastructure/chat`,
chama uma implementação do port `ChatAgent` e persiste perfil reflexivo, histórico de mensagens e
uso de LLM.

O provider de chat é selecionado em composition por `AI_CHAT_PROVIDER`, com `gemini` como padrão e
opções `openai` e `mock`. Schemas e parsing técnico de resposta ficam em infraestrutura.

Não há worker de agent, tool calling, RAG, loops ou harnesses implementados neste momento.

## MongoDB

O módulo `MongodbModule` configura a conexão MongoDB via `@nestjs/mongoose` e registra a base de
persistência inicial.

A implementação genérica `MongodbRepository` centraliza operações comuns de persistência. Schemas,
mappers e repositórios concretos ficam dentro de `src/infrastructure/database/mongodb`.

## Eventos

Eventos de domínio existem nos aggregates que já modelam fatos relevantes. O adapter
`EventDispatcherAdapter` publica eventos via `@nestjs/event-emitter`. No fluxo atual, autenticação
e chat publicam eventos; não há handlers registrados.

## Configuração

As configurações ficam em `src/config.ts` e são carregadas pelo `ConfigModule`.

O `ConfigModule` está com `ignoreEnvFile: true`; localmente, o script `start:local` carrega as
variáveis usando `env-cmd`.

Use `.env.example` como referência das variáveis necessárias para ambiente local.

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
# Stripe webhook

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
