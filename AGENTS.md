# AGENTS.md

# BBrain API

Backend principal do ecossistema BBrain.

As diretrizes globais ficam em `/home/alex/projetos/bbrain-core/AGENTS.md` e devem ser respeitadas em conjunto com este documento.

---

## 1) Contexto

Este repositório implementa a API principal do BBrain.

A API concentra os fluxos sensíveis do produto, incluindo:

- usuários
- autenticação
- perfil
- preferências
- conversas
- diário
- humor
- sono
- rotina
- memória
- insights
- integrações de IA
- assinaturas
- pagamentos
- relatórios
- persistência
- observabilidade

O frontend não deve decidir regras sensíveis, permissões reais, acesso premium, políticas de IA, persistência crítica ou autorização por conta própria.

A API é a fonte de verdade para consistência, segurança e integridade dos dados.

---

## 2) Objetivo do agente

Gerar código de nível sênior com foco em:

- clareza
- baixo acoplamento
- alta coesão
- testabilidade
- segurança
- privacidade
- rastreabilidade
- consistência arquitetural
- separação de responsabilidades
- evolução incremental

Ao alterar o projeto, preserve a intenção arquitetural antes de otimizar detalhes locais.

Não introduza complexidade desnecessária.

Não crie abstrações apenas por antecipação, mas deixe boundaries claros para evolução futura quando o fluxo indicar essa necessidade.

---

## 3) Documentos normativos

Antes de alterar código ou documentação, considere sempre:

- `AGENTS.md` global do repositório raiz
- `README.md` da API
- documentos específicos de arquitetura, produto ou domínio, se existirem
- testes existentes
- código atual como fotografia da implementação real

Se houver divergência entre documentação e código:

1. trate a documentação de domínio/produto como intenção;
2. trate o código como implementação atual;
3. corrija documentação e implementação no mesmo trabalho quando a divergência afetar fluxo relevante;
4. documente qualquer decisão arquitetural importante.

O `README.md` deve explicar visão geral, setup, arquitetura e estrutura.

Regras detalhadas de domínio, quando existirem, devem ficar em documentos próprios, não espalhadas em controllers, adapters ou comentários locais.

---

## 4) Arquitetura

A arquitetura segue separação por camadas e contextos de domínio.

Camadas principais:

- `domain`
- `use-cases` ou `application`
- `infrastructure`
- `interfaces` ou controllers
- `modules` ou composition root

Regra geral de dependência:

- domínio não depende de aplicação;
- domínio não depende de infraestrutura;
- domínio não depende de controllers, workers, filas, banco, HTTP, SDKs ou frameworks;
- aplicação depende do domínio e de ports;
- aplicação não depende de infraestrutura concreta;
- infraestrutura implementa ports da aplicação ou contratos de repositório do domínio;
- interfaces externas chamam use cases;
- modules/composition conectam implementações concretas aos contratos;
- workers, jobs e handlers devem delegar fluxo para use cases.

O domínio continua sendo a referência central do sistema.

---

## 5) Organização por contexto

Manter organização por contexto de domínio.

Exemplos de contextos possíveis:

- `core`
- `shared`
- `users`
- `conversation`
- `journal`
- `memory`
- `billing`
- `reports`
- `insights`

Não criar pastas globais genéricas para entidades, repositórios, value objects ou eventos fora de contexto.

Evite estruturas como:

- `src/domain/entities`
- `src/domain/repositories`
- `src/domain/value-objects`
- `src/domain/events`

Prefira que cada contexto contenha seus próprios elementos:

- entidades
- value objects
- serviços de domínio
- eventos
- contratos
- políticas
- testes

Componentes compartilhados só devem ir para `shared` quando forem realmente reutilizáveis e não carregarem regra específica de um contexto.

---

## 6) Domínio

A camada de domínio é responsável por:

- entidades
- aggregate roots
- value objects
- serviços de domínio
- políticas de domínio
- eventos de domínio
- invariantes
- linguagem ubíqua do produto

O domínio deve proteger regras essenciais e estados válidos.

O domínio não deve conhecer:

- NestJS
- Express
- HTTP
- MongoDB
- Mongoose
- Prisma
- OpenAI
- Gemini
- SDKs externos
- filas
- workers
- JSON schema de provider
- prompts concretos
- variáveis de ambiente
- logging técnico
- DTOs de controller
- documentos persistidos crus

Toda mutação relevante em entidades ou aggregates deve ocorrer por métodos explícitos, preservando invariantes.

Evite anemizar o domínio quando houver regra real a proteger.

Evite também transformar tudo em aggregate ou value object sem necessidade.

---

## 7) Application / Use Cases

A camada de aplicação é responsável por orquestrar fluxos.

Use cases devem:

- receber comandos ou queries de entrada;
- carregar dados por contratos;
- coordenar entidades, aggregates e serviços de domínio;
- chamar integrações por ports;
- persistir alterações por interfaces;
- publicar eventos;
- controlar transações quando aplicável;
- retornar DTOs limpos para a camada chamadora.

Use cases não devem:

- acessar banco diretamente;
- usar SDKs externos diretamente;
- importar adapters concretos;
- conter parsing de infraestrutura;
- conter regra de domínio que deveria estar em entidade, value object ou serviço de domínio;
- depender de controllers;
- depender de workers;
- depender de prompt registry concreto;
- depender diretamente de OpenAI, Gemini ou outros providers.

Ports de aplicação representam capacidades necessárias ao fluxo, não detalhes técnicos de implementação.

Exemplos de capacidades que podem ser modeladas como ports quando fizer sentido:

- geração por IA;
- renderização de prompt;
- leitura de contexto;
- memória conversacional;
- publicação de eventos;
- clock;
- transação;
- envio de e-mail;
- integração de pagamento;
- armazenamento de arquivos;
- métricas ou tracing abstrato.

Não crie ports sem necessidade real.

Quando criar um port, ele deve expressar intenção de negócio ou de aplicação, não o nome de uma tecnologia.

---

## 8) Infrastructure

A camada de infraestrutura é responsável por detalhes técnicos e integrações concretas.

Responsabilidades típicas:

- persistência;
- mapeamento entre documentos e domínio;
- implementação concreta de repositórios;
- clients HTTP;
- SDKs externos;
- providers de IA;
- providers de pagamento;
- filas;
- jobs;
- workers;
- envio de e-mail;
- templates externos;
- storage;
- logging técnico;
- métricas;
- tracing;
- schemas técnicos;
- parsing de respostas externas;
- retries e timeouts;
- adapters de serviços externos.

Infraestrutura pode importar domínio e aplicação para implementar contratos.

Infraestrutura não deve conter regra central de negócio.

Infraestrutura não deve contaminar domínio ou use cases com:

- formato de banco;
- formato de provider;
- nomes de campos persistidos;
- exceções técnicas específicas;
- objetos crus de SDK;
- schemas externos;
- detalhes de autenticação externa;
- prompts concretos acoplados ao fluxo.

Repositórios de infraestrutura devem retornar objetos de domínio ou modelos de aplicação apropriados, nunca documentos crus quando o contrato espera domínio.

Mappers de infraestrutura devem centralizar conversão entre:

- domínio em `camelCase`;
- persistência em `snake_case`, quando aplicável;
- payloads externos;
- DTOs técnicos.

---

## 9) Interfaces externas

Controllers, resolvers, handlers HTTP e endpoints são bordas de entrada e saída.

Responsabilidades:

- receber request;
- validar DTO;
- autenticar/autorização quando aplicável;
- chamar use case;
- mapear resposta;
- retornar status adequado.

Controllers não devem:

- conter regra de negócio;
- mutar domínio diretamente fora de use case;
- acessar repositories concretos;
- chamar SDKs externos;
- montar prompt;
- decidir política de IA;
- calcular acesso premium;
- manipular documentos persistidos diretamente.

Mensagens técnicas internas não devem vazar para o frontend.

Prefira códigos de erro estáveis e mensagens apropriadas para camada de apresentação.

---

## 10) Modules / Composition

A camada de modules/composition é responsável por conectar dependências.

Modules podem:

- registrar use cases;
- registrar repositories concretos;
- registrar adapters;
- registrar providers externos;
- conectar ports a implementações;
- configurar workers;
- configurar handlers;
- expor controllers.

Modules não devem conter:

- regra de negócio;
- regra de aplicação;
- entidades;
- value objects;
- tipos centrais de domínio;
- parsing de provider;
- lógica de prompt;
- lógica de contexto;
- lógica de persistência.

Se uma pasta em `modules` começar a conter tipos centrais, repositórios, regras ou services reais, ela provavelmente deve ser realocada para `domain`, `use-cases` ou `infrastructure`.

---

## 11) Eventos

O projeto deve favorecer eventos quando eles melhoram desacoplamento, rastreabilidade e evolução do fluxo.

Eventos podem existir em níveis diferentes:

- eventos de domínio;
- eventos de aplicação;
- eventos de integração;
- eventos técnicos de infraestrutura.

Não misture esses tipos.

### Eventos de domínio

Representam fatos relevantes que aconteceram no domínio.

Devem usar linguagem do domínio.

Não devem carregar detalhes técnicos de infraestrutura.

Não devem representar falhas técnicas de provider, logs, parsing ou timeouts.

Eventos de domínio podem ser produzidos por aggregates, entidades ou serviços de domínio quando um fato relevante ocorre.

### Eventos de aplicação

Representam fatos ou decisões relevantes do fluxo de aplicação.

Podem coordenar efeitos colaterais internos, como:

- disparar processamento assíncrono;
- notificar outro caso de uso;
- atualizar read models;
- solicitar persistência complementar;
- iniciar tarefas derivadas.

Eventos de aplicação não devem substituir invariantes de domínio.

### Eventos de integração

Representam comunicação com sistemas externos.

Devem ser tratados com cuidado quanto a:

- idempotência;
- reprocessamento;
- rastreabilidade;
- versionamento;
- compatibilidade;
- privacidade dos dados enviados.

### Eventos técnicos

Logs, métricas, tracing, erros técnicos, timeouts e falhas de parsing não são eventos de domínio.

Esses casos pertencem à observabilidade.

### Regras gerais para eventos

Ao criar ou alterar eventos:

- mantenha nomes no passado;
- represente fatos, não comandos;
- evite payloads grandes ou sensíveis;
- inclua identificadores necessários para rastreio;
- preserve idempotência em handlers;
- evite efeitos colaterais duplicados;
- documente eventos relevantes quando alterarem fluxo importante.

Se o projeto ainda não possuir infraestrutura robusta de eventos, introduza abstrações mínimas e compatíveis com evolução futura.

Não implemente Outbox Pattern complexo sem necessidade atual, mas não bloqueie sua adoção futura.

---

## 12) Event handlers, jobs e workers

Handlers, jobs e workers são mecanismos de execução.

Eles devem:

- receber evento, mensagem ou agendamento;
- validar envelope técnico;
- recuperar contexto mínimo necessário;
- chamar use cases;
- registrar observabilidade;
- ser seguros para reprocessamento.

Eles não devem:

- conter regra de negócio central;
- mutar aggregates diretamente fora de use cases;
- acessar banco de forma espalhada;
- chamar providers externos sem passar por application service ou port apropriado;
- duplicar fluxo já existente em use case.

Handlers e workers devem ser idempotentes quando processarem eventos externos, filas ou tarefas reexecutáveis.

---

## 13) Inteligência Artificial

Toda chamada para provedores de IA deve ocorrer na API.

A IA deve ser tratada como capacidade de aplicação implementada por infraestrutura.

O domínio não deve saber que existe LLM.

A aplicação pode depender de ports que representem capacidades como:

- geração de resposta;
- análise de texto;
- sumarização;
- classificação;
- construção de contexto;
- renderização de prompt;
- memória conversacional.

Infraestrutura implementa essas capacidades com providers concretos.

Adapters de IA são responsáveis por:

- montar payload técnico do provider;
- aplicar schema técnico quando houver;
- tratar resposta bruta;
- fazer parsing técnico;
- lidar com retry, timeout e erros externos;
- converter resposta externa para modelo canônico da aplicação;
- registrar observabilidade sem vazar dados sensíveis.

Adapters de IA não devem ser donos das regras centrais do produto.

Prompts concretos não devem virar mecanismo escondido de regra de negócio.

Se uma instrução de prompt representa regra do produto, ela deve estar refletida em domínio, aplicação ou política explícita.

---

## 14) Agents

O termo `agent` deve ser usado com cuidado.

Antes de criar ou mover um agent, identifique seu papel arquitetural.

Um agent pode representar:

- uma capacidade de aplicação;
- um orchestrator de aplicação;
- um adapter de infraestrutura para LLM;
- um fluxo especializado;
- um componente técnico de provider;
- um worker de execução.

Não trate todos esses casos como a mesma coisa.

Regra geral:

- domínio não conhece agents de IA;
- aplicação pode conhecer ports de agent/capability;
- infraestrutura implementa agents concretos baseados em providers;
- workers apenas executam use cases;
- composição conecta agent ports às implementações concretas.

Evite agents genéricos que acumulam:

- prompt;
- parsing;
- regra de negócio;
- provider;
- persistência;
- guardrails;
- memória;
- logging;
- fallback;
- orquestração.

Quando um agent crescer demais, separe responsabilidades por capability, adapter, policy, context builder, parser ou use case.

A arquitetura deve permitir evolução futura para:

- loops;
- tool use;
- RAG;
- evaluators;
- harnesses;
- multi-agent workflows;
- model routing;
- memória de longo prazo;
- tarefas assíncronas.

Mas essas capacidades não devem ser implementadas antes de existir uma necessidade concreta.

---

## 15) Context Engineering

Contexto para IA deve ser intencional, mínimo e controlado.

Diretrizes:

- enviar apenas o necessário para a tarefa;
- separar instruções de sistema, dados do usuário, memória, resumo e mensagens recentes;
- nunca permitir que dados persistidos virem instruções automaticamente;
- limitar histórico enviado ao provider;
- resumir histórico quando necessário;
- preservar preferências relevantes do usuário;
- respeitar idioma preferido;
- tratar memória como dado, não como comando;
- sanitizar conteúdo antes de enviar a providers externos;
- evitar payloads sensíveis desnecessários.

Context builders pertencem à aplicação ou à infraestrutura dependendo do papel:

- se constroem modelo canônico de contexto para o caso de uso, tendem a aplicação;
- se convertem contexto canônico para formato específico de provider, pertencem à infraestrutura;
- se aplicam regra de domínio, devem delegar para domínio ou política explícita.

---

## 16) Memória e histórico

Memória não deve depender de conversa inteira ilimitada.

Prefira dados estruturados e revisáveis, como:

- resumos;
- preferências explícitas;
- perfil reflexivo;
- histórico recente limitado;
- registros estruturados;
- eventos relevantes;
- read models.

Dados de memória devem ser tratados com privacidade, retenção adequada e possibilidade de revisão ou remoção conforme evolução do produto.

Memória não deve ser tratada como diagnóstico clínico.

Memória não deve ser enviada integralmente a providers externos sem necessidade clara.

---

## 17) Guardrails e políticas

Guardrails podem existir em diferentes camadas.

Classifique antes de implementar:

- regra de domínio;
- política de aplicação;
- validação de entrada;
- validação de saída;
- filtro técnico;
- adapter externo de moderação;
- instrução de prompt;
- observabilidade.

Regras de produto devem estar em domínio ou aplicação.

Validações técnicas podem estar em infraestrutura ou borda de entrada.

Schemas de provider pertencem à infraestrutura.

Prompts podem reforçar comportamento, mas não devem ser a única fonte de regras importantes.

---

## 18) Persistência

Persistência é detalhe de infraestrutura.

O domínio não deve conhecer formato persistido.

Diretrizes:

- nomes internos em `camelCase`;
- schemas, documentos, filtros e estruturas persistidas podem usar `snake_case`, conforme padrão do projeto;
- conversão deve ser centralizada em mappers de infraestrutura;
- repositories devem esconder detalhes de banco;
- não espalhar queries complexas fora de repositories ou query services apropriados;
- não retornar documento cru quando o contrato espera domínio;
- preservar consistência e rastreabilidade.

Quando houver read models ou queries específicas, escolha explicitamente entre:

- repository de domínio;
- query port de aplicação;
- adapter de infraestrutura.

Não force todo acesso a dados a passar por aggregate quando o caso for claramente leitura/projeção.

---

## 19) Pagamentos e assinaturas

A API controla pagamentos, assinaturas e acesso premium.

Integrações com provedores externos devem ficar na infraestrutura.

Use cases devem coordenar:

- criação de assinatura;
- atualização de estado;
- validação de webhook;
- concessão ou remoção de acesso;
- persistência;
- publicação de eventos.

Regras de acesso premium devem ser calculadas no backend.

O frontend deve apenas consumir o estado retornado pela API.

Webhooks devem ser idempotentes e rastreáveis.

Não expor dados sensíveis de pagamento em logs.

---

## 20) Autenticação e segurança

A autenticação pertence à API.

Diretrizes:

- senhas nunca em texto puro;
- hash seguro;
- secrets por variável de ambiente;
- validação forte de entrada;
- proteção de rotas sensíveis;
- tokens temporários para fluxos sensíveis;
- tokens não reutilizáveis quando aplicável;
- separação clara entre autenticação, autorização e perfil;
- logs sem tokens, senhas ou payloads sensíveis.

Controllers e guards não devem conter regra de negócio que deveria estar em use case ou domínio.

---

## 21) i18n

A API deve tratar idioma de forma tipada e consistente.

Diretrizes:

- persistir idioma preferido;
- aplicar fallback;
- evitar mensagens técnicas brutas;
- usar códigos de erro estáveis quando possível;
- não misturar texto de UI com regra de negócio;
- não espalhar strings finais de produto em domínio quando isso dificultar tradução.

Domínio deve preferir erros e estados estáveis.

A apresentação textual pode ser resolvida em camadas externas.

---

## 22) Relatórios e exportações

Relatórios e exportações devem ser tratados como fluxos sensíveis.

Diretrizes:

- respeitar consentimento e ação explícita do usuário;
- evitar linguagem conclusiva indevida;
- proteger dados sensíveis;
- registrar rastreabilidade quando necessário;
- separar geração, persistência e entrega;
- não compartilhar com terceiros sem intenção explícita do usuário.

Relatórios devem ser informativos e consistentes com o posicionamento do produto.

---

## 23) Logs e observabilidade

Observabilidade deve ajudar manutenção sem vazar dados sensíveis.

Não expor em logs:

- senhas;
- tokens;
- secrets;
- payloads completos de conversas;
- diário completo;
- dados emocionais completos;
- payloads sensíveis de pagamento;
- respostas completas de providers externos quando contiverem dados pessoais.

Prefira logs estruturados com:

- ids internos;
- correlation id;
- user id quando permitido;
- conversation id quando permitido;
- event id;
- provider;
- status;
- duração;
- erro sanitizado.

Tracing e métricas devem observar comportamento técnico sem violar privacidade.

---

## 24) Erros

Erros devem ser tratados de forma consistente.

Diretrizes:

- domínio deve expor erros estáveis e significativos;
- aplicação deve traduzir falhas de fluxo;
- infraestrutura deve encapsular erros técnicos;
- controllers devem mapear erros para respostas adequadas;
- não vazar stack trace ou detalhes internos;
- preservar causa técnica em logs sanitizados.

Evite lançar erros genéricos quando houver alternativa tipada ou erro de domínio/aplicação mais claro.

---

## 25) Testes

Todo código criado ou alterado em `src/domain` deve possuir testes.

Ao alterar ou criar código em `src/domain`, adicione ou ajuste testes de domínio correspondentes.

Testes de domínio devem focar em:

- invariantes;
- transições de estado;
- value objects;
- políticas;
- eventos de domínio;
- casos de erro.

Se algum script falhar por motivo preexistente, documente claramente.

Não aceite apenas happy path em fluxo sensível.

Prefira testes pequenos, determinísticos e orientados a comportamento.

Não crie, ajuste ou expanda testes fora de `src/domain`

---

## 26) Regras para mudanças

Sempre que alterar o projeto:

- preserve separação entre domínio, aplicação, infraestrutura e interfaces;
- mantenha nomes claros e tipagem forte;
- evite `any` fora de bordas técnicas inevitáveis;
- não introduza dependência de infraestrutura no domínio;
- não introduza dependência de infraestrutura nos use cases;
- não coloque regra de negócio em controllers;
- não coloque regra de negócio em repositories;
- não coloque regra de negócio em workers;
- não coloque regra de negócio escondida em prompts;
- atualize documentação quando alterar arquitetura, evento, fluxo ou contrato relevante;
- preserve compatibilidade pública quando possível;
- adicione mappers quando precisar adaptar modelos entre camadas;
- prefira refatorações incrementais e testáveis.

Ao mover código:

- preserve comportamento;
- atualize imports;
- remova duplicações;
- valide dependências por camada;
- rode testes disponíveis.

---

## 27) Refatoração arquitetural

Ao refatorar áreas existentes:

1. entenda o fluxo atual;
2. identifique responsabilidades reais;
3. classifique cada parte como domínio, aplicação, infraestrutura, interface ou composition;
4. mova primeiro contratos e modelos canônicos;
5. adapte implementações concretas depois;
6. preserve comportamento externo;
7. remova arquivos genéricos que acumulam responsabilidades;
8. documente decisões relevantes.

Evite nomes genéricos como:

- manager;
- helper;
- utils;
- support;
- service, quando houver nome mais específico.

Prefira nomes que expressem intenção arquitetural e linguagem do domínio.

---

## 28) Estilo de resposta do agente

Ao responder sobre mudanças no projeto, use esta ordem:

1. plano;
2. estrutura;
3. alterações;
4. testes;
5. observações.

Ao implementar, explique decisões arquiteturais relevantes, principalmente quando envolver:

- nova abstração;
- novo port;
- novo evento;
- mudança de camada;
- alteração em fluxo sensível;
- remoção de acoplamento;
- adaptação de infraestrutura.

Não esconda limitações, falhas de teste ou dívidas técnicas encontradas.

---

## 29) Critério geral de aceite

Uma alteração deve ser considerada adequada quando:

- respeita boundaries de camada;
- preserva invariantes do domínio;
- mantém use cases independentes de infraestrutura concreta;
- deixa infraestrutura como adapter;
- mantém controllers finos;
- mantém workers como executores;
- usa eventos quando há ganho real de desacoplamento ou rastreabilidade;
- não vaza dados sensíveis;
- possui testes proporcionais ao risco;
- melhora a legibilidade do sistema;
- não cria abstrações artificiais;
- prepara evolução futura sem implementar complexidade prematura.

O domínio continua sendo a referência central do sistema.