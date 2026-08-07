/* ============================================================
   FinCK of Reality — Configuração global
   Preencha SUPABASE_URL e SUPABASE_ANON_KEY com os dados do
   seu projeto. Se ficarem vazios, o app roda 100% offline
   (localStorage) — útil para demonstração em sala.
   ============================================================ */

window.FINCK_CONFIG = {
  SUPABASE_URL: "https://iruqoghylxgopbopxjbi.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_zn_jngIj2xibO_VpzOi0Wg_gGG7Z8eS",

  // Rótulos e parâmetros de produto
  APP_NOME: "FinCK of Reality",
  APP_NOME_CURTO: "FinCK",
  EMPRESA: "Conscious Knowledge",
  MOEDA: "BRL",
  LOCALE: "pt-BR",

  // Valores padrão do perfil financeiro
  PADRAO: {
    work_days_month: 22,
    work_hours_day: 8,
    income_type: "fixa",
    payday: 5,
  },

  // Categorias locais e familiares (item 4.2 do documento)
  CATEGORIAS: [
    "Alimentação",
    "Transporte",
    "Moradia",
    "Lazer",
    "Vestuário",
    "Eletrônicos",
    "Saúde",
    "Educação",
    "Outros",
  ],

  // Decisões possíveis no FinCK of Reality (item 5.2)
  DECISOES: [
    { id: "comprar", label: "Comprar agora", xp: 5, consciente: false },
    { id: "adiar", label: "Adiar a compra", xp: 25, consciente: true },
    { id: "alternativa", label: "Pesquisar alternativa", xp: 20, consciente: true },
    { id: "usado", label: "Comprar usado", xp: 30, consciente: true },
    { id: "reparar", label: "Reparar o item atual", xp: 35, consciente: true },
    { id: "desistir", label: "Desistir da compra", xp: 40, consciente: true },
  ],

  // Perguntas de reflexão (item 5.3)
  REFLEXOES: [
    { id: "necessidade", dimensao: "Necessidade", pergunta: "Eu preciso deste produto agora ou estou respondendo a um impulso?" },
    { id: "uso", dimensao: "Uso", pergunta: "Com que frequência pretendo usar o item?" },
    { id: "durabilidade", dimensao: "Durabilidade", pergunta: "O produto tem qualidade, garantia ou possibilidade de reparo?" },
    { id: "alternativas", dimensao: "Alternativas", pergunta: "Existe uma opção usada, compartilhada, alugada ou reaproveitada?" },
    { id: "orcamento", dimensao: "Orçamento", pergunta: "A compra compromete despesas essenciais ou uma meta importante?" },
    { id: "descarte", dimensao: "Descarte", pergunta: "Como o item será mantido, reutilizado ou descartado quando não servir mais?" },
  ],

  /* ----------------------------------------------------------
     GAMIFICAÇÃO — trilha de níveis (títulos + requisito de XP)
     xp = XP acumulado necessário para ALCANÇAR o nível.
     ---------------------------------------------------------- */
  NIVEIS: [
    { level: 1,  titulo: "CK Newbie",              xp: 0,     icone: "🆕", lema: "Você acabou de entrar no mundo do consumo consciente." },
    { level: 2,  titulo: "Conscious Planner",      xp: 100,   icone: "📝", lema: "Começou a registrar e planejar o próprio dinheiro." },
    { level: 3,  titulo: "Financial Thinker",      xp: 300,   icone: "💡", lema: "Pensa antes de comprar — o preço virou pergunta." },
    { level: 4,  titulo: "Stark's Investor",       xp: 600,   icone: "🚀", lema: "Enxerga cada gasto como investimento ou desperdício." },
    { level: 5,  titulo: "Economy Knowledgist",    xp: 1000,  icone: "📚", lema: "Domina os números da própria realidade financeira." },
    { level: 6,  titulo: "Norman Osborn",          xp: 1500,  icone: "🕷️", lema: "Controla o impulso antes que ele controle você." },
    { level: 7,  titulo: "Golden Seeker",          xp: 2100,  icone: "🏆", lema: "Busca metas com método, não com sorte." },
    { level: 8,  titulo: "Fisk's Counter",         xp: 2800,  icone: "⚖️", lema: "Equilibra desejo e orçamento sem se enganar." },
    { level: 9,  titulo: "Fantastic Richards",     xp: 3600,  icone: "🔬", lema: "Analisa cada compra como um experimento." },
    { level: 10, titulo: "The Miner",              xp: 4500,  icone: "⛏️", lema: "Extrai valor real de cada hora trabalhada." },
    { level: 11, titulo: "The Philanthropist",     xp: 5500,  icone: "🤝", lema: "Consome com consciência do impacto que gera." },
    { level: 12, titulo: "Wealth Keeper",          xp: 6600,  icone: "💰", lema: "Guarda o que constrói e corta o que drena." },
    { level: 13, titulo: "The Future Guardian",    xp: 7800,  icone: "🛡️", lema: "Protege o amanhã nas decisões de hoje." },
    { level: 14, titulo: "Wilson Fisk",            xp: 9100,  icone: "👑", lema: "Nada entra ou sai sem a sua autorização." },
    { level: 15, titulo: "Lex Luthor",             xp: 10500, icone: "🦅", lema: "Estratégia fria diante de qualquer promoção." },
    { level: 16, titulo: "CK's Bruce Wayne",       xp: 12000, icone: "🦇", lema: "Patrimônio construído com disciplina silenciosa." },
    { level: 17, titulo: "Tony Stark",             xp: 13600, icone: "🤖", lema: "Suas decisões financeiras já são engenharia." },
    { level: 18, titulo: "EconomisT'Challa",       xp: 15300, icone: "🐆", lema: "Riqueza com propósito e responsabilidade." },
    { level: 19, titulo: "The Future Doctor Doom", xp: 17100, icone: "🎭", lema: "Domina totalmente a própria realidade financeira." },
    { level: 20, titulo: "THE TRUE CK ZEMO",       xp: 19000, icone: "⚔️", lema: "Consumo consciente virou identidade. Nível máximo." },
  ],

  /* ----------------------------------------------------------
     REGRAS ANTI-FARM DE XP
     Cada ação tem valor, limite diário e chave de unicidade.
     ---------------------------------------------------------- */
  XP: {
    TETO_DIARIO: 260,        // XP máximo somado por dia, qualquer origem
    INTERVALO_MIN_MS: 8000,  // tempo mínimo entre dois ganhos de XP
    ACOES: {
      primeiro_acesso:  { xp:  5, rotulo: "Primeiro acesso do dia",            limiteDia: 1 },
      onboarding:       { xp: 30, rotulo: "Completar o perfil financeiro",     limiteDia: 1,  unico: true },
      entrada:          { xp: 25, rotulo: "Registrar uma entrada",             limiteDia: 4 },
      saida:            { xp: 10, rotulo: "Registrar uma saída",               limiteDia: 6 },
      transacao:        { xp: 10, rotulo: "Registrar uma movimentação",        limiteDia: 6, oculto: true },
      meta_criada:      { xp: 15, rotulo: "Criar uma meta",                    limiteDia: 2 },
      meta_aporte:      { xp: 15, rotulo: "Fazer um aporte em meta",           limiteDia: 3 },
      meta_concluida:   { xp: 50, rotulo: "Concluir uma meta",                 limiteDia: 3,  unico: true },
      calculo:          { xp: 15, rotulo: "Cadastrar um cálculo real",         limiteDia: 3 },
      decisao:          { xp: 40, rotulo: "Registrar a decisão da compra",     limiteDia: 4 },
      analise:          { xp:  5, rotulo: "Consultar suas análises",           limiteDia: 1 },
      relatorio:        { xp: 10, rotulo: "Gerar um relatório",                limiteDia: 1 },
      streak:           { xp: 10, rotulo: "Manter a sequência diária",         limiteDia: 1 },
      conquista:        { xp: 50, rotulo: "Desbloquear uma conquista",         limiteDia: 99, unico: true },
    },
    // Um cálculo só vale XP se o item for economicamente relevante
    VALOR_MINIMO_CALCULO: 20,
  },
};
