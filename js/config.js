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
    titulo: "Primeiro passo",
    xp: 0,
    icone: "🌱",
    lema: "Você começou a observar as próprias escolhas."
  }, {
    level: 2,
    titulo: "Observador do orçamento",
    xp: 100,
    icone: "👀",
    lema: "Começou a registrar e planejar o próprio dinheiro."
  }, {
    level: 3,
    titulo: "Planejador consciente",
    xp: 300,
    icone: "📝",
    lema: "Pensa antes de comprar — o preço virou pergunta."
  }, {
    level: 4,
    titulo: "Guardião das escolhas",
    xp: 600,
    icone: "🧭",
    lema: "Enxerga cada gasto como investimento ou desperdício."
  }, {
    level: 5,
    titulo: "Leitor dos números",
    xp: 1e3,
    icone: "📚",
    lema: "Entende os números da própria realidade financeira."
  }, {
    level: 6,
    titulo: "Domador do impulso",
    xp: 1500,
    icone: "🛑",
    lema: "Controla o impulso antes que ele controle você."
  }, {
    level: 7,
    titulo: "Construtor de metas",
    xp: 2100,
    icone: "🎯",
    lema: "Busca metas com método, não com sorte."
  }, {
    level: 8,
    titulo: "Equilibrista financeiro",
    xp: 2800,
    icone: "⚖️",
    lema: "Equilibra desejo e orçamento sem se enganar."
  }, {
    level: 9,
    titulo: "Analista de impacto",
    xp: 3600,
    icone: "🔎",
    lema: "Analisa cada compra e o impacto que ela produz."
  }, {
    level: 10,
    titulo: "Guardião do tempo",
    xp: 4500,
    icone: "⏳",
    lema: "Reconhece o valor real de cada hora trabalhada."
  }, {
    level: 11,
    titulo: "Consumidor responsável",
    xp: 5500,
    icone: "🤝",
    lema: "Consome com consciência do impacto que gera."
  }, {
    level: 12,
    titulo: "Protetor da reserva",
    xp: 6600,
    icone: "🏦",
    lema: "Guarda o que constrói e corta o que drena."
  }, {
    level: 13,
    titulo: "Cuidador do futuro",
    xp: 7800,
    icone: "🛡️",
    lema: "Protege o amanhã nas decisões de hoje."
  }, {
    level: 14,
    titulo: "Curador de recursos",
    xp: 9100,
    icone: "♻️",
    lema: "Faz cada recurso circular com propósito."
  }, {
    level: 15,
    titulo: "Estrategista sustentável",
    xp: 10500,
    icone: "🌿",
    lema: "Planeja compras para durar, reparar e reaproveitar."
  }, {
    level: 16,
    titulo: "Arquiteto do patrimônio",
    xp: 12e3,
    icone: "🏗️",
    lema: "Constrói patrimônio com disciplina constante."
  }, {
    level: 17,
    titulo: "Engenheiro das escolhas",
    xp: 13600,
    icone: "⚙️",
    lema: "Transforma decisões financeiras em um sistema coerente."
  }, {
    level: 18,
    titulo: "Líder de impacto",
    xp: 15300,
    icone: "🌎",
    lema: "Une prosperidade, propósito e responsabilidade."
  }, {
    level: 19,
    titulo: "Mestre da consciência",
    xp: 17100,
    icone: "💡",
    lema: "Domina a própria realidade sem perder de vista o coletivo."
  }, {
    level: 20,
    titulo: "Embaixador da ODS 12",
    xp: 19e3,
    icone: "🏅",
    lema: "Consumo responsável virou prática diária. Nível máximo."
  } ],
  XP: {
    TETO_DIARIO: 260,
    INTERVALO_MIN_MS: 8e3,
    ACOES: {
      primeiro_acesso: {
        xp: 5,
        rotulo: "Primeiro acesso do dia",
        limiteDia: 1
      },
      onboarding: {
        xp: 30,
        rotulo: "Completar o perfil financeiro",
        limiteDia: 1,
        unico: true
      },
      entrada: {
        xp: 25,
        rotulo: "Registrar uma entrada",
        limiteDia: 4
      },
      saida: {
        xp: 10,
        rotulo: "Registrar uma saída",
        limiteDia: 6
      },
      transacao: {
        xp: 10,
        rotulo: "Registrar uma movimentação",
        limiteDia: 6,
        oculto: true
      },
      meta_criada: {
        xp: 15,
        rotulo: "Criar uma meta",
        limiteDia: 2
      },
      meta_aporte: {
        xp: 15,
        rotulo: "Fazer um aporte em meta",
        limiteDia: 3
      },
      meta_concluida: {
        xp: 50,
        rotulo: "Concluir uma meta",
        limiteDia: 3,
        unico: true
      },
      calculo: {
        xp: 15,
        rotulo: "Cadastrar um cálculo real",
        limiteDia: 3
      },
      decisao: {
        xp: 40,
        rotulo: "Registrar a decisão da compra",
        limiteDia: 4
      },
      analise: {
        xp: 5,
        rotulo: "Consultar suas análises",
        limiteDia: 1
      },
      relatorio: {
        xp: 10,
        rotulo: "Gerar um relatório",
        limiteDia: 1
      },
      streak: {
        xp: 10,
        rotulo: "Manter a sequência diária",
        limiteDia: 1
      },
      conquista: {
        xp: 50,
        rotulo: "Desbloquear uma conquista",
        limiteDia: 99,
        unico: true
      }
    },
    VALOR_MINIMO_CALCULO: 20
  }
};
