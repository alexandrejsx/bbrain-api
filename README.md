# BBrain API

Backend principal do BBrain, uma plataforma de acompanhamento psicológico digital com IA,
diário, humor, sono, rotina, memória longitudinal e agentes internos.

Esta base inicial prepara o projeto para crescer com NestJS, TypeScript, MongoDB e DDD
pragmático, sem implementar regras de negócio complexas ou endpoints completos de produto.

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
Entidades, objetos de valor, eventos e contratos de repositório vivem em `src/domain`.

Integrações externas, persistência, clients HTTP, schemas e mappers vivem em
`src/infrastructure`.

Módulos NestJS ficam em `src/modules` e fazem a composição entre infraestrutura,
providers e dependências da aplicação.

## Estrutura de Pastas

```txt
src/
  domain/
    core/
    entities/
    value-objects/
    services/
    repositories/
    events/
    __tests__/
  use-cases/
  infrastructure/
    database/
      mongodb/
        schemas/
        repositories/
        mappers/
    http/
      clients/
      dtos/
      mappers/
      exceptions/
      guards/
  controllers/
    dtos/
  event-handlers/
  modules/
  cli/
    commands/
    utils/
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

## Agentes Internos

Todos os agentes ficam dentro do backend NestJS nesta fase inicial.

O módulo `AgentsModule` existe como ponto inicial de composição, mas ainda não implementa
integração real com OpenAI, memória, ferramentas ou fluxos clínicos. Futuras regras devem seguir
`BUSINESS_RULES.md`.

## MongoDB

O módulo `MongodbModule` configura a conexão MongoDB via `@nestjs/mongoose` e registra a base de
persistência inicial.

A implementação genérica `MongodbRepository` centraliza operações comuns de persistência. Schemas,
mappers e repositórios concretos ficam dentro de `src/infrastructure/database/mongodb`.

## Configuração

As configurações ficam em `src/config.ts` e são carregadas pelo `ConfigModule`.

O `ConfigModule` está com `ignoreEnvFile: true`; localmente, o script `start:local` carrega as
variáveis usando `env-cmd`.

Use `.env.example` como referência das variáveis necessárias para ambiente local.

## Rodando Localmente

Instale as dependências:

```bash
yarn install
```

Suba o MongoDB local em Docker:

```bash
yarn docker:mongo:up
```

O `.env` local deve apontar para o Mongo publicado na máquina:

```env
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE_NAME=bbrain
```

Compile o projeto:

```bash
yarn build
```

Suba em modo local:

```bash
yarn start:local
```

## Scripts

- `yarn build`: compila a aplicação NestJS.
- `yarn start`: inicia a aplicação.
- `yarn start:dev`: inicia com watch mode.
- `yarn start:prod`: executa o build gerado em `dist/main`.
- `yarn start:local`: limpa `dist`, carrega `.env`, compila e sobe em watch mode.
- `yarn docker:mongo:up`: sobe o MongoDB local em Docker.
- `yarn docker:mongo:down`: para os containers locais do compose.
- `yarn docker:mongo:logs`: acompanha os logs do MongoDB local.
- `yarn format`: aplica Prettier nos arquivos TypeScript e Markdown.
