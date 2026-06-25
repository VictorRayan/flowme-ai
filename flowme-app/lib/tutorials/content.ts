export type TutorialLang = 'en' | 'pt';

export type TutorialIconId =
  | 'balys'
  | 'notes'
  | 'briefing'
  | 'connections'
  | 'goals'
  | 'calendar'
  | 'today'
  | 'gmail'
  | 'docs'
  | 'sheets'
  | 'drive'
  | 'support';

export type TutorialBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'steps'; title?: string; items: string[] }
  | { kind: 'usecase'; title: string; text: string }
  | { kind: 'tip'; text: string };

export type Tutorial = {
  slug: string;
  iconId: TutorialIconId;
  title: string;
  summary: string;
  readMinutes: number;
  blocks: TutorialBlock[];
};

export type TutorialsIntro = {
  title: string;
  subtitle: string;
  body: string;
};

const INTRO: Record<TutorialLang, TutorialsIntro> = {
  pt: {
    title: 'Tutoriais',
    subtitle: 'Aprenda a usar o Flow-me de ponta a ponta',
    body: 'Esta seção existe para você aprender a dar um boost na sua produtividade, na sua rotina e na inteligência que a IA te entrega. Cada card abre um guia passo a passo, com casos de uso reais, mostrando exatamente onde clicar e o que falar.',
  },
  en: {
    title: 'Tutorials',
    subtitle: 'Learn Flow-me end to end',
    body: 'This section exists so you can learn to boost your productivity, your routine, and the intelligence the AI gives you. Each card opens a step-by-step guide, with real use cases, showing exactly where to click and what to say.',
  },
};

const TUTORIALS: Record<TutorialLang, Tutorial[]> = {
  pt: [
    {
      slug: 'balys',
      iconId: 'balys',
      title: 'Conversando com o Balys',
      summary: 'Seu copiloto de IA: dê comandos por texto, áudio ou imagem, e peça um conselho quando precisar decidir.',
      readMinutes: 4,
      blocks: [
        { kind: 'paragraph', text: 'O Balys é o assistente de IA do Flow-me. Você fala em linguagem natural e ele age por você: cria eventos, monta metas, lê seus e-mails e documentos, busca notícias e te lembra de coisas. Não existe um botão "criar evento" escondido — você simplesmente pede.' },
        { kind: 'steps', title: 'Onde fica', items: [
          'No menu lateral à esquerda, clique em "BalysAI" (ícone de robô).',
          'A tela abre em modo de conversa, com o campo de mensagem fixo no rodapé.',
        ] },
        { kind: 'steps', title: 'Como mandar uma mensagem', items: [
          'Clique no campo de texto no rodapé (onde aparece "Pergunte ao BalysAI").',
          'Digite seu pedido em português normal, ex: "Agende um almoço com a Ana sexta às 12h".',
          'Clique no botão de enviar (ícone de avião de papel) à direita do campo, ou aperte Enter.',
        ] },
        { kind: 'steps', title: 'Áudio e imagem', items: [
          'À esquerda do botão de enviar há uma fileira de ícones.',
          'Toque no ícone de microfone para falar em vez de digitar — quando você parar, o áudio é transcrito automaticamente e vira texto na mensagem.',
          'Toque no ícone de imagem para anexar uma foto (um print, um cardápio, a foto de um documento) — o Balys consegue interpretar o que está na imagem.',
          'O ícone de clipe (anexo) serve para enviar outros arquivos.',
        ] },
        { kind: 'steps', title: 'Nova conversa e histórico', items: [
          'Para começar um assunto do zero, clique no botão "+" no topo da tela (nova conversa).',
          'Suas conversas anteriores ficam na lista lateral — no celular, abra pelo ícone de histórico no topo.',
        ] },
        { kind: 'usecase', title: 'Caso real: invocar o conselho', text: 'Quando você tem uma decisão difícil, escreva a dúvida direto no chat — ex: "Devo aceitar a proposta de emprego ou abrir meu negócio?". O Balys convoca um conselho de especialistas (advogado, contador, médico, empreendedor e outros), que debatem o seu caso e te devolvem uma recomendação ponderada. Você não precisa apertar nenhum botão especial: basta perguntar.' },
        { kind: 'tip', text: 'No chat você pode digitar /docs, /sheets, /drive ou /gmail para dizer ao Balys exatamente qual fonte conectada ele deve usar na resposta.' },
      ],
    },
    {
      slug: 'notas',
      iconId: 'notes',
      title: 'Notas: sua memória externa',
      summary: 'Guarde reflexões, problemas, informações importantes e registros sobre pessoas. Com volume, o Balys gera insights sobre o seu dia, sua semana e sua vida.',
      readMinutes: 4,
      blocks: [
        { kind: 'paragraph', text: 'As Notas servem para guardar anotações diárias, problemas, reflexões, informações importantes e registros sobre pessoas e personalidades. Quanto mais você anota, mais contexto o Balys ganha — e mais inteligente ele fica para te dar insights sobre como melhorar o seu dia, seus relacionamentos e criar planos de ação que te levam a outro nível.' },
        { kind: 'steps', title: 'Onde fica', items: [
          'No menu lateral à esquerda, clique em "Notas".',
          'A lista das suas notas aparece à esquerda; o conteúdo da nota selecionada abre à direita.',
        ] },
        { kind: 'steps', title: 'Criar uma nota', items: [
          'Clique no botão flutuante redondo com "+" no canto inferior direito da tela.',
          'Uma nota em branco abre. Escreva o título no topo (onde aparece "Sem título").',
          'Clique abaixo do título e comece a escrever — o editor aceita texto rico (negrito, listas, etc.).',
          'Não precisa salvar: a nota é salva sozinha enquanto você escreve. Se quiser forçar, use Ctrl+S ou o botão de salvar.',
        ] },
        { kind: 'steps', title: 'Mencionar pessoas e gravar áudio', items: [
          'Para citar uma pessoa, digite "@" seguido do nome — uma lista de contatos aparece para você escolher. A nota fica ligada àquela pessoa.',
          'Para ditar em vez de digitar, clique no ícone de microfone na barra do editor; fale e clique de novo para parar. O que você falou é transcrito e inserido no texto.',
        ] },
        { kind: 'usecase', title: 'Caso real: inteligência sobre pessoas', text: 'Depois de cada reunião importante, abra uma nota, digite "@" e selecione a pessoa, e registre o que foi combinado, o humor dela e os próximos passos. Com o tempo, pergunte ao Balys "o que eu sei sobre a Ana?" e ele cruza suas notas para te lembrar do histórico, sugerir como conduzir a próxima conversa e o que cobrar.' },
        { kind: 'tip', text: 'Anote também problemas e reflexões soltas. Isso vira matéria-prima para o Balys propor planos de ação concretos quando você pedir ajuda.' },
      ],
    },
    {
      slug: 'daily-briefing',
      iconId: 'briefing',
      title: 'Daily briefing: bom dia e boa noite',
      summary: 'Um resumo diário com clima, agenda, sua meta, notícias e trends — na tela e, se quiser, no WhatsApp e no navegador.',
      readMinutes: 3,
      blocks: [
        { kind: 'paragraph', text: 'O daily briefing é um resumo do seu dia. De manhã ele te prepara ("Bom dia"), à tarde recalibra ("Boa tarde") e à noite fecha o ciclo ("Boa noite"). Ele reúne clima, seus compromissos do dia, sua meta principal, notícias dos seus tópicos e o que está em alta.' },
        { kind: 'steps', title: 'Como abrir', items: [
          'No menu lateral, clique em "Hoje".',
          'No topo da página aparece um cartão de saudação ("Bom dia", "Boa tarde" ou "Boa noite", conforme o horário).',
          'Clique nesse cartão para abrir o briefing completo, que carrega as seções de clima, agenda, meta, notícias e trends.',
        ] },
        { kind: 'steps', title: 'Como configurar', items: [
          'Você definiu horários e tópicos no onboarding. Para mudar depois, vá no menu em "Configurações".',
          'Na seção de canais você ajusta os horários de manhã/tarde/noite, a cidade (para o clima) e os tópicos de notícias.',
          'Ative WhatsApp e/ou notificação no navegador para receber o briefing também fora do app.',
        ] },
        { kind: 'usecase', title: 'Caso real: importar de ChatGPT ou Claude', text: 'Peça ao ChatGPT ou Claude um resumo do seu dia com um prompt como "Resuma em tópicos meus compromissos, prioridades e reflexões de hoje". Copie a resposta, abra o Balys e cole dizendo "anota isso no meu briefing". O Balys guarda o conteúdo e passa a usá-lo para te dar insights nos próximos resumos.' },
        { kind: 'tip', text: 'Quanto mais tópicos e cidade corretos você configurar, mais útil e personalizado fica o briefing.' },
      ],
    },
    {
      slug: 'trilha',
      iconId: 'today',
      title: 'Trilha do dia (aba Hoje): completar tarefas',
      summary: 'Veja as tarefas e eventos do dia como uma trilha e marque cada um como concluído para acompanhar seu progresso.',
      readMinutes: 3,
      blocks: [
        { kind: 'paragraph', text: 'A aba "Hoje" é o seu painel diário. Logo no topo fica o cartão de briefing (bom dia / boa tarde / boa noite) e, abaixo, a trilha do dia: uma sequência visual de "bolhas", cada uma sendo uma tarefa dos seus planos e metas ou um evento do Google Calendar. É aqui que você executa o dia e marca o que concluiu.' },
        { kind: 'steps', title: 'Onde fica', items: [
          'No menu lateral à esquerda, clique em "Hoje".',
          'No topo aparece o cartão de saudação (o briefing); logo abaixo vem a trilha com as bolhas das tarefas e eventos do dia.',
          'O cabeçalho de cada dia mostra quantas você já concluiu (ex: 2/5) e a porcentagem de progresso.',
        ] },
        { kind: 'steps', title: 'Completar uma tarefa', items: [
          'Na trilha, localize a bolha da tarefa que você fez.',
          'Toque na bolha — abre um cartão com o título da tarefa e os botões de ação.',
          'Clique em "Feito". A bolha fica verde com um check e o contador do dia sobe.',
          'Marcou sem querer? Toque na bolha de novo e clique em "Desfazer" para voltar ao estado pendente.',
        ] },
        { kind: 'steps', title: 'Adiar ou pular', items: [
          'No mesmo cartão, "Amanhã" move a tarefa para o dia seguinte (vale para tarefas dos seus planos; eventos do Google Calendar não têm essa opção).',
          '"Pular" marca a tarefa como pulada quando ela não fez sentido hoje.',
        ] },
        { kind: 'usecase', title: 'Caso real: fechar o dia no verde', text: 'Toda manhã, abra a aba "Hoje", leia o briefing e percorra a trilha de cima para baixo concluindo cada bloco. As tarefas dos seus planos de ação e os eventos do Google Calendar aparecem juntos na mesma trilha. Cada "Feito" aumenta o progresso do dia — e o Balys usa esse histórico para ajustar o plano de amanhã na sua reflexão da noite.' },
        { kind: 'tip', text: 'Tarefas ligadas a um plano de ação mostram um selo com o nome do plano (e o dia, ex: "Dia 3"). Toque no selo para ir direto à meta correspondente em "Metas".' },
      ],
    },
    {
      slug: 'conexoes',
      iconId: 'connections',
      title: 'Conexões: Gmail, Docs, Sheets e Drive',
      summary: 'Ligue suas ferramentas do Google ao Balys para ele ler e agir sobre seus e-mails, documentos e planilhas.',
      readMinutes: 3,
      blocks: [
        { kind: 'paragraph', text: 'As Conexões ligam o Balys às suas ferramentas do Google. Depois de conectar, ele pode buscar e-mails, ler e criar documentos, analisar planilhas e abrir arquivos do Drive — sempre com a sua permissão.' },
        { kind: 'steps', title: 'Onde fica', items: [
          'No menu lateral, clique em "Conexões".',
          'Você verá os cards das fontes disponíveis: Gmail, Google Docs, Google Sheets e Google Drive.',
        ] },
        { kind: 'steps', title: 'Como conectar', items: [
          'Clique no botão "Adicionar conexão" no canto superior direito.',
          'No diálogo, escolha o tipo (ex: Gmail) e dê um nome para a conexão.',
          'Confirme — você será levado para a tela de permissão do Google. Autorize o acesso.',
          'Ao voltar, o card aparece como autorizado e o Balys já pode usar aquela fonte.',
        ] },
        { kind: 'usecase', title: 'Caso real: achar arquivo pelo nome', text: 'Com o Google Sheets conectado, abra o Balys e peça "Resuma minha planilha Financeiro 2026". Você não precisa colar link nenhum: o Balys encontra a planilha pelo nome, lê os dados e te devolve a resposta. O mesmo vale para "leia o contrato em PDF no meu Drive".' },
        { kind: 'tip', text: 'No chat, digite /gmail, /docs, /sheets ou /drive para forçar o Balys a usar uma fonte específica naquela pergunta.' },
      ],
    },
    {
      slug: 'gmail',
      iconId: 'gmail',
      title: 'Gmail: leitura, análise e rascunhos',
      summary: 'Peça ao Balys para encontrar e-mails, resumir threads, identificar pendências e preparar respostas com o tom certo.',
      readMinutes: 4,
      blocks: [
        { kind: 'paragraph', text: 'Com o Gmail conectado, o Balys vira uma camada inteligente sobre a sua caixa de entrada. Ele pode pesquisar mensagens, abrir threads relevantes, resumir contexto, encontrar pendências e criar rascunhos. Ele não envia e-mails automaticamente: quando houver envio ou resposta sensível, ele prepara o texto para você revisar.' },
        { kind: 'steps', title: 'Como usar no chat', items: [
          'No menu lateral, clique em "BalysAI".',
          'Você pode clicar na ação Gmail ou simplesmente pedir em linguagem natural, como "mostre meus e-mails importantes de hoje".',
          'Para aprofundar, responda na conversa: "explique melhor o e-mail do Felipe" ou "crie um rascunho de resposta educado".',
          'Se faltar destinatário, contexto, tom ou objetivo, o Balys pergunta antes de criar o rascunho.',
        ] },
        { kind: 'usecase', title: 'Caso real: triagem rápida', text: 'Peça "o que chegou de importante hoje no Gmail?". O Balys busca as mensagens recentes, lê as mais relevantes e te devolve uma lista com remetente, assunto, urgência, próximos passos e o que pode esperar.' },
        { kind: 'usecase', title: 'Caso real: rascunho de resposta', text: 'Depois de abrir uma thread, peça "responda dizendo que consigo entregar até sexta e pergunte se eles preferem call ou documento". O Balys monta o rascunho com saudação, contexto, compromisso, pergunta objetiva e assinatura.' },
        { kind: 'tip', text: 'Diga o tom desejado: "mais direto", "mais caloroso", "executivo", "em inglês", "sem parecer robótico". Isso melhora muito a qualidade do rascunho.' },
      ],
    },
    {
      slug: 'planilhas',
      iconId: 'sheets',
      title: 'Sheets: análise e manipulação de planilhas',
      summary: 'O Balys entende abas, colunas, categorias, fórmulas e layouts financeiros para analisar ou editar planilhas sem você passar IDs.',
      readMinutes: 5,
      blocks: [
        { kind: 'paragraph', text: 'A skill de planilhas foi pensada para usuários não técnicos. Você pode falar o nome natural da planilha ("Financeiro 2026"), pedir análise, criar linhas, preencher colunas, categorizar despesas, comparar abas e sugerir fórmulas. O Balys procura o arquivo internamente e entende a estrutura antes de mexer.' },
        { kind: 'steps', title: 'Pedidos que funcionam bem', items: [
          'No menu lateral, clique em "BalysAI" e peça o resultado em linguagem natural.',
          '"Adicione uma despesa de R$ 87,90 de Uber na planilha Financeiro 2026."',
          '"Analise minha aba Janeiro e me diga onde estou gastando demais."',
          '"Crie uma visão semanal das despesas por categoria."',
          '"Encontre células vazias ou fórmulas quebradas nessa planilha."',
        ] },
        { kind: 'steps', title: 'Como o Balys decide o que preencher', items: [
          'Ele lê os nomes das abas e identifica a aba mais provável.',
          'Ele mapeia cabeçalhos como data, descrição, valor, categoria, forma de pagamento, status e observações.',
          'Quando a categoria não é explícita, ele infere pelo histórico da planilha, preservando os nomes já usados.',
          'Se uma informação obrigatória faltar, ele pergunta antes de editar.',
        ] },
        { kind: 'usecase', title: 'Caso real: despesa sem fricção', text: 'Você diz "adicione R$ 120 de mercado ontem". O Balys entende que isso provavelmente é categoria "Alimentação" ou "Mercado", usa a data de ontem, encontra a próxima linha disponível e preenche as colunas corretas. Se houver duas planilhas financeiras possíveis, ele pergunta qual usar.' },
        { kind: 'tip', text: 'Não precisa dizer "coluna C" ou ID da planilha. Diga o resultado que você quer; o Balys resolve o caminho técnico por trás.' },
      ],
    },
    {
      slug: 'documentos',
      iconId: 'docs',
      title: 'Docs: atas, relatórios e documentos bonitos',
      summary: 'Crie e edite documentos estruturados com títulos, seções, bullets, decisões, acionáveis e próximos passos.',
      readMinutes: 4,
      blocks: [
        { kind: 'paragraph', text: 'Com Google Docs conectado, o Balys age como um escrivão e editor. Ele consegue criar atas, briefings, propostas, relatórios e documentos de acompanhamento com estrutura clara e formatação legível.' },
        { kind: 'steps', title: 'Exemplos de comandos', items: [
          'No menu lateral, clique em "BalysAI" para criar ou editar documentos por conversa.',
          '"Crie uma ata da reunião sobre o lançamento do produto com decisões e responsáveis."',
          '"Transforme este texto bagunçado em um relatório executivo."',
          '"Abra o documento Proposta Cliente X e deixe mais profissional."',
          '"Crie um briefing com contexto, objetivo, entregáveis, riscos e próximos passos."',
        ] },
        { kind: 'steps', title: 'O que o documento recebe', items: [
          'Título claro e subtítulo quando fizer sentido.',
          'Seções organizadas por tema.',
          'Bullets curtos, decisões separadas e acionáveis com dono e prazo.',
          'Perguntas em aberto e próximos passos ao final.',
        ] },
        { kind: 'usecase', title: 'Caso real: ata de reunião', text: 'Cole notas soltas da reunião e peça uma ata. O Balys transforma em um documento com participantes, objetivo, pauta, decisões tomadas, responsáveis, prazos, riscos e follow-up.' },
        { kind: 'tip', text: 'Se você quiser um estilo específico, peça: "mais executivo", "mais amigável", "formato board update", "em inglês" ou "com bullets curtos".' },
      ],
    },
    {
      slug: 'suporte-balys',
      iconId: 'support',
      title: 'Suporte com Balys',
      summary: 'Use o suporte para dúvidas, problemas de pagamento, conectores e cancelamento guiado sem perder contexto.',
      readMinutes: 3,
      blocks: [
        { kind: 'paragraph', text: 'A tela de Suporte conversa com o Balys sobre a própria plataforma. Ela entende perguntas livres, categoriza o tema e responde com próximos passos. Cancelamento não fica exposto em Configurações: ele entra pelo funil de suporte, para entender o motivo e oferecer ajuda antes de concluir.' },
        { kind: 'steps', title: 'Como pedir ajuda', items: [
          'No menu lateral, clique em "Suporte".',
          'Escolha um tópico rápido ou escreva livremente no campo "Como podemos ajudar?".',
          'Explique o que aconteceu: pagamento, conector, tutorial, assinatura, erro ou dúvida de uso.',
          'O Balys classifica o caso e responde com orientação prática.',
        ] },
        { kind: 'usecase', title: 'Caso real: conector sem autenticação', text: 'Se você pedir algo de Sheets, Docs, Drive ou Gmail sem conexão ativa, o chat mostra um cartão com o ícone da ferramenta e um botão para conectar. Depois de voltar do Google, você continua no mesmo fluxo sempre que possível.' },
        { kind: 'tip', text: 'Para assinatura e cancelamento, escreva o motivo real. O funil ajuda a diferenciar problema técnico, cobrança, dúvida de uso e pedido definitivo.' },
      ],
    },
    {
      slug: 'metas',
      iconId: 'goals',
      title: 'Metas e planos de ação',
      summary: 'Transforme grandes objetivos em rotina: metas anuais, planos de ação e eventos agendados na sua trilha.',
      readMinutes: 3,
      blocks: [
        { kind: 'paragraph', text: 'No Flow-me, tudo o que importa vira evento na sua agenda. Uma meta anual gera marcos e uma rotina semanal; um plano de ação de curto prazo gera tarefas com data. Tudo aparece como eventos na sua trilha, com ou sem recorrência.' },
        { kind: 'steps', title: 'Onde fica', items: [
          'No menu lateral, clique em "Metas".',
          'A página mostra suas metas, os planos de ação e os eventos ligados a eles.',
        ] },
        { kind: 'steps', title: 'Como criar', items: [
          'Na página de Metas, clique no botão que abre o Balys (no topo direito).',
          'Descreva seu objetivo, ex: "Quero faturar R$ 10k por mês até dezembro".',
          'O Balys te ajuda a estruturar a meta, definir a rotina semanal e agenda os blocos no seu calendário automaticamente.',
          'Para um sprint curto, peça algo como "monte um plano de 21 dias para lançar meu produto".',
        ] },
        { kind: 'usecase', title: 'Caso real: remanejar a rotina', text: 'Se a vida mudou, abra o Balys e diga "passa meus treinos da meta de corrida para 6h da manhã, de segunda a sexta". Ele remaneja os eventos no Google Calendar respeitando recorrência e horário. Você também pode pedir para restaurar eventos deletados ou apagar um plano inteiro.' },
        { kind: 'tip', text: 'Acompanhe o progresso na tela "Hoje", onde as tarefas dos seus objetivos aparecem junto com seus compromissos.' },
      ],
    },
    {
      slug: 'calendario',
      iconId: 'calendar',
      title: 'Calendário: criar e remanejar eventos',
      summary: 'Sincronize o Google Calendar e deixe o Balys criar, mover e apagar eventos por você.',
      readMinutes: 3,
      blocks: [
        { kind: 'paragraph', text: 'O Calendário mostra seus compromissos sincronizados com o Google Calendar e os eventos criados a partir das suas metas e planos. A forma mais rápida de mexer na agenda é pedindo ao Balys.' },
        { kind: 'steps', title: 'Onde fica', items: [
          'No menu lateral, clique em "Calendário" para ver a grade de eventos.',
          'Para vincular uma conta Google e sincronizar, vá em "Configurações" › Calendários vinculados e conecte sua conta.',
        ] },
        { kind: 'steps', title: 'Criar e remanejar pelo Balys', items: [
          'Abra o Balys no menu "BalysAI".',
          'Para criar: "Marca uma call de 30 min com o time amanhã às 15h".',
          'Para remanejar: "Adia minha reunião de quinta para sexta no mesmo horário".',
          'Para apagar: "Cancela o evento de academia de sábado".',
        ] },
        { kind: 'usecase', title: 'Caso real: convidados e Google Meet', text: 'Peça "agenda um alinhamento com a Ana e o Bob na terça às 10h com link do Meet". O Balys resolve os e-mails da Ana e do Bob pelos seus contatos, cria o evento no Google Calendar, adiciona os convidados e o link do Google Meet.' },
        { kind: 'tip', text: 'Se um evento foi apagado e você não lembra, pergunte ao Balys: ele sabe quais eventos existiam, quando foram deletados, e consegue restaurá-los.' },
      ],
    },
  ],
  en: [
    {
      slug: 'balys',
      iconId: 'balys',
      title: 'Talking to Balys',
      summary: 'Your AI copilot: give commands by text, voice or image, and ask for advice when you need to decide.',
      readMinutes: 4,
      blocks: [
        { kind: 'paragraph', text: 'Balys is Flow-me\'s AI assistant. You speak in plain language and he acts for you: creates events, builds goals, reads your emails and documents, searches the news, and reminds you of things. There is no hidden "create event" button — you simply ask.' },
        { kind: 'steps', title: 'Where it is', items: [
          'In the left side menu, click "BalysAI" (the robot icon).',
          'The screen opens in chat mode, with the message field pinned to the bottom.',
        ] },
        { kind: 'steps', title: 'Sending a message', items: [
          'Click the text field at the bottom (where it says "Message BalysAI").',
          'Type your request in plain English, e.g. "Schedule lunch with Anna Friday at 12pm".',
          'Click the send button (paper-plane icon) to the right of the field, or press Enter.',
        ] },
        { kind: 'steps', title: 'Voice and image', items: [
          'To the left of the send button there is a row of icons.',
          'Tap the microphone icon to speak instead of type — when you stop, the audio is transcribed automatically into text.',
          'Tap the image icon to attach a photo (a screenshot, a menu, a picture of a document) — Balys can read what is in the image.',
          'The paperclip icon attaches other files.',
        ] },
        { kind: 'steps', title: 'New chat and history', items: [
          'To start a fresh topic, click the "+" button at the top of the screen (new chat).',
          'Your past conversations live in the side list — on mobile, open it with the history icon at the top.',
        ] },
        { kind: 'usecase', title: 'Real case: convene the council', text: 'When you have a hard decision, type the dilemma right in the chat — e.g. "Should I take the job offer or start my own business?". Balys convenes a council of specialists (lawyer, accountant, doctor, entrepreneur and others) who debate your case and return a weighed recommendation. No special button needed: just ask.' },
        { kind: 'tip', text: 'In chat you can type /docs, /sheets, /drive or /gmail to tell Balys exactly which connected source to use in the answer.' },
      ],
    },
    {
      slug: 'notas',
      iconId: 'notes',
      title: 'Notes: your external memory',
      summary: 'Capture reflections, problems, important info and records about people. With volume, Balys generates insights about your day, week and life.',
      readMinutes: 4,
      blocks: [
        { kind: 'paragraph', text: 'Notes are for daily notes, problems, reflections, important info, and records about people and personalities. The more you write, the more context Balys gains — and the smarter he gets at giving you insights on how to improve your day, your relationships, and build action plans that take you to the next level.' },
        { kind: 'steps', title: 'Where it is', items: [
          'In the left side menu, click "Notes".',
          'Your notes list shows on the left; the selected note opens on the right.',
        ] },
        { kind: 'steps', title: 'Create a note', items: [
          'Click the round floating "+" button in the bottom-right corner of the screen.',
          'A blank note opens. Type the title at the top (where it says "Untitled").',
          'Click below the title and start writing — the editor supports rich text (bold, lists, etc.).',
          'No need to save: the note saves itself as you write. To force it, use Ctrl+S or the save button.',
        ] },
        { kind: 'steps', title: 'Mention people and record audio', items: [
          'To reference a person, type "@" followed by the name — a contact list appears to pick from. The note gets linked to that person.',
          'To dictate instead of typing, click the microphone icon in the editor toolbar; speak, then click again to stop. What you said is transcribed into the text.',
        ] },
        { kind: 'usecase', title: 'Real case: intelligence about people', text: 'After each important meeting, open a note, type "@" and pick the person, and record what was agreed, their mood, and next steps. Over time, ask Balys "what do I know about Anna?" and he cross-references your notes to remind you of the history, suggest how to run the next conversation, and what to follow up on.' },
        { kind: 'tip', text: 'Also jot down loose problems and reflections. That becomes raw material for Balys to propose concrete action plans when you ask for help.' },
      ],
    },
    {
      slug: 'daily-briefing',
      iconId: 'briefing',
      title: 'Daily briefing: good morning and good evening',
      summary: 'A daily recap with weather, schedule, your goal, news and trends — on screen and, if you want, on WhatsApp and the browser.',
      readMinutes: 3,
      blocks: [
        { kind: 'paragraph', text: 'The daily briefing is a recap of your day. In the morning it preps you ("Good morning"), midday it recalibrates ("Good afternoon"), and at night it closes the loop ("Good evening"). It pulls together weather, your day\'s commitments, your main goal, news on your topics, and what is trending.' },
        { kind: 'steps', title: 'How to open it', items: [
          'In the side menu, click "Today".',
          'At the top of the page there is a greeting card ("Good morning", "Good afternoon" or "Good evening", depending on the time).',
          'Click that card to open the full briefing, which loads the weather, schedule, goal, news and trends sections.',
        ] },
        { kind: 'steps', title: 'How to configure it', items: [
          'You set times and topics during onboarding. To change them later, go to "Settings" in the menu.',
          'In the channels section you adjust the morning/afternoon/evening times, the city (for weather), and your news topics.',
          'Enable WhatsApp and/or browser notifications to also receive the briefing outside the app.',
        ] },
        { kind: 'usecase', title: 'Real case: import from ChatGPT or Claude', text: 'Ask ChatGPT or Claude for a recap of your day with a prompt like "Summarize my commitments, priorities and reflections for today in bullet points". Copy the answer, open Balys and paste it saying "save this to my briefing". Balys keeps the content and uses it to give you insights in future recaps.' },
        { kind: 'tip', text: 'The more accurate your topics and city, the more useful and personalized the briefing becomes.' },
      ],
    },
    {
      slug: 'trilha',
      iconId: 'today',
      title: 'Your daily track (Today tab): completing tasks',
      summary: 'See the day\'s tasks and events as a track and check each one off to keep your progress moving.',
      readMinutes: 3,
      blocks: [
        { kind: 'paragraph', text: 'The "Today" tab is your daily dashboard. At the very top sits the briefing card (good morning / afternoon / evening) and, below it, the day\'s track: a visual sequence of "bubbles", each one a task from your plans and goals or a Google Calendar event. This is where you run your day and mark what you\'ve done.' },
        { kind: 'steps', title: 'Where it is', items: [
          'In the left side menu, click "Today".',
          'The greeting card (the briefing) is at the top; right below it is the track with the day\'s task and event bubbles.',
          'Each day header shows how many you have completed (e.g. 2/5) and the progress percentage.',
        ] },
        { kind: 'steps', title: 'Completing a task', items: [
          'On the track, find the bubble for the task you did.',
          'Tap the bubble — a card opens with the task title and action buttons.',
          'Click "Done". The bubble turns green with a check and the day\'s counter goes up.',
          'Marked it by mistake? Tap the bubble again and click "Undo" to return it to pending.',
        ] },
        { kind: 'steps', title: 'Defer or skip', items: [
          'In the same card, "Tomorrow" moves the task to the next day (works for your plan tasks; Google Calendar events do not have this option).',
          '"Skip" marks the task as skipped when it did not make sense today.',
        ] },
        { kind: 'usecase', title: 'Real case: end the day in the green', text: 'Every morning, open the "Today" tab, read the briefing, and work down the track checking off each block. Your action-plan tasks and Google Calendar events show up together on the same track. Every "Done" raises the day\'s progress — and Balys uses that history to adjust tomorrow\'s plan during your evening reflection.' },
        { kind: 'tip', text: 'Tasks tied to an action plan show a badge with the plan name (and the day, e.g. "Day 3"). Tap the badge to jump straight to that goal under "Goals".' },
      ],
    },
    {
      slug: 'conexoes',
      iconId: 'connections',
      title: 'Connections: Gmail, Docs, Sheets and Drive',
      summary: 'Link your Google tools to Balys so he can read and act on your emails, documents and spreadsheets.',
      readMinutes: 3,
      blocks: [
        { kind: 'paragraph', text: 'Connections link Balys to your Google tools. Once connected, he can search emails, read and create documents, analyze spreadsheets, and open Drive files — always with your permission.' },
        { kind: 'steps', title: 'Where it is', items: [
          'In the side menu, click "Connectors".',
          'You will see cards for the available sources: Gmail, Google Docs, Google Sheets and Google Drive.',
        ] },
        { kind: 'steps', title: 'How to connect', items: [
          'Click the "Add connector" button in the top-right corner.',
          'In the dialog, pick the type (e.g. Gmail) and give the connection a name.',
          'Confirm — you will be taken to the Google permission screen. Authorize access.',
          'Back in the app, the card shows as authorized and Balys can use that source.',
        ] },
        { kind: 'usecase', title: 'Real case: find a file by name', text: 'With Google Sheets connected, open Balys and ask "Summarize my Finance 2026 sheet". You do not paste any link: Balys finds the sheet by name, reads the data, and returns the answer. The same works for "read the contract PDF in my Drive".' },
        { kind: 'tip', text: 'In chat, type /gmail, /docs, /sheets or /drive to force Balys to use a specific source for that question.' },
      ],
    },
    {
      slug: 'gmail',
      iconId: 'gmail',
      title: 'Gmail: reading, analysis and drafts',
      summary: 'Ask Balys to find emails, summarize threads, detect follow-ups and prepare replies in the right tone.',
      readMinutes: 4,
      blocks: [
        { kind: 'paragraph', text: 'With Gmail connected, Balys becomes an intelligent layer over your inbox. He can search messages, open relevant threads, summarize context, detect pending actions and create drafts. He does not send emails automatically: for sensitive replies, he prepares the text for your review.' },
        { kind: 'steps', title: 'How to use it in chat', items: [
          'In the side menu, click "BalysAI".',
          'Click the Gmail action or simply ask in natural language, such as "show me my important emails today".',
          'To go deeper, reply in the same conversation: "tell me more about Felipe\'s email" or "draft a polite response".',
          'If recipient, context, tone or goal is missing, Balys asks before creating the draft.',
        ] },
        { kind: 'usecase', title: 'Real case: fast inbox triage', text: 'Ask "what important emails arrived today?". Balys searches recent messages, reads the relevant ones, and returns sender, subject, urgency, next step and what can wait.' },
        { kind: 'usecase', title: 'Real case: reply draft', text: 'After opening a thread, ask "reply saying I can deliver by Friday and ask whether they prefer a call or a document". Balys drafts a complete response with greeting, context, commitment, clear ask and sign-off.' },
        { kind: 'tip', text: 'State the tone: "more direct", "warmer", "executive", "in Portuguese", or "less robotic". It makes drafts much better.' },
      ],
    },
    {
      slug: 'planilhas',
      iconId: 'sheets',
      title: 'Sheets: spreadsheet analysis and editing',
      summary: 'Balys understands tabs, columns, categories, formulas and financial layouts to analyze or edit sheets without asking you for IDs.',
      readMinutes: 5,
      blocks: [
        { kind: 'paragraph', text: 'The Sheets skill is built for non-technical users. You can say the natural spreadsheet name ("Finance 2026"), ask for analysis, add rows, fill columns, categorize expenses, compare tabs and suggest formulas. Balys finds the file internally and understands the structure before editing.' },
        { kind: 'steps', title: 'Requests that work well', items: [
          'In the side menu, click "BalysAI" and ask for the outcome in natural language.',
          '"Add a $87.90 Uber expense to my Finance 2026 spreadsheet."',
          '"Analyze my January tab and tell me where I am overspending."',
          '"Create a weekly view of expenses by category."',
          '"Find empty cells or broken formulas in this spreadsheet."',
        ] },
        { kind: 'steps', title: 'How Balys decides what to fill', items: [
          'He reads tab names and identifies the most likely target tab.',
          'He maps headers such as date, description, amount, category, payment method, status and notes.',
          'When the category is not explicit, he infers it from the sheet history while preserving existing category names.',
          'If required information is missing, he asks before editing.',
        ] },
        { kind: 'usecase', title: 'Real case: expense capture without friction', text: 'Say "add $120 of groceries yesterday". Balys understands the likely category, uses yesterday\'s date, finds the next available row and fills the correct columns. If there are two possible finance spreadsheets, he asks which one to use.' },
        { kind: 'tip', text: 'You do not need to say "column C" or paste a spreadsheet ID. Say the outcome you want; Balys handles the technical path.' },
      ],
    },
    {
      slug: 'documentos',
      iconId: 'docs',
      title: 'Docs: minutes, reports and polished documents',
      summary: 'Create and edit structured documents with headings, sections, bullets, decisions, action items and next steps.',
      readMinutes: 4,
      blocks: [
        { kind: 'paragraph', text: 'With Google Docs connected, Balys acts like a scribe and editor. He can create meeting minutes, briefings, proposals, reports and follow-up documents with clear structure and readable formatting.' },
        { kind: 'steps', title: 'Example commands', items: [
          'In the side menu, click "BalysAI" to create or edit documents through conversation.',
          '"Create meeting minutes for the product launch meeting with decisions and owners."',
          '"Turn this messy text into an executive report."',
          '"Open the Client X proposal and make it more professional."',
          '"Create a briefing with context, objective, deliverables, risks and next steps."',
        ] },
        { kind: 'steps', title: 'What the document includes', items: [
          'Clear title and subtitle when useful.',
          'Sections organized by theme.',
          'Short bullets, separate decisions and action items with owner and deadline.',
          'Open questions and next steps at the end.',
        ] },
        { kind: 'usecase', title: 'Real case: meeting minutes', text: 'Paste messy meeting notes and ask for minutes. Balys turns them into a document with participants, objective, agenda, decisions, owners, deadlines, risks and follow-up.' },
        { kind: 'tip', text: 'If you want a specific style, say it: "more executive", "friendlier", "board update format", "in Portuguese" or "short bullets".' },
      ],
    },
    {
      slug: 'suporte-balys',
      iconId: 'support',
      title: 'Support with Balys',
      summary: 'Use support for questions, payment issues, connectors and guided cancellation without losing context.',
      readMinutes: 3,
      blocks: [
        { kind: 'paragraph', text: 'The Support screen talks with Balys about the platform itself. It understands free-form questions, categorizes the topic and answers with practical next steps. Cancellation is not exposed directly in Settings: it goes through the support funnel, so the app can understand the reason and offer help before final confirmation.' },
        { kind: 'steps', title: 'How to ask for help', items: [
          'In the side menu, click "Support".',
          'Choose a quick topic or write freely in the "How can we help?" field.',
          'Explain what happened: payment, connector, tutorial, subscription, error or product question.',
          'Balys classifies the case and responds with practical guidance.',
        ] },
        { kind: 'usecase', title: 'Real case: connector not authenticated', text: 'If you ask for Sheets, Docs, Drive or Gmail without an active connection, the chat shows a card with the tool icon and a button to connect. After returning from Google, you continue the same flow whenever possible.' },
        { kind: 'tip', text: 'For subscription and cancellation, write the real reason. The funnel separates technical issues, billing questions, usage confusion and definitive cancellation requests.' },
      ],
    },
    {
      slug: 'metas',
      iconId: 'goals',
      title: 'Goals and action plans',
      summary: 'Turn big objectives into routine: yearly goals, action plans, and events scheduled on your track.',
      readMinutes: 3,
      blocks: [
        { kind: 'paragraph', text: 'In Flow-me, everything that matters becomes an event on your calendar. A yearly goal generates milestones and a weekly routine; a short-term action plan generates dated tasks. It all shows up as events on your track, with or without recurrence.' },
        { kind: 'steps', title: 'Where it is', items: [
          'In the side menu, click "Goals".',
          'The page shows your goals, action plans, and the events tied to them.',
        ] },
        { kind: 'steps', title: 'How to create one', items: [
          'On the Goals page, click the button that opens Balys (top-right).',
          'Describe your objective, e.g. "I want to make $10k per month by December".',
          'Balys helps you structure the goal, set the weekly routine, and books the time blocks on your calendar automatically.',
          'For a short sprint, ask something like "build me a 21-day plan to launch my product".',
        ] },
        { kind: 'usecase', title: 'Real case: reshuffle the routine', text: 'If life changed, open Balys and say "move my running-goal workouts to 6am, Monday to Friday". He reschedules the Google Calendar events respecting recurrence and time. You can also ask him to restore deleted events or delete a whole plan.' },
        { kind: 'tip', text: 'Track progress on the "Today" screen, where your goal tasks appear alongside your commitments.' },
      ],
    },
    {
      slug: 'calendario',
      iconId: 'calendar',
      title: 'Calendar: create and reschedule events',
      summary: 'Sync Google Calendar and let Balys create, move and delete events for you.',
      readMinutes: 3,
      blocks: [
        { kind: 'paragraph', text: 'The Calendar shows your commitments synced with Google Calendar plus the events created from your goals and plans. The fastest way to change your schedule is to ask Balys.' },
        { kind: 'steps', title: 'Where it is', items: [
          'In the side menu, click "Calendar" to see the event grid.',
          'To link a Google account and sync, go to "Settings" › Linked calendars and connect your account.',
        ] },
        { kind: 'steps', title: 'Create and reschedule via Balys', items: [
          'Open Balys from the "BalysAI" menu.',
          'To create: "Set a 30-min call with the team tomorrow at 3pm".',
          'To reschedule: "Move my Thursday meeting to Friday at the same time".',
          'To delete: "Cancel Saturday\'s gym event".',
        ] },
        { kind: 'usecase', title: 'Real case: guests and Google Meet', text: 'Ask "schedule a sync with Anna and Bob Tuesday at 10am with a Meet link". Balys resolves Anna\'s and Bob\'s emails from your contacts, creates the Google Calendar event, adds the guests and the Google Meet link.' },
        { kind: 'tip', text: 'If an event was deleted and you do not remember, ask Balys: he knows which events existed, when they were deleted, and can restore them.' },
      ],
    },
  ],
};

export function getTutorialsIntro(lang: TutorialLang): TutorialsIntro {
  return INTRO[lang];
}

export function getTutorials(lang: TutorialLang): Tutorial[] {
  return TUTORIALS[lang];
}

export function getTutorial(lang: TutorialLang, slug: string): Tutorial | undefined {
  return TUTORIALS[lang].find((t) => t.slug === slug);
}

export function getTutorialSlugs(): string[] {
  return TUTORIALS.en.map((t) => t.slug);
}
