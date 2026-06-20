import { Injectable } from '@nestjs/common';
import {
  ChatAgent,
  ChatAgentRequest,
  ChatAgentResponse
} from '../../use-cases/conversation/chat-agent.port';

interface MockReplyRule {
  keywords: readonly string[];
  reply: string;
}

const HIGH_RISK_KEYWORDS = [
  'suicid',
  'me matar',
  'tirar minha vida',
  'nao quero viver',
  'nao aguento mais viver',
  'me machucar'
] as const;

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

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function selectGeneralReply(message: string): string {
  const hash = Array.from(message).reduce((total, character) => total + character.charCodeAt(0), 0);
  return GENERAL_REPLIES[hash % GENERAL_REPLIES.length];
}

@Injectable()
export class MockChatAgent implements ChatAgent {
  respond(request: ChatAgentRequest): Promise<ChatAgentResponse> {
    const message = normalize(request.message);

    if (HIGH_RISK_KEYWORDS.some((keyword) => message.includes(keyword))) {
      return Promise.resolve({
        reply:
          'Sinto muito que você esteja passando por isso. Procure agora uma pessoa de confiança e não fique sozinho. Se houver risco imediato, vá para um lugar seguro e contate o serviço de emergência da sua região.',
        riskLevel: 'high',
        scopeStatus: 'in_scope',
        profileUpdate: { shouldUpdate: false }
      });
    }

    const matchedRule = REPLY_RULES.find((rule) =>
      rule.keywords.some((keyword) => message.includes(keyword))
    );

    return Promise.resolve({
      reply: matchedRule?.reply ?? selectGeneralReply(message),
      riskLevel: 'none',
      scopeStatus: 'in_scope',
      profileUpdate: { shouldUpdate: false }
    });
  }
}
