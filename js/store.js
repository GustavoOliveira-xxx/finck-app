/* ============================================================
   FinCK v2 — Camada de dados (Store)
   Uma única API para todo o app.

   Três modos de operação, decididos em tempo de execução:

     online  Supabase configurado e sessão real. Tudo persiste no
             banco, isolado por user_id (ver supabase/migrations).
     demo    Sessão de visitante. Nada sai do aparelho e nada toca
             o servidor, mesmo com o Supabase configurado. Serve
             para conhecer o app sem criar conta.
     local   Supabase não configurado. Só o modo demo funciona —
             o app nunca guarda credencial real no navegador.

   Sobre credenciais: o fallback antigo gravava e-mail e senha em
   texto puro no localStorage. Isso foi removido. Autenticação
   real acontece exclusivamente no Supabase; o que existe fora
   dele é a identidade de demonstração, que não tem senha.

   Tabelas: profiles, accounts, transactions, goals,
   recurring_transactions, purchase_analyses, gamification
   ============================================================ */

window.FinckStore = (() => {
  const cfg = window.FINCK_CONFIG;
  const CONFIGURADO = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);

  let sb = null;
  if (CONFIGURADO && window.supabase) {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  /* ---------------- Chaves locais ---------------- */
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

  /* ---------------- Modo de operação ---------------- */
  const USUARIO_DEMO = Object.freeze({
    id: "demo-local",
    email: "visitante@finck.local",
    nome: "Visitante",
  });

  const emDemo = () => localStorage.getItem(KEYS.demo) === "1";

  /** Banco ativo. Em demonstração ninguém fala com o servidor. */
  const bd = () => (emDemo() ? null : sb);

  const modo = () => (emDemo() ? "demo" : sb ? "online" : "local");

  /* Limpeza única: versões anteriores gravavam usuários com senha
     em texto puro sob "finck.users". Some com isso no primeiro
     carregamento, no navegador de quem já usou o app. */
  (function removerCredenciaisAntigas() {
    try {
      if (localStorage.getItem("finck.users") !== null) {
        localStorage.removeItem("finck.users");
      }
      // sessão local de conta antiga (sem demo) também não vale mais
      const s = ler(KEYS.session, null);
      if (s && !emDemo()) localStorage.removeItem(KEYS.session);
    } catch { /* localStorage indisponível: nada a limpar */ }
  })();

  /* ---------------- Sessão / autenticação ---------------- */
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

    // Com confirmação de e-mail ligada, o Supabase devolve o usuário
    // sem sessão. Nesse caso o perfil é criado no primeiro login.
    const precisaConfirmar = Boolean(data.user && !data.session);
    if (data.session && data.user) await salvarPerfil({ id: data.user.id, name: nome });
    return { id: data.user?.id, email, precisaConfirmar };
  }

  async function entrar({ email, senha }) {
    if (!sb) throw new Error(SEM_BANCO);
    const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error) throw new Error(traduzErro(error.message));
    // garante o perfil de quem se cadastrou com confirmação por e-mail
    const nome = data.user?.user_metadata?.name;
    if (nome) {
      const existente = await obterPerfil();
      if (!existente) await salvarPerfil({ id: data.user.id, name: nome });
    }
    return { id: data.user.id, email: data.user.email };
  }

  /** Envia o link de redefinição de senha. */
  async function recuperarSenha(email) {
    if (!sb) throw new Error(SEM_BANCO);
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/nova-senha.html`,
    });
    if (error) throw new Error(traduzErro(error.message));
    return true;
  }

  /** Grava a nova senha. Só funciona dentro da sessão criada pelo link. */
  async function definirNovaSenha(senha) {
    if (!sb) throw new Error(SEM_BANCO);
    const { error } = await sb.auth.updateUser({ password: senha });
    if (error) throw new Error(traduzErro(error.message));
    return true;
  }

  /** Reenvia a confirmação de e-mail de um cadastro pendente. */
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

  /** Abre a demonstração: sessão de visitante, sem conta e sem servidor. */
  async function entrarDemo() {
    if (sb) { try { await sb.auth.signOut(); } catch { /* já estava fora */ } }
    localStorage.setItem(KEYS.demo, "1");
    gravar(KEYS.session, { ...USUARIO_DEMO });
    return { ...USUARIO_DEMO };
  }

  /** Apaga tudo o que a demonstração criou neste aparelho. */
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

  /* ---------------- Perfil financeiro ---------------- */
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

  /* ---------------- Backup / restauração ---------------- */
  /* Ordem importa no backup: accounts entra antes de transactions
     e transfers, que apontam para ela. */
  const TABELAS = [
    "accounts", "transactions", "goals", "recurring_transactions",
    "purchase_analyses", "installment_purchases", "category_budgets",
    "transfers", "balance_adjustments",
  ];

  /* Identidade de um registro para efeito de duplicata. Não usa id
     nem created_at: um mesmo lançamento reimportado ganha id novo,
     mas continua sendo o mesmo lançamento aos olhos do usuário. */
  const ASSINATURA = {
    accounts:               (r) => [r.name, r.institution_name, r.account_type].join("|"),
    transfers:              (r) => [r.from_account_id, r.to_account_id, Number(r.amount), String(r.date).slice(0, 10)].join("|"),
    balance_adjustments:    (r) => [r.account_id, Number(r.new_balance), String(r.date).slice(0, 10)].join("|"),
    transactions:           (r) => [r.type, r.description, Number(r.amount), String(r.date).slice(0, 10)].join("|"),
    goals:                  (r) => [r.name, Number(r.target_amount)].join("|"),
    recurring_transactions: (r) => [r.description, r.type, Number(r.amount), r.day_of_month].join("|"),
    /* analyzed_at vem no próprio registro; created_at só existe
       depois de gravado. Comparar por created_at fazia o candidato
       (ainda sem o campo) nunca casar com o que já estava salvo, e
       o registro entrava de novo a cada importação. */
    purchase_analyses:      (r) => [r.item_name, Number(r.price), String(r.analyzed_at || r.created_at || "").slice(0, 10)].join("|"),
    installment_purchases:  (r) => [r.description, Number(r.total_amount), r.installments_count, String(r.first_due_date).slice(0, 10)].join("|"),
    // um teto por categoria: a categoria é a identidade
    category_budgets:       (r) => String(r.category),
  };

  const assinar = (tabela, linha) => {
    const fn = ASSINATURA[tabela];
    return fn ? fn(linha) : JSON.stringify(linha);
  };

  /** Insere só se ainda não existir um registro equivalente. */
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

  /**
   * Restaura um backup.
   * @param {object} dados  arquivo exportado por exportarTudo
   * @param {object} opcoes modo "mesclar" (padrão) ignora o que já
   *   existe; "substituir" apaga os dados atuais antes de importar.
   * @returns {object} relatório com o que entrou, o que foi ignorado
   *   e a lista de conflitos, para mostrar ao usuário.
   */
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
      // uma leitura por tabela: evita ida ao banco a cada registro
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
