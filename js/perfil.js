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
      <article class="card-indicador"><span>Saldo atual</span><strong>${U.moeda(ctx.saldo)}</strong></article>
      <article class="card-indicador"><span>Movimentações</span><strong>${ctx.transacoes.length}</strong></article>
      <article class="card-indicador"><span>Metas</span><strong>${ctx.metas.length}</strong></article>
      <article class="card-indicador"><span>Nível</span><strong>${nivel.level} · ${game.xp} XP</strong></article>`;

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

  $("btnExportar").addEventListener("click", async () => {
    const dados = await S.exportarTudo();
    U.baixarArquivo(`finck-backup-${U.hojeISO()}.json`, JSON.stringify(dados, null, 2));
    U.toast("Backup exportado.", "sucesso");
  });

  /* ---------- importar backup ----------
     Antes o arquivo era despejado direto por cima dos dados atuais,
     sempre com inserção: reimportar o mesmo backup duplicava tudo e
     o saldo saía errado, sem nenhum aviso. Agora o usuário escolhe
     mesclar ou substituir, e recebe o relatório do que entrou. */
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

    // cada abertura religa os botões, evitando handlers acumulados
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

    $("conteudoRelatorio").innerHTML = `
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
      </p>
      ${conflitos}`;
    U.abrirModal("modalRelatorio");
  }

  /* carregarDemo agora é idempotente: repetir o clique não cria um
     segundo salário nem um segundo aluguel, então o aviso mudou de
     "serão somados" para o que de fato acontece. */
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

  carregar();
});
