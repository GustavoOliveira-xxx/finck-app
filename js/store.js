window.FinckStore = (() => {
  const cfg = window.FINCK_CONFIG;
  const CONFIGURADO = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);

  let sb = null;
  if (CONFIGURADO && window.supabase) {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  const KEYS = {
    session: "finck.session",
    profiles: "finck.profiles",
    accounts: "finck.accounts",
    transactions: "finck.transactions",
    goals: "finck.goals",
    recurring_transactions: "finck.recurring",
    purchase_analyses: "finck.analyses",
    installment_purchases: "finck.parcelas",
    installment_payments: "finck.parcelas.pagas",
    category_budgets: "finck.orcamentos",
    transfers: "finck.transferencias",
    balance_adjustments: "finck.ajustes",
    gamification: "finck.gamification",
    recurring_occurrences: "finck.ocorrencias",
    monthly_closings: "finck.fechamentos",
    goal_movements: "finck.metas.movimentos",
    reconciliation_queue: "finck.reconciliacao",
    integrity_events: "finck.eventos",
    operation_keys: "finck.chaves",
    demo: "finck.demo",
  };

  const ler = (k, fb) => {
    try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; }
  };
  const gravar = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const USUARIO_DEMO = Object.freeze({
    id: "demo-local",
    email: "visitante@finck.local",
    nome: "Visitante",
  });

  const emDemo = () => localStorage.getItem(KEYS.demo) === "1";

  const bd = () => (emDemo() ? null : sb);

  const modo = () => (emDemo() ? "demo" : sb ? "online" : "local");

  (function removerCredenciaisAntigas() {
    try {
      if (localStorage.getItem("finck.users") !== null) {
        localStorage.removeItem("finck.users");
      }

      const s = ler(KEYS.session, null);
      if (s && !emDemo()) localStorage.removeItem(KEYS.session);
    } catch {  }
  })();

  async function usuarioAtual() {
    if (emDemo()) return ler(KEYS.session, null) || { ...USUARIO_DEMO };
    if (sb) {
      const { data } = await sb.auth.getUser();
      return data?.user ? { id: data.user.id, email: data.user.email } : null;
    }
    return null;
  }

  async function tokenAcesso() {
    if (!sb || emDemo()) return null;
    const { data } = await sb.auth.getSession();
    return data?.session?.access_token || null;
  }

  const SEM_BANCO =
    "Cadastro e login precisam do banco de dados configurado. " +
    "Enquanto isso, use o modo demonstração para conhecer o app.";

  async function cadastrar({ nome, email, senha }) {
    if (!sb) throw new Error(SEM_BANCO);
    const { data, error } = await sb.auth.signUp({
      email,
      password: senha,
      options: { data: { name: nome }, emailRedirectTo: `${location.origin}/index.html` },
    });
    if (error) throw new Error(traduzErro(error.message));

    const precisaConfirmar = Boolean(data.user && !data.session);
    if (data.session && data.user) await salvarPerfil({ id: data.user.id, name: nome });
    return { id: data.user?.id, email, precisaConfirmar };
  }

  async function entrar({ email, senha }) {
    if (!sb) throw new Error(SEM_BANCO);
    const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error) throw new Error(traduzErro(error.message));

    const nome = data.user?.user_metadata?.name;
    if (nome) {
      const existente = await obterPerfil();
      if (!existente) await salvarPerfil({ id: data.user.id, name: nome });
    }
    return { id: data.user.id, email: data.user.email };
  }

  async function recuperarSenha(email) {
    if (!sb) throw new Error(SEM_BANCO);
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/nova-senha.html`,
    });
    if (error) throw new Error(traduzErro(error.message));
    return true;
  }

  async function definirNovaSenha(senha) {
    if (!sb) throw new Error(SEM_BANCO);
    const { error } = await sb.auth.updateUser({ password: senha });
    if (error) throw new Error(traduzErro(error.message));
    return true;
  }

  async function reenviarConfirmacao(email) {
    if (!sb) throw new Error(SEM_BANCO);
    const { error } = await sb.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${location.origin}/index.html` },
    });
    if (error) throw new Error(traduzErro(error.message));
    return true;
  }

  async function entrarDemo() {
    if (sb) { try { await sb.auth.signOut(); } catch {  } }
    localStorage.setItem(KEYS.demo, "1");
    gravar(KEYS.session, { ...USUARIO_DEMO });
    return { ...USUARIO_DEMO };
  }

  function encerrarDemo() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  }

  async function sair() {
    if (emDemo()) { encerrarDemo(); return; }
    if (sb) await sb.auth.signOut();
    localStorage.removeItem(KEYS.session);
  }

  function traduzErro(msg = "") {
    if (/invalid login/i.test(msg)) return "E-mail ou senha incorretos.";
    if (/email not confirmed/i.test(msg)) return "Confirme seu e-mail antes de entrar. Veja a caixa de entrada.";
    if (/already registered|already exists|user already/i.test(msg)) return "Este e-mail já está cadastrado.";
    if (/rate limit|too many/i.test(msg)) return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
    if (/invalid.*email|email.*invalid/i.test(msg)) return "Esse endereço de e-mail não parece válido.";
    if (/same.*password/i.test(msg)) return "A nova senha precisa ser diferente da anterior.";
    if (/expired|invalid.*token/i.test(msg)) return "Este link expirou. Peça um novo e-mail de redefinição.";
    if (/password/i.test(msg)) return "A senha precisa ter ao menos 6 caracteres.";
    return msg || "Não foi possível concluir a operação.";
  }

  async function exigirLogin(destino = "index.html") {
    const user = await usuarioAtual();
    if (!user) { location.href = destino; return null; }
    return user;
  }

  async function listar(tabela, { ordem = "created_at", asc = false, filtro = {} } = {}) {
    const user = await usuarioAtual();
    if (!user) return [];
    const banco = bd();
    if (banco) {
      let q = banco.from(tabela).select("*").eq("user_id", user.id);
      Object.entries(filtro).forEach(([k, v]) => { q = q.eq(k, v); });
      const { data, error } = await q.order(ordem, { ascending: asc });
      if (error) throw new Error(error.message);
      return data || [];
    }
    const linhas = ler(KEYS[tabela], []).filter(
      (r) => r.user_id === user.id && Object.entries(filtro).every(([k, v]) => r[k] === v)
    );
    return linhas.sort((a, b) =>
      asc ? String(a[ordem]).localeCompare(String(b[ordem])) : String(b[ordem]).localeCompare(String(a[ordem]))
    );
  }

  async function inserir(tabela, registro) {
    const user = await usuarioAtual();
    if (!user) throw new Error("Sessão expirada. Entre novamente.");
    const linha = { ...registro, user_id: user.id };
    const banco = bd();
    if (banco) {
      const { data, error } = await banco.from(tabela).insert(linha).select().single();
      if (error) throw new Error(error.message);
      return data;
    }
    const nova = { id: window.FinckUtils.uid(), created_at: new Date().toISOString(), ...linha };
    const linhas = ler(KEYS[tabela], []);
    linhas.unshift(nova);
    gravar(KEYS[tabela], linhas);
    return nova;
  }

  async function upsert(tabela, registros, chaves) {
    const lista = Array.isArray(registros) ? registros : [registros];
    if (!lista.length) return [];
    const user = await usuarioAtual();
    if (!user) throw new Error("Sessão expirada. Entre novamente.");
    const linhas = lista.map((r) => ({ ...r, user_id: user.id }));
    const banco = bd();

    if (banco) {
      const { data, error } = await banco
        .from(tabela)
        .upsert(linhas, { onConflict: chaves.join(","), ignoreDuplicates: true })
        .select();
      if (error) throw new Error(error.message);
      return data || [];
    }

    const atuais = ler(KEYS[tabela], []);
    const existe = (r) => atuais.some(
      (a) => a.user_id === user.id && chaves.every((k) => String(a[k]) === String(r[k])));
    const novas = linhas.filter((r) => !existe(r)).map((r) => ({
      id: window.FinckUtils.uid(), created_at: new Date().toISOString(), ...r,
    }));
    if (novas.length) gravar(KEYS[tabela], [...novas, ...atuais]);
    return novas;
  }

  const meu = (registro, user) => registro && String(registro.user_id) === String(user.id);

  async function atualizar(tabela, id, campos) {
    const user = await usuarioAtual();
    if (!user) throw new Error("Sessão expirada. Entre novamente.");
    const banco = bd();
    if (banco) {
      const { data, error } = await banco.from(tabela).update(campos).eq("id", id).eq("user_id", user.id).select().single();
      if (error) throw new Error(error.message);
      return data;
    }
    const linhas = ler(KEYS[tabela], []);

    const i = linhas.findIndex((r) => String(r.id) === String(id) && meu(r, user));
    if (i >= 0) { linhas[i] = { ...linhas[i], ...campos }; gravar(KEYS[tabela], linhas); return linhas[i]; }
    return null;
  }

  async function remover(tabela, id) {
    const user = await usuarioAtual();
    if (!user) throw new Error("Sessão expirada. Entre novamente.");
    const banco = bd();
    if (banco) {
      const { error } = await banco.from(tabela).delete().eq("id", id).eq("user_id", user.id);
      if (error) throw new Error(error.message);
      return true;
    }
    const linhas = ler(KEYS[tabela], []);

    const restantes = linhas.filter((r) => !(String(r.id) === String(id) && meu(r, user)));
    if (restantes.length === linhas.length) return false;
    gravar(KEYS[tabela], restantes);
    return true;
  }

  // Chama uma função transacional do banco. Devolve { suportado: false }
  // quando não há banco (demo/local) ou quando a migration de integridade
  // ainda não foi aplicada — nesses casos o chamador usa o caminho em JS.
  const SEM_FUNCAO = /does not exist|could not find the function|schema cache|PGRST202|42883/i;

  async function rpc(nome, parametros = {}) {
    const banco = bd();
    if (!banco) return { suportado: false, dados: null };

    const { data, error } = await banco.rpc(nome, parametros);
    if (error) {
      if (SEM_FUNCAO.test(`${error.code || ""} ${error.message || ""}`)) {
        return { suportado: false, dados: null };
      }
      throw new Error(error.message);
    }
    return { suportado: true, dados: data };
  }

  // Idempotência do lado de cá. No banco quem guarda o resultado é
  // operation_keys; em demo e local o mesmo papel cabe ao localStorage.
  //
  // Ler-depois-gravar sozinho não basta: duas chamadas simultâneas com a mesma
  // chave passam as duas pela verificação antes de qualquer uma gravar. `emVoo`
  // resolve isso na origem — duplo clique, dois awaits em paralelo, handler
  // disparado duas vezes: a segunda chamada recebe a promessa da primeira em
  // vez de executar de novo.
  //
  // Entre abas diferentes (memória separada, localStorage compartilhado) esta
  // trava não alcança. Quem garante lá é o banco: a chave primária de
  // operation_keys e os índices únicos de transactions rejeitam o segundo
  // lançamento. Ou seja, no modo online a garantia é do Postgres; nos modos
  // demonstração e local ela vale por aba — e esses modos não são ambiente
  // seguro de produção, como o próprio relatório diz.
  const emVoo = new Map();

  async function operacao(chave, executar, { operacao: nome = "operacao" } = {}) {
    if (!chave) return executar();

    const user = await usuarioAtual();
    if (!user) throw new Error("Sessão expirada. Entre novamente.");

    const registro = `${user.id}:${chave}`;
    if (emVoo.has(registro)) return emVoo.get(registro);

    const corpo = async () => {
      const registradas = ler(KEYS.operation_keys, []);
      const guardada = registradas.find(
        (r) => r.user_id === user.id && r.key === chave);
      if (guardada) return guardada.result;

      const resultado = await executar();

      // Relê antes de gravar: outra aba pode ter escrito enquanto isto rodava.
      const atuais = ler(KEYS.operation_keys, []);
      atuais.unshift({
        user_id: user.id, key: chave, operation: nome,
        result: resultado ?? null, created_at: new Date().toISOString(),
      });
      // O histórico de chaves não precisa crescer para sempre: o que protege
      // contra retry é a janela recente, não o arquivo inteiro.
      gravar(KEYS.operation_keys, atuais.slice(0, 200));
      return resultado;
    };

    const promessa = corpo();
    emVoo.set(registro, promessa);
    try {
      return await promessa;
    } finally {
      emVoo.delete(registro);
    }
  }

  const chaveDeOperacao = (...partes) =>
    `${partes.filter((p) => p !== null && p !== undefined).join(":")}`;

  // Diário técnico dos fluxos críticos. Nunca lança: observabilidade que
  // derruba a operação observada é pior do que não ter observabilidade.
  // Grava sempre local (para o diagnóstico funcionar em demo e offline) e
  // espelha no banco quando ele está disponível.
  const LIMITE_EVENTOS = 200;

  async function registrarEvento({ level = "erro", scope, message, context = {} }) {
    const linha = {
      id: window.FinckUtils?.uid?.() || `ev-${Date.now()}`,
      level,
      scope: scope || "geral",
      message: String(message || "").slice(0, 500),
      context,
      created_at: new Date().toISOString(),
    };

    try {
      const user = await usuarioAtual();
      if (!user) return linha;
      linha.user_id = user.id;

      const locais = ler(KEYS.integrity_events, []);
      locais.unshift(linha);
      gravar(KEYS.integrity_events, locais.slice(0, LIMITE_EVENTOS));

      const banco = bd();
      if (banco) {
        const { id, ...semId } = linha;
        await banco.from("integrity_events").insert(semId);
      }
    } catch {
      // Um erro ao registrar o erro não pode virar o erro principal.
    }
    return linha;
  }

  async function listarEventos({ limite = 50 } = {}) {
    const user = await usuarioAtual();
    if (!user) return [];

    const locais = ler(KEYS.integrity_events, [])
      .filter((e) => !e.user_id || e.user_id === user.id);

    const banco = bd();
    if (!banco) return locais.slice(0, limite);

    try {
      const { data } = await banco
        .from("integrity_events").select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limite);

      // O banco é a fonte; o local cobre o que ainda não subiu.
      const vistos = new Set((data || []).map((e) => `${e.created_at}|${e.message}`));
      const extras = locais.filter((e) => !vistos.has(`${e.created_at}|${e.message}`));
      return [...(data || []), ...extras]
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .slice(0, limite);
    } catch {
      return locais.slice(0, limite);
    }
  }

  async function limparEventos() {
    localStorage.removeItem(KEYS.integrity_events);
    const banco = bd();
    const user = await usuarioAtual();
    if (banco && user) {
      try { await banco.from("integrity_events").delete().eq("user_id", user.id); } catch {  }
    }
    return true;
  }

  async function obter(tabela, id) {
    const user = await usuarioAtual();
    if (!user) return null;
    const banco = bd();
    if (banco) {
      const { data, error } = await banco.from(tabela).select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    }
    return ler(KEYS[tabela], []).find((r) => String(r.id) === String(id) && meu(r, user)) || null;
  }

  async function obterPerfil() {
    const user = await usuarioAtual();
    if (!user) return null;
    const banco = bd();
    if (banco) {
      const { data, error } = await banco.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    }
    return ler(KEYS.profiles, []).find((p) => p.id === user.id) || null;
  }

  async function salvarPerfil(campos) {
    const user = await usuarioAtual();
    const id = campos.id || user?.id;
    if (!id) throw new Error("Sessão expirada.");
    const registro = { ...campos, id };
    const banco = bd();
    if (banco) {
      const { data, error } = await banco.from("profiles").upsert(registro).select().single();
      if (error) throw new Error(error.message);
      return data;
    }
    const perfis = ler(KEYS.profiles, []);
    const i = perfis.findIndex((p) => p.id === id);
    if (i >= 0) perfis[i] = { ...perfis[i], ...registro };
    else perfis.push({ created_at: new Date().toISOString(), ...registro });
    gravar(KEYS.profiles, perfis);
    return perfis.find((p) => p.id === id);
  }

  async function precisaOnboarding() {
    const p = await obterPerfil();
    return !p || !p.income_monthly || !p.work_days_month || !p.work_hours_day;
  }

  async function obterGamificacao() {
    const user = await usuarioAtual();
    if (!user) return null;
    const base = { user_id: user.id, xp: 0, level: 1, streak: 0, last_active: null, achievements: [] };
    const banco = bd();
    if (banco) {
      const { data } = await banco.from("gamification").select("*").eq("user_id", user.id).maybeSingle();
      return data || base;
    }
    return ler(KEYS.gamification, []).find((g) => g.user_id === user.id) || base;
  }

  async function salvarGamificacao(estado) {
    const user = await usuarioAtual();
    const registro = { ...estado, user_id: user.id };
    const banco = bd();
    if (banco) {
      const { data, error } = await banco.from("gamification").upsert(registro, { onConflict: "user_id" }).select().single();
      if (error) throw new Error(error.message);
      return data;
    }
    const linhas = ler(KEYS.gamification, []);
    const i = linhas.findIndex((g) => g.user_id === user.id);
    if (i >= 0) linhas[i] = registro; else linhas.push(registro);
    gravar(KEYS.gamification, linhas);
    return registro;
  }

  // Ordem de gravação: quem é referenciado entra antes de quem referencia,
  // para que os vínculos possam ser reapontados para os novos IDs.
  const TABELAS = [
    "accounts", "goals",
    "transactions", "recurring_transactions",
    "purchase_analyses", "installment_purchases", "category_budgets",
    "transfers", "balance_adjustments", "installment_payments",
    "goal_movements",
  ];

  // Cada vínculo diz de qual tabela o ID vem e se ele é obrigatório.
  // Alvo fora de TABELAS nunca resolve: o vínculo é limpo em vez de virar órfão.
  const VINCULOS = {
    transactions: [
      ["account_id", "accounts", false],
      ["goal_id", "goals", false],
      ["source_occurrence_id", "recurring_occurrences", false],
    ],
    recurring_transactions: [["account_id", "accounts", false]],
    installment_purchases:  [["account_id", "accounts", false]],
    balance_adjustments: [["account_id", "accounts", true]],
    transfers:           [["from_account_id", "accounts", true], ["to_account_id", "accounts", true]],
    installment_payments: [
      ["purchase_id", "installment_purchases", true],
      ["transaction_id", "transactions", false],
    ],
    goal_movements: [
      ["goal_id", "goals", true],
      ["transaction_id", "transactions", false],
    ],
  };

  const positivo = (v) => Number.isFinite(Number(v)) && Number(v) > 0;
  const naoNegativo = (v) => v === null || v === undefined || v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0);
  const dataValida = (v) => /^\d{4}-\d{2}-\d{2}/.test(String(v || ""));

  // Regras por tabela. Devolve o motivo da rejeição ou null quando a linha é válida.
  const INVARIANTES = {
    accounts: (r) => (!String(r.name || "").trim() ? "conta sem nome" : null),

    goals: (r) =>
      !String(r.name || "").trim() ? "meta sem nome"
      : !positivo(r.target_amount) ? "meta com alvo zerado ou negativo"
      : !naoNegativo(r.current_amount) ? "meta com valor guardado negativo"
      : null,

    transactions: (r) =>
      !["entrada", "saida"].includes(r.type) ? "movimentação sem tipo válido"
      : !positivo(r.amount) ? "movimentação com valor zerado ou negativo"
      : !dataValida(r.date) ? "movimentação sem data válida"
      : !String(r.description || "").trim() ? "movimentação sem descrição"
      : null,

    recurring_transactions: (r) =>
      !["entrada", "saida"].includes(r.type) ? "recorrente sem tipo válido"
      : !positivo(r.amount) ? "recorrente com valor zerado ou negativo"
      : !(Number(r.day_of_month) >= 1 && Number(r.day_of_month) <= 31) ? "recorrente com dia fora de 1 a 31"
      : null,

    installment_purchases: (r) =>
      !positivo(r.total_amount) ? "parcelamento com total zerado ou negativo"
      : !(Number(r.installments_count) >= 1) ? "parcelamento sem número de parcelas"
      : !dataValida(r.first_due_date) ? "parcelamento sem primeiro vencimento válido"
      : Number(r.paid_count || 0) > Number(r.installments_count) ? "parcelamento com mais parcelas pagas que o total"
      : null,

    category_budgets: (r) =>
      !String(r.category || "").trim() ? "teto sem categoria"
      : !positivo(r.limit_amount) ? "teto com limite zerado ou negativo"
      : null,

    transfers: (r) =>
      !positivo(r.amount) ? "transferência com valor zerado ou negativo"
      : String(r.from_account_id) === String(r.to_account_id) ? "transferência entre a mesma conta"
      : null,

    balance_adjustments: (r) =>
      !dataValida(r.date) ? "ajuste sem data válida" : null,

    purchase_analyses: (r) =>
      !String(r.item_name || "").trim() ? "análise sem item"
      : !positivo(r.price) ? "análise com preço zerado ou negativo"
      : null,

    installment_payments: (r) =>
      !(Number(r.installment_no) >= 1) ? "parcela sem número válido"
      : !positivo(r.amount) ? "parcela com valor zerado ou negativo"
      : !["aberta", "paga", "estornada"].includes(r.status) ? "parcela com estado inválido"
      : r.status === "aberta" && r.transaction_id ? "parcela aberta não pode ter movimentação vinculada"
      : null,

    // O livro-razão da meta aceita valor negativo (retirada e estorno), mas
    // nunca zero: movimento que não move nada não é fato, é ruído.
    goal_movements: (r) =>
      !["aporte", "retirada", "estorno", "ajuste"].includes(r.kind) ? "movimento de meta sem tipo válido"
      : !Number.isFinite(Number(r.amount)) || Number(r.amount) === 0 ? "movimento de meta com valor zerado"
      : !dataValida(r.date) ? "movimento de meta sem data válida"
      : r.kind === "aporte" && Number(r.amount) < 0 ? "aporte não pode ter valor negativo"
      : r.kind === "retirada" && Number(r.amount) > 0 ? "retirada precisa ter valor negativo"
      : null,
  };

  // Fase 1: valida esquema, invariantes e referências. Não grava nada.
  function validarImportacao(dados) {
    const erros = [];
    const avisos = [];

    if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
      return { valido: false, erros: ["Arquivo inválido: não parece um backup do FinCK."], avisos, linhas: {} };
    }

    const temAlgo = TABELAS.some((t) => Array.isArray(dados[t])) || dados.profile;
    if (!temAlgo) {
      return { valido: false, erros: ["Arquivo inválido: nenhum dado reconhecido."], avisos, linhas: {} };
    }

    // IDs presentes no próprio arquivo, por tabela — base para checar referências.
    const idsNoArquivo = {};
    TABELAS.forEach((t) => {
      idsNoArquivo[t] = new Set(
        (Array.isArray(dados[t]) ? dados[t] : [])
          .map((r) => (r && r.id !== undefined && r.id !== null ? String(r.id) : null))
          .filter(Boolean)
      );
    });
    const conhecidos = (alvo) => idsNoArquivo[alvo] || new Set();

    const linhas = {};

    for (const tabela of TABELAS) {
      const bruto = dados[tabela];
      if (bruto !== undefined && !Array.isArray(bruto)) {
        erros.push(`"${tabela}" deveria ser uma lista.`);
        linhas[tabela] = [];
        continue;
      }

      const aceitas = [];
      (bruto || []).forEach((linha, i) => {
        const posicao = `${tabela}[${i}]`;
        if (!linha || typeof linha !== "object" || Array.isArray(linha)) {
          avisos.push(`${posicao}: registro ignorado por não ser um objeto.`);
          return;
        }

        const regra = INVARIANTES[tabela];
        const motivo = regra ? regra(linha) : null;
        if (motivo) { avisos.push(`${posicao}: ${motivo} — registro descartado.`); return; }

        // Referências: obrigatórias derrubam a linha; opcionais só perdem o vínculo.
        let descartar = false;
        (VINCULOS[tabela] || []).forEach(([campo, alvo, obrigatorio]) => {
          const valor = linha[campo];
          if (valor === null || valor === undefined || valor === "") {
            if (obrigatorio) {
              avisos.push(`${posicao}: sem ${campo} — registro descartado.`);
              descartar = true;
            }
            return;
          }
          // Tabela que o backup nunca leva (ocorrências são regeradas a partir
          // das regras): soltar o vínculo é o comportamento previsto, não um
          // defeito do arquivo — não vira aviso.
          const exportada = TABELAS.includes(alvo);

          if (!conhecidos(alvo).has(String(valor))) {
            if (obrigatorio) {
              avisos.push(`${posicao}: ${campo} aponta para ${alvo} que não veio no arquivo — registro descartado.`);
              descartar = true;
            } else if (exportada) {
              avisos.push(`${posicao}: ${campo} aponta para ${alvo} que não veio no arquivo — vínculo removido.`);
            }
          }
        });

        if (!descartar) aceitas.push(linha);
      });

      linhas[tabela] = aceitas;
    }

    return { valido: erros.length === 0, erros, avisos, linhas };
  }

  const ASSINATURA = {
    accounts:               (r) => [r.name, r.institution_name, r.account_type].join("|"),
    transfers:              (r) => [r.from_account_id, r.to_account_id, Number(r.amount), String(r.date).slice(0, 10)].join("|"),
    balance_adjustments:    (r) => [r.account_id, Number(r.new_balance), String(r.date).slice(0, 10)].join("|"),
    transactions:           (r) => [r.type, r.description, Number(r.amount), String(r.date).slice(0, 10)].join("|"),
    goals:                  (r) => [r.name, Number(r.target_amount)].join("|"),
    recurring_transactions: (r) => [r.description, r.type, Number(r.amount), r.day_of_month].join("|"),

    purchase_analyses:      (r) => [r.item_name, Number(r.price), String(r.analyzed_at || r.created_at || "").slice(0, 10)].join("|"),
    installment_purchases:  (r) => [r.description, Number(r.total_amount), r.installments_count, String(r.first_due_date).slice(0, 10)].join("|"),

    category_budgets:       (r) => String(r.category),
    installment_payments:   (r) => [r.purchase_id, Number(r.installment_no)].join("|"),
    goal_movements:         (r) => [r.goal_id, r.kind, Number(r.amount), String(r.date).slice(0, 10)].join("|"),
  };

  const assinar = (tabela, linha) => {
    const fn = ASSINATURA[tabela];
    return fn ? fn(linha) : JSON.stringify(linha);
  };

  async function inserirSeNovo(tabela, registro, existentes = null) {
    const atuais = existentes || (await listar(tabela));
    const alvo = assinar(tabela, registro);
    if (atuais.some((r) => assinar(tabela, r) === alvo)) return null;
    return inserir(tabela, registro);
  }

  async function exportarTudo() {
    const perfil = await obterPerfil();
    const gamificacao = await obterGamificacao();
    // Marca a origem: um arquivo tirado da demonstração carrega dados de
    // exemplo e não deve entrar numa conta real sem o usuário saber.
    const dados = {
      versao: 3,
      exportado_em: new Date().toISOString(),
      origem: emDemo() ? "demo" : "conta",
      profile: perfil,
      gamification: gamificacao,
    };
    for (const t of TABELAS) dados[t] = await listar(t);
    return dados;
  }

  async function importarTudo(dados, { modo: modoImport = "mesclar" } = {}) {
    if (!["mesclar", "substituir"].includes(modoImport)) {
      throw new Error("Modo de importação desconhecido.");
    }

    // Fase 1: valida tudo antes de tocar no banco.
    const exame = validarImportacao(dados);
    if (!exame.valido) throw new Error(exame.erros[0]);

    // Fase 2: grava. IDs antigos são reapontados para os novos conforme a
    // gravação avança — importar nunca reaproveita ID de outro usuário.
    if (modoImport === "substituir") await limparDados();

    const deDemo = dados.origem === "demo" && !emDemo();

    const relatorio = {
      modo: modoImport,
      origem: dados.origem || "desconhecida",
      deDemo,
      inseridos: 0,
      ignorados: 0,
      descartados: exame.avisos.length,
      porTabela: {},
      conflitos: [],
      avisos: exame.avisos,
      perfilAtualizado: false,
    };

    if (dados.profile) {
      const { id, created_at, user_id, ...perfil } = dados.profile;
      await salvarPerfil(perfil);
      relatorio.perfilAtualizado = true;
    }

    const mapaDeIds = {};
    TABELAS.forEach((t) => { mapaDeIds[t] = new Map(); });

    const reapontar = (tabela, linha) => {
      const ajustada = { ...linha };
      (VINCULOS[tabela] || []).forEach(([campo, alvo]) => {
        const valor = ajustada[campo];
        if (valor === null || valor === undefined || valor === "") return;
        const novo = mapaDeIds[alvo]?.get(String(valor));
        ajustada[campo] = novo !== undefined ? novo : null;
      });
      return ajustada;
    };

    for (const t of TABELAS) {
      const linhas = exame.linhas[t] || [];

      const existentes = modoImport === "substituir" ? [] : await listar(t);
      const vistos = new Set(existentes.map((r) => assinar(t, r)));
      let entraram = 0, pulados = 0;

      for (const linha of linhas) {
        const { id, user_id, created_at, ...resto } = linha;
        const preparada = reapontar(t, resto);
        const chave = assinar(t, preparada);

        if (vistos.has(chave)) {
          pulados++;
          if (relatorio.conflitos.length < 25) {
            relatorio.conflitos.push({ tabela: t, descricao: descreverLinha(t, preparada) });
          }
          continue;
        }
        vistos.add(chave);
        const criada = await inserir(t, preparada);
        if (id !== undefined && id !== null && criada?.id !== undefined) {
          mapaDeIds[t].set(String(id), criada.id);
        }
        entraram++;
      }

      relatorio.porTabela[t] = { inseridos: entraram, ignorados: pulados, total: linhas.length };
      relatorio.inseridos += entraram;
      relatorio.ignorados += pulados;
    }

    if (dados.gamification) {
      const { user_id, ...g } = dados.gamification;
      await salvarGamificacao(g);
    }

    return relatorio;
  }

  const descreverLinha = (tabela, r) => {
    if (tabela === "transactions") return `${r.description} · ${r.date}`;
    if (tabela === "goals") return r.name;
    if (tabela === "recurring_transactions") return `${r.description} · dia ${r.day_of_month}`;
    if (tabela === "purchase_analyses") return r.item_name;
    return r.name || r.description || "registro";
  };

  async function limparDados() {
    for (const t of TABELAS) {
      const linhas = await listar(t);
      for (const l of linhas) await remover(t, l.id);
    }
  }

  return {
    KEYS,
    get ONLINE() { return Boolean(bd()); },
    get MODO() { return modo(); },
    get CONFIGURADO() { return CONFIGURADO; },
    emDemo, entrarDemo, encerrarDemo,
    usuarioAtual, tokenAcesso, cadastrar, entrar, sair, exigirLogin,
    recuperarSenha, definirNovaSenha, reenviarConfirmacao,
    listar, obter, inserir, inserirSeNovo, upsert, atualizar, remover, rpc,
    operacao, chaveDeOperacao,
    registrarEvento, listarEventos, limparEventos,
    obterPerfil, salvarPerfil, precisaOnboarding,
    obterGamificacao, salvarGamificacao,
    exportarTudo, importarTudo, validarImportacao, limparDados,
    assinar, TABELAS,
  };
})();
