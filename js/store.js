/* ============================================================
   FinCK v2 — Camada de dados (Store)
   Uma única API para todo o app. Se as credenciais do banco
   estiverem preenchidas em config.js, usa Supabase; caso
   contrário, usa localStorage (modo offline/demonstração).

   Tabelas (documento, item 7.2):
   profiles, accounts, transactions, goals,
   recurring_transactions, purchase_analyses, gamification
   ============================================================ */

window.FinckStore = (() => {
  const cfg = window.FINCK_CONFIG;
  const ONLINE = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);

  let sb = null;
  if (ONLINE && window.supabase) {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  /* ---------------- localStorage helpers ---------------- */
  const KEYS = {
    session: "finck.session",
    profiles: "finck.profiles",
    accounts: "finck.accounts",
    transactions: "finck.transactions",
    goals: "finck.goals",
    recurring_transactions: "finck.recurring",
    purchase_analyses: "finck.analyses",
    gamification: "finck.gamification",
    users: "finck.users", // apenas modo offline
  };

  const ler = (k, fb) => {
    try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; }
  };
  const gravar = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  /* ---------------- Sessão / autenticação ---------------- */
  async function usuarioAtual() {
    if (sb) {
      const { data } = await sb.auth.getUser();
      return data?.user ? { id: data.user.id, email: data.user.email } : null;
    }
    return ler(KEYS.session, null);
  }

  async function cadastrar({ nome, email, senha }) {
    if (sb) {
      const { data, error } = await sb.auth.signUp({
        email,
        password: senha,
        options: { data: { name: nome }, emailRedirectTo: `${location.origin}/index.html` },
      });
      if (error) throw new Error(traduzErro(error.message));
      if (data.user) await salvarPerfil({ id: data.user.id, name: nome });
      return { id: data.user?.id, email };
    }
    const users = ler(KEYS.users, []);
    if (users.some((u) => u.email === email)) throw new Error("Este e-mail já está cadastrado.");
    const user = { id: window.FinckUtils.uid(), nome, email, senha };
    users.push(user);
    gravar(KEYS.users, users);
    gravar(KEYS.session, { id: user.id, email, nome });
    await salvarPerfil({ id: user.id, name: nome });
    return user;
  }

  async function entrar({ email, senha }) {
    if (sb) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
      if (error) throw new Error(traduzErro(error.message));
      return { id: data.user.id, email: data.user.email };
    }
    const user = ler(KEYS.users, []).find((u) => u.email === email && u.senha === senha);
    if (!user) throw new Error("E-mail ou senha incorretos.");
    gravar(KEYS.session, { id: user.id, email: user.email, nome: user.nome });
    return user;
  }

  async function sair() {
    if (sb) await sb.auth.signOut();
    localStorage.removeItem(KEYS.session);
  }

  function traduzErro(msg = "") {
    if (/invalid login/i.test(msg)) return "E-mail ou senha incorretos.";
    if (/already registered|already exists/i.test(msg)) return "Este e-mail já está cadastrado.";
    if (/password/i.test(msg)) return "A senha precisa ter ao menos 6 caracteres.";
    return msg || "Não foi possível concluir a operação.";
  }

  /** Redireciona para o login quando não há sessão. Use no topo de cada página interna. */
  async function exigirLogin(destino = "index.html") {
    const user = await usuarioAtual();
    if (!user) { location.href = destino; return null; }
    return user;
  }

  /* ---------------- CRUD genérico ---------------- */
  async function listar(tabela, { ordem = "created_at", asc = false, filtro = {} } = {}) {
    const user = await usuarioAtual();
    if (!user) return [];
    if (sb) {
      let q = sb.from(tabela).select("*").eq("user_id", user.id);
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
    if (sb) {
      const { data, error } = await sb.from(tabela).insert(linha).select().single();
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
    if (sb) {
      const { data, error } = await sb.from(tabela).update(campos).eq("id", id).eq("user_id", user.id).select().single();
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
    if (sb) {
      const { error } = await sb.from(tabela).delete().eq("id", id).eq("user_id", user.id);
      if (error) throw new Error(error.message);
      return true;
    }
    gravar(KEYS[tabela], ler(KEYS[tabela], []).filter((r) => String(r.id) !== String(id)));
    return true;
  }

  /* ---------------- Perfil financeiro ---------------- */
  async function obterPerfil() {
    const user = await usuarioAtual();
    if (!user) return null;
    if (sb) {
      const { data, error } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
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
    if (sb) {
      const { data, error } = await sb.from("profiles").upsert(registro).select().single();
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

  /** true quando o usuário ainda não configurou renda/jornada (onboarding pendente). */
  async function precisaOnboarding() {
    const p = await obterPerfil();
    return !p || !p.income_monthly || !p.work_days_month || !p.work_hours_day;
  }

  /* ---------------- Gamificação ---------------- */
  async function obterGamificacao() {
    const user = await usuarioAtual();
    if (!user) return null;
    const base = { user_id: user.id, xp: 0, level: 1, streak: 0, last_active: null, achievements: [] };
    if (sb) {
      const { data } = await sb.from("gamification").select("*").eq("user_id", user.id).maybeSingle();
      return data || base;
    }
    return ler(KEYS.gamification, []).find((g) => g.user_id === user.id) || base;
  }

  async function salvarGamificacao(estado) {
    const user = await usuarioAtual();
    const registro = { ...estado, user_id: user.id };
    if (sb) {
      const { data, error } = await sb.from("gamification").upsert(registro, { onConflict: "user_id" }).select().single();
      if (error) throw new Error(error.message);
      return data;
    }
    const linhas = ler(KEYS.gamification, []);
    const i = linhas.findIndex((g) => g.user_id === user.id);
    if (i >= 0) linhas[i] = registro; else linhas.push(registro);
    gravar(KEYS.gamification, linhas);
    return registro;
  }

  /* ---------------- Backup / restauração ---------------- */
  const TABELAS = ["accounts", "transactions", "goals", "recurring_transactions", "purchase_analyses"];

  async function exportarTudo() {
    const perfil = await obterPerfil();
    const gamificacao = await obterGamificacao();
    const dados = { versao: 2, exportado_em: new Date().toISOString(), profile: perfil, gamification: gamificacao };
    for (const t of TABELAS) dados[t] = await listar(t);
    return dados;
  }

  async function importarTudo(dados) {
    if (!dados || typeof dados !== "object") throw new Error("Arquivo inválido.");
    if (dados.profile) await salvarPerfil({ ...dados.profile, id: undefined });
    for (const t of TABELAS) {
      for (const linha of dados[t] || []) {
        const { id, user_id, created_at, ...resto } = linha;
        await inserir(t, resto);
      }
    }
    if (dados.gamification) {
      const { user_id, ...g } = dados.gamification;
      await salvarGamificacao(g);
    }
  }

  async function limparDados() {
    for (const t of TABELAS) {
      const linhas = await listar(t);
      for (const l of linhas) await remover(t, l.id);
    }
  }

  return {
    ONLINE, KEYS,
    usuarioAtual, cadastrar, entrar, sair, exigirLogin,
    listar, inserir, atualizar, remover,
    obterPerfil, salvarPerfil, precisaOnboarding,
    obterGamificacao, salvarGamificacao,
    exportarTudo, importarTudo, limparDados,
  };
})();
