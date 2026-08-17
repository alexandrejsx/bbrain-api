# Regras de Negócio — BBrain API

Este arquivo complementa `../BUSINESS_RULES.md` com os contratos do backend.

## Autorização e privacidade

- `userId` vem sempre da autenticação.
- `DataConsentPolicy` é o único ponto de decisão para uso de contexto, memória e extração automática de bem-estar.
- O consentimento é revalidado após a chamada de IA e antes da persistência.
- Revogação de memória/storage sensível remove sessão recente, Current Context e Memory/Pattern.
- Exclusão de conta drena processamento local e remove sessão, ledger, contexto, memória, humor e sono antes do usuário.

## Chat

- `conversationId` identifica a janela recente; `clientMessageId` identifica a troca.
- Reuso do mesmo `clientMessageId` com conteúdo diferente é conflito.
- Replay concluído não recria nem retorna uma resposta armazenada, pois respostas não ficam no ledger.
- A janela recente contém seis mensagens por padrão, nunca mais de oito, e expira em 24 horas por padrão.
- O Context Builder seleciona no máximo seis memories e três patterns por relevância simples, atualidade e importância.
- Diagnóstico só entra no contexto quando o perfil registra diagnóstico formal informado pelo usuário.

## Extração e persistência

- Extração é posterior à resposta e usa o papel `FAST`.
- Saída incompleta, inválida ou abaixo da confiança mínima não cria dado.
- `sourceEventId` torna Memory, Mood e Sleep idempotentes.
- Current Context substitui o anterior; não vira timeline.
- Pattern requer duas ou mais memories com pelo menos dois tópicos normalizados em comum.
- Mood e Sleep mantêm revisão para PATCH/DELETE concorrentes e continuam compatíveis com `/wellbeing-history/observations`.
- Sono sem data/período usa referência temporal `unknown`; período aproximado gera um único registro.

## IA e segurança

- `CONVERSATION` atende o chat; `FAST` atende extração; `REASONING` existe apenas na configuração de modelos.
- Provider ativo é OpenAI ou Gemini, sem fallback cruzado.
- Retry ocorre somente para timeout, erro de rede, HTTP 408, 429 ou 5xx, com máximo configurável de duas novas tentativas.
- O BBrain não diagnostica, prescreve, confirma autorrotulação clínica ou se oferece como apoio exclusivo.
- Conteúdo fora do escopo recebe resposta segura e não agenda extração.

## Planos

Limites de uso e acesso premium são autoridade do backend. Histórico manual de Humor/Sono não depende de plano. O endpoint de Insights atual retorna apenas o estado permitido/insuficiente e não gera análise por IA.
