import type { Tool } from './tools/Tool';

const MUTATION_INTENT = /\b(create|add|save|edit|update|modify|delete|remove|cancel|send|publish|schedule|reschedule|restore|write|draft|generate|complete|remind|remember|make|book|move|rename|append|record|log|mark|draw|fix|capture|crie|criar|adicione|adicionar|salve|salvar|edite|editar|atualize|atualizar|altere|alterar|mude|mudar|apague|apagar|exclua|excluir|deletar|cancele|cancelar|envie|enviar|publique|publicar|agende|agendar|reagende|reagendar|restaure|restaurar|escreva|escrever|gere|gerar|registre|registrar|conclua|concluir|marque|marcar|lembre|lembrar|planeje|planejar|faça|fazer|ajuste|ajustar|renomeie|renomear|anexe|anexar|corrija|corrigir)\b|\bplan (my|our|a|an|the|this|next|for)\b/i;
const FOLLOW_UP_APPROVAL = /^(do it|go ahead|yes,? please|yes,? do (it|that)|pode fazer|faça isso|sim,? faça|manda ver)[.!\s]*$/i;
const DELETE_INTENT = /\b(delete|remove|cancel|erase|clear|apague|apagar|exclua|excluir|deletar|remova|remover|cancele|cancelar|limpe|limpar)\b/i;
const EDIT_INTENT = /\b(edit|update|modify|change|reschedule|restore|move|rename|append|set|edite|editar|atualize|atualizar|altere|alterar|mude|mudar|reagende|reagendar|restaure|restaurar|ajuste|ajustar|renomeie|renomear|anexe|anexar|marque|marcar)\b/i;
const SEND_INTENT = /\b(send|post|envie|enviar|mande|mandar|responda|responder)\b/i;
const CREATE_INTENT = /\b(create|add|save|write|draft|generate|make|book|schedule|remind|remember|record|log|draw|capture|crie|criar|adicione|adicionar|salve|salvar|escreva|escrever|gere|gerar|faça|fazer|agende|agendar|lembre|lembrar|registre|registrar|planeje|planejar)\b|\bplan (my|our|a|an|the|this|next|for)\b/i;
const ACTION_TARGETS: Record<string, RegExp> = {
  notes: /\b(note|notes|nota|notas|anotaç[ãa]o|anotaç[õo]es)\b/i,
  calendar: /\b(calendar|event|events|meeting|meetings|agenda|evento|eventos|compromisso|compromissos|reuni[ãa]o|reuni[õo]es)\b/i,
  gmail: /\b(gmail|email|emails|e-mail|e-mails|draft|rascunho)\b/i,
  connectors: /\b(doc|docs|document|documents|documento|documentos|sheet|sheets|spreadsheet|spreadsheets|planilha|planilhas|drive)\b/i,
  goals: /\b(goal|goals|plan|plans|meta|metas|plano|planos|objetivo|objetivos)\b/i,
  reminders: /\b(reminder|reminders|lembrete|lembretes|lembrar|lembre|remind)\b/i,
  memory: /\b(memory|remember|memória|lembre|lembrar|fato|fatos)\b/i,
  images: /\b(image|images|picture|photo|imagem|imagens|foto|fotos)\b/i,
  slack: /\b(slack|thread|threads|mensagem|mensagens)\b/i,
  meetings: /\b(meeting|meetings|reuni[ãa]o|reuni[õo]es|gravaç[ãa]o|gravaç[õo]es)\b/i,
  reviews: /\b(review|reviews|revis[ãa]o|revis[õo]es)\b/i,
  finance: /\b(finance|finances|expense|expenses|spending|transaction|transactions|finanças|financeiro|gasto|gastos|despesa|despesas|transaç[ãa]o|transaç[õo]es)\b/i,
  checklists: /\b(checklist|checklists|lista|listas|item|itens)\b/i,
  people: /\b(person|people|contact|contacts|pessoa|pessoas|contato|contatos)\b/i,
};

export function isToolActionAuthorized(tool: Tool, latestUserText: string): boolean {
  if (tool.isReadOnly) return true;
  const text = latestUserText.trim();
  if (FOLLOW_UP_APPROVAL.test(text)) return true;
  const domain = tool.name.split('.')[0];
  const action = tool.name.split('.')[1];
  if (domain === 'reviews' && action.startsWith('start')) {
    return /\b(review my|review the|start .*review|revisar (minha|a) semana|revisar (meu|o) m[eê]s|iniciar .*revis[ãa]o)\b/i.test(text);
  }
  if (!MUTATION_INTENT.test(text) || !ACTION_TARGETS[domain]?.test(text)) return false;
  if (/^(delete|cancel)/.test(action)) return DELETE_INTENT.test(text);
  if (action === 'send_message') return SEND_INTENT.test(text);
  if (/^(edit|update|reschedule|restore|set_item)/.test(action)) return EDIT_INTENT.test(text);
  if (/^(create|save|record|generate)/.test(action)) return CREATE_INTENT.test(text);
  return true;
}
