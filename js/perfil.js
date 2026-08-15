document.addEventListener("DOMContentLoaded", async () => {
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const F = window.FinckFinance;
  const G = window.FinckGame;
  const R = window.FinckReality;

  const user = await window.FinckNav.iniciarPagina({ titulo: "Perfil", subtitulo: "Seus dados" });
  if (!user) return;

  const $ = (id) => document.getElementById(id);

  async function carregar() {
    const ctx = await F.carregarContexto();
    const p = ctx.perfil || {};
    const game = await S.obterGamificacao();
    const nivel = G.nivelDe(game.xp);
    perfilContas = ctx.contas || [];

    $("tituloPerfil").textContent = p.name ? `Olá, ${p.name}` : "Seu perfil";
    $("perfilNome").value = p.name || "";
    U.escreverMoeda("perfilRenda", p.income_monthly || 0);
    $("perfilTipoRenda").value = p.income_type || "fixa";
    $("perfilDias").value = p.work_days_month || 22;
    $("perfilHoras").value = p.work_hours_day || 8;
    $("perfilPayday").value = p.payday || 5;
    U.escreverMoeda("perfilSaldoInicial", p.initial_balance || 0);

    $("perfilEmail").textContent = user.email || "—";
    $("perfilModo").textContent = S.ONLINE ? "Banco de dados (online)" : "Offline (localStorage)";
    $("perfilSetup").textContent =
      ({ perfil: "Perfil Financeiro Inicial", manual: "Configuração Manual", demo: "Modo Demonstrativo" })[p.setup_mode] || "—";

    $("resumoPerfil").innerHTML = `
      <article class="card-indicador" title="${U.escapeHTML(R.GLOSSARIO.saldo_atual.definicao)}">
        <span>Saldo atual <small class="indicador-quando">até hoje</small></span>
        <strong>${U.moeda(ctx.saldo)}</strong></article>
      <article class="card-indicador" title="${U.escapeHTML(R.GLOSSARIO.nao_alocado.definicao)}">
        <span>Fora das contas <small class="indicador-quando">não alocado</small></span>
        <strong>${U.moeda(ctx.naoAlocado)}</strong></article>
      <article class="card-indicador"><span>Movimentações</span><strong>${ctx.transacoes.length}</strong></article>
      <article class="card-indicador"><span>Nível</span><strong>${nivel.level} · ${game.xp} XP</strong></article>`;

    // A composição do saldo inicial fica escrita, não só o número final.
    const origem = ctx.origemSaldo;
    $("perfilOrigemSaldo").innerHTML = `
      <strong>De onde vem o seu saldo inicial:</strong> ${U.escapeHTML(origem.nota)}
      ${p.initial_balance_migrated_at
        ? `<br><small>Migrado para uma conta em ${U.dataBR(p.initial_balance_migrated_at)} — o valor do perfil é histórico.</small>`
        : ""}`;

    atualizarDica();
  }

  function atualizarDica() {
    const renda = U.lerMoeda("perfilRenda");
    const dias = Number($("perfilDias").value) || 22;
    const horas = Number($("perfilHoras").value) || 8;
    $("perfilDica").textContent = renda > 0
      ? `Com esses dados, sua hora vale ${U.moeda(renda / dias / horas)} e seu dia, ${U.moeda(renda / dias)}.`
      : "Informe sua renda para o FinCK of Reality funcionar.";
  }
  ["perfilRenda", "perfilDias", "perfilHoras"].forEach((id) => $(id).addEventListener("input", atualizarDica));

  $("formPerfil").addEventListener("submit", async (e) => {
    e.preventDefault();
    const dados = {
      name: $("perfilNome").value.trim(),
      income_monthly: U.lerMoeda("perfilRenda"),
      income_type: $("perfilTipoRenda").value,
      work_days_month: Number($("perfilDias").value),
      work_hours_day: Number($("perfilHoras").value),
      payday: Number($("perfilPayday").value) || 5,
      initial_balance: U.lerMoeda("perfilSaldoInicial"),
    };
    if (!dados.name) return U.toast("Informe seu nome.", "erro");
    if (!(dados.income_monthly > 0)) return U.toast("Informe uma renda maior que zero.", "erro");
    try {
      await S.salvarPerfil(dados);
      U.toast("Perfil atualizado.", "sucesso");
      carregar();
    } catch (err) { U.toast(err.message, "erro"); }
  });

  $("btnSairConta").addEventListener("click", async () => {
    await S.sair();
    location.href = "index.html";
  });

  // ------------------------------------------------------ diagnóstico -----
  // Fase 3 do relatório: a rotina de reconciliação vive aqui e roda também
  // antes de exportar, para o backup nunca sair de um estado divergente sem
  // que o usuário saiba.

  const RC = window.FinckReconciliador;
  let laudo = null;

  const FORMATO = {
    moeda: (v) => U.moeda(v),
    quantidade: (v) => `${Math.round(Number(v || 0))}`,
  };

  async function reconciliar({ silencioso = false } = {}) {
    const botao = $("btnReconciliar");
    botao.disabled = true;
    $("diagnosticoEstado").innerHTML = `<p class="descricao">Conferindo saldo, contas, metas e compromissos…</p>`;

    try {
      laudo = await RC.executar();
      renderDiagnostico(laudo);
      if (!silencioso) {
        U.toast(
          laudo.ok ? "Tudo confere: nenhuma divergência encontrada."
          : laudo.contabilOk ? `Contabilidade fecha. ${laudo.pendencias.length} item(ns) esperando sua decisão.`
          : `${laudo.falhas.length} divergência(s) encontrada(s).`,
          laudo.ok ? "sucesso" : laudo.contabilOk ? "info" : "erro");
      }
      return laudo;
    } catch (err) {
      $("diagnosticoEstado").innerHTML =
        `<p class="alerta">Não foi possível reconciliar: ${U.escapeHTML(err.message)}</p>`;
      if (!silencioso) U.toast(err.message, "erro");
      return null;
    } finally {
      botao.disabled = false;
      carregarEventos();
    }
  }

  function renderDiagnostico(r) {
    const passaram = r.checagens.filter((c) => c.ok).length;
    const total = r.checagens.length;
    const pct = total ? Math.round((passaram / total) * 100) : 0;

    // Balança: o fiel inclina proporcionalmente à diferença entre os dois
    // lados, com teto de 12° para a cena continuar legível.
    const cena = document.querySelector("[data-balanca]");
    cena.hidden = false;

    const esq = r.caixa.saldoGlobal;
    const dir = r.caixa.somaContas + r.caixa.naoAlocado;
    const maior = Math.max(Math.abs(esq), Math.abs(dir), 1);
    const inclinacao = Math.max(-12, Math.min(12, ((esq - dir) / maior) * 60));

    const balanca = cena.querySelector(".balanca");
    balanca.style.setProperty("--inclinacao", `${inclinacao.toFixed(2)}deg`);
    balanca.classList.toggle("balanca--equilibrada", r.caixa.fecha);
    balanca.classList.toggle("balanca--desequilibrada", !r.caixa.fecha);

    cena.querySelector("[data-balanca-esq]").textContent = U.moeda(esq);
    cena.querySelector("[data-balanca-dir]").textContent = U.moeda(dir);

    const arco = cena.querySelector(".anel-integridade__arco");
    const volta = 2 * Math.PI * 52;
    arco.style.strokeDashoffset = String(volta - (volta * pct) / 100);
    cena.querySelector("[data-balanca-veredito]").dataset.nivel =
      pct === 100 ? "ok" : pct >= 60 ? "atencao" : "alerta";
    cena.querySelector("[data-integridade-pct]").textContent = `${pct}%`;
    cena.querySelector("[data-integridade-rotulo]").textContent =
      `${passaram} de ${total} conferem`;

    $("diagnosticoEstado").innerHTML = `
      <p class="descricao">
        ${r.caixa.fecha
          ? `O saldo global de <strong>${U.moeda(esq)}</strong> é exatamente
             ${U.moeda(r.caixa.somaContas)} nas contas${
               r.caixa.somaArquivadas
                 ? `, ${U.moeda(r.caixa.somaArquivadas)} que passou por ${r.caixa.contasArquivadas} conta(s) arquivada(s)`
                 : ""}
             mais ${U.moeda(r.caixa.naoAlocado)} fora delas.`
          : `<span class="cor-vermelha">O saldo global não fecha com a soma das contas:
             diferença de ${U.moeda(Math.abs(r.caixa.diferenca))}.</span>`}
        ${r.historico.estornadas
          ? `<br><small>${r.historico.estornadas} movimentação(ões) estornada(s) preservada(s) no histórico,
             fora do saldo (${U.moeda(r.historico.valorEstornado)}).</small>` : ""}
      </p>
      <p class="nota">Conferido em ${new Date(r.geradoEm).toLocaleString("pt-BR")}.</p>`;

    $("listaChecagens").innerHTML = r.checagens.map((c, i) => {
      const fmt = FORMATO[c.formato] || FORMATO.moeda;
      return `
        <article class="checagem checagem--${c.ok ? "ok" : "falha"}${c.alerta ? " checagem--com-alerta" : ""}"
                 style="--atraso:${i * 70}ms" data-checagem>
          <header>
            <span class="checagem__marca" aria-hidden="true">${c.ok ? "✓" : "!"}</span>
            <h4>${U.escapeHTML(c.titulo)}</h4>
          </header>
          <p class="checagem__texto">${U.escapeHTML(c.explicacao)}</p>
          <dl class="checagem__numeros">
            <div><dt>Encontrado</dt><dd>${fmt(c.encontrado)}</dd></div>
            ${c.ok ? "" : `<div><dt>Esperado</dt><dd>${fmt(c.esperado)}</dd></div>`}
            ${c.valorMoeda !== undefined
              ? `<div><dt>Valor</dt><dd>${U.moeda(c.valorMoeda)}</dd></div>` : ""}
            ${c.detalhe ? `<div><dt>Base</dt><dd>${U.escapeHTML(c.detalhe)}</dd></div>` : ""}
          </dl>
        </article>`;
    }).join("");

    renderPendencias(r.pendencias);
    renderSaldoInicial(r);
  }

  const ACAO_PENDENCIA = {
    transacao_sem_conta: "Declarar fora das contas",
    meta_sem_historico: "Regularizar histórico",
  };

  function renderPendencias(pendencias) {
    const bloco = $("blocoPendencias");
    bloco.hidden = pendencias.length === 0;
    if (!pendencias.length) return;

    $("listaPendencias").innerHTML = pendencias.map((p, i) => `
      <li class="pendencia" style="--atraso:${i * 45}ms">
        <div class="pendencia__info">
          <strong>${U.escapeHTML(p.titulo || "Registro")}</strong>
          <small>${U.escapeHTML(p.detalhe || "")}</small>
          <p>${U.escapeHTML(p.texto)}</p>
        </div>
        ${ACAO_PENDENCIA[p.kind]
          ? `<button type="button" class="btn-secundario btn-mini"
                     data-resolver="${p.kind}" data-entidade="${p.entity_id}">${ACAO_PENDENCIA[p.kind]}</button>`
          : ""}
      </li>`).join("");

    $("listaPendencias").querySelectorAll("[data-resolver]").forEach((b) =>
      b.addEventListener("click", () => resolverPendencia(b.dataset.resolver, b.dataset.entidade, b)));
  }

  // Resolver é sempre uma declaração explícita: ou o usuário diz que a
  // movimentação fica fora das contas, ou ele encosta o livro-razão no valor
  // já guardado. Nenhum dos dois apaga nada.
  async function resolverPendencia(tipo, alvo, botao) {
    botao.disabled = true;
    try {
      if (tipo === "transacao_sem_conta") {
        await S.atualizar("transactions", alvo, { unallocated: true });
        U.toast("Movimentação marcada como fora das contas.", "sucesso");
      } else if (tipo === "meta_sem_historico") {
        const meta = await S.obter("goals", alvo);
        await F.ajustarMeta(alvo, Number(meta?.current_amount || 0),
                            "Regularização: valor guardado antes do livro-razão");
        U.toast("Histórico da meta regularizado. O progresso agora é derivável.", "sucesso");
      }
      await reconciliar({ silencioso: true });
    } catch (err) {
      await S.registrarEvento({ scope: "reconciliacao", message: err.message, context: { tipo, alvo } });
      U.toast(err.message, "erro");
      botao.disabled = false;
    }
  }

  // Migração do saldo inicial: converte o valor legado do perfil em saldo de
  // uma conta escolhida, com relatório antes e marca de migrado depois.
  function renderSaldoInicial(r) {
    const bloco = $("blocoSaldoInicial");
    const pendente = r.pendencias.find((p) => p.kind === "saldo_inicial_duplicado");
    bloco.hidden = !pendente;
    if (!pendente) return;

    const ativas = (r.checagens && perfilContas) ? perfilContas.filter((c) => c.active !== false) : [];
    $("textoSaldoInicial").innerHTML =
      `Seu perfil guarda ${U.escapeHTML(pendente.detalhe)} de saldo inicial e você já tem contas cadastradas.
       O FinCK parou de somar esse valor para não contar o mesmo dinheiro duas vezes — mas ele continua
       registrado no perfil. Leve-o para uma conta e a composição do saldo passa a ser explícita.`;

    $("contaSaldoInicial").innerHTML = ativas
      .map((c) => `<option value="${c.id}">${U.escapeHTML(c.name)}</option>`).join("");
  }

  let perfilContas = [];

  $("btnMigrarSaldo").addEventListener("click", async () => {
    const conta = $("contaSaldoInicial").value;
    if (!conta) return U.toast("Escolha a conta que vai receber o saldo.", "erro");

    const nome = $("contaSaldoInicial").selectedOptions[0]?.textContent || "conta";
    if (!confirm(`O saldo inicial do perfil vai para "${nome}". O valor do perfil vira histórico e nunca mais é somado. Continuar?`)) return;

    try {
      const noBanco = await S.rpc("migrar_saldo_inicial", { p_account_id: conta, p_modo: "somar" });
      if (!noBanco.suportado) {
        // Sem a função do banco, o mesmo efeito em dois passos, na ordem que
        // não deixa o dinheiro sumir: primeiro soma na conta, depois marca.
        const p = await S.obterPerfil();
        const valor = Number(p?.initial_balance || 0);
        const c = await S.obter("accounts", conta);
        await S.atualizar("accounts", conta, {
          initial_balance: Number(c?.initial_balance || 0) + valor,
        });
        await S.salvarPerfil({
          initial_balance_migrated_at: new Date().toISOString(),
          initial_balance_account_id: conta,
          initial_balance_source: "contas",
        });
      }
      U.toast(`Saldo inicial migrado para "${nome}".`, "sucesso");
      await carregar();
      await reconciliar({ silencioso: true });
    } catch (err) {
      await S.registrarEvento({ scope: "migracao", message: err.message, context: { conta } });
      U.toast(err.message, "erro");
    }
  });

  $("btnReconciliar").addEventListener("click", () => reconciliar());

  // ------------------------------------------------------ registro técnico --

  const NIVEL_EVENTO = { erro: "alerta", aviso: "atencao", info: "ok" };

  async function carregarEventos() {
    const eventos = await S.listarEventos({ limite: 40 });
    $("chipEventos").textContent = String(eventos.length);

    $("listaEventos").innerHTML = eventos.length
      ? eventos.map((e) => `
          <li class="evento evento--${NIVEL_EVENTO[e.level] || "ok"}">
            <span class="evento__escopo">${U.escapeHTML(e.scope)}</span>
            <span class="evento__msg">${U.escapeHTML(e.message)}</span>
            <time>${new Date(e.created_at).toLocaleString("pt-BR")}</time>
          </li>`).join("")
      : `<li class="evento evento--vazio">Nenhum erro registrado.</li>`;
  }

  $("btnExportarEventos").addEventListener("click", async () => {
    const eventos = await S.listarEventos({ limite: 200 });
    U.baixarArquivo(`finck-registro-${U.hojeISO()}.json`, JSON.stringify(eventos, null, 2));
    U.toast("Registro técnico exportado.", "sucesso");
  });

  $("btnLimparEventos").addEventListener("click", async () => {
    if (!confirm("Apagar o registro técnico? O histórico financeiro não é afetado.")) return;
    await S.limparEventos();
    carregarEventos();
    U.toast("Registro limpo.", "info");
  });

  $("btnExportar").addEventListener("click", async () => {
    // O relatório pede reconciliação antes de exportar: um backup tirado de um
    // estado divergente carrega a divergência junto.
    const r = await reconciliar({ silencioso: true });
    if (r && !r.contabilOk &&
        !confirm(`A reconciliação encontrou ${r.falhas.length} divergência(s). Exportar mesmo assim?`)) {
      return U.toast("Exportação cancelada. Resolva as divergências no diagnóstico.", "info");
    }

    const dados = await S.exportarTudo();
    dados.reconciliacao = r
      ? { geradoEm: r.geradoEm, ok: r.ok, contabilOk: r.contabilOk, caixa: r.caixa }
      : null;
    U.baixarArquivo(`finck-backup-${U.hojeISO()}.json`, JSON.stringify(dados, null, 2));
    U.toast("Backup exportado.", "sucesso");
  });

  const TABELAS_ROTULO = {
    accounts: "contas",
    transactions: "movimentações",
    goals: "metas",
    recurring_transactions: "recorrentes",
    purchase_analyses: "cálculos",
  };

  $("inputImportar").addEventListener("change", async (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;

    let dados;
    try {
      dados = JSON.parse(await arquivo.text());
    } catch {
      return U.toast("Não foi possível ler o arquivo: ele não é um JSON válido.", "erro");
    }

    const contagem = Object.entries(TABELAS_ROTULO)
      .map(([t, rotulo]) => (Array.isArray(dados[t]) && dados[t].length ? `${dados[t].length} ${rotulo}` : null))
      .filter(Boolean);

    $("resumoArquivo").textContent = contagem.length
      ? `O arquivo traz ${contagem.join(", ")}.`
      : "O arquivo não traz registros além do perfil.";

    U.abrirModal("modalImportar");

    document.querySelectorAll("#modalImportar [data-modo]").forEach((botao) => {
      botao.onclick = async () => {
        const modo = botao.dataset.modo;
        if (modo === "substituir" &&
            !confirm("Substituir apaga seus dados atuais e não pode ser desfeito. Continuar?")) return;

        document.querySelectorAll("#modalImportar [data-modo]").forEach((b) => { b.disabled = true; });
        try {
          const rel = await S.importarTudo(dados, { modo });
          U.fecharModal("modalImportar");
          mostrarRelatorio(rel);
          carregar();
        } catch (err) {
          U.toast(`Não foi possível importar: ${err.message}`, "erro");
        } finally {
          document.querySelectorAll("#modalImportar [data-modo]").forEach((b) => { b.disabled = false; });
        }
      };
    });
  });

  function mostrarRelatorio(rel) {
    const linhas = Object.entries(rel.porTabela)
      .filter(([, v]) => v.total > 0)
      .map(([t, v]) => `
        <li><span>${U.escapeHTML(TABELAS_ROTULO[t] || t)}</span>
            <strong>${v.inseridos} de ${v.total}</strong></li>`)
      .join("");

    const conflitos = rel.conflitos.length
      ? `<div class="bloco-interno">
           <h4>Ignorados por já existirem</h4>
           <ul class="lista-simples">
             ${rel.conflitos.map((c) => `
               <li class="item-lista">
                 <span class="item-desc">${U.escapeHTML(c.descricao)}</span>
                 <span class="item-dia">${U.escapeHTML(TABELAS_ROTULO[c.tabela] || c.tabela)}</span>
               </li>`).join("")}
           </ul>
           ${rel.ignorados > rel.conflitos.length
             ? `<p class="nota">…e mais ${rel.ignorados - rel.conflitos.length} registro(s).</p>` : ""}
         </div>`
      : "";

    const avisos = (rel.avisos || []).length
      ? `<div class="bloco-interno">
           <h4>Descartados por inconsistência</h4>
           <p class="nota">Registros com valor inválido, sem data ou apontando para algo que não veio no arquivo não foram gravados.</p>
           <ul class="lista-simples">
             ${rel.avisos.slice(0, 25).map((a) => `
               <li class="item-lista"><span class="item-desc">${U.escapeHTML(a)}</span></li>`).join("")}
           </ul>
           ${rel.avisos.length > 25
             ? `<p class="nota">…e mais ${rel.avisos.length - 25} aviso(s).</p>` : ""}
         </div>`
      : "";

    $("conteudoRelatorio").innerHTML = `
      ${rel.deDemo
        ? `<p class="nota nota--conciliacao">Atenção: este arquivo saiu do modo demonstração. Os dados são de exemplo, não do seu histórico real.</p>`
        : ""}
      <p class="descricao">
        ${rel.modo === "substituir"
          ? "Seus dados foram substituídos pelo conteúdo do arquivo."
          : "O arquivo foi mesclado com os seus dados."}
      </p>
      <ul class="lista-resumo">
        ${linhas || "<li><span>Nenhum registro no arquivo</span><strong>0</strong></li>"}
      </ul>
      <p class="total-linha">
        <span>Importados</span> <strong>${rel.inseridos}</strong>
        ${rel.ignorados ? `· <span>ignorados</span> <strong>${rel.ignorados}</strong>` : ""}
        ${rel.descartados ? `· <span>descartados</span> <strong>${rel.descartados}</strong>` : ""}
      </p>
      ${conflitos}
      ${avisos}`;
    U.abrirModal("modalRelatorio");
  }

  $("btnDemoDados").addEventListener("click", async () => {
    if (!confirm("Carregar dados de exemplo? O que já existir não será duplicado.")) return;
    const r = await F.carregarDemo();
    await G.sincronizarConquistas();
    U.toast(
      r.inseridos
        ? `Dados de exemplo carregados: ${r.inseridos} registro(s) novo(s).`
        : "Os dados de exemplo já estavam carregados.",
      r.inseridos ? "sucesso" : "info"
    );
    carregar();
  });

  $("btnLimpar").addEventListener("click", async () => {
    if (!confirm("Apagar todas as movimentações, metas, recorrentes e análises? Esta ação não pode ser desfeita.")) return;
    await S.limparDados();
    U.toast("Dados apagados.", "info");
    carregar();
  });

  (async () => {
    await carregar();
    await carregarEventos();
    // Reconcilia sozinho ao abrir: divergência que só aparece quando alguém
    // pede não é diagnóstico, é sorte.
    await reconciliar({ silencioso: true });

    if (location.hash === "#diagnostico") {
      $("diagnostico").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  })();
});
