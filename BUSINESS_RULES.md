# Business Rules

Este arquivo é a fonte normativa de regras de negócio do produto.

O código existente não deve ser tratado como fonte de verdade quando entrar em conflito com este documento.

## Produto

O sistema é uma rede de apoio psicológica digital com:

- diário inteligente
- acompanhamento de humor
- acompanhamento de sono
- acompanhamento de rotina
- chat com IA
- memória longitudinal
- análise de padrões
- resumos
- rede de apoio

## Limites clínicos

O sistema não deve:

- diagnosticar usuários
- prescrever medicamentos
- substituir psicólogo ou psiquiatra
- afirmar certeza clínica sobre mania, depressão ou recaída
- tomar decisões críticas sem política explícita

O sistema pode:

- acompanhar padrões pessoais
- gerar reflexões
- sugerir autocuidado seguro
- organizar informações para consulta com profissional
- identificar mudanças relevantes de rotina, sono e humor como hipóteses

## Arquitetura

Todos os agentes ficam dentro do backend NestJS nesta fase inicial.

O agente deve usar tools internas tipadas.

O agente não deve acessar o banco diretamente de forma livre.

O domínio não deve depender de NestJS, Mongoose ou OpenAI.
