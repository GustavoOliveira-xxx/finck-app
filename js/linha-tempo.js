// Tela da linha do tempo da compra, dentro do resultado do FinCK of Reality.
// As contas são do motor (js/linha-tempo-engine.js); aqui só se lê o
// formulário e se desenha o resultado. A explicação em palavras fica na
// conversa da Análise FinCK, a única entrada da FINCK AI no resultado.
//
// Ordem da leitura: primeiro uma conclusão curta e os quatro cartões, depois
// os controles para testar outros cenários, e por fim a simulação completa
// (de onde vem cada número, comparação, gráfico, conta mês a mês e fórmulas).

window.FinckLinhaTempoUI = (() => {
  const L = window.FinckLinhaTempo;
  const U = window.FinckUtils;
  const cfg = window.FINCK_CONFIG || {};
  const LT = cfg.LINHA_DO_TEMPO || {};
  const $ = id => document.getElementById(id);
  const moeda = v => U.moeda(v);
  const pct = v => `${U.numero(v * 100, 2)}%`;
  // Rótulo curto para caber embaixo das barras: "2,9 mil", "−300".
  const curto = v => {
    const abs = Math.abs(v);
    const sinal = v < 0 ? "−" : "";
    return abs >= 1000 ? `${sinal}${U.numero(abs / 1000, abs >= 10000 ? 0 : 1)} mil` : `${sinal}${U.numero(abs, 0)}`;
  };

  let estado = null;
  let analise = null;
  let ligado = false;
  let relogio = null;
  // Campos que a pessoa (ou outra parte do Reality, a pedido dela) mudou na
  // simulação. Ao refazer a análise do mesmo item, eles voltam como estavam,
  // e o resto volta ao padrão calculado com os dados novos.
  const editados = new Set();
  let itemAtual = null;
  // A forma só é "sua escolha" depois que a pessoa escolhe; antes, é exemplo.
  const escolheuForma = () => editados.has("ltForma");

  // ----------------------------------------------------------- formulário

  const formaEscolhida = () => (document.querySelector('input[name="ltForma"]:checked') || {}).value || "parcelado";

  function horizontePara(parcelas) {
    return Math.min(LT.HORIZONTE_MAX || 24, Math.max(LT.HORIZONTE_MESES || 12, parcelas + 2));
  }

  function lerEntrada() {
    const parcelas = Math.max(1, Math.min(24, Math.floor(Number($("ltParcelas").value) || LT.PARCELAS_PADRAO || 10)));
    return {
      preco: estado.preco,
      forma: formaEscolhida(),
      parcelas: parcelas,
      juros_am: Math.max(0, Number(String($("ltJuros").value).replace(",", ".")) || 0),
      desconto_avista: Math.max(0, Number(String($("ltDesconto").value).replace(",", ".")) || 0),
      dia_a_dia: Math.max(0, U.lerMoeda("ltDiaADia") || 0),
      imprevisto: {
        valor: Math.max(0, U.lerMoeda("ltImprevisto") || 0),
        mes: Number($("ltMesImprevisto").value) || 1
      }
    };
  }

  function mostrarCamposDaForma() {
    const avista = formaEscolhida() === "avista";
    document.querySelectorAll("[data-lt-parcelado]").forEach(el => { el.hidden = avista; });
    document.querySelectorAll("[data-lt-avista]").forEach(el => { el.hidden = !avista; });
  }

  function preencherMeses(b, escolhido) {
    const sel = $("ltMesImprevisto");
    sel.innerHTML = b.meses.slice(1).map(m =>
      `<option value="${m.indice}">${U.escapeHTML(m.rotulo)} (mês ${m.indice})</option>`).join("");
    sel.value = String(Math.min(b.horizonte, Math.max(1, escolhido)));
  }

  // Valores iniciais a cada nova análise: tudo editável depois.
  function preencherPadroes(b) {
    const renda = b.renda;
    const barato = renda > 0 && estado.preco < renda * .1;
    document.querySelectorAll('input[name="ltForma"]').forEach(r => { r.checked = r.value === (barato ? "avista" : "parcelado"); });
    $("ltParcelas").value = String(LT.PARCELAS_PADRAO || 10);
    $("ltJuros").value = "0";
    $("ltDesconto").value = "0";
    U.escreverMoeda("ltDiaADia", b.dia_a_dia);
    $("ajudaLtDiaADia").textContent = b.dia_a_dia_parcial
      ? "Estimativa: por enquanto é só o que já saiu neste mês fora das despesas fixas e das parcelas. Ajuste para o valor de um mês inteiro (mercado, transporte, lazer)."
      : b.dia_a_dia_estimado
        ? `Estimativa pela média dos seus gastos fora das despesas fixas e das parcelas nos últimos ${b.dia_a_dia_meses} ${b.dia_a_dia_meses === 1 ? "mês" : "meses"}. Ajuste se não for o seu normal.`
        : "O FinCK ainda não tem histórico dos seus gastos do dia a dia (mercado, transporte, lazer). Informe uma estimativa para a conta ficar realista.";
    const sugestao = Math.round(renda * (LT.IMPREVISTO_PCT_RENDA || 15) / 100 / 50) * 50;
    U.escreverMoeda("ltImprevisto", sugestao > 0 ? sugestao : 0);
    preencherMeses(b, LT.IMPREVISTO_MES_PADRAO || 3);
    mostrarCamposDaForma();
  }

  // Os dois campos que não vêm do FinCK ganham o selo "Estimativa" no próprio
  // rótulo, para a pessoa ver o que é palpite antes de ler o resultado.
  function marcarEstimativas() {
    const alvos = [ $("ltDiaADia")?.closest("label"), document.querySelector("#formLinhaTempo .linha-tempo__imprevisto legend") ];
    alvos.forEach(alvo => {
      if (!alvo || alvo.querySelector(".linha-tempo__tipo")) return;
      const selo = document.createElement("span");
      selo.className = "linha-tempo__tipo linha-tempo__tipo--estimativa linha-tempo__tipo--mini";
      selo.textContent = "Estimativa";
      const texto = [ ...alvo.childNodes ].find(n => n.nodeType === 3 && n.textContent.trim());
      if (!texto) {
        alvo.prepend(selo);
        return;
      }
      // Texto e selo numa linha só, para o rótulo em grade não virar duas.
      const linha = document.createElement("span");
      linha.className = "linha-tempo__rotulo-campo";
      alvo.insertBefore(linha, texto);
      linha.append(document.createTextNode(texto.textContent.trim()), selo);
      texto.remove();
    });
  }

  // Monta, uma vez, o resumo antes dos controles. Se a página já tiver o
  // elemento com esse id, usa o dela.
  function montarAreas() {
    const form = $("formLinhaTempo");
    if (!$("ltResumo")) {
      const resumo = document.createElement("div");
      resumo.id = "ltResumo";
      resumo.className = "linha-tempo__resumo";
      form.insertAdjacentElement("beforebegin", resumo);
    }
    $("ltResumo").innerHTML = `
      <p class="linha-tempo__exemplo" id="ltExemplo" hidden></p>
      <p class="linha-tempo__conclusao" id="ltConclusao" aria-live="polite"></p>
      <p class="nota linha-tempo__selo" id="ltSelo" hidden></p>
      <div class="linha-tempo__falta" id="ltFalta" hidden>
        <p id="ltFaltaTexto"></p>
        <button type="button" class="btn-secundario btn-mini" data-lt-informar="ltDiaADia">Informar os gastos do dia a dia</button>
      </div>
      <p class="nota linha-tempo__simulacao">Cálculo do FinCK, sem IA. É uma simulação com os números desta tela, não previsão garantida: se a renda ou os gastos mudarem, o resultado muda.</p>
      <div class="orcamento-concreto linha-tempo__cartoes" id="ltCartoes"></div>
      <p class="nota linha-tempo__dica-controles">Para testar outro cenário, mude abaixo a forma de pagamento, as parcelas ou o imprevisto. <button type="button" class="btn-texto linha-tempo__perguntar" data-lt-perguntar>Perguntar à FINCK AI sobre esta simulação</button></p>`;
    // Só a conclusão é anunciada a cada mudança; ler o resultado inteiro a
    // cada número digitado cansaria quem usa leitor de tela.
    $("linhaTempoResultado").removeAttribute("aria-live");
  }

  function ligar() {
    if (ligado) return;
    ligado = true;
    const form = $("formLinhaTempo");
    montarAreas();
    marcarEstimativas();
    const agendar = () => {
      clearTimeout(relogio);
      relogio = setTimeout(calcular, 180);
    };
    const anotar = e => editados.add(e.target.name === "ltForma" ? "ltForma" : e.target.id);
    form.addEventListener("input", e => {
      anotar(e);
      agendar();
    });
    form.addEventListener("change", e => {
      anotar(e);
      if (e.target.name === "ltForma") mostrarCamposDaForma();
      agendar();
    });
    form.addEventListener("submit", e => e.preventDefault());
    // O botão da pergunta leva ao campo que falta; o scroll-padding do html
    // deixa o campo abaixo das barras presas. "Perguntar à FINCK AI" abre a
    // conversa da Análise FinCK com a pergunta escrita, sem enviar.
    $("ltResumo").addEventListener("click", e => {
      const alvo = e.target.closest("[data-lt-informar]");
      if (alvo) $(alvo.dataset.ltInformar)?.focus();
      if (e.target.closest("[data-lt-perguntar]")) {
        window.FinckInteligenciaUI?.perguntar?.("Explique em linguagem simples o que a simulação dos próximos meses mostra sobre esta compra.");
      }
    });
  }

  // --------------------------------------------------------------- contas

  function calcular() {
    if (!estado) return;
    const entrada = lerEntrada();
    const mesAntes = $("ltMesImprevisto").value;
    const b = L.base(estado.ctx, { horizonte: horizontePara(entrada.parcelas) });
    if (b.meses.length - 1 !== $("ltMesImprevisto").options.length) {
      preencherMeses(b, Number(mesAntes) || LT.IMPREVISTO_MES_PADRAO || 3);
      entrada.imprevisto.mes = Number($("ltMesImprevisto").value) || 1;
    }
    b.dia_a_dia = entrada.dia_a_dia;
    analise = L.analisar(b, entrada);
    desenhar();
  }

  // --------------------------------------------------------------- tela

  const rotuloDoMes = i => analise.base.meses[i]?.rotulo || `mês ${i}`;

  // "Juros do cartão" ganha uma frase no próprio cartão que mostra juros, sem
  // mandar a pessoa abrir as fórmulas. Aparece uma vez só.
  const JUROS_DO_CARTAO = "Juros do cartão: cobrados quando a fatura não é paga inteira.";

  function cartoes() {
    const e = analise.escolhido.resumo;
    const imp = analise.entrada.imprevisto;
    const ap = e.mes_mais_apertado;
    const ci = e.com_imprevisto;
    const jurosNoImprevisto = Boolean(imp && e.cabe_sem_imprevisto && ci && ci.entra_no_cartao);
    const custoComJuros = e.custo_real > e.total + .01;
    const cartao = (rotulo, valor, explica, classe = "") =>
      `<div><span>${rotulo}</span><strong class="${classe}">${valor}</strong><small>${explica}</small></div>`;
    const imprevisto = !imp
      ? cartao("Com o imprevisto", "Não testado", "Informe um valor no campo do imprevisto, logo abaixo, para testar.")
      : !e.cabe_sem_imprevisto
        ? cartao("Com o imprevisto", "Já no cartão", "Neste cenário, falta dinheiro mesmo sem imprevisto.", "cor-vermelha")
        : jurosNoImprevisto
          ? cartao("Com o imprevisto", `${moeda(ci.juros_cartao)} de juros`, `${ci.meses_com_divida} ${ci.meses_com_divida === 1 ? "mês" : "meses"} pagando o cartão. ${JUROS_DO_CARTAO}`, "cor-vermelha")
          : cartao("Com o imprevisto", "Cabe sem dívida", `${moeda(imp.valor)} em ${U.escapeHTML(rotuloDoMes(imp.mes))}.`, "cor-verde");
    const explicaCusto = `Total pago mais os juros do cartão que só existem por causa dela${imp ? ", com o imprevisto testado" : ""}.${custoComJuros && !jurosNoImprevisto ? ` ${JUROS_DO_CARTAO}` : ""}`;
    return `
      ${cartao("Mês mais apertado", U.escapeHTML(ap.rotulo), `${ap.sobra < 0 ? `Faltam ${moeda(-ap.sobra)}` : `Sobram ${moeda(ap.sobra)}`} nesse mês, sem contar o imprevisto.`, ap.sobra < 0 ? "cor-vermelha" : "")}
      ${cartao("Folga para imprevistos", e.cabe_sem_imprevisto ? moeda(e.margem_geral.valor) : moeda(0), "Maior gasto extra que cabe sem usar o cartão, no pior mês.", e.margem_geral.valor > 0 ? "" : "cor-vermelha")}
      ${imprevisto}
      ${cartao("Custo real da compra", moeda(e.custo_real), explicaCusto, custoComJuros ? "cor-vermelha" : "")}`;
  }

  // De onde vem cada número: dado confirmado (registrado no FinCK ou
  // informado nesta análise) separado de estimativa.
  function numerosDaSimulacao() {
    const u = L.numerosUsados(analise);
    const item = i => `
      <div>
        <dt>${U.escapeHTML(i.rotulo)}</dt>
        <dd>${i.valor === null ? `${pct(i.taxa_am)} ao mês` : moeda(i.valor)}<small>${U.escapeHTML(i.detalhe)}</small></dd>
      </div>`;
    return `
      <h5 class="linha-tempo__subtitulo">Números desta simulação</h5>
      <div class="linha-tempo__origem">
        <div class="linha-tempo__origem-grupo">
          <p class="linha-tempo__origem-titulo"><span class="linha-tempo__tipo linha-tempo__tipo--confirmado">Dado confirmado</span> registrado no FinCK ou informado por você</p>
          <dl>${u.confirmados.map(item).join("")}</dl>
        </div>
        <div class="linha-tempo__origem-grupo linha-tempo__origem-grupo--estimativa">
          <p class="linha-tempo__origem-titulo"><span class="linha-tempo__tipo linha-tempo__tipo--estimativa">Estimativa</span> pode ser diferente na vida real</p>
          <dl>${u.estimativas.map(item).join("")}</dl>
        </div>
      </div>`;
  }

  function comparacao() {
    const a = analise;
    const linhas = [ a.escolhido.resumo, a.outro.resumo ].sort((x, y) => (x.forma === "parcelado" ? -1 : 1) - (y.forma === "parcelado" ? -1 : 1));
    const imp = a.entrada.imprevisto;
    const escolhida = a.escolhido.resumo.forma;
    const celulaImprevisto = r => {
      if (!imp) return "—";
      if (!r.cabe_sem_imprevisto) return `<span class="cor-vermelha">${moeda(r.com_imprevisto.juros_cartao)} de juros</span><small class="explica-numero">já falta dinheiro sem o imprevisto</small>`;
      return r.com_imprevisto.entra_no_cartao ? `<span class="cor-vermelha">${moeda(r.com_imprevisto.juros_cartao)} de juros</span>` : `<span class="cor-verde">cabe</span>`;
    };
    const linha = r => `
      <tr class="${r.forma === escolhida ? "linha-tempo__escolhida" : ""}">
        <th scope="row">${r.forma === "avista" ? "À vista" : `Parcelado em ${r.parcelas}x`}${r.forma === escolhida ? ` <span class="chip">${escolheuForma() ? "sua escolha" : "exemplo"}</span>` : ""}</th>
        <td>${r.forma === "avista" ? (r.cabe_hoje ? moeda(r.total) : `<span class="cor-vermelha">${moeda(r.total)}, o saldo não cobre</span>`) : moeda(0)}</td>
        <td>${r.forma === "avista" ? "—" : moeda(r.parcela)}</td>
        <td>${celulaImprevisto(r)}</td>
        <td><strong>${moeda(r.custo_real)}</strong></td>
      </tr>`;
    const j = a.juntar_antes;
    const quando = j.meses === 0 ? "dá para comprar hoje" : j.meses ? `compra em ${j.meses} ${j.meses === 1 ? "mês" : "meses"}${j.linha ? ` (${U.escapeHTML(j.linha.rotulo)})` : ""}` : "a sobra atual não chega lá";
    return `
      <h5 class="linha-tempo__subtitulo">Três caminhos para a mesma compra</h5>
      <div class="tabela-wrapper" tabindex="0" role="region" aria-label="Comparação entre formas de pagamento">
        <table class="tabela linha-tempo__tabela">
          <caption class="visualmente-oculto">Comparação entre parcelar, pagar à vista e juntar antes</caption>
          <thead><tr><th scope="col">Caminho</th><th scope="col">Sai hoje</th><th scope="col">Por mês</th><th scope="col">${imp ? `Com imprevisto de ${moeda(imp.valor)}` : "Com imprevisto"}</th><th scope="col">Custo real</th></tr></thead>
          <tbody>
            ${linhas.map(linha).join("")}
            <tr>
              <th scope="row">Juntar e comprar à vista</th>
              <td>${moeda(0)}<small class="explica-numero">${quando}</small></td>
              <td>guarda a sobra</td>
              <td>${imp ? "a compra espera" : "—"}</td>
              <td><strong>${moeda(a.outro.resumo.forma === "avista" ? a.outro.resumo.total : a.escolhido.resumo.total)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>`;
  }

  function cenarioDoGrafico() {
    const c = analise.escolhido;
    return c.imprevisto || c.normal;
  }

  function grafico() {
    const s = cenarioDoGrafico();
    const valores = s.linhas.map(l => l.caixa - l.divida);
    const maior = Math.max(1, ...valores.map(Math.abs));
    const titulo = analise.entrada.imprevisto ? "Dinheiro guardado e dívida no cartão, com o imprevisto" : "Dinheiro guardado mês a mês";
    return `
      <h5 class="linha-tempo__subtitulo">${titulo}</h5>
      <div class="projecao-grafico linha-tempo__grafico" role="img" aria-label="${U.escapeHTML(titulo)}. Barras roxas: dinheiro guardado. Barras vermelhas: dívida no cartão.">
        ${s.linhas.map((l, i) => {
          const v = valores[i];
          const altura = Math.max(3, Math.abs(v) / maior * 100);
          return `<div class="projecao-col" title="${U.escapeHTML(l.rotulo)}: ${v < 0 ? `dívida de ${moeda(-v)}` : moeda(v)}">
            <div class="projecao-barra-caixa"><div class="projecao-barra ${v < 0 ? "projecao-barra--negativa" : ""}" style="height:${altura}%"></div></div>
            <span class="projecao-valor ${v < 0 ? "cor-vermelha" : ""}">${curto(v)}</span>
            <span class="projecao-mes">${l.hoje ? "hoje" : U.escapeHTML(l.rotulo)}</span>
          </div>`;
        }).join("")}
      </div>
      <p class="nota linha-tempo__legenda"><span class="linha-tempo__ponto"></span> dinheiro guardado <span class="linha-tempo__ponto linha-tempo__ponto--divida"></span> dívida no cartão</p>`;
  }

  // A conta mês a mês é a parte mais densa: fica recolhida.
  function mesAMes() {
    const s = cenarioDoGrafico();
    return `
      <details class="detalhes-hipoteses" data-lt-detalhe="mes-a-mes">
        <summary>Ver a conta mês a mês</summary>
        <div class="tabela-wrapper" tabindex="0" role="region" aria-label="Conta mês a mês; deslize para ver todas as colunas">
          <table class="tabela linha-tempo__tabela">
            <caption class="visualmente-oculto">Sobra, parcelas, imprevisto, juros, dívida e dinheiro guardado por mês</caption>
            <thead><tr><th scope="col">Mês</th><th scope="col">Sobra do mês</th><th scope="col">Parcelas</th><th scope="col">Imprevisto</th><th scope="col">Juros do cartão</th><th scope="col">Dívida no cartão</th><th scope="col">Guardado</th></tr></thead>
            <tbody>
              ${s.linhas.map(l => l.hoje ? `
                <tr><th scope="row">hoje</th><td colspan="4">${l.pago_hoje ? `Pagamento à vista de ${moeda(l.pago_hoje)}` : "Nada sai hoje"}</td><td class="${l.divida > 0 ? "cor-vermelha" : ""}">${l.divida > 0 ? moeda(l.divida) : "—"}</td><td><strong>${moeda(l.caixa)}</strong></td></tr>` : `
                <tr>
                  <th scope="row">${U.escapeHTML(l.rotulo)}</th>
                  <td class="${l.sobra < 0 ? "cor-vermelha" : ""}">${moeda(l.sobra)}</td>
                  <td>${l.parcelas_existentes + l.parcela_nova > 0 ? moeda(l.parcelas_existentes + l.parcela_nova) : "—"}${l.parcela_nova > 0 && l.parcelas_existentes > 0 ? `<small class="explica-numero">${moeda(l.parcela_nova)} desta compra</small>` : ""}</td>
                  <td>${l.imprevisto ? `<span class="cor-vermelha">${moeda(l.imprevisto)}</span>` : "—"}</td>
                  <td>${l.juros ? `<span class="cor-vermelha">${moeda(l.juros)}</span>` : "—"}</td>
                  <td class="${l.divida > 0 ? "cor-vermelha" : ""}">${l.divida > 0 ? moeda(l.divida) : "—"}</td>
                  <td><strong>${moeda(l.caixa)}</strong></td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </details>`;
  }

  function comoCalculamos() {
    const t = analise.taxas;
    return `
      <details class="detalhes-hipoteses linha-tempo__formulas" data-lt-detalhe="formulas">
        <summary>Como calculamos</summary>
        <ol>
          <li><strong>Sobra de cada mês</strong> = renda − despesas fixas − gastos do dia a dia − parcelas que você já tem − parcela desta compra − imprevisto.</li>
          <li><strong>Dinheiro guardado</strong> começa no seu saldo de hoje e soma a sobra de cada mês. À vista, o preço sai do saldo hoje.</li>
          <li><strong>Se o guardado ficaria negativo</strong>, a diferença vira dívida no cartão: é a parte da fatura que não deu para pagar.</li>
          <li><strong>Juros da dívida</strong>: no primeiro mês, o rotativo; depois, o parcelamento da fatura, como manda o Banco Central. Taxa anual vira mensal por juros compostos: i = (1 + a)<sup>1/12</sup> − 1. Rotativo: ${U.numero(t.ROTATIVO_AA, 1)}% ao ano ≈ ${pct(t.rotativo_am)} ao mês. Parcelamento da fatura: ${U.numero(t.PARCELADO_AA, 1)}% ao ano ≈ ${pct(t.parcelado_am)} ao mês. A dívida cresce como uma progressão geométrica: D<sub>n+1</sub> = D<sub>n</sub> × (1 + i) − pagamento.</li>
          <li><strong>Teto</strong>: desde 2024 os juros dessas duas modalidades não passam de ${U.numero(t.TETO_JUROS_PCT, 0)}% do valor devido (Lei 14.690/2023).</li>
          <li><strong>Pagamento</strong>: toda sobra dos meses seguintes vai para quitar a dívida.</li>
          <li><strong>Parcela com juros</strong> segue a Tabela Price: PMT = V × i ÷ (1 − (1 + i)<sup>−n</sup>).</li>
          <li><strong>Custo real</strong> = total pago + juros do cartão que só existem por causa desta compra (a mesma vida, com o mesmo imprevisto, com e sem ela).</li>
          <li><strong>Folga para imprevistos</strong> = o menor valor guardado nos meses seguintes: um gasto extra tira esse mesmo valor de todos os meses depois dele.</li>
        </ol>
        <p class="nota">É uma simulação, não uma previsão garantida. Simplificações: renda, despesas fixas e gastos do dia a dia iguais todo mês; entradas extras e lançamentos agendados não entram. ${U.escapeHTML(t.FONTE || "")}</p>
      </details>`;
  }

  // O link do Reality para o Assistente leva uma pergunta neutra, só com
  // valores: sem o nome do item e sem pedir veredito. A forma entra depois
  // que a pessoa escolhe uma.
  function atualizarLinkAssistente() {
    const link = document.querySelector("#respostaReality a[data-link-assistente]");
    if (!link) return;
    const e = analise.escolhido.resumo;
    const forma = !escolheuForma() ? "" : e.forma === "avista" ? " à vista" : ` em ${e.parcelas}x de ${moeda(e.parcela)}`;
    link.href = `assistente.html?pergunta=${encodeURIComponent(`Como uma compra de ${moeda(estado.preco)}${forma} mexe no meu planejamento?`)}`;
  }

  // O selo do Reality mede o peso no dinheiro de agora; a simulação mede o
  // fôlego dos próximos meses. Quando os dois parecem dizer coisas opostas,
  // a tela explica a diferença em vez de deixá-los lado a lado.
  function textoSelo(situacao) {
    const cabe = situacao === "cabe" || situacao === "cabe-com-imprevisto";
    if (cabe && (estado.nivel === "alerta" || estado.nivel === "atencao")) {
      return "O selo de impacto, lá em cima, mede o peso da compra no seu dinheiro de agora; esta simulação mede o fôlego dos próximos meses. Parcelada, uma compra pode pesar muito hoje e ainda caber mês a mês.";
    }
    if (!cabe && estado.nivel === "verde") {
      return "O selo de impacto, lá em cima, mede o peso da compra no seu dinheiro de agora; esta simulação mede o fôlego dos próximos meses. Mesmo leve hoje, a compra pode apertar os meses seguintes.";
    }
    return "";
  }

  function desenhar() {
    const a = analise;
    const leitura = L.leitura(a, { moeda });
    atualizarLinkAssistente();
    const conclusao = $("ltConclusao");
    // Só troca o texto quando ele muda, para o leitor de tela não repetir a
    // mesma frase a cada número digitado.
    if (conclusao.textContent !== leitura.conclusao) conclusao.textContent = leitura.conclusao;
    conclusao.dataset.situacao = leitura.situacao;
    const e = a.escolhido.resumo;
    const exemplo = escolheuForma() ? "" : `Exemplo: ${e.forma === "avista" ? "à vista" : `${e.parcelas}x${e.juros_parcelamento > 0 ? "" : " sem juros"}`}. Escolha em “Como você pagaria?”, logo abaixo, a forma que você usaria.`;
    $("ltExemplo").hidden = !exemplo;
    if ($("ltExemplo").textContent !== exemplo) $("ltExemplo").textContent = exemplo;
    const selo = textoSelo(leitura.situacao);
    $("ltSelo").hidden = !selo;
    if ($("ltSelo").textContent !== selo) $("ltSelo").textContent = selo;
    const resumo = document.querySelector('#blocoLinhaTempo [data-resumo="linha"]');
    if (resumo) resumo.textContent = `${escolheuForma() ? "" : "Exemplo. "}${leitura.conclusao}`;
    const falta = leitura.perguntas[0];
    $("ltFalta").hidden = !falta;
    if (falta && $("ltFaltaTexto").textContent !== falta.texto) $("ltFaltaTexto").textContent = falta.texto;
    $("ltCartoes").innerHTML = cartoes();
    // Cada número digitado redesenha o resultado; o que a pessoa abriu
    // (conta mês a mês, fórmulas) continua aberto.
    const host = $("linhaTempoResultado");
    const abertos = new Set([ ...host.querySelectorAll("details[data-lt-detalhe][open]") ].map(d => d.dataset.ltDetalhe));
    host.innerHTML = `
      <p class="orcamento-concreto__frase linha-tempo__frase">${U.escapeHTML(leitura.explicacao.join(" "))}</p>
      ${a.alertas.map(t => `<p class="alerta">${U.escapeHTML(t)}</p>`).join("")}
      <details class="detalhes-hipoteses linha-tempo__completa" data-lt-detalhe="completa">
        <summary>Ver a simulação completa</summary>
        ${numerosDaSimulacao()}
        ${comparacao()}
        ${grafico()}
        ${mesAMes()}
        ${comoCalculamos()}
      </details>`;
    host.querySelectorAll("details[data-lt-detalhe]").forEach(d => { d.open = abertos.has(d.dataset.ltDetalhe); });
  }

  // --------------------------------------------------------------- entrada

  // Valores atuais dos campos que a pessoa mudou, para devolver depois. Campo
  // de dinheiro guarda o valor em centavos, então passa pelo FinckMoeda.
  const ehMoeda = id => Boolean($(id)?.hasAttribute("data-moeda"));
  function lerEditados() {
    return [ ...editados ]
      .map(id => [ id, id === "ltForma" ? formaEscolhida() : ehMoeda(id) ? U.lerMoeda(id) : $(id)?.value ])
      .filter(([ , v ]) => v !== undefined && v !== null);
  }

  function devolverEditados(lista) {
    lista.forEach(([ id, valor ]) => {
      if (id === "ltForma") {
        document.querySelectorAll('input[name="ltForma"]').forEach(r => { r.checked = r.value === valor; });
      } else if (ehMoeda(id)) {
        U.escreverMoeda(id, valor);
      } else if ($(id)) {
        $(id).value = valor;
      }
    });
    mostrarCamposDaForma();
  }

  // Chamado pelo Reality a cada análise. Outro item: tudo volta ao padrão e
  // a explicação da FINCK AI some. O mesmo item de novo (a pessoa mudou a
  // quantidade, a vida útil ou o preço): a forma de pagamento e os outros
  // campos que ela mexeu continuam como estavam.
  function mostrar({ ctx, item, preco, nivel = null }) {
    const bloco = $("blocoLinhaTempo");
    if (!bloco || !$("formLinhaTempo") || !L || !(Number(preco) > 0)) return;
    const chave = String(item || "").trim().toLowerCase();
    const mesmoItem = ligado && Boolean(chave) && chave === itemAtual;
    const guardados = mesmoItem ? lerEditados() : [];
    itemAtual = chave;
    estado = { ctx, item, preco: Number(preco), nivel };
    bloco.hidden = false;
    ligar();
    if (!mesmoItem) {
      editados.clear();
    }
    // O número de meses depende das parcelas: com as parcelas que a pessoa
    // escolheu, a lista de meses do imprevisto já nasce do tamanho certo.
    const parcelasGuardadas = Number((guardados.find(([ id ]) => id === "ltParcelas") || [])[1]) || 0;
    preencherPadroes(L.base(ctx, { horizonte: horizontePara(parcelasGuardadas || LT.PARCELAS_PADRAO || 10) }));
    devolverEditados(guardados);
    calcular();
  }

  return { mostrar, analiseAtual: () => analise };
})();
