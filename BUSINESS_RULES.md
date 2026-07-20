# Regras de Negócio — BBrain API

Estas regras detalham o comportamento normativo do backend. Elas complementam `../BUSINESS_RULES.md`; em conflito, prevalecem proteção do usuário, privacidade, limites clínicos e autorização no backend.

## Limites de produto

A API sustenta apoio reflexivo e organização pessoal, não atendimento clínico. Não pode diagnosticar, prescrever, ajustar medicamentos, afirmar recaída/manias/depressão, prometer cura ou substituir profissional.

Respostas, Insights, resumos e Recursos devem usar linguagem não conclusiva. Mudanças de Humor, Sono e rotina são observações/hipóteses do usuário, nunca evidência clínica.

## Ownership, planos e dados sensíveis

`userId` vem da autenticação, nunca de DTO, modelo ou query pública. Toda query, update e delete deve ser scoped ao dono autenticado.

Dados emocionais, Sono, diário, conversa, perfil e saúde autorrelatada são sensíveis. Eles não podem aparecer em logs, traces, exceções HTTP ou telemetria textual. Preferências de privacidade são aplicadas antes de contexto, provider e persistência. Mensagens e respostas literais não são documentos de produto e não podem ser gravadas pelo fluxo de chat.

Histórico básico e operações manuais de bem-estar não dependem de plano. Insights exige plano Pro efetivo calculado na API. Plano sem dados suficientes recebe `insufficient_data`; plano não elegível recebe erro estável de autorização.

## Conversa

Cada envio pode ter `clientMessageId` UUID estável. Idempotência usa HMAC com secret e ledger técnico temporário, sem conteúdo. O mesmo id com HMAC diferente é conflito; claim concorrente fica em processamento; replay concluído não reproduz a resposta e retorna erro estável. Limites de plano/uso são autoridade do backend.

Chat pode usar idioma, preferências permitidas e `ConversationState` estruturado. O estado tem TTL, é apagado na revogação aplicável e não pode conter transcrição, diagnóstico, medicação, rótulo clínico, padrão, Insight ou interpretação profunda. `profileUpdate` não faz parte do contrato de chat.

Uma conversa isolada não é padrão. Padrão/Insight futuro exige múltiplas observações estruturadas em datas distintas, cobertura e evidências válidas; autorrelato de mania ou outro diagnóstico nunca confirma estado clínico nem explica automaticamente o comportamento.

Ao receber autorrotulação clínica, a resposta declara que não pode confirmar e não acrescenta sintomas. Se o estado indicar dificuldade de controlar impulsos e falta de apoio humano, a resposta não reforça exclusividade, declara que o BBrain não deve ser o único apoio e pergunta sobre risco imediato.

## Extração de Humor e Sono

Extração ocorre somente após a resposta conversacional e não deve alterar o texto entregue ao usuário.

Para criar ou corrigir uma observação automática, exige-se:

- mensagem do próprio usuário, em relato direto e afirmado;
- citação literal de evidência na mensagem atual, apenas para validação transitória;
- schema/parser/policy válidos;
- temporalidade, timezone e precisão válidas quando fornecidas;
- consentimentos `allowMoodInsights` e `allowSensitiveDataStorage` ativos;
- conta não agendada para exclusão;
- confiança mínima definida em configuração.

Não criar observação para terceiro, futura, desejada, hipotética, ficcional, pergunta ou estado negado. Não completar campos ausentes. Números de score, intensidade, duração ou despertares precisam estar sustentados literalmente no contexto da evidência.

A persistência guarda `evidenceFingerprint` HMAC e identificadores de origem, nunca `evidenceQuote`. O fingerprint não é retornado pela API pública.

`AI_OBSERVATION_EXTRACTION_ENABLED=true` permite shadow. Persistência exige também `AI_OBSERVATION_EXTRACTION_PERSIST_ENABLED=true`; a segunda flag fica desligada até gates operacionais/evals aprovados.

## Modelo de bem-estar

`mood_event`, `sleep_record` e `mood_daily_summary` usam proveniência, revisão e controle de concorrência.

- evento de Humor é primário;
- resumo diário é derivado, exige fontes suficientes e pode ficar stale;
- ausência não é humor neutro;
- `isMixed` representa mistura explicitamente, sem inventar emoção;
- Sono aceita campos parciais e aproximações, sem fabricar noites;
- manual override e resumo explícito têm precedência de leitura sobre derivado;
- correção, edição e exclusão invalidam/reconstroem derivados aplicáveis;
- PATCH segue merge patch: omitido preserva, `null` remove;
- idempotency key manual reutilizada com payload diferente é conflito.

## Insights e Recursos

Insights futuros devem ser derivados de evidência estruturada, revisável e autorizada; não podem diagnosticar, atribuir causalidade indevida ou ocultar incerteza.

Recursos/RAG é boundary separado: corpus externo não é memória pessoal e nunca atualiza perfil ou histórico automaticamente. Toda futura síntese precisa respeitar fonte, direitos e trust domain.

## Operação e evolução

Provider/modelo/prompt/schema são detalhes versionados de infraestrutura. O domínio não depende de NestJS, Mongoose, OpenAI, Gemini ou SDKs. Não implementar multiagente, RAG, fila distribuída, backfill ou memória vetorial sem avaliação objetiva, custo/latência, segurança e rollback.

Mudanças em consentimento, contratos, revisões, eventos, modelos, prompts ou retenção exigem testes proporcionais e atualização de `README.md`, `AGENTS.md` e documentos em `../docs/ai-architecture/`.
