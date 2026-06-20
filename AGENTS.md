# AGENTS.md

# BBrain API

Backend principal do ecossistema BBrain.

Responsável por autenticação, regras de negócio, persistência de dados, integrações externas e recursos de inteligência artificial.

Também devem ser respeitadas as diretrizes globais definidas no AGENTS.md da raiz do projeto.

---

# Objetivo

A API deve centralizar toda a lógica de negócio do BBrain.

O frontend deve atuar principalmente como camada de apresentação.

Regras críticas, autenticação, persistência e integrações devem permanecer na API.

---

# Stack

Tecnologias principais:

- Node.js
- TypeScript
- NestJS
- MongoDB

Novas dependências devem ser adicionadas apenas quando houver benefício claro.

---

# Arquitetura

A aplicação deve seguir princípios inspirados em:

- Domain-Driven Design
- Clean Architecture
- Clean Code
- Modularização por domínio
- Separação de responsabilidades

O código deve possuir fronteiras claras entre:

- Domínio
- Aplicação
- Infraestrutura
- Interfaces externas

Detalhes técnicos não devem contaminar as regras de negócio.

---

# Organização

O sistema deve ser organizado por módulos de domínio.

Cada módulo deve possuir responsabilidade clara e baixo acoplamento.

Evitar estruturas genéricas onde funcionalidades sem relação ficam agrupadas apenas por tipo de arquivo.

## Estrutura do domínio

O diretório `src/domain` deve ser organizado por contexto de domínio, e não por tipo técnico global.

Estrutura adotada:

```txt
src/domain/
  core/
  shared/
  <contexto>/
    entities/
    events/
    repositories/
    services/
    value-objects/
```

Cada contexto, como `users`, `conversation`, `journal` ou `memory`, deve manter suas entidades, eventos, contratos de repositório, serviços e value objects dentro da própria pasta.

As subpastas devem ser criadas apenas quando o contexto possuir elementos daquela categoria.

`domain/core` deve conter somente abstrações fundamentais do domínio, como `Entity`, `AggregateRoot`, `ValueObject` e contratos de eventos.

`domain/shared` deve conter apenas elementos de domínio realmente compartilhados entre múltiplos contextos. Atualmente, o `Uuid` pertence a essa pasta.

Não criar novamente pastas globais como `domain/entities`, `domain/repositories` ou `domain/value-objects` para elementos específicos de um contexto.

---

# Regras de negócio

Regras de negócio devem ficar fora de controllers, guards e repositórios.

Controllers devem apenas receber requisições e delegar processamento.

A lógica principal deve permanecer em serviços de aplicação ou domínio.

---

# Autenticação

A autenticação pertence à API.

A aplicação deve possuir sistema próprio de autenticação e gerenciamento de usuários.

Dados de autenticação devem ser tratados separadamente dos demais dados do usuário sempre que fizer sentido.

Senhas nunca devem ser armazenadas em texto puro.

---

# Banco de dados

MongoDB é a fonte principal de persistência.

A modelagem deve priorizar:

- Clareza
- Evolução futura
- Manutenibilidade
- Performance adequada

Evitar otimizações prematuras.

---

# Inteligência Artificial

Toda integração com IA deve ser realizada pela API.

O frontend não deve acessar provedores de IA diretamente.

A API é responsável por:

- Construção de contexto
- Controle de permissões
- Segurança
- Histórico
- Integrações externas

---

# Segurança

Segurança deve ser considerada desde o início.

Prioridades:

- Proteção de dados
- Validação de entradas
- Controle de acesso
- Uso correto de variáveis de ambiente
- Menor privilégio possível

Dados sensíveis não devem ser expostos em logs ou respostas.

---

# Qualidade de código

Priorizar:

- Simplicidade
- Legibilidade
- Coesão
- Baixo acoplamento
- Responsabilidade única

Evitar:

- Código duplicado
- Arquivos excessivamente grandes
- Complexidade desnecessária
- Dependências sem justificativa

---

# Testes

Todo código criado em `src/domain` deve possuir testes.

Os testes de domínio devem ficar em `src/domain/__tests__`, organizados pelo respectivo contexto.

Não criar testes fora de `src/domain` nesta fase.

Controllers, infraestrutura, módulos, integrações e casos de uso não devem receber arquivos de teste enquanto esta regra estiver vigente.

---
