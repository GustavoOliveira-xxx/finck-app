document.addEventListener("DOMContentLoaded", async () => {
  const cfg = window.FINCK_CONFIG;
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const F = window.FinckFinance;
  const R = window.FinckReality;
  const G = window.FinckGame;
  const user = await window.FinckNav.iniciarPagina({
    titulo: "FinCK of Reality",
    subtitulo: "Quanto a compra custa de verdade"
  });
  if (!user) {
    return;
  }
  const $ = id => document.getElementById(id);
  let ctx = await F.carregarContexto();
  let locais = await carregarLocais();
  let resultado = null;
  let entrada = null;
  let decisao = null;
  let registroId = null;
  // A opção guardada para comparar e a última
  // análise do mesmo item, para mostrar o que mudou ao refazer a conta.
  let comparando = null;
  let anterior = null;
  const campoCategoria = $("itemCategory");
  campoCategoria.innerHTML = cfg.CATEGORIAS.map(c => `<option value="${c}">${c}</option>`).join("");
  campoCategoria.value = "Outros";
  $("itemDestino").innerHTML = `<option value="">Prefiro não dizer</option>` + cfg.DESTINOS_ITEM.map(d => `<option value="${d.id}">${U.escapeHTML(d.rotulo)}</option>`).join("");
  const horasPorDia = () => Number(ctx.perfil?.work_hours_day) || cfg.PADRAO.work_hours_day;

  // Sugerida pelo nome do item; vira confirmação, não tarefa.
  const pilulaCategoria = $("categoriaInferida");
  function mostrarCategoria() {
    const escolhida = Boolean(campoCategoria.dataset.escolhida);
    const nome = $("itemName").value.trim();
    if (!nome) {
      pilulaCategoria.hidden = true;
      return;
    }
    pilulaCategoria.hidden = false;
    pilulaCategoria.innerHTML = `${escolhida ? "Categoria" : "Categoria identificada"}: <strong>${U.escapeHTML(campoCategoria.value)}</strong>
      <button type="button" class="btn-texto" data-alterar-categoria>Alterar</button>`;
  }
  function sugerirCategoria() {
    if (!campoCategoria.dataset.escolhida) {
      campoCategoria.value = R.inferirCategoria($("itemName").value) || "Outros";
    }
    mostrarCategoria();
  }
  $("itemName").addEventListener("input", sugerirCategoria);
  campoCategoria.addEventListener("change", () => {
    campoCategoria.dataset.escolhida = "1";
    mostrarCategoria();
  });
  // A busca pelo link ou pelo print também pode trazer a categoria.
  campoCategoria.addEventListener("finck:categoria", mostrarCategoria);
  document.addEventListener("click", e => {
    if (!e.target.closest("[data-alterar-categoria]")) {
      return;
    }
    const detalhes = $("detalhesVidaUtil");
    detalhes.open = true;
    campoCategoria.focus();
  });

  // O link fica guardado até a pessoa pedir: quem já sabe o preço não precisa
  // entender a busca automática para seguir.
  const botaoLink = $("btnMostrarLink");
  botaoLink.addEventListener("click", () => {
    const area = $("areaLink");
    area.hidden = !area.hidden;
    botaoLink.setAttribute("aria-expanded", String(!area.hidden));
    if (!area.hidden) {
      $("itemLink").focus();
    }
  });

  // 1 Dados, 2 Impacto, 3 Reflexão, 4 Decisão.
  const ORDEM_ETAPAS = [ "passoDados", "passoResultado", "passoReflexao", "passoDecisao" ];
  function marcarEtapas() {
    const nav = $("etapasReality");
    if (!nav) {
      return;
    }
    const visiveis = ORDEM_ETAPAS.filter(id => !$(id).hidden);
    const linha = window.innerHeight * .4;
    let atual = visiveis[0];
    visiveis.forEach(id => {
      if ($(id).getBoundingClientRect().top < linha) {
        atual = id;
      }
    });
    const iAtual = ORDEM_ETAPAS.indexOf(atual);
    nav.querySelectorAll("[data-etapa-reality]").forEach(li => {
      const id = li.dataset.etapaReality;
      const i = ORDEM_ETAPAS.indexOf(id);
      const link = li.querySelector("a");
      const disponivel = !$(id).hidden;
      li.dataset.estado = !disponivel ? "bloqueada" : i < iAtual ? "feita" : i === iAtual ? "atual" : "proxima";
      link.setAttribute("aria-disabled", String(!disponivel));
      if (i === iAtual) {
        link.setAttribute("aria-current", "step");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }
  $("etapasReality")?.addEventListener("click", e => {
    const link = e.target.closest("a");
    if (!link) {
      return;
    }
    e.preventDefault();
    if (link.getAttribute("aria-disabled") === "true") {
      return;
    }
    const alvo = document.querySelector(link.getAttribute("href"));
    alvo?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
  window.addEventListener("scroll", () => requestAnimationFrame(marcarEtapas), {
    passive: true
  });
  marcarEtapas();

  const form = $("formReality");
  const botaoVer = $("btnVerImpacto");
  const status = $("statusProcesso");
  const etapa = texto => {
    status.textContent = texto;
  };
  // Mexeu em qualquer campo depois do resultado: o botão passa a atualizar.
  form.addEventListener("input", () => {
    if (resultado) {
      botaoVer.textContent = "Atualizar o impacto";
    }
  });
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const item_name = $("itemName").value.trim();
    const price = U.lerMoeda("itemPrice");
    const category = campoCategoria.value;
    const note = $("itemNote").value.trim();
    let item_link = $("itemLink").value.trim();
    $("alertaRenda").hidden = true;
    if (!item_name) {
      return U.erroCampo("itemName", "Diga o que você quer comprar.");
    }
    if (!(price > 0)) {
      return U.erroCampo("itemPrice", window.FinckMoeda?.ERRO || "Digite um valor válido, como R$ 800,00.");
    }
    if (item_link && !/^https?:\/\//i.test(item_link)) {
      item_link = `https://${item_link}`;
    }
    if (item_link) {
      try {
        new URL(item_link);
      } catch {
        $("areaLink").hidden = false;
        botaoLink.setAttribute("aria-expanded", "true");
        return U.erroCampo("itemLink", "Este link parece incompleto. Confira o endereço ou apague o campo.");
      }
    }
    botaoVer.disabled = true;
    botaoVer.setAttribute("aria-busy", "true");
    try {
      // Cada etapa real aparece enquanto acontece, sem espera
      // inventada: dados, conta, metas e alternativas.
      etapa("Lendo seus dados financeiros…");
      ctx = await F.carregarContexto();
      locais = await carregarLocais();
      if (!(Number(ctx.perfil?.income_monthly) > 0)) {
        // Erro de operação importante: aviso persistente no fluxo, com saída.
        const alerta = $("alertaRenda");
        alerta.hidden = false;
        alerta.innerHTML = `<p><strong>Falta a sua renda mensal.</strong> É com ela que o preço vira horas de trabalho.</p>
          <a class="btn-secundario btn-mini" href="perfil.html">Informar minha renda no Perfil</a>`;
        etapa("");
        return;
      }
      etapa("Calculando o seu impacto…");
      const quantidade = Number($("itemQuantidade").value) || null;
      const mesesDeUso = Number($("itemMeses").value) || null;
      const destino = $("itemDestino").value || null;
      entrada = {
        item_name: item_name,
        price: price,
        category: category,
        note: note,
        item_link: item_link || null,
        quantity: quantidade,
        expected_months: mesesDeUso,
        end_of_life: destino
      };
      resultado = R.calcular(price, ctx.perfil, {
        saldo: ctx.saldo,
        despesasFixas: ctx.despesasFixas,
        compromissosAbertos: ctx.compromissosAbertos,
        quantidade: quantidade,
        mesesDeUso: mesesDeUso,
        metas: ctx.metas,
        movimentosMeta: ctx.movimentosMeta
      });
      etapa("Conferindo metas e alternativas…");
      const mesmoItem = anterior && anterior.nome.toLowerCase() === item_name.toLowerCase();
      const mudancas = mesmoItem && !comparando ? R.oQueMudou(anterior.resultado, resultado) : [];
      renderComparacao();
      renderResposta(mudancas);
      renderIndicadores();
      renderOrcamento();
      renderMetas();
      // O filme da compra: os próximos meses, parcelas e o teste do imprevisto.
      window.FinckLinhaTempoUI?.mostrar({
        ctx: ctx,
        item: item_name,
        preco: price * (quantidade || 1)
      });
      renderAlternativas();
      renderDestino();
      renderReflexoes();
      renderDecisoes();
      anterior = {
        nome: item_name,
        resultado: resultado
      };
      // ODS 12: o que a compra pesa para o planeta, estimado por IA. Carrega à
      // parte, depois do resultado, e não segura a análise financeira.
      window.FinckImpacto?.mostrar({
        item: item_name,
        categoria: category,
        preco: price,
        quantidade: quantidade,
        mesesDeUso: mesesDeUso
      }, $("impactoAmbiental"), {
        pontos: blocoPontos
      });
      [ "passoResultado", "passoReflexao", "passoDecisao" ].forEach(id => {
        $(id).hidden = false;
      });
      window.FinckFundo?.tom(resultado.semaforo.nivel === "verde" ? "positivo" : "neutro");
      $("passoResultado").scrollIntoView({
        behavior: "smooth"
      });
      $("respostaReality").focus({
        preventScroll: true
      });
      $("btnRegistrarCalculo").disabled = false;
      $("statusRegistro").textContent = registroId ? "Análise salva. Salve de novo para guardar a versão atualizada." : "Esta análise ainda não foi salva. Salve para guardar no seu histórico.";
      botaoVer.textContent = "Atualizar o impacto";
      etapa("Análise pronta.");
      marcarEtapas();
    } finally {
      botaoVer.disabled = false;
      botaoVer.removeAttribute("aria-busy");
    }
  });

  // Meses ou dias, do jeito que se fala: "12 dias", "2,5 meses".
  const duracao = dias => dias < 45 ? `${Math.max(1, Math.round(dias))} ${Math.round(dias) === 1 ? "dia" : "dias"}` : `${U.numero(dias / 30, 1)} meses`;

  function renderResposta(mudancas = []) {
    const r = resultado;
    const sin = R.sintese(r);
    const qtd = r.custo_de_uso.quantidade;
    const horasTotais = r.work_hours * (qtd || 1);
    const tempo = R.formatarTempo(horasTotais, horasPorDia());
    const textoMudanca = m => {
      const fmt = m.campo === "horas" ? v => R.formatarTempo(v, horasPorDia()).horas : v => v === null ? "sem vida útil" : U.moeda(v);
      const nome = {
        preco: "Preço",
        horas: "Tempo de trabalho",
        por_mes: "Custo por mês de uso"
      }[m.campo];
      return `<li><span>${nome}</span> antes <s>${fmt(m.antes)}</s> agora <strong>${fmt(m.agora)}</strong></li>`;
    };
    $("respostaReality").innerHTML = `
      <p class="resposta-reality__item">${U.escapeHTML(entrada.item_name)} · ${U.moeda(r.price)}${qtd > 1 ? ` × ${qtd} = ${U.moeda(r.custo_de_uso.total)}` : ""}</p>
      <p class="resposta-reality__rotulo">${qtd > 1 ? "Estes itens custam" : "Este produto custa"}</p>
      <p class="resposta-reality__tempo"><strong>${tempo.horas}</strong> de trabalho</p>
      <p class="resposta-reality__dias">≈ ${tempo.dias} de trabalho, na sua jornada de ${U.numero(horasPorDia(), horasPorDia() % 1 ? 1 : 0)} h por dia</p>
      <p class="resposta-reality__renda">Isso representa <strong>${U.percentual(r.income_percent * (qtd || 1), 1)}</strong> da sua renda mensal.</p>
      <p class="resposta-reality__sintese">${U.escapeHTML(sin.frase)}</p>
      <div class="semaforo-card semaforo--${r.semaforo.nivel} impacto-nivel">
        <span class="impacto-nivel__rotulo">${sin.rotulo_impacto}</span>
        <strong>${U.escapeHTML(r.semaforo.titulo)}</strong>
        <p>${U.escapeHTML(r.semaforo.texto)}</p>
        <p class="impacto-nivel__nao-julga">Isso não significa que você não deva comprar.</p>
      </div>
      ${mudancas.length ? `<div class="o-que-mudou"><p class="o-que-mudou__titulo">O que mudou desde a última conta</p><ul>${mudancas.map(textoMudanca).join("")}</ul></div>` : ""}
      <p class="resposta-reality__categoria">Categoria: <strong>${U.escapeHTML(entrada.category)}</strong>
        <button type="button" class="btn-texto" data-alterar-categoria>Alterar</button></p>
      <div class="resposta-reality__links">
        <a class="link-mais resposta-reality__mais" href="#detalhesAnalise">Ver análise completa</a>
        <a class="link-mais" href="assistente.html?pergunta=${encodeURIComponent(`Posso comprar ${entrada.item_name} de ${U.moeda(r.price * (qtd || 1))} sem atrapalhar o meu planejamento?`)}">Ver como esta compra cabe no seu planejamento</a>
      </div>`;
  }

  function renderIndicadores() {
    const r = resultado;
    $("indicadores").innerHTML = `
      <article class="card-indicador"><span>Preço</span><strong>${U.moeda(r.price)}</strong></article>
      <article class="card-indicador"><span>% da renda mensal</span><strong>${U.percentual(r.income_percent)}</strong></article>
      <article class="card-indicador"><span>Dias de trabalho</span><strong>${U.numero(r.work_days)} dias</strong></article>
      <article class="card-indicador"><span>Horas de trabalho</span><strong>${U.numero(r.work_hours)} horas</strong></article>
      ${r.custo_de_uso.por_mes ? `<article class="card-indicador">
        <span>Custo por mês de uso</span><strong>${U.moeda(r.custo_de_uso.por_mes)}</strong>
        <small class="explica-numero">Preço dividido pelos ${r.custo_de_uso.meses_de_uso} meses de uso que você espera. É estimativa sua.</small></article>` : ""}
      ${r.custo_de_uso.quantidade > 1 ? `<article class="card-indicador"><span>Total por ${r.custo_de_uso.quantidade} unidades</span><strong>${U.moeda(r.custo_de_uso.total)}</strong></article>` : ""}`;
  }

  // Primeiro a conta concreta (compra, sobra, impacto e o que
  // fica); a lista completa de indicadores vem depois, com a definição de
  // cada um visível, sem depender de passar o mouse.
  function renderOrcamento() {
    const r = resultado;
    const sin = R.sintese(r);
    const GL = R.GLOSSARIO;
    const linha = (chave, valor, classe = "") => `
      <li>
        <span>${U.escapeHTML(GL[chave].rotulo)} <small class="indicador-quando">${U.escapeHTML(GL[chave].referencia)}</small>
          <small class="explica-numero">${U.escapeHTML(GL[chave].definicao)}</small></span>
        <strong class="${classe}">${valor}</strong>
      </li>`;
    $("impactoOrcamento").innerHTML = `
      <div class="orcamento-concreto">
        <div><span>Compra</span><strong>${U.moeda(r.price)}</strong></div>
        <div><span>Sobra do mês após os fixos</span><strong class="${r.renda_livre > 0 ? "" : "cor-vermelha"}">${r.renda_livre > 0 ? U.moeda(r.renda_livre) : "sem sobra"}</strong></div>
        <div><span>Impacto na sobra</span><strong>${r.renda_livre > 0 ? U.percentual(r.percentual_renda_livre, 0) : "—"}</strong></div>
      </div>
      <p class="orcamento-concreto__frase">${U.escapeHTML(sin.frase_sobra)}</p>
      ${r.compromete_saldo ? `<p class="alerta">Esta compra deixa seu saldo negativo em ${U.moeda(Math.abs(r.saldo_depois))}.</p>` : r.compromete_projetado ? `<p class="alerta">Cabe no saldo de hoje, mas não no que pode sobrar depois dos compromissos: faltariam ${U.moeda(Math.abs(r.disponivel_depois))} para cobrir o que você já assumiu.</p>` : ""}
      ${r.deficit_fixos > 0 ? `<p class="alerta">Suas despesas fixas superam a renda em ${U.moeda(r.deficit_fixos)} por mês. Enquanto isso durar, toda compra sai da reserva.</p>` : ""}
      <details class="detalhes-hipoteses">
        <summary>Ver todos os números do orçamento</summary>
        <ul class="lista-resumo lista-resumo--glossario">
          ${linha("saldo_atual", U.moeda(r.saldo_antes))}
          <li>
            <span>Saldo após a compra <small class="indicador-quando">se comprar hoje</small>
              <small class="explica-numero">Saldo atual menos o preço desta compra.</small></span>
            <strong class="${r.compromete_saldo ? "cor-vermelha" : ""}">${U.moeda(r.saldo_depois)}</strong>
          </li>
          ${r.deficit_fixos > 0 ? linha("deficit_fixos", `− ${U.moeda(r.deficit_fixos)}`, "cor-vermelha") : linha("sobra_apos_fixos", U.moeda(r.sobra_apos_fixos))}
          ${r.compromissos_futuros > 0 ? linha("compromissos_futuros", U.moeda(r.compromissos_futuros)) : ""}
          ${linha("disponivel_projetado", U.moeda(r.disponivel_projetado), r.disponivel_projetado < 0 ? "cor-vermelha" : "")}
          <li><span>Valor do seu dia / hora <small class="explica-numero">Renda mensal dividida pelos dias e horas da sua jornada.</small></span><strong>${U.moeda(r.valor_dia)} / ${U.moeda(r.valor_hora)}</strong></li>
        </ul>
      </details>`;
  }

  function textoAtraso(m) {
    if (m.falta <= 0) {
      return "esta meta já foi alcançada.";
    }
    if (m.base_atraso === "ritmo") {
      return `ela atrasa cerca de <strong>${duracao(m.atraso_dias)}</strong>, no seu ritmo de ${U.moeda(m.aporte_mensal)} por mês (média dos últimos 3 meses).`;
    }
    if (m.base_atraso === "prazo") {
      return `ela atrasa cerca de <strong>${duracao(m.atraso_dias)}</strong>, no ritmo de ${U.moeda(m.aporte_mensal)} por mês que o prazo da meta pede.`;
    }
    return `equivale a <strong>${U.numero(m.dias_trabalho_extra, 1)} dias de trabalho</strong> a mais para alcançá-la. Registre aportes na meta para o FinCK estimar o atraso em semanas e meses.`;
  }
  function renderMetas() {
    const r = resultado;
    const host = $("impactoMetas");
    if (!r.impacto_metas.length) {
      host.innerHTML = `<div class="vazio vazio--guia"><p><strong>Você ainda não tem metas.</strong> Com uma meta, esta seção responde "o que eu deixo de fazer se comprar isso?", em dias e meses de atraso.</p>
        <a class="btn-secundario btn-mini" href="metas.html#nova">Criar uma meta</a></div>`;
      return;
    }
    const ordenadas = r.impacto_metas.slice().sort((a, b) => b.percentual_do_restante - a.percentual_do_restante).slice(0, 3);
    host.innerHTML = ordenadas.map(m => `
      <article class="card-impacto-meta">
        <h5>Sua meta: ${U.escapeHTML(m.nome)}</h5>
        <p>Progresso atual: <strong>${U.moeda(m.atual)} / ${U.moeda(m.alvo)}</strong> (${U.percentual(m.progresso, 0)})</p>
        <div class="barra" role="img" aria-label="${U.percentual(m.progresso, 0)} da meta"><div class="barra-preenchida" style="width:${m.progresso}%"></div></div>
        <p>Se comprar ${U.moeda(r.price)}, ${textoAtraso(m)}</p>
        ${m.cobre_a_meta ? `<p class="destaque">Com este valor você concluiria a meta hoje.</p>` : ""}
      </article>`).join("") + (r.impacto_metas.length > 3 ? `<p class="nota">Mostrando as 3 metas mais afetadas de ${r.impacto_metas.length}.</p>` : "");
  }

  function renderAlternativas() {
    $("alternativas").innerHTML = resultado.alternativas.map(a => `
      <li class="alternativa">
        <h5>${U.escapeHTML(a.titulo)}</h5>
        <p>${U.escapeHTML(a.texto)}</p>
        ${a.faixa ? `<small>Hipótese de design do projeto: entre ${U.moeda(a.faixa.min)} e ${U.moeda(a.faixa.max)} a menos (referência de ${U.percentual(a.percentual * 100, 0)}). Não é dado de pesquisa: confirme com o preço real.</small>` : ""}
        ${blocoPontos(LOCAIS_POR_ALTERNATIVA[a.id])}
      </li>`).join("");
  }

  function renderComparacao() {
    const host = $("comparacao");
    if (!comparando) {
      host.innerHTML = "";
      return;
    }
    const c = R.comparar({
      nome: comparando.nome,
      resultado: comparando.resultado
    }, {
      nome: entrada.item_name,
      resultado: resultado
    });
    const h = v => R.formatarTempo(v, horasPorDia()).horas;
    const coluna = x => `
      <div class="comparacao__opcao${x.nome === c.mais_barata && !c.empate ? " comparacao__opcao--barata" : ""}">
        <h5>${U.escapeHTML(x.nome)}</h5>
        <dl>
          <div><dt>Preço</dt><dd>${U.moeda(x.preco)}</dd></div>
          <div><dt>Trabalho</dt><dd>${h(x.horas)}</dd></div>
          <div><dt>Uso esperado</dt><dd>${x.meses ? `${x.meses} meses` : "não informado"}</dd></div>
          <div><dt>Por mês de uso</dt><dd>${x.por_mes ? `${U.moeda(x.por_mes)}/mês` : "—"}</dd></div>
        </dl>
      </div>`;
    host.innerHTML = `
      <section class="comparacao" aria-labelledby="tituloComparacao">
        <h4 id="tituloComparacao">Comparando as duas opções</h4>
        <div class="comparacao__grade">${coluna(c.a)}${coluna(c.b)}</div>
        <p class="comparacao__conclusao">${c.empate ? "As duas custam o mesmo." : `<strong>${U.escapeHTML(c.mais_barata)}</strong> custa ${U.moeda(c.economia)} a menos, ou ${h(c.horas_economizadas)} de trabalho.`}
          ${c.compara_uso ? c.inverte ? ` Mas, por mês de uso, <strong>${U.escapeHTML(c.melhor_por_mes)}</strong> custa menos: dura mais e o preço se dilui no tempo.` : ` E também custa menos por mês de uso.` : ` Informe a vida útil das duas para comparar o custo por mês de uso.`}</p>
        <button type="button" class="btn-texto" id="btnEncerrarComparacao">Encerrar comparação</button>
      </section>`;
    $("btnEncerrarComparacao").addEventListener("click", () => {
      comparando = null;
      host.innerHTML = "";
      $("faixaComparando").hidden = true;
    });
  }
  $("btnComparar").addEventListener("click", () => {
    if (!resultado) {
      return;
    }
    comparando = {
      nome: entrada.item_name,
      resultado: resultado
    };
    // Mantém categoria, quantidade, destino e todos os parâmetros financeiros;
    // troca só o que identifica a outra opção.
    $("itemName").value = "";
    U.limparMoeda("itemPrice");
    $("itemLink").value = "";
    $("itemMeses").value = "";
    $("itemNote").value = "";
    pilulaCategoria.hidden = true;
    resultado = null;
    entrada = null;
    decisao = null;
    registroId = null;
    anterior = null;
    [ "passoResultado", "passoReflexao", "passoDecisao" ].forEach(id => {
      $(id).hidden = true;
    });
    const faixa = $("faixaComparando");
    faixa.hidden = false;
    faixa.innerHTML = `<p>Comparando com <strong>${U.escapeHTML(comparando.nome)}</strong> · ${U.moeda(comparando.resultado.price)} · ${R.formatarTempo(comparando.resultado.work_hours, horasPorDia()).horas} de trabalho. Agora informe a outra opção.</p>
      <button type="button" class="btn-texto" id="btnCancelarComparacao">Cancelar comparação</button>`;
    $("btnCancelarComparacao").addEventListener("click", () => {
      comparando = null;
      faixa.hidden = true;
      $("comparacao").innerHTML = "";
    });
    botaoVer.textContent = "Ver o impacto da compra";
    etapa("");
    marcarEtapas();
    $("passoDados").scrollIntoView({
      behavior: "smooth"
    });
    $("itemName").focus({
      preventScroll: true
    });
  });

  // Cada alternativa aponta para os pontos reais que o usuário salvou.
  // Não existe base pronta de parceiros: os endereços são os que a própria pessoa
  // guardou em Ações locais, cadastrados à mão ou achados no Google Maps. É isso
  // que fecha o ciclo dentro do app: preço vira tempo de trabalho, tempo vira
  // alternativa, e a alternativa vira um lugar concreto do bairro em vez de uma
  // recomendação genérica. Sem ponto salvo, o link leva à busca já preenchida.
  const LOCAIS_POR_ALTERNATIVA = {
    usado: {
      tipos: [ "usado", "troca" ],
      rotulo: "Onde comprar usado, perto de você",
      convite: "Você ainda não cadastrou nenhum brechó ou ponto de troca."
    },
    reparar: {
      tipos: [ "reparo" ],
      rotulo: "Quem conserta, perto de você",
      convite: "Você ainda não cadastrou nenhum ponto de reparo."
    },
    compartilhar: {
      tipos: [ "aluguel", "troca" ],
      rotulo: "Quem aluga ou empresta, perto de você",
      convite: "Você ainda não cadastrou ninguém que aluga ou empresta."
    }
  };
  // O destino declarado no formulário deixa de ser só um dado guardado
  // e passa a ter consequência na tela — é o elo com a meta 12.5 da ODS 12.
  const DESTINOS_LOCAIS = {
    doar_revender: {
      tipos: [ "doacao", "usado" ],
      titulo: "Você pretende doar ou revender depois",
      texto: "Isso mantém o item em uso por mais tempo e o tira da fila do descarte."
    },
    reciclar: {
      tipos: [ "descarte" ],
      titulo: "Você pretende levar para descarte correto",
      texto: "Eletrônico não vai no lixo comum: tem metal pesado e componente que contamina solo e água."
    },
    guardar: {
      tipos: [ "doacao", "usado", "troca" ],
      titulo: "Você pretende guardar mesmo sem usar",
      texto: "Item parado perde valor até virar descarte. Doar, trocar ou revender enquanto ele ainda funciona devolve o produto ao uso."
    },
    descartar: {
      tipos: [ "descarte", "doacao" ],
      titulo: "Você pretende jogar fora",
      texto: "É aqui que a compra vira resíduo. A meta 12.5 da ODS 12 trata exatamente disso: reduzir a geração de resíduo por prevenção, redução, reciclagem e reuso."
    }
  };
  async function carregarLocais() {
    try {
      return await S.listar("local_actions", {
        ordem: "created_at",
        asc: false
      });
    } catch {
      return [];
    }
  }
  function pontosPorTipo(tipos) {
    return locais.filter(l => tipos.indexOf(l.kind) >= 0);
  }
  // O item analisado vira o "para quê" da busca em Ações locais: as primeiras
  // palavras, sem modelo nem medida ("iPhone 15 Pro 256GB" vira "iPhone Pro").
  const LIGACOES = /^(a|o|as|os|de|da|do|das|dos|e|com|sem|para|pra|em)$/i;
  function itemParaBusca(nome) {
    const palavras = String(nome || "").replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter(p => p && !/\d/.test(p)).slice(0, 3);
    while (palavras.length && LIGACOES.test(palavras[palavras.length - 1])) {
      palavras.pop();
    }
    return palavras.join(" ").slice(0, 60);
  }
  function linkProcurar(tipos) {
    const item = itemParaBusca(entrada && entrada.item_name);
    return `locais.html?tipo=${encodeURIComponent(tipos[0])}${item ? `&item=${encodeURIComponent(item)}` : ""}#procurar`;
  }
  function cartaoPonto(l) {
    const t = cfg.TIPOS_ACAO_LOCAL.find(x => x.id === l.kind) || {};
    const detalhe = [ l.address, l.contact ].filter(Boolean).map(U.escapeHTML).join(" · ");
    // Ponto salvo de uma busca no Maps: o link do lugar fica na observação.
    const achado = /https:\/\/(?:www\.)?google\.[a-z.]+\/maps\S*|https:\/\/maps\.google\.\S+/.exec(l.notes || "");
    const mapa = achado && U.urlHttpSegura(achado[0]);
    return `\n      <li class="ponto-local">\n        <span class="ponto-local__icone" aria-hidden="true">${t.icone || "\ud83d\udccd"}</span>\n        <span class="ponto-local__corpo">\n          <b>${U.escapeHTML(l.name)}</b>\n          <small>${U.escapeHTML(t.rotulo || "")}${detalhe ? ` \u00b7 ${detalhe}` : ""}</small>\n          ${mapa ? `<small><a class="ponto-local__mapa" href="${U.escapeHTML(mapa)}" target="_blank" rel="noopener">Abrir no <span class="marca-maps" translate="no">Google Maps</span></a></small>` : ""}\n          ${l.verified_at ? `<small class="ponto-local__data">conferido em ${U.dataBR(l.verified_at)}</small>` : `<small class="ponto-local__data">sem data de conferência</small>`}\n        </span>\n      </li>`;
  }
  function blocoPontos(mapa) {
    if (!mapa) {
      return "";
    }
    const achados = pontosPorTipo(mapa.tipos);
    if (!achados.length) {
      return `\n        <p class="alternativa__vazio">${U.escapeHTML(mapa.convite)}\n          <span class="alternativa__links"><a href="${linkProcurar(mapa.tipos)}">Procurar perto de você →</a>\n          <a href="locais.html">Cadastrar um ponto →</a></span></p>`;
    }
    return `\n        <div class="alternativa__pontos">\n          <p class="alternativa__pontos-rotulo">${U.escapeHTML(mapa.rotulo)}</p>\n          <ul class="lista-pontos">${achados.slice(0, 3).map(cartaoPonto).join("")}</ul>\n          <span class="alternativa__links"><a class="alternativa__local" href="locais.html">${achados.length > 3 ? `Ver os outros ${achados.length - 3} →` : "Gerenciar meus pontos →"}</a>\n          <a class="alternativa__local" href="${linkProcurar(mapa.tipos)}">Procurar mais perto de você →</a></span>\n        </div>`;
  }
  function renderDestino() {
    const host = document.getElementById("blocoDestino");
    const mapa = entrada && entrada.end_of_life ? DESTINOS_LOCAIS[entrada.end_of_life] : null;
    if (!mapa) {
      host.hidden = true;
      return;
    }
    const achados = pontosPorTipo(mapa.tipos);
    document.getElementById("destinoItem").innerHTML = `\n      <p class="destino-item__titulo">${U.escapeHTML(mapa.titulo)}</p>\n      <p class="destino-item__texto">${U.escapeHTML(mapa.texto)}</p>\n      ${achados.length ? `<ul class="lista-pontos">${achados.slice(0, 3).map(cartaoPonto).join("")}</ul>\n        <a class="alternativa__local" href="locais.html">Gerenciar meus pontos →</a>` : `<p class="alternativa__vazio">Você ainda não cadastrou nenhum ponto para isso.\n        <span class="alternativa__links"><a href="${linkProcurar(mapa.tipos)}">Procurar perto de você →</a>\n        <a href="locais.html">Cadastrar um ponto →</a></span></p>`}`;
    host.hidden = false;
  }
  const OPCOES = {
    necessidade: [ "Preciso agora", "Posso esperar", "É impulso" ],
    uso: [ "Uso diário", "Uso ocasional", "Uso raro" ],
    durabilidade: [ "Alta, com garantia", "Média", "Baixa ou descartável" ],
    alternativas: [ "Existe opção usada", "Posso emprestar/alugar", "Não há alternativa" ],
    orcamento: [ "Não compromete nada", "Aperta um pouco", "Compromete o essencial" ],
    descarte: [ "Uso por muitos anos", "Doo ou revendo depois", "Vai virar descarte rápido" ]
  };
  // Três perguntas rápidas primeiro; as outras três ficam a
  // um toque, para não virar formulário depois do formulário.
  const RAPIDAS = [ "necessidade", "uso", "durabilidade" ];
  const perguntaHTML = q => `
      <fieldset class="reflexao">
        <legend>${U.escapeHTML(q.dimensao)}</legend>
        <p>${U.escapeHTML(q.pergunta)}</p>
        <div class="opcoes-reflexao">
          ${OPCOES[q.id].map(op => `
            <label class="chip">
              <input type="radio" name="${q.id}" value="${U.escapeHTML(op)}">
              <span>${U.escapeHTML(op)}</span>
            </label>`).join("")}
        </div>
      </fieldset>`;
  function renderReflexoes() {
    const form = $("formReflexao");
    const rapidas = cfg.REFLEXOES.filter(q => RAPIDAS.includes(q.id));
    const outras = cfg.REFLEXOES.filter(q => !RAPIDAS.includes(q.id));
    form.innerHTML = rapidas.map(perguntaHTML).join("") + (outras.length ? `
      <details class="detalhes-hipoteses mais-reflexoes">
        <summary>Mais ${outras.length} perguntas: ${outras.map(q => q.dimensao.toLowerCase()).join(", ")}</summary>
        ${outras.map(perguntaHTML).join("")}
      </details>` : "");
    renderSintese();
  }
  $("formReflexao").addEventListener("change", renderSintese);
  function renderSintese() {
    const ind = R.indicadorResponsavel(coletarReflexoes());
    const host = document.getElementById("sinteseReflexao");
    if (!host) {
      return;
    }
    if (ind.pontuacao === null) {
      host.innerHTML = `<p class="nota">${U.escapeHTML(ind.sintese)}</p>`;
      return;
    }
    host.innerHTML = `\n      <article class="indicador-responsavel indicador-responsavel--${ind.nivel}">\n        <span class="indicador-responsavel__etiqueta">Indicador de decisão responsável</span>\n        <strong class="indicador-responsavel__valor">${ind.pontuacao}<small>/100</small></strong>\n        <p class="indicador-responsavel__rotulo">${U.escapeHTML(ind.rotulo)}</p>\n        <p>${U.escapeHTML(ind.sintese)}</p>\n        <p class="indicador-responsavel__cobertura">${ind.respondidas} de ${ind.total} perguntas respondidas.</p>\n      </article>\n      ${ind.alertas.length ? `<ul class="lista-alertas-reflexao">${ind.alertas.map(a => `<li><strong>${U.escapeHTML(a.dimensao)}:</strong> ${U.escapeHTML(a.texto)}</li>`).join("")}</ul>` : ""}\n      <details class="detalhes-hipoteses">\n        <summary>Como este número é calculado</summary>\n        <ul class="lista-simples">\n          ${ind.criterios.map(c => `<li>${U.escapeHTML(c.dimensao)}: ${c.respondida ? `${U.escapeHTML(c.resposta)} — ${c.pontos} de 2 pontos` : "sem resposta, fora da conta"}</li>`).join("")}\n        </ul>\n        <p class="nota">Cada pergunta vale de 0 a 2 pontos; o indicador é a soma dividida pelo máximo das perguntas respondidas.</p>\n        <p class="nota">${U.escapeHTML(ind.limitacao)}</p>\n      </details>`;
  }
  const coletarReflexoes = () => {
    const dados = {};
    new FormData(document.getElementById("formReflexao")).forEach((v, k) => {
      dados[k] = v;
    });
    return dados;
  };
  // A decisão como conclusão da análise: quatro escolhas
  // principais, cada uma dizendo o que acontece ao salvar, e uma confirmação
  // visível antes de gravar.
  const DECISAO = id => cfg.DECISOES.find(d => d.id === id);
  const botaoDecisao = d => `
      <button type="button" class="botao-decisao${d.consciente ? " botao-decisao--consciente" : ""}" data-decisao="${d.id}" role="radio" aria-checked="false">
        <strong>${U.escapeHTML(d.label)}</strong>
        <span class="botao-decisao__consequencia">${U.escapeHTML(d.consequencia || "")}</span>
        <small>+${d.xp} XP</small>
      </button>`;
  function renderDecisoes() {
    const principais = cfg.DECISOES.filter(d => d.grupo !== "alternativa");
    const alternativas = cfg.DECISOES.filter(d => d.grupo === "alternativa");
    $("opcoesDecisao").innerHTML = principais.map(botaoDecisao).join("") + (alternativas.length ? `
      <button type="button" class="botao-decisao botao-decisao--consciente botao-decisao--grupo" id="btnBuscarAlternativa" aria-expanded="false" aria-controls="alternativasDecisao">
        <strong>Buscar alternativa</strong>
        <span class="botao-decisao__consequencia">Usado, conserto ou aluguel em vez de comprar novo.</span>
      </button>
      <div class="opcoes-decisao opcoes-decisao--alternativas" id="alternativasDecisao" hidden>
        ${alternativas.map(botaoDecisao).join("")}
      </div>` : "");
    decisao = null;
    $("confirmacaoDecisao").hidden = true;
    const salvar = $("btnSalvarDecisao");
    salvar.disabled = true;
    salvar.textContent = "Salvar decisão";
    $("btnBuscarAlternativa")?.addEventListener("click", e => {
      const grupo = $("alternativasDecisao");
      grupo.hidden = !grupo.hidden;
      e.currentTarget.setAttribute("aria-expanded", String(!grupo.hidden));
    });
    document.querySelectorAll("[data-decisao]").forEach(b => b.addEventListener("click", () => {
      decisao = b.dataset.decisao;
      document.querySelectorAll("[data-decisao]").forEach(x => {
        x.classList.toggle("ativo", x === b);
        x.setAttribute("aria-checked", String(x === b));
      });
      const d = DECISAO(decisao);
      const confirmacao = $("confirmacaoDecisao");
      confirmacao.hidden = false;
      confirmacao.className = `confirmacao-decisao confirmacao-decisao--${decisao === "comprar" ? "compra" : "consciente"}`;
      confirmacao.innerHTML = `<p>Você escolheu <strong>${U.escapeHTML(d.label)}</strong>.</p>
        <p>Ao salvar: ${decisao === "comprar" ? `a saída de <strong>${U.moeda(entrada.price * (entrada.quantity || 1))}</strong> entra no seu extrato com a data de hoje.` : U.escapeHTML(d.consequencia.charAt(0).toLowerCase() + d.consequencia.slice(1))}</p>`;
      salvar.disabled = false;
      salvar.textContent = `Salvar decisão: ${d.label}`;
    }));
  }
  const chaveCalculo = () => `${(entrada.item_name || "").toLowerCase().trim()}|${Number(entrada.price).toFixed(2)}|${U.hojeISO()}`;
  function montarRegistro(extra = {}) {
    return R.paraRegistro({
      ...entrada,
      resultado: resultado,
      perfil: ctx.perfil,
      note: document.getElementById("decisaoNota").value.trim() || entrada.note,
      ...extra
    });
  }
  async function cadastrarCalculo(extra = {}) {
    const registro = montarRegistro(extra);
    if (registroId) {
      const {analyzed_at: analyzed_at, ...campos} = registro;
      await S.atualizar("purchase_analyses", registroId, campos);
      return registroId;
    }
    const criado = await S.inserir("purchase_analyses", registro);
    registroId = criado.id;
    return registroId;
  }
  $("btnRegistrarCalculo").addEventListener("click", async () => {
    if (!resultado) {
      return;
    }
    const botao = $("btnRegistrarCalculo");
    botao.disabled = true;
    try {
      await cadastrarCalculo({
        decision: null
      });
      if (Number(entrada.price) >= cfg.XP.VALOR_MINIMO_CALCULO) {
        await G.premiar("calculo", {
          chave: chaveCalculo(),
          motivo: "análise salva"
        });
        window.FinckCalculos?.recarregar?.();
      }
      await G.sincronizarConquistas();
      $("statusRegistro").innerHTML = `Análise salva. <a href="#calculos" data-ir-aba="calculos">Ver minhas análises</a>`;
      U.toast("Análise salva no seu histórico.", "sucesso");
    } catch (err) {
      $("statusRegistro").innerHTML = `<span class="cor-vermelha">Não deu para salvar agora: ${U.escapeHTML(err.message)} Tente de novo em instantes.</span>`;
      botao.disabled = false;
    }
  });
  $("btnSalvarDecisao").addEventListener("click", async () => {
    if (!resultado || !decisao) {
      return;
    }
    const botao = $("btnSalvarDecisao");
    botao.disabled = true;
    try {
      const jaRegistrado = Boolean(registroId);
      const reflexoes = coletarReflexoes();
      // A análise e a saída eram duas gravações soltas: se a segunda
      // falhasse, ficava uma decisão de "comprar" sem dinheiro saindo. Agora a
      // análise é gravada sem decisão, o lançamento vem antes (idempotente pela
      // chave da análise, então clicar duas vezes não duplica) e a decisão só é
      // registrada depois que o dinheiro se moveu de verdade.
      await cadastrarCalculo({
        decision: null,
        reflections: reflexoes
      });
      if (decisao === "comprar") {
        await S.operacao(S.chaveDeOperacao("compra_reality", registroId), () => S.inserir("transactions", {
          type: "saida",
          description: entrada.item_name,
          amount: entrada.price * (entrada.quantity || 1),
          date: U.hojeISO(),
          category: entrada.category,
          source: "reality"
        }), {
          operacao: "compra_reality"
        });
      }
      await S.atualizar("purchase_analyses", registroId, {
        decision: decisao,
        reflections: reflexoes
      });
      if (!jaRegistrado && Number(entrada.price) >= cfg.XP.VALOR_MINIMO_CALCULO) {
        await G.premiar("calculo", {
          chave: chaveCalculo(),
          motivo: "análise salva",
          silencioso: true
        });
      }
      const d = DECISAO(decisao);
      await G.premiar("decisao", {
        chave: `${registroId}`,
        xp: d?.xp || 5,
        motivo: "decisão registrada"
      });
      window.FinckCalculos?.recarregar?.();
      await G.sincronizarConquistas();
      // Próximos passos à vista, sem trocar de tela por conta própria.
      const tipos = {
        alternativa: [ "usado", "troca", "aluguel" ],
        usado: [ "usado", "troca" ],
        reparar: [ "reparo" ]
      }[decisao];
      const confirmacao = $("confirmacaoDecisao");
      confirmacao.hidden = false;
      confirmacao.className = "confirmacao-decisao confirmacao-decisao--salva";
      confirmacao.innerHTML = `<p><strong>Decisão salva: ${U.escapeHTML(d.label)}.</strong> ${decisao === "comprar" ? "A saída já está no seu extrato." : d.consciente ? "Daqui a 30 dias o FinCK pergunta o que aconteceu depois." : ""}</p>
        <div class="acoes-etapa">
          ${tipos ? `<a class="btn-primario btn-mini" href="${linkProcurar(tipos)}">Procurar perto de você</a>` : ""}
          <a class="btn-secundario btn-mini" href="#calculos" data-ir-aba="calculos">Ver minhas análises</a>
        </div>`;
      botao.textContent = "Decisão salva";
      U.toast("Decisão registrada no seu histórico.", "sucesso");
    } catch (err) {
      const confirmacao = $("confirmacaoDecisao");
      confirmacao.hidden = false;
      confirmacao.className = "confirmacao-decisao confirmacao-decisao--erro";
      confirmacao.innerHTML = `<p><strong>A decisão não foi salva.</strong> ${U.escapeHTML(err.message)} Nada foi lançado duas vezes: pode tentar de novo.</p>`;
      botao.disabled = false;
    }
  });
  $("btnNovaAnalise").addEventListener("click", () => {
    resultado = null;
    entrada = null;
    decisao = null;
    registroId = null;
    comparando = null;
    anterior = null;
    $("btnRegistrarCalculo").disabled = false;
    $("statusRegistro").textContent = "";
    form.reset();
    U.limparMoeda("itemPrice");
    delete campoCategoria.dataset.escolhida;
    campoCategoria.value = "Outros";
    pilulaCategoria.hidden = true;
    $("faixaComparando").hidden = true;
    $("comparacao").innerHTML = "";
    $("alertaRenda").hidden = true;
    [ "passoResultado", "passoReflexao", "passoDecisao" ].forEach(id => {
      $(id).hidden = true;
    });
    $("btnSalvarDecisao").disabled = true;
    $("btnSalvarDecisao").textContent = "Salvar decisão";
    botaoVer.textContent = "Ver o impacto da compra";
    etapa("");
    window.FinckFundo?.tom("neutro");
    marcarEtapas();
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });
});
