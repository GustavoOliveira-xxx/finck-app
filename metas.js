

document.addEventListener('DOMContentLoaded', () => {

    const btnNovaMeta        = document.getElementById('btnNovaMeta');
    const modalMeta          = document.getElementById('modalMeta');
    const fecharModalMetaBtn = document.getElementById('fecharModalMeta');
    const formMeta           = document.getElementById('formMeta');
    const tipoRentabilidade  = document.getElementById('tipoRentabilidade');
    const campoTaxa          = document.getElementById('campoTaxa');
    const listaMetas         = document.getElementById('listaMetas');
    const aviso              = document.getElementById('aviso');
    const btnSair            = document.getElementById('btnSair');

    const modalAporte        = document.getElementById('modalAporte');
    const fecharModalAporte  = document.getElementById('fecharModalAporte');
    const formAporte         = document.getElementById('formAporte');
    const modalDetalhes      = document.getElementById('modalDetalhes');
    const fecharModalDetalhes = document.getElementById('fecharModalDetalhes');

    let metaEmEdicaoId   = null;
    let graficoProgresso = null;

   
    function formatarMoeda(valor) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    }

    function calcularMesesRestantes(dataLimite) {
        const hoje = new Date(); hoje.setHours(0,0,0,0);
        const fim  = new Date(dataLimite + 'T00:00:00'); fim.setHours(0,0,0,0);
        if (fim < hoje) return 0;
        return Math.max(0, (fim.getFullYear() - hoje.getFullYear()) * 12 + (fim.getMonth() - hoje.getMonth()));
    }

    function calcularProgresso(atual, total) {
        return Math.min(100, Math.max(0, (atual / total) * 100));
    }

    function calcularValorMensal(valorFalta, meses, taxaMensal = 0) {
        if (meses <= 0) return valorFalta;
        if (taxaMensal <= 0) return valorFalta / meses;
        const taxa = taxaMensal / 100;
        return valorFalta / (((Math.pow(1 + taxa, meses) - 1) / taxa) * (1 + taxa));
    }

    function aplicarRendimento(valor, taxa) {
        if (!taxa || taxa <= 0) return valor;
        return valor * (1 + taxa / 100);
    }

    function mostrarAviso(texto, tipo = 'info') {
        if (!aviso) return;
        aviso.textContent = texto;
        aviso.className = `aviso visivel ${tipo}`;
        aviso.style.display = 'block';
        clearTimeout(aviso._timer);
        aviso._timer = setTimeout(() => {
            aviso.classList.remove('visivel');
            setTimeout(() => { aviso.style.display = 'none'; }, 300);
        }, 3500);
    }

  
    function pegarMetas() {
        const dados = localStorage.getItem('finckMetas');
        return dados ? JSON.parse(dados) : [];
    }

    function salvarMetas(lista) {
        localStorage.setItem('finckMetas', JSON.stringify(lista));
        atualizarResumoGeral();
        renderizarMetas();
    }

    
    function atualizarResumoGeral() {
        const metas = pegarMetas();
        let totalReservado = 0, totalRendendo = 0, totalFalta = 0;
        metas.forEach(meta => {
            totalReservado += Number(meta.valorAtual);
            if (meta.tipo === 'cdb') totalRendendo += Number(meta.valorAtual);
            totalFalta += Math.max(0, Number(meta.valorTotal) - Number(meta.valorAtual));
        });
        const el = (id) => document.getElementById(id);
        if (el('totalReservado')) el('totalReservado').textContent = formatarMoeda(totalReservado);
        if (el('totalRendendo'))  el('totalRendendo').textContent  = formatarMoeda(totalRendendo);
        if (el('totalFalta'))     el('totalFalta').textContent     = formatarMoeda(totalFalta);
    }

  
    function renderizarMetas() {
        const metas = pegarMetas();
        if (!listaMetas) return;

        if (metas.length === 0) {
            listaMetas.innerHTML = `<div class="vazio">🎯 Nenhuma meta cadastrada ainda.<br>Comece agora mesmo definindo seus objetivos!</div>`;
            return;
        }

        listaMetas.innerHTML = metas.map(meta => {
            const progresso = calcularProgresso(meta.valorAtual, meta.valorTotal);
            const mesesRestantes = calcularMesesRestantes(meta.dataLimite);
            const concluida = progresso >= 99.9;

            return `
            <div class="card-meta ${concluida ? 'concluida' : ''} ${meta.tipo === 'cdb' ? 'rendendo' : ''}" data-id="${meta.id}">
                <div class="cabecalho-meta">
                    <h4>${escapeHtml(meta.nome)}</h4>
                    ${meta.tipo === 'cdb' ? `<span class="etiqueta-rendimento">+ ${Number(meta.taxa).toFixed(2)}% a.m.</span>` : ''}
                    ${concluida ? '<span class="etiqueta-concluida">✅ Concluída</span>' : ''}
                </div>
                <div class="barra-progresso-container">
                    <div class="barra-progresso ${concluida ? 'concluida' : ''}" style="width: ${progresso}%"></div>
                </div>
                <div class="info-linha">
                    <span>Progresso: ${progresso.toFixed(1)}%</span>
                    <span>${mesesRestantes > 0 ? `${mesesRestantes} meses restantes` : 'Prazo vencido'}</span>
                </div>
                <div class="valores-meta">
                    <span class="valor-atual">${formatarMoeda(meta.valorAtual)}</span>
                    <span class="valor-total">de ${formatarMoeda(meta.valorTotal)}</span>
                </div>
                <div class="acoes-meta">
                    <button class="btn-meta btn-adicionar" data-action="aporte" data-id="${meta.id}">Adicionar</button>
                    <button class="btn-meta btn-detalhes" data-action="detalhes" data-id="${meta.id}">Detalhes</button>
                </div>
            </div>`;
        }).join('');

        listaMetas.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.dataset.action === 'aporte')   abrirModalAporte(btn.dataset.id);
                if (btn.dataset.action === 'detalhes') abrirModalDetalhes(btn.dataset.id);
            });
        });
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }


    function abrirModalMeta(meta = null) {
        metaEmEdicaoId = meta ? meta.id : null;
        const titulo = document.getElementById('tituloModalMeta');
        if (titulo) titulo.textContent = meta ? 'Editar Meta' : 'Cadastrar Nova Meta';

        if (meta) {
            document.getElementById('nomeMeta').value         = meta.nome;
            document.getElementById('valorTotalMeta').value   = meta.valorTotal;
            document.getElementById('dataLimiteMeta').value   = meta.dataLimite;
            document.getElementById('valorInicialMeta').value = meta.valorAtual;
            document.getElementById('tipoRentabilidade').value = meta.tipo;
            document.getElementById('taxaMeta').value         = meta.taxa || '';
            if (campoTaxa) campoTaxa.style.display = meta.tipo === 'cdb' ? 'block' : 'none';
        } else {
            if (formMeta) formMeta.reset();
            if (campoTaxa) campoTaxa.style.display = 'none';
        }

        if (modalMeta) { modalMeta.classList.add('ativo'); document.body.style.overflow = 'hidden'; }
    }

    function fecharModal(modal) {
        if (modal) { modal.classList.remove('ativo'); document.body.style.overflow = 'auto'; }
    }

    function abrirModalAporte(id) {
        const meta = pegarMetas().find(m => m.id === id);
        if (!meta) return;
        const nomeEl = document.getElementById('nomeMetaAporte');
        if (nomeEl) nomeEl.textContent = meta.nome;
        if (formAporte) { formAporte.dataset.id = id; formAporte.reset(); }
        if (modalAporte) { modalAporte.classList.add('ativo'); document.body.style.overflow = 'hidden'; }
    }

    function abrirModalDetalhes(id) {
        const meta = pegarMetas().find(m => m.id === id);
        if (!meta) return;

        const progresso   = calcularProgresso(meta.valorAtual, meta.valorTotal);
        const meses       = calcularMesesRestantes(meta.dataLimite);
        const falta       = Math.max(0, meta.valorTotal - meta.valorAtual);
        const valorMensal = calcularValorMensal(falta, meses, meta.taxa || 0);

        const el = (i) => document.getElementById(i);
        if (el('tituloDetalhes')) el('tituloDetalhes').textContent = meta.nome;
        if (el('detalheTotal'))   el('detalheTotal').textContent   = formatarMoeda(meta.valorTotal);
        if (el('detalheAtual'))   el('detalheAtual').textContent   = formatarMoeda(meta.valorAtual);
        if (el('detalheFalta'))   el('detalheFalta').textContent   = formatarMoeda(falta);
        if (el('detalheMensal'))  el('detalheMensal').textContent  = meses > 0 ? formatarMoeda(valorMensal) : '—';
        if (el('detalhePrazo'))   el('detalhePrazo').textContent   = new Date(meta.dataLimite + 'T00:00:00').toLocaleDateString('pt-BR');
        if (el('detalheTempo'))   el('detalheTempo').textContent   = meses > 0 ? `${meses} meses` : 'Vencido';

      
        if (graficoProgresso) { graficoProgresso.destroy(); graficoProgresso = null; }
        const canvas = document.getElementById('graficoProgresso');
        if (canvas && typeof Chart !== 'undefined') {
            graficoProgresso = new Chart(canvas.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: ['Alcançado', 'Falta'],
                    datasets: [{ data: [progresso, 100 - progresso], backgroundColor: ['rgba(31,209,143,0.75)', 'rgba(255,255,255,0.1)'], borderWidth: 0 }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, cutout: '78%',
                    plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.parsed.toFixed(1)}%` } } }
                }
            });
        }

      
        if (el('btnAporteDetalhe'))  el('btnAporteDetalhe').onclick  = () => { fecharModal(modalDetalhes); abrirModalAporte(id); };
        if (el('btnEditarDetalhe'))  el('btnEditarDetalhe').onclick  = () => { fecharModal(modalDetalhes); abrirModalMeta(meta); };
        if (el('btnExcluirDetalhe')) el('btnExcluirDetalhe').onclick = () => excluirMeta(id);

        if (modalDetalhes) { modalDetalhes.classList.add('ativo'); document.body.style.overflow = 'hidden'; }
    }


    if (formMeta) {
        formMeta.addEventListener('submit', e => {
            e.preventDefault();
            const metas = pegarMetas();
            const isEdicao = !!metaEmEdicaoId;

            const novaMeta = {
                id:          metaEmEdicaoId || Date.now().toString(),
                nome:        document.getElementById('nomeMeta').value.trim(),
                valorTotal:  parseFloat(document.getElementById('valorTotalMeta').value),
                valorAtual:  parseFloat(document.getElementById('valorInicialMeta').value) || 0,
                dataLimite:  document.getElementById('dataLimiteMeta').value,
                tipo:        tipoRentabilidade.value,
                taxa:        tipoRentabilidade.value === 'cdb' ? parseFloat(document.getElementById('taxaMeta').value) || 0 : 0,
                dataCriacao: isEdicao ? (metas.find(m => m.id === metaEmEdicaoId)?.dataCriacao || new Date().toISOString()) : new Date().toISOString()
            };

            if (isEdicao) {
                const idx = metas.findIndex(m => m.id === metaEmEdicaoId);
                if (idx >= 0) metas[idx] = novaMeta;
                mostrarAviso('Meta atualizada com sucesso!', 'sucesso');
            } else {
                metas.push(novaMeta);
                mostrarAviso('Meta cadastrada! +15 XP', 'sucesso');

               
                if (typeof ganharXP !== 'undefined') ganharXP(REGRAS_XP.novaMeta, 'Criou uma nova meta!');
                if (typeof desbloquearConquista !== 'undefined') desbloquearConquista('primeira_meta');
            }

            salvarMetas(metas);
            fecharModal(modalMeta);
        });
    }

    if (formAporte) {
        formAporte.addEventListener('submit', e => {
            e.preventDefault();
            const id    = e.target.dataset.id;
            const valor = parseFloat(document.getElementById('valorAporte').value);
            const metas = pegarMetas();
            const meta  = metas.find(m => m.id === id);
            if (!meta || isNaN(valor) || valor <= 0) return;

          
            const transacoes = JSON.parse(localStorage.getItem('finckTransacoes')) || [];
            let entradas = 0, saidas = 0;
            transacoes.forEach(t => {
                if (t.tipo === "entrada") entradas += Number(t.valor);
                else if (t.tipo === "saida") saidas += Number(t.valor);
            });
            const saldoDisponivel = entradas - saidas;

            if (valor > saldoDisponivel) {
                mostrarAviso(`Saldo insuficiente na conta! Saldo atual: ${formatarMoeda(saldoDisponivel)}`, 'erro');
                return;
            }

            const jaEstavaConcluida = (meta.valorAtual / meta.valorTotal) >= 0.999;
            meta.valorAtual = Number(meta.valorAtual) + valor;
        

            const agora_concluida = (meta.valorAtual / meta.valorTotal) >= 0.999;

            salvarMetas(metas);
            mostrarAviso(`Valor adicionado! Saldo atual: ${formatarMoeda(meta.valorAtual)}`, 'sucesso');

          
            if (!jaEstavaConcluida && agora_concluida) {
                if (typeof ganharXP !== 'undefined') ganharXP(REGRAS_XP.metaConcluida, `Meta "${meta.nome}" concluída!`);
                if (typeof desbloquearConquista !== 'undefined') desbloquearConquista('meta_concluida');
            }

            fecharModal(modalAporte);
            e.target.reset();
        });
    }

    function excluirMeta(id) {
        if (!confirm('Tem certeza que deseja excluir esta meta?')) return;
        const metas = pegarMetas().filter(m => m.id !== id);
        salvarMetas(metas);
        mostrarAviso('Meta removida!', 'info');
        fecharModal(modalDetalhes);
    }

   
    if (tipoRentabilidade) {
        tipoRentabilidade.addEventListener('change', () => {
            if (campoTaxa) campoTaxa.style.display = tipoRentabilidade.value === 'cdb' ? 'block' : 'none';
        });
    }

    if (btnNovaMeta)          btnNovaMeta.addEventListener('click', () => abrirModalMeta());
    if (fecharModalMetaBtn)   fecharModalMetaBtn.addEventListener('click', () => fecharModal(modalMeta));
    if (fecharModalAporte)    fecharModalAporte.addEventListener('click', () => fecharModal(modalAporte));
    if (fecharModalDetalhes)  fecharModalDetalhes.addEventListener('click', () => fecharModal(modalDetalhes));

    [modalMeta, modalAporte, modalDetalhes].forEach(m => {
        if (m) m.addEventListener('click', (e) => { if (e.target === m) fecharModal(m); });
    });

    if (btnSair) {
        btnSair.addEventListener('click', () => {
            if (confirm('Deseja realmente sair?')) window.location.href = 'index.html';
        });
    }

    atualizarResumoGeral();
    renderizarMetas();
});
