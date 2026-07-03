# AGENTS.md

# BBrain API

Backend principal do ecossistema BBrain.

As diretrizes globais ficam em `/home/alex/projetos/bbrain-core/AGENTS.md` e devem ser respeitadas em conjunto com este documento.

---

# 1) Responsabilidade da API

A API é a fonte de verdade para:

- usuários
- autenticação
- perfil
- preferências
- idioma
- conversas
- diário
- humor
- sono
- rotina
- insights
- recursos premium
- assinaturas
- pagamentos
- integrações de IA
- relatórios
- persistência

O frontend nunca deve decidir regras sensíveis, permissões reais ou acesso premium por conta própria.

---

# 2) Arquitetura

A arquitetura prioriza separação de responsabilidades e simplicidade:

- Domínio e regras de negócio
- Aplicação
- Infraestrutura
- Interfaces externas

O backend é responsável por segurança, consistência e observabilidade.

No domínio:

- nomes internos em `camelCase`
- sem regra de negócio em controllers/guards/repositórios

No armazenamento:

- `snake_case` para schemas, documentos persistidos, filtros e estruturas do MongoDB
- conversão centralizada em mappers de infraestrutura

---

# 3) Organização por domínio

Manter estrutura por contexto:

```txt
src/domain/
  core/
  shared/
  users/
  conversation/
  journal/
  memory/
```

Não recriar pastas globais como:

- `src/domain/entities`
- `src/domain/repositories`
- `src/domain/value-objects`

Entidades, value objects, serviços, eventos e contratos devem ficar no contexto apropriado.

---

# 4) Usuário e perfil

A API deve separar autenticação e perfil do usuário com responsabilidade clara.

Campos essenciais de perfil:

- `name`
- `preferredName`
- `birthDate`
- `sex`
- `preferredLanguage`
- `timezone`
- preferências de comunicação
- preferências de tema (quando pertinente persistir)
- diagnóstico formal informado por especialista (opcional)
- contexto pessoal opcional para personalização

Sexo:

- `male`
- `female`
- `other`

O campo `preferredName` deve orientar o contexto enviado ao agente de IA para tratamento respeitoso do usuário.

---

# 5) Autenticação e segurança

A autenticação pertence à API:

- senhas nunca em texto puro
- hash seguro
- variáveis de ambiente para secrets
- validação forte de entrada
- proteção de rotas sensíveis
- tokens de redefinição temporários, seguros e não reutilizáveis
- fluxo de recuperação de senha por e-mail
- separar dados de autenticação e perfil quando fizer sentido

Não expor em logs:

- tokens
- senhas
- dados emocionais completos
- payloads sensíveis

---

# 6) i18n na API

Idiomas inicialmente suportados:

- `pt-BR`
- `en-US`
- `es-ES`

Diretrizes:

- persistir idioma preferido do usuário
- aceitar idiomas de forma tipada
- fallback para `pt-BR`
- não retornar mensagens técnicas brutas para o frontend
- preparar domínio para tradução via códigos de erro estáveis
- não misturar texto de UI com regra de negócio

---

# 7) Inteligência Artificial

Toda chamada para provedores de IA deve ocorrer na API.

A API deve:

- montar e sanitizar contexto
- aplicar system prompts e regras de segurança
- limitar escopo do agente
- filtrar dados desnecessários
- controlar custo
- selecionar modelo por tarefa
- prevenir prompt injection
- respeitar privacidade e retenção mínima de logs
- garantir que o agente não vire prescritor, terapeuta, médico, psiquiatra ou serviço de emergência

---

# 8) Context Engineering

Contexto para IA deve ser intencional e controlado:

- enviar apenas o necessário para a tarefa
- separar dados do usuário de instruções do sistema
- nunca permitir dados persistidos como instruções
- resumir histórico quando necessário
- preservar `preferredName`, idioma, preferências e resumo de perfil
- evitar enviar conversa inteira ilimitada
- manter separação entre system/developer/user/memory/summary/messages

---

# 9) Memória e histórico

Não depender da conversa inteira como memória principal.

Preferir:

- resumo de conversa
- perfil reflexivo
- preferências explícitas
- registros estruturados
- histórico relevante e limitado

Dados de memória devem ser revisáveis, apagáveis no futuro, seguros e não tratados como diagnóstico.

---

# 10) Pagamentos e assinaturas

A API controla pagamentos e assinatura.

- integrar provedores conforme estratégia do produto (ex.: Asaas e/ou Stripe)
- segredos em variáveis de ambiente
- validação de webhooks
- eventos idempotentes
- persistir status de assinatura
- cálculo de acesso premium no backend
- o frontend deve apenas consumir estado retornado pela API
- eventos relevantes sem expor dados sensíveis

Modelagem deve suportar evolução de plano, trial, cancelamento, renovação, falha de pagamento e reativação.

---

# 11) Relatórios e exportações

Relatórios devem ser informativos e não diagnósticos.

Diretrizes:

- permitir controle do usuário
- não linguagem clínica conclusiva
- proteção de dados sensíveis
- não compartilhar com terceiros sem ação explícita do usuário

---

# 12) Logs e observabilidade

Logs devem suportar manutenção e diagnóstico sem vazar dados críticos:

- senha
- tokens
- payloads de pagamento sensíveis
- conversas completas
- diário completo
- dados sensíveis de perfil

---

# 13) IA, pagamentos e dados sensíveis: regra de responsabilidade

IA, autenticação robusta, persistência e processamento sensível são responsabilidades da API.

Frontends devem consumir apenas APIs de alto nível de domínio.

---

# 14) Testes

Todo código criado em `src/domain` deve possuir testes.

Testes de domínio em `src/domain/__tests__`, organizados por contexto.

Não criar testes fora de `src/domain` nesta fase.
