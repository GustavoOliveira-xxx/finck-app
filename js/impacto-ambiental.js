window.FinckImpacto = (() => {
  const U = window.FinckUtils;
  const IA = window.FinckIA;
  // ODS 12: o resultado do FinCK of Reality mostra também o que a compra pesa
  // para o planeta. A IA estima faixas para um item parecido (carbono, água,
  // vida útil) e dá o contexto: a etapa que mais pesa, os materiais, o reparo
  // e o descarte. As contas que dependem desta compra, como a quantidade, os
  // meses de uso que a pessoa espera e o que se evita comprando usado, são
  // feitas aqui, sempre a partir dessas faixas e sem número novo da IA.
  const significativo = n => Number(Number(n).toPrecision(2));
  const meio = f => (f.min + f.max) / 2;
  function calcular(estimativa, {quantidade: quantidade = 1, mesesDeUso: mesesDeUso = null} = {}) {
    const qtd = Number(quantidade) > 1 ? Math.round(Number(quantidade)) : 1;
    const vezes = f => f ? {
      min: significativo(f.min * qtd),
      max: significativo(f.max * qtd)
    } : null;
    const carbono = vezes(estimativa.carbono);
    const meses = Number(mesesDeUso) > 0 ? Number(mesesDeUso) : estimativa.vidaUtilMeses ? meio(estimativa.vidaUtilMeses) : null;
    const fracao = Number(estimativa.fracaoFabricacao);
    return {
      quantidade: qtd,
      carbono: carbono,
      agua: vezes(estimativa.agua),
      porMes: carbono && meses ? {
        valor: significativo(meio(carbono) / meses),
        meses: Math.round(meses),
        daPessoa: Number(mesesDeUso) > 0
      } : null,
      evitavelUsado: carbono && fracao > 0 && fracao <= 1 ? {
        min: significativo(carbono.min * fracao),
        max: significativo(carbono.max * fracao),
        percentual: Math.round(fracao * 100)
      } : null
    };
  }
  // Casas só onde fazem diferença: 0,35; 1,5; 44.
  const numero = n => U.numero(n, Number.isInteger(n) || n >= 10 ? 0 : n >= 1 ? 1 : 2);
  function formatarCarbono(f) {
    if (f.max >= 1e3) {
      return `${numero(significativo(f.min / 1e3))} a ${numero(significativo(f.max / 1e3))} t de CO₂e`;
    }
    return f.min === f.max ? `${numero(f.min)} kg de CO₂e` : `${numero(f.min)} a ${numero(f.max)} kg de CO₂e`;
  }
  const formatarLitros = f => `${U.numero(f.min, 0)} a ${U.numero(f.max, 0)} litros`;
  // 6 a 18 meses; 1 a 3 anos; 8 meses a 3 anos. Abaixo de dois anos, em
  // meses, que é como se pensa na duração de uma coisa assim.
  function formatarDuracao(f) {
    const anos = m => {
      const v = Math.round(m / 6) / 2;
      return U.numero(v, Number.isInteger(v) ? 0 : 1);
    };
    const meses = m => U.numero(Math.round(m), 0);
    if (f.max < 24) {
      return f.min === f.max ? `${meses(f.min)} meses` : `${meses(f.min)} a ${meses(f.max)} meses`;
    }
    if (f.min < 12) {
      return `${meses(f.min)} meses a ${anos(f.max)} anos`;
    }
    return anos(f.min) === anos(f.max) ? `${anos(f.min)} anos` : `${anos(f.min)} a ${anos(f.max)} anos`;
  }
  const ETAPA = {
    "matéria-prima": "na extração da matéria-prima",
    "fabricação": "na fabricação",
    transporte: "no transporte",
    uso: "no uso, ao longo da vida do item",
    descarte: "no descarte"
  };
  const REPARO = {
    alto: "Fácil de consertar",
    medio: "Conserto possível",
    baixo: "Difícil de consertar"
  };
  const CONFIANCA = {
    alta: "confiança alta",
    media: "confiança média",
    baixa: "confiança baixa"
  };
  // Os pontos que a própria pessoa cadastrou em Ações locais, pelo tipo de
  // resíduo que o item vira no fim da vida.
  const PONTOS_POR_RESIDUO = {
    "eletrônico": {
      tipos: [ "descarte", "reparo" ],
      rotulo: "Onde consertar ou descartar eletrônicos, perto de você",
      convite: "Você ainda não cadastrou nenhum ponto de reparo ou de descarte de eletrônicos."
    },
    "têxtil": {
      tipos: [ "doacao", "usado", "troca" ],
      rotulo: "Onde doar, trocar ou revender, perto de você",
      convite: "Você ainda não cadastrou nenhum ponto de doação, troca ou brechó."
    },
    "plástico": {
      tipos: [ "descarte" ],
      rotulo: "Onde descartar para reciclagem, perto de você",
      convite: "Você ainda não cadastrou nenhum ponto de descarte."
    },
    metal: {
      tipos: [ "descarte" ],
      rotulo: "Onde descartar para reciclagem, perto de você",
      convite: "Você ainda não cadastrou nenhum ponto de descarte."
    },
    vidro: {
      tipos: [ "descarte" ],
      rotulo: "Onde descartar para reciclagem, perto de você",
      convite: "Você ainda não cadastrou nenhum ponto de descarte."
    },
    papel: {
      tipos: [ "descarte", "doacao" ],
      rotulo: "Onde doar ou descartar, perto de você",
      convite: "Você ainda não cadastrou nenhum ponto de doação ou de descarte."
    },
    misto: {
      tipos: [ "descarte", "doacao" ],
      rotulo: "Onde doar ou descartar, perto de você",
      convite: "Você ainda não cadastrou nenhum ponto de doação ou de descarte."
    }
  };
  function montarHtml(e, contas, pontos) {
    const etapa = e.etapaPrincipal ? `<small>${(e.etapaPrincipal === "fabricação" || e.etapaPrincipal === "matéria-prima") && contas.evitavelUsado ? `cerca de ${contas.evitavelUsado.percentual}% vem da fabricação` : `a maior parte ${U.escapeHTML(ETAPA[e.etapaPrincipal])}`}</small>` : "";
    const cards = [ `<article class="card-indicador impacto__card"><span>Pegada de carbono</span><strong>${formatarCarbono(contas.carbono)}</strong>${etapa}</article>`, contas.agua ? `<article class="card-indicador impacto__card"><span>Água na produção</span><strong>${formatarLitros(contas.agua)}</strong></article>` : "", e.vidaUtilMeses ? `<article class="card-indicador impacto__card"><span>Vida útil típica</span><strong>${formatarDuracao(e.vidaUtilMeses)}</strong></article>` : "" ].join("");
    const contasHtml = [ contas.porMes ? `<li>${contas.porMes.daPessoa ? `Pelo uso que você espera (${contas.porMes.meses} meses)` : `Na vida útil típica (cerca de ${contas.porMes.meses} meses)`}, são <strong>${numero(contas.porMes.valor)} kg de CO₂e por mês de uso</strong>. Quanto mais o item dura, menor fica essa conta.</li>` : "", contas.evitavelUsado ? `<li>Comprar usado ou recondicionado evita a parte da fabricação: cerca de <strong>${formatarCarbono(contas.evitavelUsado)}</strong>.</li>` : "", e.premissa ? `<li class="impacto__premissa">A faixa supõe ${U.escapeHTML(noMeio(e.premissa).replace(/\.$/, ""))}.</li>` : "" ].join("");
    const detalhes = [ e.materiais && e.materiais.length ? `<div><dt>Materiais</dt><dd>${e.materiais.map(U.escapeHTML).join(", ")}</dd></div>` : "", e.reparo ? `<div><dt>Reparo</dt><dd><span class="impacto__nivel impacto__nivel--${e.reparo.nivel}">${REPARO[e.reparo.nivel]}</span> ${U.escapeHTML(e.reparo.texto)}</dd></div>` : "", e.descarte ? `<div><dt>Descarte</dt><dd>${U.escapeHTML(e.descarte)}</dd></div>` : "" ].join("");
    const mapa = PONTOS_POR_RESIDUO[e.residuo];
    return `\n      <p class="impacto__base">Estimativa para <strong>${U.escapeHTML(e.tipo || "este item")}</strong>${contas.quantidade > 1 ? `, ${contas.quantidade} unidades` : ""} · ${CONFIANCA[e.confianca] || CONFIANCA.media}</p>\n      <div class="cards-indicadores impacto__numeros">${cards}</div>\n      ${contasHtml ? `<ul class="impacto__contas">${contasHtml}</ul>` : ""}\n      ${detalhes ? `<dl class="impacto__detalhes">${detalhes}</dl>` : ""}\n      ${mapa && typeof pontos === "function" ? pontos(mapa) : ""}\n      ${e.dicas && e.dicas.length ? `<div class="impacto__dicas"><p class="impacto__dicas-titulo">Para pesar menos no planeta</p><ul>${e.dicas.map(d => `<li>${U.escapeHTML(d)}</li>`).join("")}</ul></div>` : ""}\n      <p class="impacto__nota">Estimativa feita por IA a partir de ${U.escapeHTML(noMeio(e.base || "médias de produtos parecidos").replace(/\.$/, ""))}. Varia com marca, modelo e uso: mostra a ordem de grandeza, não é medição.</p>`;
  }
  // Trecho que entra no meio de uma frase da tela: "a partir de médias de...".
  // Sigla como "ACV" fica como está.
  const noMeio = t => /^[A-ZÀ-Ý][a-zà-ÿ]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
  const lembrancas = new Map;
  const chave = entrada => `${String(entrada.item || "").trim().toLowerCase()}|${String(entrada.categoria || "").toLowerCase()}`;
  let vez = 0;
  async function mostrar(entrada, host, opcoes = {}) {
    if (!host) {
      return;
    }
    const bloco = host.closest(".bloco-interno") || host;
    if (!IA || !IA.ATIVA) {
      bloco.hidden = true;
      return;
    }
    bloco.hidden = false;
    // Uma análise nova pode começar antes de a anterior voltar: só a última
    // desenha na tela.
    const minhaVez = ++vez;
    const desenhar = html => {
      if (minhaVez === vez) {
        host.innerHTML = html;
      }
    };
    const aviso = (texto, tentarDeNovo = false) => {
      desenhar(`<div class="impacto__aviso"><p>${U.escapeHTML(texto)}</p>${tentarDeNovo ? `<button type="button" class="btn-secundario btn-mini impacto__repetir">Tentar de novo</button>` : ""}</div>`);
      const botao = minhaVez === vez ? host.querySelector(".impacto__repetir") : null;
      if (botao) {
        botao.addEventListener("click", () => mostrar(entrada, host, opcoes));
      }
    };
    const lembrada = lembrancas.get(chave(entrada));
    let resposta = lembrada;
    if (!resposta) {
      const pode = await IA.disponivel();
      if (!pode.ok) {
        aviso(pode.demo ? "Na demonstração, a estimativa de impacto ambiental fica desligada. Entre com uma conta para ver o que esta compra pesa para o planeta." : pode.motivo);
        return;
      }
      desenhar(`<p class="impacto__carregando"><span class="busca-preco__giro" aria-hidden="true"></span> Calculando uma estimativa ambiental… <small>É uma estimativa feita por IA a partir de estudos de ciclo de vida, não uma medição. O resto da análise já está pronto acima.</small></p>`);
      resposta = await IA.pedir({
        impacto: {
          item: entrada.item,
          categoria: entrada.categoria,
          preco: entrada.preco
        }
      });
    }
    if (!resposta || !resposta.ok) {
      const r = resposta || {};
      if (r.codigo === "SEM_ESTIMATIVA") {
        aviso([ "Não deu para estimar o impacto deste item.", r.detalhe, "Um nome mais específico ajuda, como “tênis de corrida” em vez de “presente”." ].filter(Boolean).join(" "));
        return;
      }
      if (r.codigo === "SEM_LOGIN" && window.FinckStore.emDemo()) {
        aviso("Na demonstração, a estimativa de impacto ambiental fica desligada. Entre com uma conta para ver o que esta compra pesa para o planeta.");
        return;
      }
      aviso(r.motivo || "Não consegui estimar o impacto agora.", r.codigo !== "SEM_LOGIN" && r.codigo !== "IA_INDISPONIVEL");
      return;
    }
    lembrancas.set(chave(entrada), resposta);
    desenhar(montarHtml(resposta, calcular(resposta, entrada), opcoes.pontos));
  }
  return {
    calcular: calcular,
    formatarDuracao: formatarDuracao,
    formatarCarbono: formatarCarbono,
    mostrar: mostrar
  };
})();
