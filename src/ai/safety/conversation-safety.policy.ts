import { Injectable } from '@nestjs/common';
import { ConversationOutput } from '../structured-output';
import { ConversationContext } from '../../modules/chat/conversation-context';

const selfClinicalLabel =
  /\b(?:acho|creio|acredito|penso|sinto|estou|sou|i think|i believe|i am|i'm|creo|pienso|estoy|soy).{0,64}\b(mania|man[ií]aco|man[ií]aca|manic)\b/iu;
const onlyBbrain =
  /(?:^|\s)(?:somente|apenas|s[oó]|only|solo|solamente)(?:\s|$).{0,24}(?:voc[eê]|bbrain|you|t[uú])(?:\s|[.!?,]|$)/iu;
const impulse = /\b(impuls|controle|control)\w*/iu;
const prohibited =
  /estamos sozinhos nessa|s[oó] precisa de mim|voc[eê] est[aá] em mania|you are manic|solo me necesitas|est[aá]s en man[ií]a/iu;

const replies = {
  profile: {
    'pt-BR':
      'Antes de continuarmos, vamos configurar seu perfil para que o BBrain possa acompanhar você com mais cuidado?',
    'en-US':
      'Before we continue, shall we set up your profile so BBrain can support you with more care?',
    'es-ES':
      'Antes de continuar, ¿configuramos tu perfil para que BBrain pueda acompañarte con más cuidado?'
  },
  outOfScope: {
    'pt-BR':
      'Não consigo ajudar com esse tipo de pedido aqui. O BBrain é voltado a apoio emocional, reflexão, rotina, sono, humor e autoconhecimento.',
    'en-US':
      'I cannot help with that kind of request here. BBrain focuses on emotional support, reflection, routine, sleep, mood, and self-knowledge.',
    'es-ES':
      'No puedo ayudar con ese tipo de pedido aquí. BBrain se enfoca en apoyo emocional, reflexión, rutina, sueño, estado de ánimo y autoconocimiento.'
  },
  selfLabel: {
    'pt-BR':
      'Não consigo confirmar se isso é mania. Posso considerar apenas o que você relatou, sem acrescentar sintomas, e vale buscar uma avaliação profissional se essa suspeita continuar. O que está mais difícil agora?',
    'en-US':
      'I cannot confirm whether this is mania. I can only consider what you reported without adding symptoms, and a professional assessment may help if this concern continues. What feels hardest right now?',
    'es-ES':
      'No puedo confirmar si esto es manía. Solo puedo considerar lo que relataste sin añadir síntomas, y una evaluación profesional puede ayudar si esta preocupación continúa. ¿Qué es lo más difícil ahora?'
  },
  exclusive: {
    'pt-BR':
      'Obrigado pela confiança. Não devo ser seu único apoio. Existe alguém de confiança ou um profissional com quem você possa entrar em contato hoje?',
    'en-US':
      'Thank you for trusting me. I should not be your only support. Is there someone you trust or a professional you could contact today?',
    'es-ES':
      'Gracias por confiar en mí. No debo ser tu único apoyo. ¿Hay alguien de confianza o un profesional con quien puedas contactar hoy?'
  },
  immediateSafety: {
    'pt-BR':
      'Obrigado por me contar. Não devo ser seu único apoio. Como está difícil controlar impulsos, neste momento você sente que pode agir de uma forma que coloque você ou outra pessoa em risco?',
    'en-US':
      'Thank you for telling me. I should not be your only support. Since controlling impulses feels difficult, do you feel you might act in a way that could put you or someone else at risk right now?',
    'es-ES':
      'Gracias por contármelo. No debo ser tu único apoyo. Como es difícil controlar los impulsos, ¿sientes que podrías actuar de una forma que te ponga a ti o a otra persona en riesgo ahora?'
  },
  checkInHandoff: {
    'pt-BR':
      'Obrigado por me contar. Vamos interromper o check-in por aqui. Se houver risco imediato, procure agora alguém de confiança ou o serviço de emergência da sua região. Você pode continuar no chat para receber uma orientação de segurança mais adequada.',
    'en-US':
      'Thank you for telling me. We will pause the check-in here. If there is immediate danger, contact someone you trust or your local emergency service now. You can continue in chat for more appropriate safety guidance.',
    'es-ES':
      'Gracias por contármelo. Vamos a interrumpir el check-in aquí. Si existe un riesgo inmediato, contacta ahora a alguien de confianza o al servicio de emergencias de tu zona. Puedes continuar en el chat para recibir una orientación de seguridad más adecuada.'
  },
  corrective: {
    'pt-BR':
      'Quero corrigir a direção: não posso confirmar rótulos clínicos nem acrescentar sintomas não relatados. Podemos ficar no que você percebe concretamente. O que está mais difícil agora?',
    'en-US':
      'I want to correct course: I cannot confirm clinical labels or add symptoms you did not report. We can stay with what you notice directly. What feels hardest now?',
    'es-ES':
      'Quiero corregir el rumbo: no puedo confirmar etiquetas clínicas ni añadir síntomas no relatados. Podemos centrarnos en lo que percibes directamente. ¿Qué es lo más difícil ahora?'
  }
} as const;

type Language = keyof (typeof replies)['profile'];

@Injectable()
export class ConversationSafetyPolicy {
  profileSetup(language: Language): ConversationOutput {
    return { reply: replies.profile[language], riskLevel: 'none', scopeStatus: 'in_scope' };
  }

  dailyCheckInHandoff(language: Language): string {
    return replies.checkInHandoff[language];
  }

  apply(input: {
    message: string;
    context: ConversationContext;
    language: Language;
    output: ConversationOutput;
  }): ConversationOutput {
    if (input.output.scopeStatus === 'out_of_scope') {
      return { ...input.output, reply: replies.outOfScope[input.language] };
    }
    const contextText = `${input.context.currentContext?.summary ?? ''} ${input.context.currentContext?.topics.join(' ') ?? ''}`;
    const exclusive = onlyBbrain.test(input.message);
    if (exclusive && (impulse.test(input.message) || impulse.test(contextText))) {
      return {
        reply: replies.immediateSafety[input.language],
        riskLevel: 'medium',
        scopeStatus: 'in_scope'
      };
    }
    if (exclusive) {
      return {
        reply: replies.exclusive[input.language],
        riskLevel: 'low',
        scopeStatus: 'in_scope'
      };
    }
    if (selfClinicalLabel.test(input.message)) {
      return {
        reply: replies.selfLabel[input.language],
        riskLevel: input.output.riskLevel === 'none' ? 'low' : input.output.riskLevel,
        scopeStatus: 'in_scope'
      };
    }
    if (prohibited.test(input.output.reply)) {
      return {
        reply: replies.corrective[input.language],
        riskLevel: input.output.riskLevel === 'none' ? 'low' : input.output.riskLevel,
        scopeStatus: 'in_scope'
      };
    }
    return input.output;
  }
}

export function resolveLanguage(profile?: string, accepted?: string): Language {
  const value = (profile || accepted?.split(',')[0] || 'pt-BR').toLowerCase();
  if (value.startsWith('en')) return 'en-US';
  if (value.startsWith('es')) return 'es-ES';
  return 'pt-BR';
}
