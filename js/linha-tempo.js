// Tela da linha do tempo da compra, dentro do resultado do FinCK of Reality.
// As contas são do motor (js/linha-tempo-engine.js); aqui só se lê o
// formulário, se desenha o resultado e se pede à FINCK AI a explicação.

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
      ? "Por enquanto é só o que já saiu neste mês fora das despesas fixas e das parcelas. Ajuste para o valor de um mês inteiro (mercado, transporte, lazer)."
      : b.dia_a_dia_estimado
        ? `Média dos seus gastos fora das despesas fixas e das parcelas nos últimos ${b.dia_a_dia_meses} ${b.dia_a_dia_meses === 1 ? "mês" : "meses"}. Ajuste se não for o seu normal.`
        : "O FinCK ainda não tem histórico dos seus gastos do dia a dia (mercado, transporte, lazer). Informe uma estimativa para a conta ficar realista.";
    const sugestao = Math.round(renda * (LT.IMPREVISTO_PCT_RENDA || 15) / 100 / 50) * 50;
    U.escreverMoeda("ltImprevisto", sugestao > 0 ? sugestao : 0);
    preencherMeses(b, LT.IMPREVISTO_MES_PADRAO || 3);
    mostrarCamposDaForma();
  }

  function ligar() {
    if (ligado) return;
    ligado = true;
    const form = $("formLinhaTempo");
    const agendar = () => {
      clearTimeout(relogio);
      relogio = setTimeout(calcular, 180);
    };
    form.addEventListener("input", agendar);
    form.addEventListener("change", e => {
      if (e.target.name === "ltForma") mostrarCamposDaForma();
      agendar();
    });
    form.addEventListener("submit", e => e.preventDefault());
    $("linhaTempoResultado").addEventListener("click", e => {
      if (e.target.closest("[data-lt-explicar]")) explicar();
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

  function frase() {
    const a = analise;
    const e = a.escolhido.resumo;
    const imp = a.entrada.imprevisto;
    const partes = [];
    const ap = e.mes_mais_apertado;
    const comoFica = ap ? (ap.sobra < 0 ? `faltam ${moeda(-ap.sobra)}` : `sobram ${moeda(ap.sobra)}`) : "";

    if (e.forma === "avista" && !e.cabe_hoje) {
      partes.push(`O saldo de hoje (${moeda(a.base.saldo)}) não cobre o pagamento à vista de ${moeda(e.total)}. Passar no cartão sem ter o dinheiro da fatura vira rotativo, o crédito mais caro do país.`);
    } else if (e.forma === "avista") {
      partes.push(`Pagando à vista ${moeda(e.total)}, o dinheiro sai hoje e os próximos meses ficam livres. O mês mais apertado é ${ap.rotulo}, quando ${comoFica}.`);
    } else {
      partes.push(`Parcelando em ${e.parcelas}x de ${moeda(e.parcela)}${e.juros_parcelamento > 0 ? ` (total de ${moeda(e.total)}, com ${moeda(e.juros_parcelamento)} de juros do parcelamento)` : ""}, o mês mais apertado é ${ap.rotulo}, quando ${comoFica}.`);
    }

    if (!e.cabe_sem_imprevisto) {
      const p = a.escolhido.normal.resumo.primeiro_mes_divida;
      partes.push(`Mesmo sem imprevisto, a conta não fecha: a partir de ${p ? p.rotulo : "agora"} a diferença iria para o cartão e geraria ${moeda(e.juros_da_compra_normal)} de juros.`);
    } else if (imp && e.com_imprevisto) {
      const ci = e.com_imprevisto;
      if (ci.entra_no_cartao) {
        const soDaCompra = e.juros_da_compra < ci.juros_cartao - .01 ? ` (${moeda(e.juros_da_compra)} deles só existem por causa desta compra)` : "";
        partes.push(`Um imprevisto de ${moeda(imp.valor)} em ${rotuloDoMes(imp.mes)} não caberia: até ${moeda(ci.maior_divida)} iriam para o cartão. Com os juros do rotativo e do parcelamento da fatura, isso gera ${moeda(ci.juros_cartao)} de juros${soDaCompra} e ${ci.meses_com_divida} ${ci.meses_com_divida === 1 ? "mês" : "meses"} pagando dívida.`);
        if (e.juros_da_compra > 0) {
          partes.push(`Nesse cenário, esta compra de ${moeda(e.total)} passa a custar <strong>${moeda(e.custo_real)}</strong>.`);
        }
        if (ci.divida_final > 0) {
          partes.push(`E no fim da linha do tempo ainda restariam ${moeda(ci.divida_final)} de dívida.`);
        }
      } else {
        partes.push(`Um imprevisto de ${moeda(imp.valor)} em ${rotuloDoMes(imp.mes)} ainda caberia sem usar o cartão.`);
      }
    }
    return partes.join(" ");
  }

  function cartoes() {
    const e = analise.escolhido.resumo;
    const imp = analise.entrada.imprevisto;
    const ap = e.mes_mais_apertado;
    const ci = e.com_imprevisto;
    const cartao = (rotulo, valor, explica, classe = "") =>
      `<div><span>${rotulo}</span><strong class="${classe}">${valor}</strong><small>${explica}</small></div>`;
    const imprevisto = !imp
      ? cartao("Com o imprevisto", "—", "Informe um valor acima para testar.")
      : !e.cabe_sem_imprevisto
        ? cartao("Com o imprevisto", "Já no cartão", "A conta não fecha nem sem imprevisto.", "cor-vermelha")
        : ci.entra_no_cartao
          ? cartao("Com o imprevisto", `${moeda(ci.juros_cartao)} de juros`, `${ci.meses_com_divida} ${ci.meses_com_divida === 1 ? "mês" : "meses"} pagando o cartão.`, "cor-vermelha")
          : cartao("Com o imprevisto", "Cabe sem dívida", `${moeda(imp.valor)} em ${rotuloDoMes(imp.mes)}.`, "cor-verde");
    return `<div class="orcamento-concreto linha-tempo__cartoes">
      ${cartao("Mês mais apertado", U.escapeHTML(ap.rotulo), `${ap.sobra < 0 ? `Faltam ${moeda(-ap.sobra)}` : `Sobram ${moeda(ap.sobra)}`} nesse mês, sem contar o imprevisto.`, ap.sobra < 0 ? "cor-vermelha" : "")}
      ${cartao("Folga para imprevistos", e.cabe_sem_imprevisto ? moeda(e.margem_geral.valor) : moeda(0), "Maior gasto extra que cabe sem usar o cartão, no pior mês.", e.margem_geral.valor > 0 ? "" : "cor-vermelha")}
      ${imprevisto}
      ${cartao("Custo real da compra", moeda(e.custo_real), "Total pago mais os juros que só existem por causa dela.", e.custo_real > e.total + .01 ? "cor-vermelha" : "")}
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
        <th scope="row">${r.forma === "avista" ? "À vista" : `Parcelado em ${r.parcelas}x`}${r.forma === escolhida ? ' <span class="chip">sua escolha</span>' : ""}</th>
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

  function mesAMes() {
    const s = cenarioDoGrafico();
    return `
      <details class="detalhes-hipoteses">
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
      <details class="detalhes-hipoteses linha-tempo__formulas">
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
        <p class="nota">Simplificações: renda, despesas fixas e gastos do dia a dia iguais todo mês; entradas extras e lançamentos agendados não entram. ${U.escapeHTML(t.FONTE || "")}</p>
      </details>`;
  }

  function blocoIA() {
    return `
      <div class="linha-tempo__ia">
        <button type="button" class="btn-secundario" data-lt-explicar>Explicar estes números com a FINCK AI</button>
        <div class="linha-tempo__ia-resposta" id="ltRespostaIA" aria-live="polite" hidden></div>
      </div>`;
  }

  function desenhar() {
    const a = analise;
    $("linhaTempoResultado").innerHTML = `
      ${cartoes()}
      <p class="orcamento-concreto__frase linha-tempo__frase">${frase()}</p>
      ${a.alertas.map(t => `<p class="alerta">${U.escapeHTML(t)}</p>`).join("")}
      ${comparacao()}
      ${grafico()}
      ${mesAMes()}
      ${comoCalculamos()}
      ${blocoIA()}`;
  }

  // ------------------------------------------------------------- FINCK AI

  async function explicar() {
    const botao = document.querySelector("[data-lt-explicar]");
    const caixa = $("ltRespostaIA");
    if (!analise || !botao) return;
    const numeros = L.paraIA(analise, { item: estado.item, moeda: v => moeda(v) });
    const pergunta =
      "Você recebe uma análise de compra já calculada pelo FinCK. Explique para a pessoa, em linguagem simples e em até 120 palavras, o que esses números significam para a decisão dela. " +
      "Não refaça contas e não invente números: use só os que estão abaixo. Não diga se ela deve ou não comprar; mostre o que muda entre os caminhos e dê um cuidado prático.\n\n" + numeros;
    botao.disabled = true;
    caixa.hidden = false;
    caixa.classList.remove("linha-tempo__ia-resposta--erro");
    caixa.textContent = "A FINCK AI está lendo os números…";
    try {
      const r = await fetch("/api/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta })
      });
      const dados = await r.json().catch(() => ({}));
      if (dados.resposta) {
        caixa.textContent = dados.resposta;
        const rodape = document.createElement("small");
        rodape.className = "explica-numero";
        rodape.textContent = "Texto escrito por IA a partir dos números acima. As contas são do FinCK.";
        caixa.appendChild(rodape);
      } else {
        throw new Error(dados.erro || "A FINCK AI não respondeu agora.");
      }
    } catch (e) {
      caixa.classList.add("linha-tempo__ia-resposta--erro");
      caixa.textContent = `${e.message || "Não consegui falar com a FINCK AI."} Os números acima continuam valendo.`;
    } finally {
      botao.disabled = false;
    }
  }

  // --------------------------------------------------------------- entrada

  // Chamado pelo Reality a cada análise.
  function mostrar({ ctx, item, preco }) {
    const bloco = $("blocoLinhaTempo");
    if (!bloco || !L || !(Number(preco) > 0)) return;
    estado = { ctx, item, preco: Number(preco) };
    bloco.hidden = false;
    ligar();
    preencherPadroes(L.base(ctx, { horizonte: horizontePara(LT.PARCELAS_PADRAO || 10) }));
    calcular();
  }

  return { mostrar, analiseAtual: () => analise };
})();
