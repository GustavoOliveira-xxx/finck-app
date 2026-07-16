

document.addEventListener('DOMContentLoaded', () => {

    const filtroMes    = document.getElementById('filtroMes');
    const filtroAno    = document.getElementById('filtroAno');
    const btnFiltrar   = document.getElementById('btnFiltrar');
    const btnExportar  = document.getElementById('btnExportar');
    const aviso        = document.getElementById('aviso');
    const btnSair      = document.getElementById('btnSair');

    const resumoEntradasEl = document.getElementById('resumoEntradas');
    const resumoSaidasEl   = document.getElementById('resumoSaidas');
    const resumoSaldoEl    = document.getElementById('resumoSaldo');
    const resumoTaxaEl     = document.getElementById('resumoTaxa');
    const qtdTransacoesEl  = document.getElementById('qtdTransacoes');

    let graficoCategorias = null;
    let graficoEvolucao   = null;
    let relatorioJaGerado = false;

 
    function formatarMoeda(valor) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    }

    function formatarData(dataISO) {
        return new Date(dataISO + 'T00:00:00').toLocaleDateString('pt-BR');
    }

    function pegarTransacoes() {
        const dados = localStorage.getItem('finckTransacoes');
        return dados ? JSON.parse(dados) : [];
    }

    function filtrarPorPeriodo(lista, mes, ano) {
        return lista.filter(item => {
            const d = new Date(item.data + 'T00:00:00');
            return String(d.getMonth() + 1).padStart(2, '0') === mes && String(d.getFullYear()) === ano;
        });
    }

    function calcularTotais(lista) {
        let entradas = 0, saidas = 0;
        lista.forEach(item => {
            if (item.tipo === 'entrada') entradas += Number(item.valor);
            else saidas += Number(item.valor);
        });
        const saldo = entradas - saidas;
        const taxaEconomia = entradas > 0 ? ((saldo / entradas) * 100).toFixed(1) : 0;
        return { entradas, saidas, saldo, taxaEconomia };
    }

    function agruparPorCategoria(listaSaidas) {
        const categorias = {};
        listaSaidas.forEach(item => {
            const cat = item.descricao || 'Outros';
            categorias[cat] = (categorias[cat] || 0) + Number(item.valor);
        });
        return categorias;
    }

    function gerarAnosDisponiveis() {
        const transacoes = pegarTransacoes();
        const anos = new Set([new Date().getFullYear()]);
        transacoes.forEach(item => anos.add(new Date(item.data + 'T00:00:00').getFullYear()));
        const ordenados = Array.from(anos).sort((a, b) => b - a);
        if (filtroAno) {
            filtroAno.innerHTML = ordenados.map(ano => `<option value="${ano}">${ano}</option>`).join('');
        }
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


    function atualizarResumo(totais) {
     
        if (resumoEntradasEl) resumoEntradasEl.textContent = formatarMoeda(totais.entradas);
        if (resumoSaidasEl)   resumoSaidasEl.textContent   = formatarMoeda(totais.saidas);
        if (resumoSaldoEl) {
            resumoSaldoEl.textContent = formatarMoeda(totais.saldo);
            resumoSaldoEl.style.color = totais.saldo >= 0 ? 'var(--verde)' : 'var(--vermelho)';
        }
        if (resumoTaxaEl)     resumoTaxaEl.textContent     = `${totais.taxaEconomia}%`;
    }

  
    function atualizarTabela(lista) {
        if (qtdTransacoesEl) qtdTransacoesEl.textContent = `${lista.length} registro${lista.length !== 1 ? 's' : ''}`;
        const corpo = document.getElementById('corpoTabela');
        if (!corpo) return;

        if (lista.length === 0) {
            corpo.innerHTML = `<tr><td colspan="5" class="vazio-tabela">Nenhuma transação encontrada para o período selecionado</td></tr>`;
            return;
        }

        corpo.innerHTML = lista.map(item => `
            <tr>
                <td>${formatarData(item.data)}</td>
                <td>${escapeHtml(item.descricao || '-')}</td>
                <td>${escapeHtml(item.descricao || 'Sem categoria')}</td>
                <td class="tipo-${item.tipo}">${item.tipo === 'entrada' ? 'Entrada' : 'Saída'}</td>
                <td class="valor-${item.tipo}">${formatarMoeda(item.valor)}</td>
            </tr>`).join('');
    }

    function escapeHtml(str) {
        return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    }

  
    function atualizarGraficoCategorias(categorias) {
        const canvas = document.getElementById('graficoCategorias');
        if (!canvas || typeof Chart === 'undefined') return;
        if (graficoCategorias) { graficoCategorias.destroy(); graficoCategorias = null; }

        const nomes   = Object.keys(categorias);
        const valores = Object.values(categorias);
        const cores   = ['rgba(104,12,144,0.75)','rgba(254,200,0,0.75)','rgba(31,209,143,0.75)','rgba(255,77,94,0.75)','rgba(147,51,196,0.75)','rgba(70,180,255,0.75)','rgba(255,120,100,0.75)','rgba(255,223,92,0.75)'];

        if (nomes.length === 0) return;

        graficoCategorias = new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: { labels: nomes, datasets: [{ data: valores, backgroundColor: cores, borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: '#f3f0f8', padding: 12 } },
                    tooltip: { callbacks: { label: ctx => `${ctx.label}: ${formatarMoeda(ctx.raw)}` } }
                }
            }
        });
    }

    
    function atualizarGraficoEvolucao(lista, mes, ano) {
        const canvas = document.getElementById('graficoEvolucao');
        if (!canvas || typeof Chart === 'undefined') return;
        if (graficoEvolucao) { graficoEvolucao.destroy(); graficoEvolucao = null; }

        const diasNoMes = new Date(parseInt(ano), parseInt(mes), 0).getDate();
        const dias = Array.from({ length: diasNoMes }, (_, i) => i + 1);
        const saldoDiario = {};
        dias.forEach(d => saldoDiario[d] = 0);
        lista.forEach(item => {
            const d = new Date(item.data + 'T00:00:00').getDate();
            if (saldoDiario[d] !== undefined) {
                saldoDiario[d] += item.tipo === 'entrada' ? Number(item.valor) : -Number(item.valor);
            }
        });

        let acumulado = 0;
        const valoresGrafico = dias.map(d => { acumulado += saldoDiario[d]; return acumulado; });

        graficoEvolucao = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: dias,
                datasets: [{
                    label: 'Saldo acumulado',
                    data: valoresGrafico,
                    borderColor: 'rgba(254,200,0,0.9)',
                    backgroundColor: 'rgba(254,200,0,0.12)',
                    fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: 'Dia do mês', color: '#9b93a8' }, ticks: { color: '#9b93a8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { title: { display: true, text: 'Valor (R$)', color: '#9b93a8' }, ticks: { color: '#9b93a8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
                },
                plugins: { tooltip: { callbacks: { label: ctx => `Saldo: ${formatarMoeda(ctx.raw)}` } } }
            }
        });
    }


    function carregarRelatorio(porClique = false) {
        const mes = filtroMes ? filtroMes.value : String(new Date().getMonth() + 1).padStart(2, '0');
        const ano = filtroAno ? filtroAno.value : String(new Date().getFullYear());
        const todasTransacoes = pegarTransacoes();
        const filtradas = filtrarPorPeriodo(todasTransacoes, mes, ano);
        const totais    = calcularTotais(filtradas);
        const gastos    = agruparPorCategoria(filtradas.filter(t => t.tipo === 'saida'));

        atualizarResumo(totais);
        atualizarTabela(filtradas.sort((a, b) => new Date(b.data + 'T00:00:00') - new Date(a.data + 'T00:00:00')));
        atualizarGraficoCategorias(gastos);
        atualizarGraficoEvolucao(filtradas, mes, ano);

     
        if (porClique && !relatorioJaGerado && typeof ganharXP !== 'undefined') {
            ganharXP(REGRAS_XP.relatorioGerado, 'Gerou um relatório!');
            relatorioJaGerado = true;
        }
    }

   
    function exportarDados() {
        const mes  = filtroMes ? filtroMes.value : String(new Date().getMonth() + 1).padStart(2, '0');
        const ano  = filtroAno ? filtroAno.value : String(new Date().getFullYear());
        const dados = filtrarPorPeriodo(pegarTransacoes(), mes, ano);

        if (dados.length === 0) { mostrarAviso('Nenhum dado para exportar', 'info'); return; }

        const csv = [
            'Data,Descrição,Tipo,Valor',
            ...dados.map(item => `${formatarData(item.data)},"${(item.descricao || '').replace(/"/g, '""')}","${item.tipo}",${item.valor}`)
        ].join('\n');

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `relatorio_${mes}_${ano}.csv`;
        link.click();
        mostrarAviso('Relatório exportado com sucesso!', 'sucesso');
    }

  
    if (btnFiltrar)  btnFiltrar.addEventListener('click', () => carregarRelatorio(true));
    if (btnExportar) btnExportar.addEventListener('click', exportarDados);
    if (btnSair)     btnSair.addEventListener('click', () => { if (confirm('Deseja realmente sair?')) window.location.href = 'index.html'; });

    
    gerarAnosDisponiveis();
    const hoje = new Date();
    if (filtroMes) filtroMes.value = String(hoje.getMonth() + 1).padStart(2, '0');
    if (filtroAno) filtroAno.value = String(hoje.getFullYear());
    carregarRelatorio();
});
