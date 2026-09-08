document.addEventListener("DOMContentLoaded", async () => {
  const cfg = window.FINCK_CONFIG;
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const C = window.FinckContas;
  const F = window.FinckFinance;
  const user = await window.FinckNav.iniciarPagina({
    titulo: "Contas",
    subtitulo: "Onde seu dinheiro está"
  });
  if (!user) {
    return;
  }
  const $ = id => document.getElementById(id);
  let contas = [];
  let transacoes = [];
  let transferencias = [];
  let ajustes = [];
  let perfil = null;
  let instituicaoEscolhida = "inter";
  async function carregar() {
    [contas, transacoes, transferencias, ajustes, perfil] = await Promise.all([ S.listar("accounts", {
      ordem: "created_at",
      asc: true
    }), S.listar("transactions", {
      ordem: "date",
      asc: false
    }).then(l => l.filter(t => !t.reversed_at)), S.listar("transfers", {
      ordem: "date",
      asc: false
    }), S.listar("balance_adjustments", {
      ordem: "date",
      asc: false
    }), S.obterPerfil() ]);
    render();
  }
  const hoje = () => U.hojeISO();
  const realizadas = () => F.vigentesAteHoje(transacoes, hoje());
  const futuras = () => F.vigentesFuturas(transacoes, hoje());
  const movimentos = () => ({
    transacoes: realizadas(),
    transferencias: transferencias,
    ajustes: ajustes
  });
  const contasComSaldo = () => C.saldos(contas, movimentos());
  const ativas = () => contasComSaldo().filter(c => c.active !== false);
  function render() {
    const resumo = C.consolidado(contas, movimentos());
    $("chipContas").textContent = `${resumo.quantidade} ativa${resumo.quantidade === 1 ? "" : "s"}`;
    const origem = F.origemDoSaldo(perfil, contas);
    const naoAlocado = F.naoAlocadoDe(transacoes, origem, hoje());
    const saldoAtual = resumo.disponivel + naoAlocado;
    const aVir = futuras();
    const previsto = F.saldoDeMovimentos(aVir);
    const ambiguas = F.alocacaoAmbigua(transacoes, contas, hoje()).length;
    const linhaPrevisto = aVir.length ? `\n      <li class="linha-previsto"><span>Previsto (ainda não saiu do caixa)</span>\n          <strong class="${previsto < 0 ? "cor-vermelha" : ""}">${previsto > 0 ? "+" : ""}${U.moeda(previsto)}</strong></li>` : "";
    $("consolidado").innerHTML = `\n      <li><span>Dinheiro em contas</span>\n          <strong class="${resumo.disponivel < 0 ? "cor-vermelha" : "cor-verde"}">${U.moeda(resumo.disponivel)}</strong></li>\n      <li><span>Fora das contas (não alocado)</span>\n          <strong class="${naoAlocado < 0 ? "cor-vermelha" : ""}">${U.moeda(naoAlocado)}</strong></li>\n      <li class="linha-identidade"><span>Saldo atual (realizado)</span>\n          <strong>${U.moeda(saldoAtual)}</strong></li>${linhaPrevisto}\n      <li><span>Transferências registradas</span>\n          <strong>${transferencias.length}</strong></li>`;
    const notaOrigem = $("notaOrigemSaldo");
    if (notaOrigem) {
      notaOrigem.textContent = `${origem.nota} O saldo atual conta apenas o que já aconteceu até hoje; o previsto aparece em linha separada.`;
    }
    const aviso = $("avisoReconciliacao");
    if (aviso) {
      aviso.hidden = ambiguas === 0;
      aviso.innerHTML = ambiguas ? `<strong>${ambiguas} lançamento(s) sem conta definida.</strong>\n           Eles entram no saldo atual, mas não aparecem em nenhuma conta — e você\n           ainda não disse que devem ficar de fora. Enquanto isso, os dois números\n           acima contam histórias diferentes.\n           <a href="perfil.html#diagnostico">Resolver no diagnóstico</a>` : "";
    }
    renderContas();
    renderInstituicoes(resumo.contas);
    renderSemConta();
    renderTransferencias();
  }
  function cartaoConta(c) {
    const inst = c.instituicao;
    const marca = inst.logo ? `<img src="${inst.logo}" alt="${U.escapeHTML(inst.nome)}" class="conta-logo" loading="lazy">` : `<span class="conta-sigla" style="--cor:${inst.cor}">${U.escapeHTML(inst.curto.slice(0, 2))}</span>`;
    const lancamentos = transacoes.filter(t => String(t.account_id) === String(c.id)).length;
    return `\n      <article class="cartao-conta${c.active === false ? " cartao-conta--arquivada" : ""}"\n               style="--cor-banco:${inst.cor}">\n        <div class="cartao-conta__marca">${marca}</div>\n        <div class="cartao-conta__info">\n          <h4>${U.escapeHTML(c.name)}\n            ${c.is_default ? '<span class="selo selo--mini">padrão</span>' : ""}\n            ${c.active === false ? '<span class="selo selo--mini selo--apagado">arquivada</span>' : ""}\n          </h4>\n          <small>${U.escapeHTML(inst.curto)} · ${U.escapeHTML(c.tipoRotulo)}${c.last_four_digits ? ` · ····${U.escapeHTML(c.last_four_digits)}` : ""}</small>\n          <small class="cartao-conta__extra">${lancamentos} lançamento(s)</small>\n        </div>\n        <div class="cartao-conta__lado">\n          <strong class="${c.saldo < 0 ? "cor-vermelha" : ""}">${U.moeda(c.saldo)}</strong>\n          ${c.saldo < 0 ? '<small class="cor-vermelha">saldo devedor</small>' : ""}\n          <div class="acoes-card">\n            <button type="button" class="btn-secundario btn-mini" data-editar="${c.id}">Editar</button>\n            <button type="button" class="btn-secundario btn-mini" data-arquivar="${c.id}">${c.active === false ? "Reativar" : "Arquivar"}</button>\n            <button type="button" class="btn-excluir-item" data-excluir="${c.id}" aria-label="Excluir conta">✕</button>\n          </div>\n        </div>\n      </article>`;
  }
  function renderContas() {
    const filtro = $("filtroStatus").value;
    const lista = contasComSaldo().filter(c => filtro === "todas" ? true : filtro === "ativas" ? c.active !== false : c.active === false);
    $("vazioContas").hidden = lista.length > 0;
    $("listaContas").innerHTML = lista.map(cartaoConta).join("");
    $("listaContas").querySelectorAll("[data-editar]").forEach(b => b.addEventListener("click", () => abrirConta(b.dataset.editar)));
    $("listaContas").querySelectorAll("[data-arquivar]").forEach(b => b.addEventListener("click", () => alternarArquivo(b.dataset.arquivar)));
    $("listaContas").querySelectorAll("[data-excluir]").forEach(b => b.addEventListener("click", () => pedirExclusao(b.dataset.excluir)));
  }
  function renderInstituicoes(comSaldo) {
    const linhas = C.porInstituicao(comSaldo);
    $("blocoInstituicoes").hidden = linhas.length < 2;
    $("listaInstituicoes").innerHTML = linhas.map(l => `\n      <li>\n        <span class="ponto-banco" style="--cor:${l.instituicao.cor}"></span>\n        <span class="inst-nome">${U.escapeHTML(l.instituicao.curto)}</span>\n        <span class="inst-contas">${l.contas} conta(s)</span>\n        <strong class="${l.total < 0 ? "cor-vermelha" : ""}">${U.moeda(l.total)}</strong>\n      </li>`).join("");
  }
  function renderSemConta() {
    const orfaos = transacoes.filter(t => !t.account_id);
    $("blocoSemConta").hidden = orfaos.length === 0 || contas.length === 0;
    if (!orfaos.length || !contas.length) {
      return;
    }
    $("textoSemConta").textContent = `${orfaos.length} lançamento(s) ainda não têm conta. Eles continuam valendo no saldo geral, mas não entram no saldo de nenhuma conta.`;
    const opcoes = ativas().map(c => `<option value="${c.id}">${U.escapeHTML(c.name)}</option>`).join("");
    $("listaSemConta").innerHTML = orfaos.slice(0, 12).map(t => `\n      <article class="item-transacao ${t.type}">\n        <div class="item-info">\n          <h4>${U.escapeHTML(t.description)}</h4>\n          <small>${U.escapeHTML(t.category || "Outros")} · ${U.dataBR(t.date)}</small>\n        </div>\n        <div class="item-lado">\n          <strong class="${t.type === "entrada" ? "cor-verde" : "cor-vermelha"}">\n            ${t.type === "entrada" ? "+" : "−"} ${U.moeda(t.amount)}</strong>\n          <select class="select-mini" data-vincular="${t.id}">\n            <option value="">Vincular a…</option>${opcoes}\n          </select>\n        </div>\n      </article>`).join("");
    $("listaSemConta").querySelectorAll("[data-vincular]").forEach(sel => sel.addEventListener("change", async () => {
      if (!sel.value) {
        return;
      }
      await S.atualizar("transactions", sel.dataset.vincular, {
        account_id: sel.value
      });
      U.toast("Lançamento vinculado.", "sucesso");
      carregar();
    }));
  }
  function renderTransferencias() {
    $("blocoTransferencias").hidden = transferencias.length === 0;
    const nome = id => contas.find(c => String(c.id) === String(id))?.name || "conta removida";
    $("listaTransferencias").innerHTML = transferencias.slice(0, 10).map(t => `\n      <article class="item-transacao item-transferencia">\n        <div class="item-info">\n          <h4>${U.escapeHTML(nome(t.from_account_id))} → ${U.escapeHTML(nome(t.to_account_id))}</h4>\n          <small>${U.dataBR(t.date)}${t.description ? ` · ${U.escapeHTML(t.description)}` : ""}</small>\n        </div>\n        <div class="item-lado">\n          <strong>${U.moeda(t.amount)}</strong>\n          <small class="item-dia">não altera o total</small>\n          <button type="button" class="btn-excluir-item" data-excluir-transf="${t.id}" aria-label="Excluir transferência">✕</button>\n        </div>\n      </article>`).join("");
    $("listaTransferencias").querySelectorAll("[data-excluir-transf]").forEach(b => b.addEventListener("click", async () => {
      if (!confirm("Excluir esta transferência? Os saldos das duas contas voltam ao que eram.")) {
        return;
      }
      await S.remover("transfers", b.dataset.excluirTransf);
      U.toast("Transferência excluída.", "info");
      carregar();
    }));
  }
  $("filtroStatus").addEventListener("change", renderContas);
  function pintarInstituicoes() {
    $("gradeInstituicoes").innerHTML = cfg.INSTITUICOES.map(i => `\n      <button type="button" class="opcao-banco${i.id === instituicaoEscolhida ? " opcao-banco--ativa" : ""}"\n              data-inst="${i.id}" style="--cor:${i.cor}"\n              aria-pressed="${i.id === instituicaoEscolhida}">\n        ${i.logo ? `<img src="${i.logo}" alt="" class="opcao-banco__logo" loading="lazy">` : `<span class="opcao-banco__sigla">${U.escapeHTML(i.curto)}</span>`}\n        <span class="opcao-banco__nome">${U.escapeHTML(i.curto)}</span>\n      </button>`).join("");
    $("campoOutraInstituicao").hidden = instituicaoEscolhida !== "outro";
    $("gradeInstituicoes").querySelectorAll("[data-inst]").forEach(b => b.addEventListener("click", () => {
      instituicaoEscolhida = b.dataset.inst;
      pintarInstituicoes();
      const nome = $("contaNome");
      if (!nome.value.trim()) {
        const inst = C.instituicao(instituicaoEscolhida);
        if (inst.id !== "outro") {
          nome.value = `${inst.curto} principal`;
        }
      }
    }));
  }
  function abrirConta(id) {
    const c = id ? contas.find(x => String(x.id) === String(id)) : null;
    $("tituloConta").textContent = c ? "Editar conta" : "Nova conta";
    $("contaId").value = c?.id || "";
    $("contaNome").value = c?.name || "";
    $("contaDigitos").value = c?.last_four_digits || "";
    $("contaNota").value = c?.notes || "";
    window.FinckData.escrever("contaData", c?.initial_balance_date ? String(c.initial_balance_date).slice(0, 10) : U.hojeISO());
    $("contaPadrao").checked = Boolean(c?.is_default);
    const saldo = Number(c?.initial_balance || 0);
    $("contaNegativa").checked = saldo < 0;
    U.escreverMoeda("contaSaldo", Math.abs(saldo));
    $("contaTipo").innerHTML = cfg.TIPOS_CONTA.map(t => `<option value="${t.id}"${c?.account_type === t.id ? " selected" : ""}>${t.rotulo}</option>`).join("");
    const conhecida = cfg.INSTITUICOES.some(i => i.id === c?.institution_name);
    instituicaoEscolhida = c ? conhecida ? c.institution_name : "outro" : "inter";
    $("contaOutraInstituicao").value = conhecida ? "" : c?.notes_institution || "";
    pintarInstituicoes();
    U.abrirModal("modalConta");
  }
  $("btnNovaConta").addEventListener("click", () => abrirConta(null));
  $("formConta").addEventListener("submit", async e => {
    e.preventDefault();
    const id = $("contaId").value;
    const nome = $("contaNome").value.trim();
    if (!nome) {
      return U.toast("Dê um nome para a conta.", "erro");
    }
    if (!window.FinckData.ler("contaData")) {
      return U.toast("Informe a data do saldo inicial.", "erro");
    }
    const digitos = $("contaDigitos").value.replace(/\D/g, "").slice(0, 4);
    const bruto = U.lerMoeda("contaSaldo");
    const saldoInicial = $("contaNegativa").checked ? -bruto : bruto;
    const dados = {
      name: nome,
      institution_name: instituicaoEscolhida,
      account_type: $("contaTipo").value,
      initial_balance: saldoInicial,
      initial_balance_date: window.FinckData.ler("contaData"),
      last_four_digits: digitos || null,
      color: C.instituicao(instituicaoEscolhida).cor,
      notes: $("contaNota").value.trim() || null,
      is_default: $("contaPadrao").checked,
      active: true
    };
    try {
      if (dados.is_default) {
        for (const c of contas.filter(x => x.is_default && String(x.id) !== String(id))) {
          await S.atualizar("accounts", c.id, {
            is_default: false
          });
        }
      }
      if (id) {
        await S.atualizar("accounts", id, dados);
      } else {
        await S.inserir("accounts", dados);
      }
      U.fecharModal("modalConta");
      U.toast("Conta salva.", "sucesso");
      carregar();
    } catch (err) {
      U.toast(err.message, "erro");
    }
  });
  async function alternarArquivo(id) {
    const c = contas.find(x => String(x.id) === String(id));
    const arquivando = c.active !== false;
    if (arquivando && !confirm(`Arquivar "${c.name}"? Ela sai dos formulários de novos lançamentos, mas todo o histórico continua.`)) {
      return;
    }
    await S.atualizar("accounts", id, {
      active: !arquivando,
      is_default: false
    });
    U.toast(arquivando ? "Conta arquivada." : "Conta reativada.", "info");
    carregar();
  }
  let contaParaExcluir = null;
  function pedirExclusao(id) {
    const c = contas.find(x => String(x.id) === String(id));
    const usos = transacoes.filter(t => String(t.account_id) === String(id)).length;
    const transf = transferencias.filter(t => String(t.from_account_id) === String(id) || String(t.to_account_id) === String(id)).length;
    if (usos === 0 && transf === 0) {
      if (!confirm(`Excluir "${c.name}"? Ela não tem nenhum lançamento.`)) {
        return;
      }
      S.remover("accounts", id).then(() => {
        U.toast("Conta excluída.", "info");
        carregar();
      });
      return;
    }
    contaParaExcluir = id;
    $("textoExcluirConta").textContent = `"${c.name}" tem ${usos} lançamento(s) e ${transf} transferência(s). Escolha o que fazer com esse histórico.`;
    $("contaDestinoMover").innerHTML = ativas().filter(x => String(x.id) !== String(id)).map(x => `<option value="${x.id}">${U.escapeHTML(x.name)}</option>`).join("");
    $("campoContaDestino").hidden = true;
    U.abrirModal("modalExcluirConta");
  }
  document.querySelectorAll("[data-acao-conta]").forEach(b => b.addEventListener("click", async () => {
    const acao = b.dataset.acaoConta;
    const id = contaParaExcluir;
    if (!id) {
      return;
    }
    if (acao === "mover" && $("campoContaDestino").hidden) {
      $("campoContaDestino").hidden = false;
      b.querySelector("strong").textContent = "Confirmar e apagar";
      return;
    }
    try {
      if (acao === "arquivar") {
        await S.atualizar("accounts", id, {
          active: false,
          is_default: false
        });
        U.toast("Conta arquivada com o histórico preservado.", "sucesso");
      } else {
        if (acao === "mover") {
          const destino = $("contaDestinoMover").value;
          if (!destino) {
            return U.toast("Escolha a conta de destino.", "erro");
          }
          for (const t of transacoes.filter(x => String(x.account_id) === String(id))) {
            await S.atualizar("transactions", t.id, {
              account_id: destino
            });
          }
        }
        for (const t of transferencias.filter(x => String(x.from_account_id) === String(id) || String(x.to_account_id) === String(id))) {
          await S.remover("transfers", t.id);
        }
        for (const a of ajustes.filter(x => String(x.account_id) === String(id))) {
          await S.remover("balance_adjustments", a.id);
        }
        await S.remover("accounts", id);
        U.toast("Conta excluída.", "info");
      }
      contaParaExcluir = null;
      U.fecharModal("modalExcluirConta");
      carregar();
    } catch (err) {
      U.toast(err.message, "erro");
    }
  }));
  function abrirTransferencia() {
    const lista = ativas();
    if (lista.length < 2) {
      return U.toast("Cadastre pelo menos duas contas para transferir entre elas.", "info");
    }
    const opcoes = selecionado => lista.map(c => `<option value="${c.id}"${String(c.id) === String(selecionado) ? " selected" : ""}>${U.escapeHTML(c.name)} · ${U.moeda(c.saldo)}</option>`).join("");
    $("transferOrigem").innerHTML = opcoes(lista[0].id);
    $("transferDestino").innerHTML = opcoes(lista[1].id);
    window.FinckData.escrever("transferData", U.hojeISO());
    $("transferDescricao").value = "";
    U.limparMoeda("transferValor");
    U.abrirModal("modalTransferencia");
  }
  $("btnTransferir").addEventListener("click", abrirTransferencia);
  $("formTransferencia").addEventListener("submit", async e => {
    e.preventDefault();
    const origem = $("transferOrigem").value;
    const destino = $("transferDestino").value;
    const valor = U.lerMoeda("transferValor");
    const erro = C.validarTransferencia({
      origem: origem,
      destino: destino,
      valor: valor
    });
    if (erro) {
      return U.toast(erro, "erro");
    }
    if (!window.FinckData.ler("transferData")) {
      return U.toast("Informe a data.", "erro");
    }
    const data = window.FinckData.ler("transferData");
    const botao = e.submitter || $("formTransferencia").querySelector('button[type="submit"]');
    if (botao) {
      botao.disabled = true;
    }
    try {
      await window.FinckFinance.transferir({
        from_account_id: origem,
        to_account_id: destino,
        amount: valor,
        date: data,
        description: $("transferDescricao").value.trim() || null,
        chave: S.chaveDeOperacao("transferencia", origem, destino, valor.toFixed(2), data)
      });
      U.fecharModal("modalTransferencia");
      U.toast("Transferência registrada. O patrimônio total não mudou.", "sucesso");
      carregar();
    } catch (err) {
      await S.registrarEvento({
        scope: "transferencia",
        message: err.message,
        context: {
          origem: origem,
          destino: destino,
          valor: valor
        }
      });
      U.toast(err.message, "erro");
    } finally {
      if (botao) {
        botao.disabled = false;
      }
    }
  });
  function abrirAjuste() {
    const lista = ativas();
    if (!lista.length) {
      return U.toast("Cadastre uma conta antes de ajustar saldo.", "info");
    }
    $("ajusteConta").innerHTML = lista.map(c => `<option value="${c.id}">${U.escapeHTML(c.name)}</option>`).join("");
    window.FinckData.escrever("ajusteData", U.hojeISO());
    $("ajusteMotivo").value = "";
    $("ajusteConfirma").checked = false;
    $("ajusteNegativo").checked = false;
    U.limparMoeda("ajusteSaldo");
    atualizarPreviaAjuste();
    U.abrirModal("modalAjuste");
  }
  function saldoEsperadoDaConta() {
    const c = contasComSaldo().find(x => String(x.id) === $("ajusteConta").value);
    return c ? c.saldo : 0;
  }
  function atualizarPreviaAjuste() {
    const esperado = saldoEsperadoDaConta();
    $("saldoEsperado").innerHTML = `Pelo FinCK, essa conta deveria ter <strong>${U.moeda(esperado)}</strong>.`;
    const bruto = U.lerMoeda("ajusteSaldo");
    const real = $("ajusteNegativo").checked ? -bruto : bruto;
    const dif = C.diferencaDoAjuste(esperado, real);
    $("diferencaAjuste").textContent = bruto === 0 ? "Informe o saldo que aparece no seu extrato." : dif === 0 ? "Os valores já batem — nenhum ajuste será criado." : `Vamos registrar um ajuste de ${dif > 0 ? "+" : "−"} ${U.moeda(Math.abs(dif))}. Ele não entra no relatório de gastos.`;
  }
  [ "ajusteConta", "ajusteSaldo", "ajusteNegativo" ].forEach(id => {
    $(id).addEventListener("input", atualizarPreviaAjuste);
    $(id).addEventListener("change", atualizarPreviaAjuste);
  });
  $("btnAjustar").addEventListener("click", abrirAjuste);
  $("formAjuste").addEventListener("submit", async e => {
    e.preventDefault();
    if (!$("ajusteConfirma").checked) {
      return U.toast("Confirme que conferiu o saldo.", "erro");
    }
    if (!window.FinckData.ler("ajusteData")) {
      return U.toast("Informe a data da conferência.", "erro");
    }
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
        date: window.FinckData.ler("ajusteData"),
        reason: $("ajusteMotivo").value.trim() || null
      });
      U.fecharModal("modalAjuste");
      U.toast("Saldo ajustado.", "sucesso");
      carregar();
    } catch (err) {
      U.toast(err.message, "erro");
    }
  });
  carregar();
});
