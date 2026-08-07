/* ============================================================
   FinCK v2 — Perfil, conta e gestão de dados
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const F = window.FinckFinance;
  const G = window.FinckGame;

  const user = await window.FinckNav.iniciarPagina({ titulo: "Perfil", subtitulo: "Seus dados" });
  if (!user) return;

  const $ = (id) => document.getElementById(id);

  async function carregar() {
    const ctx = await F.carregarContexto();
    const p = ctx.perfil || {};
    const game = await S.obterGamificacao();
    const nivel = G.nivelDe(game.xp);

    $("tituloPerfil").textContent = p.name ? `Olá, ${p.name}` : "Seu perfil";
    $("perfilNome").value = p.name || "";
    $("perfilRenda").value = p.income_monthly || "";
    $("perfilTipoRenda").value = p.income_type || "fixa";
    $("perfilDias").value = p.work_days_month || 22;
    $("perfilHoras").value = p.work_hours_day || 8;
    $("perfilPayday").value = p.payday || 5;
    $("perfilSaldoInicial").value = p.initial_balance || 0;

    $("perfilEmail").textContent = user.email || "—";
    $("perfilModo").textContent = S.ONLINE ? "Banco de dados (online)" : "Offline (localStorage)";
    $("perfilSetup").textContent =
      ({ perfil: "Perfil Financeiro Inicial", manual: "Configuração Manual", demo: "Modo Demonstrativo" })[p.setup_mode] || "—";

    $("resumoPerfil").innerHTML = `
      <article class="card-indicador"><span>Saldo atual</span><strong>${U.moeda(ctx.saldo)}</strong></article>
      <article class="card-indicador"><span>Movimentações</span><strong>${ctx.transacoes.length}</strong></article>
      <article class="card-indicador"><span>Metas</span><strong>${ctx.metas.length}</strong></article>
      <article class="card-indicador"><span>Nível</span><strong>${nivel.level} · ${game.xp} XP</strong></article>`;

    atualizarDica();
  }

  function atualizarDica() {
    const renda = Number($("perfilRenda").value) || 0;
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
      income_monthly: Number($("perfilRenda").value),
      income_type: $("perfilTipoRenda").value,
      work_days_month: Number($("perfilDias").value),
      work_hours_day: Number($("perfilHoras").value),
      payday: Number($("perfilPayday").value) || 5,
      initial_balance: Number($("perfilSaldoInicial").value) || 0,
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

  $("btnExportar").addEventListener("click", async () => {
    const dados = await S.exportarTudo();
    U.baixarArquivo(`finck-backup-${U.hojeISO()}.json`, JSON.stringify(dados, null, 2));
    U.toast("Backup exportado.", "sucesso");
  });

  $("inputImportar").addEventListener("change", async (e) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    try {
      const dados = JSON.parse(await arquivo.text());
      await S.importarTudo(dados);
      U.toast("Backup importado.", "sucesso");
      carregar();
    } catch (err) {
      U.toast(`Não foi possível importar: ${err.message}`, "erro");
    } finally {
      e.target.value = "";
    }
  });

  $("btnDemoDados").addEventListener("click", async () => {
    if (!confirm("Carregar dados de exemplo? Eles serão somados aos seus dados atuais.")) return;
    await F.carregarDemo();
    await G.sincronizarConquistas();
    U.toast("Dados de exemplo carregados.", "sucesso");
    carregar();
  });

  $("btnLimpar").addEventListener("click", async () => {
    if (!confirm("Apagar todas as movimentações, metas, recorrentes e análises? Esta ação não pode ser desfeita.")) return;
    await S.limparDados();
    U.toast("Dados apagados.", "info");
    carregar();
  });

  carregar();
});
