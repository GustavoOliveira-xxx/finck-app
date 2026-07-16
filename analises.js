
document.addEventListener('DOMContentLoaded', () => {

    const filtroMes = document.getElementById('filtroMes');
    const filtroAno = document.getElementById('filtroAno');
    const btnFiltrar = document.getElementById('btnFiltrar');
    const resumoEntradasEl = document.getElementById('resumoEntradas');
    const resumoSaidasEl   = document.getElementById('resumoSaidas');
    const resumoSaldoEl    = document.getElementById('resumoSaldo');

    let graficoComparativo = null;
    let graficoGastos      = null;

    function formatarMoeda(valor) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    }

    function pegarTransacoes() {
        const dados = localStorage.getItem('finckTransacoes');
        return dados ? JSON.parse(dados) : [];
    }

    function filtrarPorPeriodo(transacoes, mes, ano) {
        return transacoes.filter(t => {
            const d = new Date(t.data + 'T00:00:00');
            return String(d.getMonth() + 1).padStart(2, '0') === mes && String(d.getFullYear()) === ano;
        });
    }

    function calcularTotais(lista) {
        let entradas = 0, saidas = 0;
        lista.forEach(item => {
            if (item.tipo === 'entrada') entradas += Number(item.valor);
            else saidas += Number(item.valor);
        });
        return { entradas, saidas, saldo: entradas - saidas };
    }

    function agruparPorCategoria(listaSaidas) {
        const categorias = {};
        listaSaidas.forEach(item => {
            const cat = item.descricao || 'Outros';
            categorias[cat] = (categorias[cat] || 0) + Number(item.valor);
        });
        return categorias;
    }


    function atualizarResumo(totais) {
        
        function fmtNum(v) {
            return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        if (resumoEntradasEl) resumoEntradasEl.textContent = fmtNum(totais.entradas);
        if (resumoSaidasEl)   resumoSaidasEl.textContent   = fmtNum(totais.saidas);
        if (resumoSaldoEl) {
            resumoSaldoEl.textContent = fmtNum(totais.saldo);
            resumoSaldoEl.style.color = totais.saldo >= 0 ? 'var(--verde)' : 'var(--vermelho)';
        }
    }

  
    function atualizarGraficoComparativo(entradas, saidas) {
        const canvas = document.getElementById('graficoComparativo');
        if (!canvas || typeof Chart === 'undefined') return;
        if (graficoComparativo) { graficoComparativo.destroy(); graficoComparativo = null; }

        graficoComparativo = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Entradas', 'Saídas'],
                datasets: [{
                    label: 'Valor (R$)',
                    data: [entradas, saidas],
                    backgroundColor: ['rgba(31,209,143,0.7)', 'rgba(255,77,94,0.7)'],
                    borderColor:     ['rgba(31,209,143,1)',   'rgba(255,77,94,1)'],
                    borderWidth: 2,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { backgroundColor: 'rgba(20,16,25,0.95)', titleColor: '#f3f0f8', bodyColor: '#f3f0f8', borderColor: 'rgba(255,255,255,0.15)', borderWidth: 1 }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9b93a8' } },
                    x: { grid: { display: false }, ticks: { color: '#f3f0f8', font: { weight: 600 } } }
                }
            }
        });
    }

    function atualizarGraficoGastos(categorias) {
        const canvas = document.getElementById('graficoPizza');
        if (!canvas || typeof Chart === 'undefined') return;
        const ctx = canvas.getContext('2d');
        if (graficoGastos) { graficoGastos.destroy(); graficoGastos = null; }

        const nomes   = Object.keys(categorias);
        const valores = Object.values(categorias);
        const cores   = ['rgba(104,12,144,0.75)','rgba(254,200,0,0.75)','rgba(31,209,143,0.75)','rgba(255,77,94,0.75)','rgba(147,51,196,0.75)','rgba(255,223,92,0.75)','rgba(70,180,255,0.75)','rgba(255,120,100,0.75)'];

        if (nomes.length === 0) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = '1rem Inter';
            ctx.fillStyle = '#6b6478';
            ctx.textAlign = 'center';
            ctx.fillText('Nenhum gasto registrado no período', canvas.width / 2, canvas.height / 2);
            return;
        }

        graficoGastos = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: nomes,
                datasets: [{ data: valores, backgroundColor: cores, borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: '#f3f0f8', font: { family: 'Inter', size: 12 }, padding: 12 } },
                    tooltip: { backgroundColor: 'rgba(20,16,25,0.95)', titleColor: '#f3f0f8', bodyColor: '#f3f0f8', borderColor: 'rgba(255,255,255,0.15)', borderWidth: 1 }
                }
            }
        });
    }

    let analiseXPConcedido = false; 

    function carregarDados(porClique = false) {
        const mes = filtroMes ? filtroMes.value : String(new Date().getMonth() + 1).padStart(2, '0');
        const ano = filtroAno ? filtroAno.value : String(new Date().getFullYear());

        const filtradas = filtrarPorPeriodo(pegarTransacoes(), mes, ano);
        const totais    = calcularTotais(filtradas);
        const gastos    = agruparPorCategoria(filtradas.filter(t => t.tipo === 'saida'));

        atualizarResumo(totais);
        atualizarGraficoComparativo(totais.entradas, totais.saidas);
        atualizarGraficoGastos(gastos);

        
        if (porClique && !analiseXPConcedido && typeof ganharXP !== 'undefined') {
            ganharXP(REGRAS_XP.analiseConsultada, 'Consultou análises!');
            analiseXPConcedido = true;
        }
    }

   
    if (btnFiltrar) btnFiltrar.addEventListener('click', () => carregarDados(true));

    const btnSair = document.getElementById('btnSair');
    if (btnSair) btnSair.addEventListener('click', () => { if (confirm('Deseja realmente sair?')) window.location.href = 'index.html'; });

    const hoje = new Date();
    if (filtroMes) filtroMes.value = String(hoje.getMonth() + 1).padStart(2, '0');
    if (filtroAno) filtroAno.value = String(hoje.getFullYear());
    carregarDados();
});
