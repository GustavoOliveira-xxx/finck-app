/* ============================================================
   FinCK Contas — contas.js
   Tela de contas: cadastro, transferências e ajuste de saldo.

   Fases 1 e 2 da especificação. Nenhuma chamada a instituição
   externa: tudo aqui é dado que o próprio usuário digitou.
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  const cfg = window.FINCK_CONFIG;
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const C = window.FinckContas;

  const user = await window.FinckNav.iniciarPagina({ titulo: "Contas", subtitulo: "Onde seu dinheiro está" });
  if (!user) return;

  const $ = (id) => document.getElementById(id);

  let contas = [];
  let transacoes = [];
  let transferencias = [];
  let ajustes = [];
  let instituicaoEscolhida = "inter";

  /* ---------------- carga ---------------- */
  async function carregar() {
    [contas, transacoes, transferencias, ajustes] = await Promise.all([
      S.listar("accounts", { ordem: "created_at", asc: true }),
      S.listar("transactions", { ordem: "date", asc: false }),
      S.listar("transfers", { ordem: "date", asc: false }),
      S.listar("balance_adjustments", { ordem: "date", asc: false }),
    ]);
    render();
  }

  const movimentos = () => ({ transacoes, transferencias, ajustes });

  const contasComSaldo = () => C.saldos(contas, movimentos());
  const ativas = () => contasComSaldo().filter((c) => c.active !== false);

  /* ---------------- render ---------------- */
  function render() {
    const resumo = C.consolidado(contas, movimentos());
    $("chipContas").textContent = `${resumo.quantidade} ativa${resumo.quantidade === 1 ? "" : "s"}`;

    $("consolidado").innerHTML = `
      <li><span>Dinheiro em contas</span>
          <strong class="${resumo.disponivel < 0 ? "cor-vermelha" : "cor-verde"}">${U.moeda(resumo.disponivel)}</strong></li>
      <li><span>Lançamentos sem conta</span>
          <strong>${C.semConta(transacoes)}</strong></li>
      <li><span>Transferências registradas</span>
          <strong>${transferencias.length}</strong></li>`;

    renderContas();
    renderInstituicoes(resumo.contas);
    renderSemConta();
    renderTransferencias();
  }

  function cartaoConta(c) {
    const inst = c.instituicao;
    const marca = inst.logo
      ? `<img src="${inst.logo}" alt="${U.escapeHTML(inst.nome)}" class="conta-logo" loading="lazy">`
      : `<span class="conta-sigla" style="--cor:${inst.cor}">${U.escapeHTML(inst.curto.slice(0, 2))}</span>`;

    const lancamentos = transacoes.filter((t) => String(t.account_id) === String(c.id)).length;

    return `
      <article class="cartao-conta${c.active === false ? " cartao-conta--arquivada" : ""}"
               style="--cor-banco:${inst.cor}">
        <div class="cartao-conta__marca">${marca}</div>
        <div class="cartao-conta__info">
          <h4>${U.escapeHTML(c.name)}
            ${c.is_default ? '<span class="selo selo--mini">padrão</span>' : ""}
            ${c.active === false ? '<span class="selo selo--mini selo--apagado">arquivada</span>' : ""}
          </h4>
          <small>${U.escapeHTML(inst.curto)} · ${U.escapeHTML(c.tipoRotulo)}${
            c.last_four_digits ? ` · ····${U.escapeHTML(c.last_four_digits)}` : ""}</small>
          <small class="cartao-conta__extra">${lancamentos} lançamento(s)</small>
        </div>
        <div class="cartao-conta__lado">
          <strong class="${c.saldo < 0 ? "cor-vermelha" : ""}">${U.moeda(c.saldo)}</strong>
          ${c.saldo < 0 ? '<small class="cor-vermelha">saldo devedor</small>' : ""}
          <div class="acoes-card">
            <button type="button" class="btn-secundario btn-mini" data-editar="${c.id}">Editar</button>
            <button type="button" class="btn-secundario btn-mini" data-arquivar="${c.id}">${c.active === false ? "Reativar" : "Arquivar"}</button>
            <button type="button" class="btn-excluir-item" data-excluir="${c.id}" aria-label="Excluir conta">✕</button>
          </div>
        </div>
      </article>`;
  }

  function renderContas() {
    const filtro = $("filtroStatus").value;
    const lista = contasComSaldo().filter((c) =>
      filtro === "todas" ? true : filtro === "ativas" ? c.active !== false : c.active === false
    );

    $("vazioContas").hidden = lista.length > 0;
    $("listaContas").innerHTML = lista.map(cartaoConta).join("");

    $("listaContas").querySelectorAll("[data-editar]").forEach((b) =>
      b.addEventListener("click", () => abrirConta(b.dataset.editar)));
    $("listaContas").querySelectorAll("[data-arquivar]").forEach((b) =>
      b.addEventListener("click", () => alternarArquivo(b.dataset.arquivar)));
    $("listaContas").querySelectorAll("[data-excluir]").forEach((b) =>
      b.addEventListener("click", () => pedirExclusao(b.dataset.excluir)));
  }

  function renderInstituicoes(comSaldo) {
    const linhas = C.porInstituicao(comSaldo);
    $("blocoInstituicoes").hidden = linhas.length < 2;
    $("listaInstituicoes").innerHTML = linhas.map((l) => `
      <li>
        <span class="ponto-banco" style="--cor:${l.instituicao.cor}"></span>
        <span class="inst-nome">${U.escapeHTML(l.instituicao.curto)}</span>
        <span class="inst-contas">${l.contas} conta(s)</span>
        <strong class="${l.total < 0 ? "cor-vermelha" : ""}">${U.moeda(l.total)}</strong>
      </li>`).join("");
  }

  /* Lançamentos antigos sem conta: a especificação pede que
     continuem funcionando e possam ser vinculados depois. */
  function renderSemConta() {
    const orfaos = transacoes.filter((t) => !t.account_id);
    $("blocoSemConta").hidden = orfaos.length === 0 || contas.length === 0;
    if (!orfaos.length || !contas.length) return;

    $("textoSemConta").textContent =
      `${orfaos.length} lançamento(s) ainda não têm conta. Eles continuam valendo no saldo geral, mas não entram no saldo de nenhuma conta.`;

    const opcoes = ativas().map((c) => `<option value="${c.id}">${U.escapeHTML(c.name)}</option>`).join("");

    $("listaSemConta").innerHTML = orfaos.slice(0, 12).map((t) => `
      <article class="item-transacao ${t.type}">
        <div class="item-info">
          <h4>${U.escapeHTML(t.description)}</h4>
          <small>${U.escapeHTML(t.category || "Outros")} · ${U.dataBR(t.date)}</small>
        </div>
        <div class="item-lado">
          <strong class="${t.type === "entrada" ? "cor-verde" : "cor-vermelha"}">
            ${t.type === "entrada" ? "+" : "−"} ${U.moeda(t.amount)}</strong>
          <select class="select-mini" data-vincular="${t.id}">
            <option value="">Vincular a…</option>${opcoes}
          </select>
        </div>
      </article>`).join("");

    $("listaSemConta").querySelectorAll("[data-vincular]").forEach((sel) =>
      sel.addEventListener("change", async () => {
        if (!sel.value) return;
        await S.atualizar("transactions", sel.dataset.vincular, { account_id: sel.value });
        U.toast("Lançamento vinculado.", "sucesso");
        carregar();
      }));
  }

  function renderTransferencias() {
    $("blocoTransferencias").hidden = transferencias.length === 0;
    const nome = (id) => contas.find((c) => String(c.id) === String(id))?.name || "conta removida";

    $("listaTransferencias").innerHTML = transferencias.slice(0, 10).map((t) => `
      <article class="item-transacao item-transferencia">
        <div class="item-info">
          <h4>${U.escapeHTML(nome(t.from_account_id))} → ${U.escapeHTML(nome(t.to_account_id))}</h4>
          <small>${U.dataBR(t.date)}${t.description ? ` · ${U.escapeHTML(t.description)}` : ""}</small>
        </div>
        <div class="item-lado">
          <strong>${U.moeda(t.amount)}</strong>
          <small class="item-dia">não altera o total</small>
          <button type="button" class="btn-excluir-item" data-excluir-transf="${t.id}" aria-label="Excluir transferência">✕</button>
        </div>
      </article>`).join("");

    $("listaTransferencias").querySelectorAll("[data-excluir-transf]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Excluir esta transferência? Os saldos das duas contas voltam ao que eram.")) return;
        await S.remover("transfers", b.dataset.excluirTransf);
        U.toast("Transferência excluída.", "info");
        carregar();
      }));
  }

  $("filtroStatus").addEventListener("change", renderContas);

  /* ============================================================
     Cadastro de conta
     ============================================================ */
  function pintarInstituicoes() {
    $("gradeInstituicoes").innerHTML = cfg.INSTITUICOES.map((i) => `
      <button type="button" class="opcao-banco${i.id === instituicaoEscolhida ? " opcao-banco--ativa" : ""}"
              data-inst="${i.id}" style="--cor:${i.cor}"
              aria-pressed="${i.id === instituicaoEscolhida}">
        ${i.logo
          ? `<img src="${i.logo}" alt="" class="opcao-banco__logo" loading="lazy">`
          : `<span class="opcao-banco__sigla">${U.escapeHTML(i.curto)}</span>`}
        <span class="opcao-banco__nome">${U.escapeHTML(i.curto)}</span>
      </button>`).join("");

    $("campoOutraInstituicao").hidden = instituicaoEscolhida !== "outro";

    $("gradeInstituicoes").querySelectorAll("[data-inst]").forEach((b) =>
      b.addEventListener("click", () => {
        instituicaoEscolhida = b.dataset.inst;
        pintarInstituicoes();
        // sugere um nome quando o campo ainda está vazio
        const nome = $("contaNome");
        if (!nome.value.trim()) {
          const inst = C.instituicao(instituicaoEscolhida);
          if (inst.id !== "outro") nome.value = `${inst.curto} principal`;
        }
      }));
  }

  function abrirConta(id) {
    const c = id ? contas.find((x) => String(x.id) === String(id)) : null;
    $("tituloConta").textContent = c ? "Editar conta" : "Nova conta";
    $("contaId").value = c?.id || "";
    $("contaNome").value = c?.name || "";
    $("contaDigitos").value = c?.last_four_digits || "";
    $("contaNota").value = c?.notes || "";
    $("contaData").value = c?.initial_balance_date
      ? String(c.initial_balance_date).slice(0, 10) : U.hojeISO();
    $("contaPadrao").checked = Boolean(c?.is_default);

    const saldo = Number(c?.initial_balance || 0);
    $("contaNegativa").checked = saldo < 0;
    U.escreverMoeda("contaSaldo", Math.abs(saldo));

    $("contaTipo").innerHTML = cfg.TIPOS_CONTA
      .map((t) => `<option value="${t.id}"${c?.account_type === t.id ? " selected" : ""}>${t.rotulo}</option>`).join("");

    const conhecida = cfg.INSTITUICOES.some((i) => i.id === c?.institution_name);
    instituicaoEscolhida = c ? (conhecida ? c.institution_name : "outro") : "inter";
    $("contaOutraInstituicao").value = conhecida ? "" : (c?.notes_institution || "");
    pintarInstituicoes();

    U.abrirModal("modalConta");
  }

  $("btnNovaConta").addEventListener("click", () => abrirConta(null));

  $("formConta").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = $("contaId").value;
    const nome = $("contaNome").value.trim();
    if (!nome) return U.toast("Dê um nome para a conta.", "erro");
    if (!$("contaData").value) return U.toast("Informe a data do saldo inicial.", "erro");

    const digitos = $("contaDigitos").value.replace(/\D/g, "").slice(0, 4);
    const bruto = U.lerMoeda("contaSaldo");
    const saldoInicial = $("contaNegativa").checked ? -bruto : bruto;

    const dados = {
      name: nome,
      institution_name: instituicaoEscolhida,
      account_type: $("contaTipo").value,
      initial_balance: saldoInicial,
      initial_balance_date: $("contaData").value,
      last_four_digits: digitos || null,
      color: C.instituicao(instituicaoEscolhida).cor,
      notes: $("contaNota").value.trim() || null,
      is_default: $("contaPadrao").checked,
      active: true,
    };

    try {
      // só uma conta padrão por vez
      if (dados.is_default) {
        for (const c of contas.filter((x) => x.is_default && String(x.id) !== String(id))) {
          await S.atualizar("accounts", c.id, { is_default: false });
        }
      }
      if (id) await S.atualizar("accounts", id, dados);
      else await S.inserir("accounts", dados);

      U.fecharModal("modalConta");
      U.toast("Conta salva.", "sucesso");
      carregar();
    } catch (err) { U.toast(err.message, "erro"); }
  });

  async function alternarArquivo(id) {
    const c = contas.find((x) => String(x.id) === String(id));
    const arquivando = c.active !== false;
    if (arquivando && !confirm(`Arquivar "${c.name}"? Ela sai dos formulários de novos lançamentos, mas todo o histórico continua.`)) return;
    await S.atualizar("accounts", id, { active: !arquivando, is_default: false });
    U.toast(arquivando ? "Conta arquivada." : "Conta reativada.", "info");
    carregar();
  }

  /* ---------- exclusão com dependências (seção 7) ---------- */
  let contaParaExcluir = null;

  function pedirExclusao(id) {
    const c = contas.find((x) => String(x.id) === String(id));
    const usos = transacoes.filter((t) => String(t.account_id) === String(id)).length;
    const transf = transferencias.filter((t) =>
      String(t.from_account_id) === String(id) || String(t.to_account_id) === String(id)).length;

    if (usos === 0 && transf === 0) {
      if (!confirm(`Excluir "${c.name}"? Ela não tem nenhum lançamento.`)) return;
      S.remover("accounts", id).then(() => { U.toast("Conta excluída.", "info"); carregar(); });
      return;
    }

    contaParaExcluir = id;
    $("textoExcluirConta").textContent =
      `"${c.name}" tem ${usos} lançamento(s) e ${transf} transferência(s). Escolha o que fazer com esse histórico.`;
    $("contaDestinoMover").innerHTML = ativas()
      .filter((x) => String(x.id) !== String(id))
      .map((x) => `<option value="${x.id}">${U.escapeHTML(x.name)}</option>`).join("");
    $("campoContaDestino").hidden = true;
    U.abrirModal("modalExcluirConta");
  }

  document.querySelectorAll("[data-acao-conta]").forEach((b) =>
    b.addEventListener("click", async () => {
      const acao = b.dataset.acaoConta;
      const id = contaParaExcluir;
      if (!id) return;

      if (acao === "mover" && $("campoContaDestino").hidden) {
        // primeiro clique revela para onde vai; o segundo confirma
        $("campoContaDestino").hidden = false;
        b.querySelector("strong").textContent = "Confirmar e apagar";
        return;
      }

      try {
        if (acao === "arquivar") {
          await S.atualizar("accounts", id, { active: false, is_default: false });
          U.toast("Conta arquivada com o histórico preservado.", "sucesso");
        } else {
          if (acao === "mover") {
            const destino = $("contaDestinoMover").value;
            if (!destino) return U.toast("Escolha a conta de destino.", "erro");
            for (const t of transacoes.filter((x) => String(x.account_id) === String(id))) {
              await S.atualizar("transactions", t.id, { account_id: destino });
            }
          }
          // transferências que citam a conta somem junto: sem uma das
          // pontas elas não descrevem mais movimento nenhum
          for (const t of transferencias.filter((x) =>
            String(x.from_account_id) === String(id) || String(x.to_account_id) === String(id))) {
            await S.remover("transfers", t.id);
          }
          for (const a of ajustes.filter((x) => String(x.account_id) === String(id))) {
            await S.remover("balance_adjustments", a.id);
          }
          await S.remover("accounts", id);
          U.toast("Conta excluída.", "info");
        }
        contaParaExcluir = null;
        U.fecharModal("modalExcluirConta");
        carregar();
      } catch (err) { U.toast(err.message, "erro"); }
    }));

  /* ============================================================
     Transferência interna
     ============================================================ */
  function abrirTransferencia() {
    const lista = ativas();
    if (lista.length < 2) {
      return U.toast("Cadastre pelo menos duas contas para transferir entre elas.", "info");
    }
    const opcoes = (selecionado) => lista
      .map((c) => `<option value="${c.id}"${String(c.id) === String(selecionado) ? " selected" : ""}>${U.escapeHTML(c.name)} · ${U.moeda(c.saldo)}</option>`).join("");

    $("transferOrigem").innerHTML = opcoes(lista[0].id);
    $("transferDestino").innerHTML = opcoes(lista[1].id);
    $("transferData").value = U.hojeISO();
    $("transferDescricao").value = "";
    U.limparMoeda("transferValor");
    U.abrirModal("modalTransferencia");
  }

  $("btnTransferir").addEventListener("click", abrirTransferencia);

  $("formTransferencia").addEventListener("submit", async (e) => {
    e.preventDefault();
    const origem = $("transferOrigem").value;
    const destino = $("transferDestino").value;
    const valor = U.lerMoeda("transferValor");

    const erro = C.validarTransferencia({ origem, destino, valor });
    if (erro) return U.toast(erro, "erro");
    if (!$("transferData").value) return U.toast("Informe a data.", "erro");

    try {
      /* Uma linha só: a transferência é atômica por construção.
         Se fossem duas transações (uma de saída e uma de entrada),
         falhar no meio deixaria dinheiro sumido de uma conta sem
         aparecer na outra. */
      await S.inserir("transfers", {
        from_account_id: origem,
        to_account_id: destino,
        amount: valor,
        date: $("transferData").value,
        description: $("transferDescricao").value.trim() || null,
      });
      U.fecharModal("modalTransferencia");
      U.toast("Transferência registrada. O saldo consolidado não mudou.", "sucesso");
      carregar();
    } catch (err) { U.toast(err.message, "erro"); }
  });

  /* ============================================================
     Ajuste de saldo
     ============================================================ */
  function abrirAjuste() {
    const lista = ativas();
    if (!lista.length) return U.toast("Cadastre uma conta antes de ajustar saldo.", "info");

    $("ajusteConta").innerHTML = lista
      .map((c) => `<option value="${c.id}">${U.escapeHTML(c.name)}</option>`).join("");
    $("ajusteData").value = U.hojeISO();
    $("ajusteMotivo").value = "";
    $("ajusteConfirma").checked = false;
    $("ajusteNegativo").checked = false;
    U.limparMoeda("ajusteSaldo");
    atualizarPreviaAjuste();
    U.abrirModal("modalAjuste");
  }

  function saldoEsperadoDaConta() {
    const c = contasComSaldo().find((x) => String(x.id) === $("ajusteConta").value);
    return c ? c.saldo : 0;
  }

  function atualizarPreviaAjuste() {
    const esperado = saldoEsperadoDaConta();
    $("saldoEsperado").innerHTML =
      `Pelo FinCK, essa conta deveria ter <strong>${U.moeda(esperado)}</strong>.`;

    const bruto = U.lerMoeda("ajusteSaldo");
    const real = $("ajusteNegativo").checked ? -bruto : bruto;
    const dif = C.diferencaDoAjuste(esperado, real);

    $("diferencaAjuste").textContent = bruto === 0
      ? "Informe o saldo que aparece no seu extrato."
      : dif === 0
      ? "Os valores já batem — nenhum ajuste será criado."
      : `Vamos registrar um ajuste de ${dif > 0 ? "+" : "−"} ${U.moeda(Math.abs(dif))}. Ele não entra no relatório de gastos.`;
  }

  ["ajusteConta", "ajusteSaldo", "ajusteNegativo"].forEach((id) => {
    $(id).addEventListener("input", atualizarPreviaAjuste);
    $(id).addEventListener("change", atualizarPreviaAjuste);
  });

  $("btnAjustar").addEventListener("click", abrirAjuste);

  $("formAjuste").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!$("ajusteConfirma").checked) return U.toast("Confirme que conferiu o saldo.", "erro");
    if (!$("ajusteData").value) return U.toast("Informe a data da conferência.", "erro");

    const esperado = saldoEsperadoDaConta();
    const bruto = U.lerMoeda("ajusteSaldo");
    const real = $("ajusteNegativo").checked ? -bruto : bruto;
    const dif = C.diferencaDoAjuste(esperado, real);

    if (dif === 0) {
      U.fecharModal("modalAjuste");
      return U.toast("Nada a ajustar: os valores já batem.", "info");
    }

    try {
      await S.inserir("balance_adjustments", {
        account_id: $("ajusteConta").value,
        amount: dif,
        new_balance: real,
        date: $("ajusteData").value,
        reason: $("ajusteMotivo").value.trim() || null,
      });
      U.fecharModal("modalAjuste");
      U.toast("Saldo ajustado.", "sucesso");
      carregar();
    } catch (err) { U.toast(err.message, "erro"); }
  });

  carregar();
});
