

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
    category_budgets: "finck.orcamentos",
    transfers: "finck.transferencias",
    balance_adjustments: "finck.ajustes",
    gamification: "finck.gamification",
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

  async function atualizar(tabela, id, campos) {
    const user = await usuarioAtual();
    const banco = bd();
    if (banco) {
      const { data, error } = await banco.from(tabela).update(campos).eq("id", id).eq("user_id", user.id).select().single();
      if (error) throw new Error(error.message);
      return data;
    }
    const linhas = ler(KEYS[tabela], []);
    const i = linhas.findIndex((r) => String(r.id) === String(id));
    if (i >= 0) { linhas[i] = { ...linhas[i], ...campos }; gravar(KEYS[tabela], linhas); return linhas[i]; }
    return null;
  }

  async function remover(tabela, id) {
    const user = await usuarioAtual();
    const banco = bd();
    if (banco) {
      const { error } = await banco.from(tabela).delete().eq("id", id).eq("user_id", user.id);
      if (error) throw new Error(error.message);
      return true;
    }
    gravar(KEYS[tabela], ler(KEYS[tabela], []).filter((r) => String(r.id) !== String(id)));
    return true;
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

  const TABELAS = [
    "accounts", "transactions", "goals", "recurring_transactions",
    "purchase_analyses", "installment_purchases", "category_budgets",
    "transfers", "balance_adjustments",
  ];

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
    const dados = { versao: 2, exportado_em: new Date().toISOString(), profile: perfil, gamification: gamificacao };
    for (const t of TABELAS) dados[t] = await listar(t);
    return dados;
  }

  async function importarTudo(dados, { modo: modoImport = "mesclar" } = {}) {
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
      throw new Error("Arquivo inválido: não parece um backup do FinCK.");
    }
    const temAlgo = TABELAS.some((t) => Array.isArray(dados[t])) || dados.profile;
    if (!temAlgo) throw new Error("Arquivo inválido: nenhum dado reconhecido.");
    if (!["mesclar", "substituir"].includes(modoImport)) {
      throw new Error("Modo de importação desconhecido.");
    }

    if (modoImport === "substituir") await limparDados();

    const relatorio = {
      modo: modoImport,
      inseridos: 0,
      ignorados: 0,
      porTabela: {},
      conflitos: [],
      perfilAtualizado: false,
    };

    if (dados.profile) {
      const { id, created_at, ...perfil } = dados.profile;
      await salvarPerfil(perfil);
      relatorio.perfilAtualizado = true;
    }

    for (const t of TABELAS) {
      const linhas = Array.isArray(dados[t]) ? dados[t] : [];

      const existentes = modoImport === "substituir" ? [] : await listar(t);
      const vistos = new Set(existentes.map((r) => assinar(t, r)));
      let entraram = 0, pulados = 0;

      for (const linha of linhas) {
        const { id, user_id, created_at, ...resto } = linha;
        const chave = assinar(t, resto);
        if (vistos.has(chave)) {
          pulados++;
          if (relatorio.conflitos.length < 25) {
            relatorio.conflitos.push({ tabela: t, descricao: descreverLinha(t, resto) });
          }
          continue;
        }
        vistos.add(chave);
        await inserir(t, resto);
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
    usuarioAtual, cadastrar, entrar, sair, exigirLogin,
    recuperarSenha, definirNovaSenha, reenviarConfirmacao,
    listar, inserir, inserirSeNovo, atualizar, remover,
    obterPerfil, salvarPerfil, precisaOnboarding,
    obterGamificacao, salvarGamificacao,
    exportarTudo, importarTudo, limparDados,
    assinar,
  };
})();
