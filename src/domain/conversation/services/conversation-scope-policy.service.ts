import { ReflectiveProfileUpdate } from '../entities/reflective-profile.entity';

export type ConversationScopeStatus = 'in_scope' | 'out_of_scope';

const OUT_OF_SCOPE_REPLY =
  'Eu não consigo ajudar com esse tipo de pedido aqui. O BBrain é voltado para apoio emocional, reflexão, rotina, sono, humor e autoconhecimento.';

export class ConversationScopePolicy {
  resolveReply(scopeStatus: ConversationScopeStatus, agentReply: string): string {
    return scopeStatus === 'out_of_scope' ? OUT_OF_SCOPE_REPLY : agentReply;
  }

  resolveProfileUpdate(
    scopeStatus: ConversationScopeStatus,
    update: ReflectiveProfileUpdate
  ): ReflectiveProfileUpdate | undefined {
    if (scopeStatus === 'in_scope') {
      return update;
    }

    if (update.boundariesToAdd?.length) {
      return { boundariesToAdd: update.boundariesToAdd };
    }

    return undefined;
  }
}
