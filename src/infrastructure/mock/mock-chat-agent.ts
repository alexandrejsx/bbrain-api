import { Injectable } from '@nestjs/common';
import {
  ChatAgent,
  ChatAgentRequest,
  ChatAgentResponse
} from '../../use-cases/conversation/chat-agent.port';
import { estimateLlmUsageFromText } from '../../domain/usage/value-objects/llm-usage';

interface MockReplyRule {
  keywords: readonly string[];
  reply: string;
}

const REPLY_RULES: readonly MockReplyRule[] = [
  {
    keywords: ['ansied', 'ansioso', 'ansiosa', 'nervoso', 'nervosa', 'preocupad'],
    reply:
      'Parece que há muita coisa pedindo sua atenção ao mesmo tempo. O que está pesando mais agora?'
  },
  {
    keywords: ['triste', 'sozinho', 'sozinha', 'desanimad', 'vazio', 'vazia'],
    reply:
      'Sinto que este momento está sendo difícil para você. O que você mais gostaria que alguém compreendesse sobre isso?'
  },
  {
    keywords: ['cansad', 'esgotad', 'sem energia', 'exaust'],
    reply:
      'Esse cansaço parece estar ocupando bastante espaço. Ele tem sido mais físico, emocional ou um pouco dos dois?'
  },
  {
    keywords: ['sono', 'dormir', 'dormi', 'insonia', 'acordando'],
    reply:
      'Quando o sono não vai bem, o restante do dia costuma sentir também. O que tem dificultado mais o seu descanso?'
  },
  {
    keywords: ['trabalho', 'emprego', 'chefe', 'colega'],
    reply:
      'Parece que essa situação no trabalho ficou com você além do expediente. Qual parte dela tem sido mais difícil de carregar?'
  },
  {
    keywords: ['relacionamento', 'namoro', 'familia', 'briga', 'discussao'],
    reply:
      'Relações importantes podem mexer com muitas coisas ao mesmo tempo. O que mais te marcou nessa situação?'
  }
];

const GENERAL_REPLIES = [
  'Obrigado por dividir isso comigo. Qual parte dessa situação parece mais importante olhar primeiro?',
  'Faz sentido dar espaço para isso. O que você percebe em si quando pensa nessa situação?',
  'Podemos olhar para isso com calma. O que tem sido mais difícil neste momento?',
  'Estou acompanhando você. O que gostaria de compreender melhor sobre o que aconteceu?',
  'Parece que isso merece atenção. Como essa experiência tem aparecido no seu dia a dia?'
] as const;

const GENERAL_REPLIES_BY_LANGUAGE = {
  'pt-BR': GENERAL_REPLIES,
  'en-US': [
    'Thank you for sharing that with me. Which part of this feels most important to look at first?',
    'It makes sense to give this some space. What do you notice in yourself when you think about it?',
    'We can look at this calmly. What has felt hardest right now?',
    'I am here with you. What would you like to understand better about what happened?',
    'This sounds worth paying attention to. How has this experience been showing up in your day?'
  ],
  'es-ES': [
    'Gracias por compartir eso conmigo. ¿Qué parte de esta situación parece más importante mirar primero?',
    'Tiene sentido darle espacio a esto. ¿Qué notas en ti cuando piensas en esa situación?',
    'Podemos mirar esto con calma. ¿Qué ha sido lo más difícil en este momento?',
    'Estoy contigo. ¿Qué te gustaría comprender mejor sobre lo que pasó?',
    'Parece que esto merece atención. ¿Cómo ha aparecido esta experiencia en tu día a día?'
  ]
} as const;

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function selectGeneralReply(
  message: string,
  language: keyof typeof GENERAL_REPLIES_BY_LANGUAGE
): string {
  const hash = Array.from(message).reduce((total, character) => total + character.charCodeAt(0), 0);
  const replies = GENERAL_REPLIES_BY_LANGUAGE[language];
  return replies[hash % replies.length];
}

function normalizeResponseLanguage(language?: string): keyof typeof GENERAL_REPLIES_BY_LANGUAGE {
  if (language?.startsWith('en')) return 'en-US';
  if (language?.startsWith('es')) return 'es-ES';
  return 'pt-BR';
}

@Injectable()
export class MockChatAgent implements ChatAgent {
  respond(request: ChatAgentRequest): Promise<ChatAgentResponse> {
    const message = normalize(request.message);
    const responseLanguage = normalizeResponseLanguage(request.responseLanguage);

    const matchedRule = REPLY_RULES.find((rule) =>
      rule.keywords.some((keyword) => message.includes(keyword))
    );

    const reply = matchedRule?.reply ?? selectGeneralReply(message, responseLanguage);

    return Promise.resolve({
      reply,
      riskLevel: 'none',
      scopeStatus: 'in_scope',
      profileUpdate: { shouldUpdate: false },
      usage: estimateLlmUsageFromText(request.message, reply)
    });
  }
}
