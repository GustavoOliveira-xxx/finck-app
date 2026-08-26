document.addEventListener("DOMContentLoaded", async () => {
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const F = window.FinckFinance;
  const T = window.FinckTempo;
  const C = window.FinckCenarios;
  const user = await window.FinckNav.iniciarPagina({
    titulo: "Cenários",
    subtitulo: "E se…"
  });
  if (!user) {
    return;
  }
  const $ = id => document.getElementById(id);
  let ctx = null;
  let cenarios = [];
  const escolhidos = new Set(C.catalogo().map(c => c.id));
  async function carregar() {
    ctx = await F.carregarContexto();
    montarOpcoes();
    simular();
  }
  const contexto = () => {
    const dias = Number(ctx.perfil?.work_days_month) || 22;
    const horas = Number(ctx.perfil?.work_hours_day) || 8;
    const valorDia = (Number(ctx.perfil?.income_monthly) || 0) / dias;
    return {
      saldo: ctx.saldo,
      rendaLivre: ctx.rendaLivre,
      metas: ctx.metas,
      valorDia: valorDia,
      valorHora: valorDia / horas
    };
  };
  const entrada = () => ({
    item: $("cenarioItem").value.trim(),
    preco: U.lerMoeda("cenarioPreco"),
    parcelas: Number($("cenarioParcelas").value) || 12,
    descontoUsado: .45
  });
  function montarOpcoes() {
    $("opcoesCenarios").innerHTML = C.catalogo().map(c => `\n      <label class="chip chip--cenario">\n        <input type="checkbox" data-cenario="${c.id}" ${escolhidos.has(c.id) ? "checked" : ""}>\n        <span>${U.escapeHTML(c.rotulo)}</span>\n      </label>`).join("");
    $("opcoesCenarios").querySelectorAll("[data-cenario]").forEach(c => c.addEventListener("change", () => {
      if (c.checked) {
        escolhidos.add(c.dataset.cenario);
      } else {
        escolhidos.delete(c.dataset.cenario);
      }
      simular();
    }));
  }
  function simular() {
    const e = entrada();
    if (!(e.preco > 0)) {
      $("tabelaCenarios").innerHTML = "";
      $("vazioCenarios").hidden = false;
      $("fluxograma").innerHTML = "";
      $("blocoFluxo").hidden = true;
      return;
    }
    $("vazioCenarios").hidden = true;
    $("blocoFluxo").hidden = false;
    cenarios = C.comparar(e, contexto(), [ ...escolhidos ]);
    renderTabela();
    renderFluxograma(e);
  }
  function renderTabela() {
    const melhor = C.ranking(cenarios)[0];
    $("tabelaCenarios").innerHTML = `\n      <div class="tabela-wrapper" tabindex="0" role="region" aria-label="Comparação de cenários; deslize horizontalmente para ver todas as colunas">\n        <table class="tabela tabela-cenarios">\n          <caption class="visualmente-oculto">Comparação entre cenários de compra</caption>\n          <thead>\n            <tr>\n              <th scope="col">Cenário</th>\n              <th scope="col">Custo</th>\n              <th scope="col">Em trabalho</th>\n              <th scope="col">Metas</th>\n              <th scope="col">Saldo depois</th>\n            </tr>\n          </thead>\n          <tbody>\n            ${cenarios.map(c => `\n              <tr class="${c.id === melhor.id ? "linha-folga" : ""}">\n                <th scope="row">\n                  ${U.escapeHTML(c.rotulo)}\n                  ${c.id === melhor.id ? '<span class="selo selo--mini">mais folga</span>' : ""}\n                  <small>${U.escapeHTML(c.resumo)}</small>\n                </th>\n                <td>${c.parcelas ? `${c.parcelas}x ${U.moeda(c.custoMensal)}` : c.precoEfetivo > 0 ? U.moeda(c.precoEfetivo) : "R$ 0,00"}</td>\n                <td>${c.horas > 0 ? T.formatar(c.horas) : "—"}</td>\n                <td>${c.impactoMetas.possui ? U.percentual(c.impactoMetas.percentual, 0) : "—"}</td>\n                <td class="${c.comprometeSaldo ? "cor-vermelha" : ""}">\n                  <strong>${U.moeda(c.saldoDepois)}</strong>\n                </td>\n              </tr>`).join("")}\n          </tbody>\n        </table>\n      </div>\n      <p class="assinatura-cenarios">Você escolhe.</p>`;
  }
  function renderFluxograma(e) {
    const {nos: nos, arestas: arestas} = C.fluxograma(e, cenarios);
    const caminhos = nos.filter(n => n.tipo === "caminho");
    if (!caminhos.length) {
      $("fluxograma").innerHTML = "";
      return;
    }
    const LARGURA_COL = 210;
    const GAP = 26;
    const largura = caminhos.length * LARGURA_COL + (caminhos.length - 1) * GAP;
    const altura = 470;
    const meio = largura / 2;
    const posX = ordem => ordem * (LARGURA_COL + GAP) + LARGURA_COL / 2;
    const caixa = (x, y, w, h, classe) => `<rect x="${x - w / 2}" y="${y}" width="${w}" height="${h}" rx="14" class="${classe}"/>`;
    const texto = (x, y, conteudo, classe, tamanho = 13) => `<text x="${x}" y="${y}" class="${classe}" font-size="${tamanho}" text-anchor="middle">${U.escapeHTML(conteudo)}</text>`;
    const liga = (x1, y1, x2, y2, classe = "fluxo-linha") => {
      const meioY = (y1 + y2) / 2;
      return `<path d="M ${x1} ${y1} C ${x1} ${meioY}, ${x2} ${meioY}, ${x2} ${y2}" class="${classe}"/>`;
    };
    const partes = [];
    partes.push(caixa(meio, 10, 240, 58, "fluxo-caixa fluxo-caixa--raiz"));
    partes.push(texto(meio, 34, nos[0].titulo, "fluxo-titulo", 14));
    partes.push(texto(meio, 54, nos[0].detalhe, "fluxo-detalhe", 12));
    caminhos.forEach(n => {
      const x = posX(n.ordem);
      partes.push(liga(meio, 68, x, 132));
      partes.push(caixa(x, 132, LARGURA_COL, 62, `fluxo-caixa fluxo-caixa--caminho${n.consciente ? " fluxo-caixa--consciente" : ""}`));
      partes.push(texto(x, 156, n.titulo, "fluxo-titulo", 13));
      const palavras = n.detalhe.split(" ");
      const meioP = Math.ceil(palavras.length / 2);
      partes.push(texto(x, 173, palavras.slice(0, meioP).join(" "), "fluxo-detalhe", 10.5));
      partes.push(texto(x, 186, palavras.slice(meioP).join(" "), "fluxo-detalhe", 10.5));
    });
    nos.filter(n => n.tipo === "resultado").forEach(n => {
      const x = posX(n.ordem);
      partes.push(liga(x, 194, x, 246, `fluxo-linha fluxo-linha--${n.risco}`));
      partes.push(caixa(x, 246, LARGURA_COL, 150, `fluxo-caixa fluxo-caixa--resultado fluxo-caixa--${n.risco}`));
      partes.push(texto(x, 274, n.titulo, "fluxo-valor", 15));
      n.linhas.forEach((l, i) => {
        const y = 306 + i * 30;
        partes.push(`<text x="${x - LARGURA_COL / 2 + 16}" y="${y}" class="fluxo-rotulo" font-size="10.5" text-anchor="start">${U.escapeHTML(l.rotulo)}</text>`);
        partes.push(`<text x="${x + LARGURA_COL / 2 - 16}" y="${y}" class="fluxo-numero" font-size="12" text-anchor="end">${U.escapeHTML(l.valor)}</text>`);
      });
    });
    partes.push(texto(meio, altura - 16, "Você escolhe.", "fluxo-assinatura", 13));
    $("fluxograma").innerHTML = `\n      <svg viewBox="0 0 ${largura} ${altura}" role="img"\n           aria-label="Fluxograma de decisão comparando ${caminhos.length} cenários"\n           preserveAspectRatio="xMidYMin meet">\n        ${partes.join("\n")}\n      </svg>`;
  }
  [ "cenarioItem", "cenarioPreco", "cenarioParcelas" ].forEach(id => $(id).addEventListener("input", simular));
  $("btnLimparCenario").addEventListener("click", () => {
    $("cenarioItem").value = "";
    U.limparMoeda("cenarioPreco");
    $("cenarioParcelas").value = 12;
    simular();
  });
  $("btnLevarReality").addEventListener("click", () => {
    const e = entrada();
    if (!(e.preco > 0)) {
      return U.toast("Informe um valor para simular primeiro.", "erro");
    }
    const params = new URLSearchParams({
      item: e.item || "",
      preco: String(e.preco)
    });
    location.href = `reality.html?${params.toString()}`;
  });
  carregar();
});
