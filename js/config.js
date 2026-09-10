window.FINCK_CONFIG = {
  SUPABASE_URL: "https://iruqoghylxgopbopxjbi.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_zn_jngIj2xibO_VpzOi0Wg_gGG7Z8eS",
  BUSCA_IA: {
    ATIVA: true,
    // Caminho relativo funciona quando o site é servido pela mesma Vercel que
    // hospeda a função. Em outra hospedagem, troque pela URL completa —
    // por exemplo "https://finck-app.vercel.app/api/buscar-preco-ia".
    ENDPOINT: "/api/buscar-preco-ia"
  },
  APP_NOME: "FinCK of Reality",
  APP_NOME_CURTO: "FinCK",
  EMPRESA: "Conscious Knowledge",
  MOEDA: "BRL",
  LOCALE: "pt-BR",
  PADRAO: {
    work_days_month: 22,
    work_hours_day: 8,
    income_type: "fixa",
    payday: 5
  },
  CATEGORIAS: [ "Alimentação", "Transporte", "Moradia", "Lazer", "Vestuário", "Eletrônicos", "Saúde", "Educação", "Outros" ],
  INSTITUICOES: [ {
    id: "inter",
    nome: "Banco Inter",
    curto: "Inter",
    cor: "#ea7100",
    logo: "assets/bancos/inter.svg"
  }, {
    id: "nubank",
    nome: "Nubank",
    curto: "Nubank",
    cor: "#820ad1",
    logo: "assets/bancos/nubank.svg"
  }, {
    id: "itau",
    nome: "Itaú Unibanco",
    curto: "Itaú",
    cor: "#ff6200",
    logo: "assets/bancos/itau.svg"
  }, {
    id: "bradesco",
    nome: "Bradesco",
    curto: "Bradesco",
    cor: "#e5173f",
    logo: "assets/bancos/bradesco.svg"
  }, {
    id: "bb",
    nome: "Banco do Brasil",
    curto: "BB",
    cor: "#fde100",
    logo: "assets/bancos/banco-do-brasil.svg"
  }, {
    id: "caixa",
    nome: "Caixa Econômica Federal",
    curto: "Caixa",
    cor: "#0066b3",
    logo: "assets/bancos/caixa.svg"
  }, {
    id: "banrisul",
    nome: "Banrisul",
    curto: "Banrisul",
    cor: "#0788fe",
    logo: "assets/bancos/banrisul.svg"
  }, {
    id: "santander",
    nome: "Santander",
    curto: "Santander",
    cor: "#ec0000",
    logo: null
  }, {
    id: "carteira",
    nome: "Dinheiro em espécie",
    curto: "Carteira",
    cor: "#1fd18f",
    logo: null
  }, {
    id: "outro",
    nome: "Outro banco ou instituição",
    curto: "Outro",
    cor: "#9333c4",
    logo: null
  } ],
  TIPOS_CONTA: [ {
    id: "corrente",
    rotulo: "Conta corrente"
  }, {
    id: "poupanca",
    rotulo: "Poupança"
  }, {
    id: "digital",
    rotulo: "Conta digital"
  }, {
    id: "carteira",
    rotulo: "Carteira / dinheiro"
  }, {
    id: "investimento",
    rotulo: "Investimento (manual)"
  } ],
  DECISOES: [ {
    id: "comprar",
    label: "Comprar agora",
    xp: 5,
    consciente: false
  }, {
    id: "adiar",
    label: "Adiar a compra",
    xp: 25,
    consciente: true
  }, {
    id: "alternativa",
    label: "Pesquisar alternativa",
    xp: 20,
    consciente: true
  }, {
    id: "usado",
    label: "Comprar usado",
    xp: 30,
    consciente: true
  }, {
    id: "reparar",
    label: "Reparar o item atual",
    xp: 35,
    consciente: true
  }, {
    id: "desistir",
    label: "Desistir da compra",
    xp: 40,
    consciente: true
  } ],
  HIPOTESES_ALTERNATIVAS: {
    usado: {
      rotulo: "Comprar usado ou recondicionado",
      referencia: .4,
      min: .3,
      max: .5,
      texto: "Hipótese de design do projeto: itens de segunda mão costumam custar entre 30% e 50% menos. Não é dado científico — varia por produto, estado e região. Confirme com o preço real."
    },
    reparar: {
      rotulo: "Reparar ou reaproveitar o que você já tem",
      referencia: .8,
      min: .6,
      max: .9,
      texto: "Hipótese de design do projeto: um reparo costuma custar uma fração do item novo e prolonga a vida útil. O valor real depende da peça e da mão de obra."
    },
    compartilhar: {
      rotulo: "Alugar, emprestar ou compartilhar",
      referencia: .7,
      min: .5,
      max: .85,
      texto: "Hipótese de design do projeto para itens de uso pouco frequente. O custo do aluguel varia bastante e pode não compensar em uso diário."
    }
  },
  PESOS_RESPONSABILIDADE: {
    necessidade: {
      "Preciso agora": 2,
      "Posso esperar": 1,
      "É impulso": 0
    },
    uso: {
      "Uso diário": 2,
      "Uso ocasional": 1,
      "Uso raro": 0
    },
    durabilidade: {
      "Alta, com garantia": 2,
      "Média": 1,
      "Baixa ou descartável": 0
    },
    alternativas: {
      "Existe opção usada": 2,
      "Posso emprestar/alugar": 2,
      "Não há alternativa": 0
    },
    orcamento: {
      "Não compromete nada": 2,
      "Aperta um pouco": 1,
      "Compromete o essencial": 0
    },
    descarte: {
      "Uso por muitos anos": 2,
      "Doo ou revendo depois": 1,
      "Vai virar descarte rápido": 0
    }
  },
  ALERTAS_RESPONSABILIDADE: {
    necessidade: "Você marcou que a compra é um impulso. A regra dos 30 dias costuma separar necessidade real de vontade momentânea.",
    uso: "Você marcou uso raro. Alugar, emprestar ou dividir com alguém costuma resolver o mesmo problema sem um item novo.",
    durabilidade: "Você marcou baixa durabilidade. Considere reparar o que já tem ou comprar usado antes de concluir.",
    alternativas: "Você marcou que não há alternativa de uso, aluguel ou reaproveitamento. Vale checar de novo antes de comprar novo.",
    orcamento: "Você marcou que a compra compromete o essencial. O impacto aqui é financeiro antes de ser ambiental.",
    descarte: "Você marcou que o item vira descarte rápido. Um produto de vida curta tende a ser refeito, transportado e descartado mais vezes."
  },
  DESTINOS_ITEM: [ {
    id: "doar_revender",
    rotulo: "Doar ou revender"
  }, {
    id: "reciclar",
    rotulo: "Levar para reciclagem/descarte correto"
  }, {
    id: "guardar",
    rotulo: "Guardar mesmo sem usar"
  }, {
    id: "descartar",
    rotulo: "Jogar fora"
  }, {
    id: "nao_sei",
    rotulo: "Ainda não sei"
  } ],
  TIPOS_ACAO_LOCAL: [ {
    id: "reparo",
    rotulo: "Conserta / repara",
    icone: "🔧"
  }, {
    id: "usado",
    rotulo: "Vende usado",
    icone: "🏷️"
  }, {
    id: "troca",
    rotulo: "Troca ou empresta",
    icone: "🔁"
  }, {
    id: "aluguel",
    rotulo: "Aluga",
    icone: "📅"
  }, {
    id: "doacao",
    rotulo: "Recebe doação",
    icone: "🎁"
  }, {
    id: "descarte",
    rotulo: "Descarte correto",
    icone: "♻️"
  } ],
  ACOMPANHAMENTO: [ {
    id: "mantive",
    label: "Mantive a decisão",
    confirma: true
  }, {
    id: "resolvi_reparo_reuso",
    label: "Resolvi com reparo ou reuso",
    confirma: true
  }, {
    id: "comprei_depois",
    label: "Comprei depois",
    confirma: false
  }, {
    id: "nao_sei",
    label: "Ainda não sei",
    confirma: false
  } ],
  REFLEXOES: [ {
    id: "necessidade",
    dimensao: "Necessidade",
    pergunta: "Eu preciso deste produto agora ou estou respondendo a um impulso?"
  }, {
    id: "uso",
    dimensao: "Uso",
    pergunta: "Com que frequência pretendo usar o item?"
  }, {
    id: "durabilidade",
    dimensao: "Durabilidade",
    pergunta: "O produto tem qualidade, garantia ou possibilidade de reparo?"
  }, {
    id: "alternativas",
    dimensao: "Alternativas",
    pergunta: "Existe uma opção usada, compartilhada, alugada ou reaproveitada?"
  }, {
    id: "orcamento",
    dimensao: "Orçamento",
    pergunta: "A compra compromete despesas essenciais ou uma meta importante?"
  }, {
    id: "descarte",
    dimensao: "Descarte",
    pergunta: "Como o item será mantido, reutilizado ou descartado quando não servir mais?"
  } ],
  NIVEIS: [ {
    level: 1,
    titulo: "CK Newbie",
    xp: 0,
    icone: "🆕",
    lema: "Todo mundo começa aqui: a primeira pergunta antes da primeira compra."
  }, {
    level: 2,
    titulo: "Conscious Planner",
    xp: 100,
    icone: "📝",
    lema: "Já não gasta no escuro — agora existe um plano."
  }, {
    level: 3,
    titulo: "Financial Thinker",
    xp: 300,
    icone: "💡",
    lema: "O preço virou pergunta, não resposta pronta."
  }, {
    level: 4,
    titulo: "Stark's Investor",
    xp: 600,
    icone: "🚀",
    lema: "Aprendeu que dinheiro parado também é uma decisão."
  }, {
    level: 5,
    titulo: "Economy \"Knowledgist\"",
    xp: 1e3,
    icone: "📚",
    lema: "Lê os próprios números sem precisar de tradutor."
  }, {
    level: 6,
    titulo: "Norman Osborn",
    xp: 1500,
    icone: "🕷️",
    lema: "Conhece o próprio impulso — e sabe quando ele fala mais alto."
  }, {
    level: 7,
    titulo: "Golden Seeker",
    xp: 2100,
    icone: "🏆",
    lema: "Persegue meta com método, não com sorte."
  }, {
    level: 8,
    titulo: "Fisk's Counter",
    xp: 2800,
    icone: "⚖️",
    lema: "Equilibra desejo e orçamento sem se enganar na conta."
  }, {
    level: 9,
    titulo: "Fantastic Richards",
    xp: 3600,
    icone: "🔬",
    lema: "Analisa cada compra antes de assinar embaixo."
  }, {
    level: 10,
    titulo: "The Miner",
    xp: 4500,
    icone: "⛏️",
    lema: "Sabe quantas horas de trabalho cabem em cada preço."
  }, {
    level: 11,
    titulo: "The Philanthropist",
    xp: 5500,
    icone: "🤝",
    lema: "Consome pensando em quem vem depois."
  }, {
    level: 12,
    titulo: "Wealth Keeper",
    xp: 6600,
    icone: "💰",
    lema: "Guarda o que constrói e corta o que drena."
  }, {
    level: 13,
    titulo: "The Future Guardian",
    xp: 7800,
    icone: "🛡️",
    lema: "Protege o amanhã nas escolhas de hoje."
  }, {
    level: 14,
    titulo: "Wilson Fisk",
    xp: 9100,
    icone: "👑",
    lema: "Manda no próprio império sem deixar o caixa mandar em você."
  }, {
    level: 15,
    titulo: "Lex Luthor",
    xp: 10500,
    icone: "🦅",
    lema: "Planeja tão longe que o impulso não alcança."
  }, {
    level: 16,
    titulo: "CK's Bruce Wayne",
    xp: 12e3,
    icone: "🦇",
    lema: "Constrói patrimônio na disciplina, não no golpe de sorte."
  }, {
    level: 17,
    titulo: "Tony Stark",
    xp: 13600,
    icone: "🤖",
    lema: "Transformou as próprias decisões em um sistema que funciona."
  }, {
    level: 18,
    titulo: "EconomisT'Challa",
    xp: 15300,
    icone: "🐆",
    lema: "Une prosperidade, propósito e responsabilidade."
  }, {
    level: 19,
    titulo: "The Future Doctor Doom",
    xp: 17100,
    icone: "🎭",
    lema: "Domina a própria realidade sem perder de vista o coletivo."
  }, {
    level: 20,
    titulo: "THE TRUE CK ZEMO",
    xp: 19e3,
    icone: "⚔️",
    lema: "Consumo responsável virou prática diária. Nível máximo."
  } ],
  XP: {
    TETO_DIARIO: 260,
    INTERVALO_MIN_MS: 8e3,
    ACOES: {
      primeiro_acesso: {
        categoria: "organizacao",
        xp: 5,
        rotulo: "Primeiro acesso do dia",
        limiteDia: 1
      },
      onboarding: {
        categoria: "organizacao",
        xp: 30,
        rotulo: "Completar o perfil financeiro",
        limiteDia: 1,
        unico: true
      },
      entrada: {
        categoria: "organizacao",
        xp: 25,
        rotulo: "Registrar uma entrada",
        limiteDia: 4
      },
      saida: {
        categoria: "organizacao",
        xp: 10,
        rotulo: "Registrar uma saída",
        limiteDia: 6
      },
      transacao: {
        categoria: "organizacao",
        xp: 10,
        rotulo: "Registrar uma movimentação",
        limiteDia: 6,
        oculto: true
      },
      meta_criada: {
        categoria: "organizacao",
        xp: 15,
        rotulo: "Criar uma meta",
        limiteDia: 2
      },
      meta_aporte: {
        categoria: "organizacao",
        xp: 15,
        rotulo: "Fazer um aporte em meta",
        limiteDia: 3
      },
      meta_concluida: {
        categoria: "organizacao",
        xp: 50,
        rotulo: "Concluir uma meta",
        limiteDia: 3,
        unico: true
      },
      calculo: {
        categoria: "consumo",
        xp: 15,
        rotulo: "Cadastrar um cálculo real",
        limiteDia: 3
      },
      decisao: {
        categoria: "consumo",
        xp: 40,
        rotulo: "Registrar a decisão da compra",
        limiteDia: 4
      },
      analise: {
        categoria: "consumo",
        xp: 5,
        rotulo: "Consultar suas análises",
        limiteDia: 1
      },
      relatorio: {
        categoria: "organizacao",
        xp: 10,
        rotulo: "Gerar um relatório",
        limiteDia: 1
      },
      streak: {
        categoria: "organizacao",
        xp: 10,
        rotulo: "Manter a sequência diária",
        limiteDia: 1
      },
      conquista: {
        categoria: "organizacao",
        xp: 50,
        rotulo: "Desbloquear uma conquista",
        limiteDia: 99,
        unico: true
      }
    },
    VALOR_MINIMO_CALCULO: 20
  }
};
