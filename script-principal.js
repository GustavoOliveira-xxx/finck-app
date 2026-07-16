

document.addEventListener("DOMContentLoaded", () => {

    const STORAGE_PERFIL     = 'finckPerfil';
    const STORAGE_TRANSACOES = 'finckTransacoes';


    const saldoAtualEl    = document.getElementById("saldoAtual");
    const totalEntradasEl = document.getElementById("totalEntradas");
    const totalSaidasEl   = document.getElementById("totalSaidas");
    const listaEl         = document.getElementById("lista");
    const vazioEl         = document.getElementById("vazio");
    const modal           = document.getElementById("modal");
    const fecharModal     = document.getElementById("fecharModal");
    const formTransacao   = document.getElementById("formTransacao");
    const tipoTransacaoEl = document.getElementById("tipoTransacao");
    const valorEl         = document.getElementById("valor");
    const descricaoEl     = document.getElementById("descricao");
    const dataEl          = document.getElementById("data");
    const metaSelecionadaEl = document.getElementById("metaSelecionada");
    const btnEntrada      = document.getElementById("btnEntrada");
    const btnSaida        = document.getElementById("btnSaida");
    const avisoEl         = document.getElementById("aviso");
    const saudacaoEl      = document.getElementById("saudacao");


    const modalConfirmacao      = document.getElementById("modalConfirmacao");
    const fecharConfirmacao     = document.getElementById("fecharConfirmacao");
    const btnCancelarConfirmacao = document.getElementById("btnCancelarConfirmacao");
    const btnConfirmarSalvar    = document.getElementById("btnConfirmarSalvar");
    const confTipoEl            = document.getElementById("confTipo");
    const confValorEl           = document.getElementById("confValor");
    const confDescricaoEl       = document.getElementById("confDescricao");
    const confDataEl            = document.getElementById("confData");
    const confMetaContainer     = document.getElementById("confMetaContainer");
    const confMetaEl            = document.getElementById("confMeta");

    let dadosParaSalvar = null;

 
    function formatarMoeda(valor) {
        return Number(valor).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function mostrarAviso(texto, tipo = "info") {
        if (!avisoEl) return;
        avisoEl.textContent = texto;
        avisoEl.className = `aviso visivel ${tipo}`;
        avisoEl.style.display = "block";
        clearTimeout(avisoEl._timer);
        avisoEl._timer = setTimeout(() => {
            avisoEl.classList.remove("visivel");
            setTimeout(() => { avisoEl.style.display = "none"; }, 300);
        }, 3000);
    }

    function carregarUsuario() {
        const perfil = JSON.parse(localStorage.getItem(STORAGE_PERFIL)) || { nome: 'Usuário' };
        if (saudacaoEl) {
            const hora = new Date().getHours();
            const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
            saudacaoEl.textContent = `${saudacao}, ${perfil.nome || 'Usuário'}!`;
        }
    }

    function carregarTransacoes() {
        const dados = localStorage.getItem(STORAGE_TRANSACOES);
        return dados ? JSON.parse(dados) : [];
    }

    function carregarMetas() {
        const dados = localStorage.getItem('finckMetas');
        return dados ? JSON.parse(dados) : [];
    }

    function salvarMetas(metas) {
        localStorage.setItem('finckMetas', JSON.stringify(metas));
    }

    function carregarOpcoesMetas() {
        if (!metaSelecionadaEl) return;
        const metas = carregarMetas();
        metaSelecionadaEl.innerHTML = '<option value="">Nenhuma meta</option>';
        metas.forEach(meta => {
            const option = document.createElement("option");
            option.value = meta.id;
            option.textContent = meta.nome;
            metaSelecionadaEl.appendChild(option);
        });
    }

    function salvarTransacaoLocal(transacao) {
        const transacoes = carregarTransacoes();
        transacao.id = Date.now();
        transacoes.unshift(transacao);
        localStorage.setItem(STORAGE_TRANSACOES, JSON.stringify(transacoes));
    }

    function atualizarTotais() {
        const transacoes = carregarTransacoes();
        let entradas = 0, saidas = 0;
        transacoes.forEach(t => {
            if (t.tipo === "entrada") entradas += Number(t.valor);
            else if (t.tipo === "saida") saidas += Number(t.valor);
        });
        if (saldoAtualEl)    saldoAtualEl.textContent    = formatarMoeda(entradas - saidas);
        if (totalEntradasEl) totalEntradasEl.textContent = formatarMoeda(entradas);
        if (totalSaidasEl)   totalSaidasEl.textContent   = formatarMoeda(saidas);
    }

    function renderizarLista() {
        const transacoes = carregarTransacoes();
        if (!listaEl) return;
        listaEl.innerHTML = "";

        if (transacoes.length === 0) {
            if (vazioEl) vazioEl.style.display = "block";
            return;
        }
        if (vazioEl) vazioEl.style.display = "none";

        transacoes.slice(0, 10).forEach(t => {
            const item = document.createElement("div");
            item.className = `item-transacao ${t.tipo}`;
            item.innerHTML = `
                <div>
                    <h4>${escapeHtml(t.descricao)}</h4>
                    <small>${new Date(t.data + 'T00:00:00').toLocaleDateString("pt-BR")}</small>
                </div>
                <div style="display:flex; align-items:center; gap:1rem;">
                    <span class="item-valor">${t.tipo === "entrada" ? "+" : "-"} R$ ${formatarMoeda(t.valor)}</span>
                    <button type="button" data-id="${t.id}" class="btn-excluir-item" title="Excluir">🗑️</button>
                </div>`;
            listaEl.appendChild(item);
        });

        listaEl.querySelectorAll(".btn-excluir-item").forEach(btn => {
            btn.addEventListener("click", () => excluir(Number(btn.dataset.id)));
        });
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function excluir(id) {
        if (!confirm("Deseja excluir esta transação?")) return;
        let transacoes = carregarTransacoes();
        transacoes = transacoes.filter(t => t.id !== id);
        localStorage.setItem(STORAGE_TRANSACOES, JSON.stringify(transacoes));
        renderizarLista();
        atualizarTotais();
        mostrarAviso("Transação excluída!", "info");
    }

    function atualizarTravaDeScroll() {
        const algumAberto = (modal && !modal.hidden) || (modalConfirmacao && !modalConfirmacao.hidden);
        document.body.classList.toggle("modal-aberto", !!algumAberto);
    }

    function abrirModal(tipo) {
        if (!modal || !formTransacao || !tipoTransacaoEl) return;
        tipoTransacaoEl.value = tipo;
        const titulo = document.getElementById("tituloModal");
        if (titulo) titulo.textContent = tipo === "entrada" ? "Nova Entrada" : "Nova Saída";
        formTransacao.reset();
        carregarOpcoesMetas();
        tipoTransacaoEl.value = tipo;
        if (dataEl) dataEl.value = new Date().toISOString().split("T")[0];
        modal.hidden = false;
        atualizarTravaDeScroll();
        if (valorEl) valorEl.focus();
    }

    function fecharModalAcao() {
        if (modal) modal.hidden = true;
        atualizarTravaDeScroll();
    }

    function fecharConfirmacaoAcao() {
        if (modalConfirmacao) modalConfirmacao.hidden = true;
        dadosParaSalvar = null;
        atualizarTravaDeScroll();
    }

    
    if (btnEntrada) btnEntrada.addEventListener("click", () => abrirModal("entrada"));
    if (btnSaida)   btnSaida.addEventListener("click",   () => abrirModal("saida"));
    if (fecharModal) fecharModal.addEventListener("click", fecharModalAcao);

    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) fecharModalAcao();
        });
    }
    if (modalConfirmacao) {
        modalConfirmacao.addEventListener("click", (e) => {
            if (e.target === modalConfirmacao) fecharConfirmacaoAcao();
        });
    }

    if (formTransacao) {
        formTransacao.addEventListener("submit", (e) => {
            e.preventDefault();
            const valorFloat = parseFloat(valorEl.value.replace(",", "."));
            const descricao  = descricaoEl.value.trim();
            const data       = dataEl.value;
            const tipo       = tipoTransacaoEl.value;
            const metaId     = metaSelecionadaEl.value;

            if (isNaN(valorFloat) || valorFloat <= 0) { mostrarAviso("Informe um valor válido!", "erro"); return; }
            if (!descricao) { mostrarAviso("Informe uma descrição!", "erro"); return; }
            if (!data)      { mostrarAviso("Informe uma data!", "erro"); return; }

          
            if (metaId && tipo === "entrada") {
                const transacoes = carregarTransacoes();
                let entradas = 0, saidas = 0;
                transacoes.forEach(t => {
                    if (t.tipo === "entrada") entradas += Number(t.valor);
                    else if (t.tipo === "saida") saidas += Number(t.valor);
                });
                const saldoDisponivel = entradas - saidas;
                if (valorFloat > saldoDisponivel) {
                    mostrarAviso(`Saldo insuficiente para aportar nesta meta! Saldo atual: R$ ${formatarMoeda(saldoDisponivel)}`, "erro");
                    return;
                }
            }

        
            if (metaId && tipo === "saida") {
                const metas = carregarMetas();
                const meta = metas.find(m => m.id === metaId);
                if (meta && valorFloat > meta.valorAtual) {
                    mostrarAviso(`Valor maior do que o saldo da meta! Saldo da meta: R$ ${formatarMoeda(meta.valorAtual)}`, "erro");
                    return;
                }
            }

            dadosParaSalvar = { valor: valorFloat, descricao, data, tipo, metaId };

            if (confTipoEl)      confTipoEl.textContent      = tipo === "entrada" ? "Entrada" : "Saída";
            if (confValorEl)     confValorEl.textContent     = formatarMoeda(valorFloat);
            if (confDescricaoEl) confDescricaoEl.textContent = descricao;
            if (confDataEl)      confDataEl.textContent      = new Date(data + 'T00:00:00').toLocaleDateString("pt-BR");

            if (metaId) {
                const metas = carregarMetas();
                const meta = metas.find(m => m.id === metaId);
                if (meta) {
                    confMetaEl.textContent = meta.nome;
                    confMetaContainer.style.display = "block";
                }
            } else {
                confMetaContainer.style.display = "none";
            }

            fecharModalAcao();
            if (modalConfirmacao) modalConfirmacao.hidden = false;
            atualizarTravaDeScroll();
        });
    }

    if (btnConfirmarSalvar) {
        btnConfirmarSalvar.addEventListener("click", () => {
            if (!dadosParaSalvar) return;


            const transacoesAtuais = carregarTransacoes();
            const primeiraEntrada = !transacoesAtuais.some(t => t.tipo === "entrada");
            const primeiraSaida   = !transacoesAtuais.some(t => t.tipo === "saida");

            salvarTransacaoLocal(dadosParaSalvar);

   
            if (dadosParaSalvar.metaId) {
                const metas = carregarMetas();
                const metaIndex = metas.findIndex(m => m.id === dadosParaSalvar.metaId);
                if (metaIndex !== -1) {
                    if (dadosParaSalvar.tipo === "entrada") {
                        metas[metaIndex].valorAtual = Number(metas[metaIndex].valorAtual) + dadosParaSalvar.valor;
                    } else if (dadosParaSalvar.tipo === "saida") {
                        metas[metaIndex].valorAtual = Number(metas[metaIndex].valorAtual) - dadosParaSalvar.valor;
                    }
                    salvarMetas(metas);
                }
            }

          
            if (typeof ganharXP !== "undefined" && typeof REGRAS_XP !== "undefined") {
                if (dadosParaSalvar.tipo === "entrada") {
                    ganharXP(REGRAS_XP.novaEntrada, "Cadastrou uma entrada!");
                    if (primeiraEntrada && typeof desbloquearConquista !== "undefined") {
                        desbloquearConquista("primeira_entrada");
                    }
                } else if (dadosParaSalvar.tipo === "saida") {
                    ganharXP(REGRAS_XP.novaSaida, "Registrou uma saída!");
                    if (primeiraSaida && typeof desbloquearConquista !== "undefined") {
                        desbloquearConquista("primeira_saida");
                    }
                }
            }

            fecharConfirmacaoAcao();
            renderizarLista();
            atualizarTotais();
            mostrarAviso("Lançamento salvo com sucesso!", "sucesso");
        });
    }

    if (btnCancelarConfirmacao) btnCancelarConfirmacao.addEventListener("click", fecharConfirmacaoAcao);
    if (fecharConfirmacao)      fecharConfirmacao.addEventListener("click", fecharConfirmacaoAcao);

    const btnSair = document.getElementById("btnSair");
    if (btnSair) {
        btnSair.addEventListener("click", () => {
            if (confirm("Deseja realmente sair?")) window.location.href = "index.html";
        });
    }

    carregarUsuario();
    renderizarLista();
    atualizarTotais();
});
