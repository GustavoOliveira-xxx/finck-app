// Painel (home): cada número com um nome só, a programação de 60 dias, o
// registro rápido e o que muda entre a primeira visita e o uso recorrente.
// As regras ficam em js/home.js (FinckPainel) e js/programacao.js, que o
// testes.html carrega antes deste arquivo.
(() => {
  const { descrever, teste, esperar } = window.FinckTestes;
  const U = window.FinckUtils;
  const F = window.FinckFinance;
  const S = window.FinckStore;

  const PN = () => window.FinckPainel;
  const P = () => window.FinckProgramacao;

  // Mesmo padrão das outras suítes: guarda o que havia no aparelho, entra na
  // demonstração vazia e devolve tudo no fim.
  const comSessaoLimpa = async fn => {
    const antes = {};
    Object.values(S.KEYS).forEach(v => {
      antes[v] = localStorage.getItem(v);
    });
    Object.values(S.KEYS).forEach(v => localStorage.removeItem(v));
    await S.entrarDemo();
    try {
      await fn();
    } finally {
      Object.values(S.KEYS).forEach(v => localStorage.removeItem(v));
      Object.entries(antes).forEach(([k, v]) => {
        if (v !== null) {
          localStorage.setItem(k, v);
        }
      });
    }
  };
  const iso = d => U.dataISO(d);
  const emDias = n => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + n);
    return d;
  };
  const JULGAMENTOS = [ "não compre", "compra ruim", "ótima compra", "boa compra", "compre agora" ];
  const textoLimpo = t => !String(t).includes(String.fromCharCode(0x2014)) &&JULGAMENTOS.every(j => !String(t).toLowerCase().includes(j));

  descrever("Painel: projeções com nome e janela (home)", () => {
    teste("saldo, sobra da renda e caixa de 60 dias são três números diferentes", () => {
      // Os valores do exemplo da auditoria: o mesmo saldo não pode aparecer
      // como "pode sobrar" e, mais abaixo, como falta.
      const p = F.projecoesDe({ saldo: 2585, renda: 3500, despesasFixas: 1354, parcelasAPagar: 0, saidasPrevistas: 3908, entradasPrevistas: 3500 });
      esperar(p.saldoAtual).aSer(2585);
      esperar(p.sobraRendaAposFixos).aSer(2146);
      esperar(p.caixaAposPrevisoes60Dias).aSer(-1323);
      esperar(p.saldoAposParcelas).aSer(2585);
      esperar(p.saidasPrevistas60Dias).aSer(3908);
      esperar(p.entradasPrevistas60Dias).aSer(3500);
      esperar(p.janelaDias).aSer(60);
      esperar(F.JANELA_PREVISOES).aSer(60);
    });
    teste("parcelas a pagar só descontam do saldo no número que leva esse nome", () => {
      const p = F.projecoesDe({ saldo: 5000, renda: 3000, despesasFixas: 1000, parcelasAPagar: 3000 });
      esperar(p.saldoAposParcelas).aSer(2000);
      esperar(p.parcelasAPagar).aSer(3000);
      esperar(p.sobraRendaAposFixos).aSer(2000);
      esperar(p.saldoAtual).aSer(5000);
    });
    teste("sem a programação carregada, o caixa de 60 dias fica vazio em vez de inventado", () => {
      const p = F.projecoesDe({ saldo: 1000, renda: 2000, despesasFixas: 500 });
      esperar(p.caixaAposPrevisoes60Dias).aSer(null);
      esperar(p.saidasPrevistas60Dias).aSer(null);
      esperar(p.entradasPrevistas60Dias).aSer(null);
    });
    teste("valores ausentes ou inválidos viram zero, sem NaN na tela", () => {
      const p = F.projecoesDe({ saldo: "abc", renda: undefined, despesasFixas: null, parcelasAPagar: "", saidasPrevistas: "x" });
      esperar(p.saldoAtual).aSer(0);
      esperar(p.sobraRendaAposFixos).aSer(0);
      esperar(p.saldoAposParcelas).aSer(0);
      esperar(p.caixaAposPrevisoes60Dias).aSer(0);
      const vazio = F.projecoesDe();
      esperar(vazio.saldoAtual).aSer(0);
      esperar(vazio.caixaAposPrevisoes60Dias).aSer(null);
    });
    teste("carregarContexto entrega as projeções e mantém o disponível projetado do Reality", async () => {
      await comSessaoLimpa(async () => {
        await S.salvarPerfil({ income_monthly: 3000, work_days_month: 22, work_hours_day: 8, initial_balance: 5000 });
        await S.inserir("installment_purchases", { description: "Notebook", total_amount: 3000, installments_count: 3, first_due_date: iso(emDias(10)), paid_count: 0, active: true });
        await S.inserir("recurring_transactions", { description: "Aluguel", type: "saida", amount: 1000, day_of_month: emDias(5).getDate(), active: true });
        const ctx = await F.carregarContexto();
        esperar(ctx.saldo).aSer(5000);
        esperar(ctx.disponivelProjetado).aSer(2000);
        esperar(ctx.projecoes.saldoAposParcelas).aSer(ctx.disponivelProjetado);
        esperar(ctx.projecoes.sobraRendaAposFixos).aSer(ctx.renda - ctx.despesasFixas);
        esperar(ctx.programacao === null).aSerFalso();
        esperar(ctx.projecoes.saidasPrevistas60Dias).aSer(ctx.programacao.comprometidoTotal);
        esperar(ctx.projecoes.caixaAposPrevisoes60Dias).aSer(ctx.saldo - ctx.programacao.comprometidoTotal);
        esperar(ctx.programacao.naoComprometido).aSer(ctx.projecoes.caixaAposPrevisoes60Dias);
        // Duas parcelas do notebook cabem em 60 dias; o aluguel, uma ou duas vezes.
        esperar(ctx.programacao.compromissos.filter(c => c.origem === "parcela").length >= 2).aSerVerdadeiro();
        esperar(ctx.programacao.compromissos.some(c => c.origem === "recorrente")).aSerVerdadeiro();
      });
    });
  });

  descrever("Painel: programação de 60 dias", () => {
    const referencia = new Date(2026, 9, 8, 12, 0, 0);
    const fonte = {
      recorrentes: [
        { id: "r1", description: "Aluguel", type: "saida", amount: 1200, day_of_month: 10, active: true },
        { id: "r2", description: "Salário", type: "entrada", amount: 3500, day_of_month: 5, active: true }
      ],
      agendadas: [
        { id: "t1", description: "Aluguel", type: "saida", amount: 1200, date: "2026-10-10" },
        { id: "t2", description: "Tênis", type: "saida", amount: 380, date: "2026-10-12" },
        { id: "t3", description: "Dentista", type: "saida", amount: 200, date: "2026-10-20", reversed_at: "2026-10-08T10:00:00Z" },
        { id: "t4", description: "Mercado", type: "saida", amount: 620, date: "2026-10-08" }
      ],
      parcelamentos: [ { id: "p1", description: "Geladeira", total_amount: 900, installments_count: 3, first_due_date: "2026-09-15", paid_count: 1, active: true } ],
      pagamentos: []
    };
    teste("soma recorrentes, lançamentos agendados e parcelas, sem contar duas vezes", async () => {
      const lista = P().compromissos(fonte, { dias: 60, referencia: referencia });
      const nomes = lista.map(c => c.descricao);
      // O aluguel agendado no extrato e o recorrente do mesmo dia são a mesma saída.
      esperar(nomes.filter(n => n === "Aluguel").length).aSer(2);
      esperar(nomes.includes("Tênis")).aSerVerdadeiro();
      esperar(lista.find(c => c.descricao === "Tênis").origem).aSer("agendada");
      // Estornado não sai; o de hoje já está no saldo.
      esperar(nomes.includes("Dentista")).aSerFalso();
      esperar(nomes.includes("Mercado")).aSerFalso();
      // A parcela 1 foi paga; a 2 (15/10) e a 3 (15/11) entram.
      const parcelas = lista.filter(c => c.origem === "parcela");
      esperar(parcelas.length).aSer(2);
      esperar(parcelas[0].descricao).aConter("parcela 2/3");
      esperar(nomes.includes("Salário")).aSerFalso();
    });
    teste("entradas previstas aparecem ao lado, mas não entram no caixa", async () => {
      const pan = P().panorama(fonte, 2000, { dias: 60, referencia: referencia });
      // Aluguel 10/10 e 10/11, tênis e duas parcelas de 300.
      esperar(pan.comprometidoTotal).aSer(1200 + 1200 + 380 + 300 + 300);
      esperar(pan.naoComprometido).aSer(2000 - pan.comprometidoTotal);
      esperar(pan.entradasPrevistas).aSer(3500 * 2);
      esperar(pan.janelaDias).aSer(60);
      esperar(iso(pan.limite)).aSer("2026-12-07");
    });
    teste("aponta o primeiro dia em que as saídas passam o saldo de hoje", async () => {
      const pan = P().panorama(fonte, 1500, { dias: 60, referencia: referencia });
      // 10/10: 1.200; 12/10: 1.580, passa de 1.500.
      esperar(iso(pan.descobertoEm)).aSer("2026-10-12");
      const folgado = P().panorama(fonte, 10000, { dias: 60, referencia: referencia });
      esperar(folgado.descobertoEm).aSer(null);
    });
    teste("o caixa corrido conta as entradas previstas na ordem das datas", async () => {
      // Saídas: 10/10 1.200, 12/10 380, 15/10 300, 10/11 1.200, 15/11 300.
      // Salário de 3.500 em 05/11 e 05/12.
      // Com 2.000: só as saídas dão -1.380, mas o salário chega antes de
      // faltar (o menor ponto é 120, em 15/10).
      const coberto = P().panorama(fonte, 2000, { dias: 60, referencia: referencia });
      esperar(coberto.naoComprometido).aSer(-1380);
      esperar(coberto.descobertoComEntradasEm).aSer(null);
      esperar(coberto.menorCaixaComEntradas).aSer(120);
      // Com 1.500, falta em 12/10 (300 - 380), antes do salário de 05/11.
      const curto = P().panorama(fonte, 1500, { dias: 60, referencia: referencia });
      esperar(iso(curto.descobertoComEntradasEm)).aSer("2026-10-12");
      esperar(curto.menorCaixaComEntradas).aSer(-380);
      // A home usa a mesma conta: só a falta de verdade vira alerta.
      const proj = c => F.projecoesDe({ saldo: c.saldo, saidasPrevistas: c.comprometidoTotal, entradasPrevistas: c.entradasPrevistas, menorCaixaComEntradas: c.menorCaixaComEntradas, descobertoEm: c.descobertoComEntradasEm });
      const base = { perfil: { income_monthly: 3000 }, contas: [] };
      esperar(PN().faltaDeVerdade(proj(coberto))).aSerFalso();
      esperar(PN().tarefasDoPainel({ ...base, projecoes: proj(coberto) }).length).aSer(0);
      const como = PN().respostaComoEstou(proj(coberto));
      esperar(como.tom).aSer("neutro");
      esperar(como.nota).aConter("Com as entradas previstas");
      esperar(como.nota).aConter("não fica negativo");
      esperar(como.nota.includes(U.moeda(-1380))).aSerFalso();
      esperar(PN().proximoPasso({ tarefas: PN().tarefasDoPainel({ ...base, projecoes: proj(coberto) }), metas: [ { name: "PC", target_amount: 5000, current_amount: 3100 } ] }).acao).aSer("Ver progresso");
      const alerta = PN().tarefasDoPainel({ ...base, projecoes: proj(curto) });
      esperar(alerta.length).aSer(1);
      esperar(alerta[0].nivel).aSer("alerta");
      esperar(alerta[0].texto).aConter("12/10");
      esperar(alerta[0].texto).aConter(U.moeda(-380));
      esperar([ como.nota, alerta[0].texto ].every(textoLimpo)).aSerVerdadeiro();
    });
    teste("previsão em aberto de recorrente apagado não vira compromisso", async () => {
      const ocorrencias = [
        { id: "o1", recurring_id: "r1", cycle: "2026-10", due_date: "2026-10-10", description: "Aluguel", type: "saida", planned_amount: 1200, status: "previsto" },
        { id: "o2", recurring_id: "apagado", cycle: "2026-10", due_date: "2026-10-20", description: "Academia", type: "saida", planned_amount: 150, status: "previsto" },
        { id: "o3", recurring_id: "apagado", cycle: "2026-09", due_date: "2026-09-20", description: "Academia", type: "saida", planned_amount: 150, status: "confirmado" }
      ];
      const vigentes = P().ocorrenciasVigentes(ocorrencias, fonte.recorrentes);
      // A decidida fica como histórico; só a aberta sem recorrente sai.
      esperar(vigentes.map(o => o.id).join(",")).aSer("o1,o3");
      const lista = P().compromissos({ ...fonte, agendadas: [], parcelamentos: [], ocorrencias: ocorrencias }, { dias: 60, referencia: referencia });
      esperar(lista.some(c => c.descricao === "Academia")).aSerFalso();
      // A ocorrência do aluguel cobre só o aluguel de outubro; o salário de
      // outubro já passou e o de novembro continua previsto.
      esperar(lista.filter(c => c.descricao === "Aluguel").length).aSer(2);
      const entradas = P().compromissos({ ...fonte, ocorrencias: ocorrencias }, { dias: 60, referencia: referencia, tipo: "entrada" });
      esperar(entradas.map(c => c.iso).join(",")).aSer("2026-11-05,2026-12-05");
    });
    teste("\"Apagar tudo\" leva também ocorrências, fechamentos e pendências", async () => {
      await comSessaoLimpa(async () => {
        const r = await S.inserir("recurring_transactions", { description: "Salário", type: "entrada", amount: 3500, day_of_month: 5, active: true });
        await S.inserir("recurring_occurrences", { recurring_id: r.id, cycle: "2026-10", due_date: "2026-10-05", description: "Salário", type: "entrada", planned_amount: 3500, status: "pendente" });
        await S.inserir("monthly_closings", { cycle: "2026-09" });
        await S.inserir("reconciliation_queue", { entity_table: "recurring_occurrences", status: "aberta" });
        await S.limparDados();
        esperar((await S.listar("recurring_transactions")).length).aSer(0);
        esperar((await S.listar("recurring_occurrences")).length).aSer(0);
        esperar((await S.listar("monthly_closings")).length).aSer(0);
        esperar((await S.listar("reconciliation_queue")).length).aSer(0);
      });
    });
  });

  descrever("Painel: três perguntas e próximo passo", () => {
    teste("\"Como estou?\" mostra o registrado e a previsão de 60 dias com nomes diferentes", async () => {
      const semPrevisao = PN().respostaComoEstou({ saldoAtual: 2880, caixaAposPrevisoes60Dias: null });
      esperar(semPrevisao.valor).aSer(U.moeda(2880));
      esperar(semPrevisao.nota).aSer("Registrado até hoje.");
      const negativo = PN().respostaComoEstou({ saldoAtual: 2880, caixaAposPrevisoes60Dias: -1648 });
      esperar(negativo.tom).aSer("alerta");
      esperar(negativo.nota).aConter("saídas previstas em 60 dias");
      esperar(negativo.nota).aConter(U.moeda(-1648));
      esperar(PN().respostaComoEstou({ saldoAtual: 500, caixaAposPrevisoes60Dias: 100 }).tom).aSer("ok");
      const nadaPrevisto = PN().respostaComoEstou({ saldoAtual: 1200, saidasPrevistas60Dias: 0, caixaAposPrevisoes60Dias: 1200 });
      esperar(nadaPrevisto.nota).aConter("Nenhuma saída prevista");
      esperar(textoLimpo(negativo.nota)).aSerVerdadeiro();
    });
    teste("o valor negativo da nota não se separa do sinal e o texto é escapado", async () => {
      const html = PN().semQuebrarNegativo(`<b>x</b> Depois das saídas: ${U.moeda(-448)}.`);
      esperar(html).aConter(`<span class="valor-junto">${U.moeda(-448)}.</span>`);
      esperar(html.includes("<b>")).aSerFalso();
      esperar(PN().semQuebrarNegativo(`Saldo ${U.moeda(500)}.`)).aSer(`Saldo ${U.moeda(500)}.`);
    });
    teste("\"Para onde meu dinheiro está indo?\" acha a maior categoria do mês", async () => {
      const r = PN().resumoGastos([
        { type: "saida", amount: 1200, category: "Moradia" },
        { type: "saida", amount: 620, category: "Alimentação" },
        { type: "entrada", amount: 3500, category: "Salário" },
        { type: "saida", amount: 180, category: null }
      ]);
      esperar(r.total).aSer(2000);
      esperar(r.quantidade).aSer(3);
      esperar(r.maior.categoria).aSer("Moradia");
      esperar(r.maior.percentual).aSerPerto(60, 2);
      esperar(PN().resumoGastos([]).maior).aSer(null);
    });
    teste("\"O que fazer agora?\" dá uma ação só, começando pelas previsões vencidas", async () => {
      const tarefas = [ { nivel: "info", texto: "info", acao: "A", href: "a.html" }, { nivel: "alerta", texto: "alerta", acao: "B", href: "b.html" } ];
      esperar(PN().proximoPasso({ pendentes: [ { description: "Aluguel" } ], tarefas: tarefas }).tipo).aSer("revisar");
      esperar(PN().proximoPasso({ pendentes: [ { description: "Aluguel" } ] }).texto).aConter("Aluguel");
      esperar(PN().proximoPasso({ tarefas: tarefas }).acao).aSer("B");
      const meta = PN().proximoPasso({ metas: [ { name: "PC", target_amount: 5000, current_amount: 3100 } ] });
      esperar(meta.texto).aConter("62%");
      esperar(meta.acao).aSer("Ver progresso");
      const semMeta = PN().proximoPasso({ metas: [] });
      esperar(semMeta.texto).aSer("Você ainda não definiu uma meta.");
      esperar(semMeta.acao).aSer("Criar meta");
    });
    teste("tarefas usam o caixa de 60 dias e, sem ele, as parcelas", async () => {
      const base = { perfil: { income_monthly: 3000 }, contas: [], transacoesRealizadas: [ { id: 1 } ] };
      const comCaixa = PN().tarefasDoPainel({ ...base, projecoes: { caixaAposPrevisoes60Dias: -500, saldoAposParcelas: 100 } });
      esperar(comCaixa.length).aSer(1);
      esperar(comCaixa[0].texto).aConter("próximos 60 dias");
      esperar(comCaixa[0].href).aSer("#programacaoFinanceira");
      const soParcelas = PN().tarefasDoPainel({ ...base, projecoes: { caixaAposPrevisoes60Dias: null, saldoAposParcelas: -300 } });
      esperar(soParcelas[0].texto).aConter("parcelas");
      esperar(soParcelas[0].href).aSer("planejamento.html");
      // Sem contas cadastradas, lançamento sem conta não vira tarefa.
      esperar(PN().tarefasDoPainel(base).length).aSer(0);
      const comContas = PN().tarefasDoPainel({ ...base, contas: [ { id: "c1" } ], transacoesRealizadas: [ { id: 1 }, { id: 2, account_id: "c1" } ] });
      esperar(comContas.length).aSer(1);
      esperar(comContas[0].href).aSer("contas.html");
      esperar([ ...comCaixa, ...soParcelas, ...comContas ].every(t => textoLimpo(t.texto))).aSerVerdadeiro();
    });
  });

  descrever("Painel: primeira visita e convite de instalação", () => {
    teste("a faixa \"Comece pelo Reality\" some ao ser dispensada ou depois da primeira análise", async () => {
      esperar(PN().mostrarFaixaInicio({})).aSerVerdadeiro();
      esperar(PN().mostrarFaixaInicio({ dispensada: true })).aSerFalso();
      esperar(PN().mostrarFaixaInicio({ concluida: true })).aSerFalso();
      esperar(PN().mostrarFaixaInicio({ proprias: 1 })).aSerFalso();
    });
    teste("a análise de exemplo da demonstração não conta como decisão da pessoa", async () => {
      const exemplo = { item_name: "Fone de ouvido premium", price: 800 };
      const analises = [ { item_name: "Fone de ouvido premium", price: "800" }, { item_name: "Notebook", price: 4000 } ];
      esperar(PN().analisesProprias([ analises[0] ], { demo: true, exemplo: exemplo })).aSer(0);
      esperar(PN().analisesProprias(analises, { demo: true, exemplo: exemplo })).aSer(1);
      esperar(PN().analisesProprias(analises, { demo: false, exemplo: exemplo })).aSer(2);
      esperar(PN().analisesProprias(null)).aSer(0);
    });
    teste("o convite de instalação espera uma análise salva e 30 dias depois de dispensado", async () => {
      const agora = Date.UTC(2026, 9, 8);
      const dia = 864e5;
      const pode = { podeConvidar: true, proprias: 1, agora: agora };
      esperar(PN().deveConvidarInstalacao({ ...pode, proprias: 0 })).aSerFalso();
      esperar(PN().deveConvidarInstalacao(pode)).aSerVerdadeiro();
      esperar(PN().deveConvidarInstalacao({ ...pode, instalado: true })).aSerFalso();
      esperar(PN().deveConvidarInstalacao({ ...pode, podeConvidar: false })).aSerFalso();
      esperar(PN().deveConvidarInstalacao({ ...pode, dispensadoEm: agora - 10 * dia })).aSerFalso();
      esperar(PN().deveConvidarInstalacao({ ...pode, dispensadoEm: String(agora - 31 * dia) })).aSerVerdadeiro();
      esperar(PN().ESPERA_INSTALAR).aSer(30 * dia);
    });
    teste("seções recolhíveis começam fechadas e lembram como a pessoa deixou", async () => {
      const usuario = "teste-painel";
      const k = PN().chave(usuario, "aberto.exemplo");
      const raiz = document.createElement("div");
      raiz.innerHTML = '<details data-recolhivel="exemplo"><summary>Exemplo</summary><p>conteúdo</p></details>';
      document.body.appendChild(raiz);
      try {
        PN().gravarLocal(k, null);
        PN().ligarRecolhiveis(raiz, usuario);
        const det = raiz.querySelector("details");
        esperar(det.open).aSerFalso();
        esperar(det.querySelector("p").textContent).aSer("conteúdo");
        det.open = true;
        await new Promise(r => setTimeout(r, 50));
        esperar(PN().lerLocal(k)).aSer("1");
        // Na próxima visita, a mesma seção já abre.
        const outra = document.createElement("div");
        outra.innerHTML = '<details data-recolhivel="exemplo"><summary>Exemplo</summary></details>';
        PN().ligarRecolhiveis(outra, usuario);
        esperar(outra.querySelector("details").open).aSerVerdadeiro();
        await new Promise(r => setTimeout(r, 50));
      } finally {
        PN().gravarLocal(k, null);
        raiz.remove();
      }
    });
    teste("para quem já usa o app, as seções abrem até a pessoa escolher", async () => {
      const usuario = "teste-painel-volta";
      const chaves = [ "visitou", "inicio-concluido", "aberto.exemplo" ].map(n => PN().chave(usuario, n));
      const limpar = () => chaves.forEach(k => PN().gravarLocal(k, null));
      const novo = () => {
        const raiz = document.createElement("div");
        raiz.innerHTML = '<details data-recolhivel="exemplo"><summary>Exemplo</summary></details>';
        return raiz;
      };
      limpar();
      try {
        // Primeira visita: fechadas. Na volta: abertas.
        esperar(PN().iniciarRecolhiveis(usuario)).aSerFalso();
        const primeira = novo();
        PN().ligarRecolhiveis(primeira, usuario);
        esperar(primeira.querySelector("details").open).aSerFalso();
        esperar(PN().iniciarRecolhiveis(usuario)).aSerVerdadeiro();
        const volta = novo();
        PN().ligarRecolhiveis(volta, usuario);
        esperar(volta.querySelector("details").open).aSerVerdadeiro();
        await new Promise(r => setTimeout(r, 50));
        // A escolha da pessoa vale acima do padrão.
        PN().gravarLocal(chaves[2], "0");
        const fechada = novo();
        PN().ligarRecolhiveis(fechada, usuario);
        esperar(fechada.querySelector("details").open).aSerFalso();
        // Na primeira visita, salvar a primeira análise abre o que não foi escolhido.
        PN().gravarLocal(chaves[2], null);
        const antes = novo();
        PN().ligarRecolhiveis(antes, usuario, { abertas: false });
        PN().abrirRecolhiveisSemEscolha(antes, usuario);
        esperar(antes.querySelector("details").open).aSerVerdadeiro();
        await new Promise(r => setTimeout(r, 50));
      } finally {
        limpar();
        // Devolve o padrão de primeira visita para os outros testes.
        PN().iniciarRecolhiveis(usuario);
        limpar();
      }
    });
  });

  descrever("Painel: registro rápido e contas", () => {
    teste("a categoria sugerida é regra de palavras do FinCK e respeita a lista do app", async () => {
      const cats = window.FINCK_CONFIG.CATEGORIAS;
      esperar(PN().sugerirCategoria("Almoço", { categorias: cats })).aSer("Alimentação");
      esperar(PN().sugerirCategoria("almoco no centro", { categorias: cats })).aSer("Alimentação");
      esperar(PN().sugerirCategoria("Conta de luz", { categorias: cats })).aSer("Moradia");
      esperar(PN().sugerirCategoria("Uber", { categorias: cats })).aSer("Transporte");
      // "bar" não pode casar dentro de "barco".
      esperar(PN().sugerirCategoria("barco", { categorias: cats })).aSer(null);
      esperar(PN().sugerirCategoria("xyz", { categorias: cats })).aSer(null);
      esperar(PN().sugerirCategoria("", { categorias: cats })).aSer(null);
      esperar(PN().sugerirCategoria("Almoço", { categorias: [ "Outros" ] })).aSer(null);
    });
    teste("com contas, o registro já vem com a última conta usada, a padrão ou a única", async () => {
      const contas = [ { id: 1, name: "Conta corrente" }, { id: 2, name: "Carteira", is_default: true }, { id: 3, name: "Antiga", active: false } ];
      esperar(PN().contaInicial([], "1")).aSer("");
      esperar(PN().contaInicial(contas, "1")).aSer("1");
      esperar(PN().contaInicial(contas, null)).aSer("2");
      // Conta desativada não volta a ser sugerida.
      esperar(PN().contaInicial(contas, "3")).aSer("2");
      esperar(PN().contaInicial(contas, PN().FORA_DAS_CONTAS)).aSer(PN().FORA_DAS_CONTAS);
      esperar(PN().contaInicial([ { id: 7 } ], null)).aSer("7");
      esperar(PN().contaInicial([ { id: 7 }, { id: 8 } ], null)).aSer("");
    });
    teste("a etiqueta \"sem conta\" só aparece quando existem contas", async () => {
      esperar(PN().mostrarSeloSemConta({ id: 1 }, false)).aSerFalso();
      esperar(PN().mostrarSeloSemConta({ id: 1 }, true)).aSerVerdadeiro();
      esperar(PN().mostrarSeloSemConta({ id: 1, account_id: "c1" }, true)).aSerFalso();
      esperar(PN().mostrarSeloSemConta({ id: 1, unallocated: true }, true)).aSerFalso();
    });
    teste("a confirmação diz o tipo, o valor e a descrição", async () => {
      const saida = PN().textoRegistrado({ tipo: "saida", valor: 18, descricao: " Almoço " });
      esperar(saida).aSer(`✓ Saída registrada: ${U.moeda(18)}, Almoço`);
      esperar(PN().textoRegistrado({ tipo: "entrada", valor: 3500, descricao: "Salário" })).aConter("Entrada registrada");
      esperar(textoLimpo(saida)).aSerVerdadeiro();
    });
  });
})();
