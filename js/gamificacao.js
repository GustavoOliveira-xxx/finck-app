document.addEventListener("DOMContentLoaded", async () => {
  const cfg = window.FINCK_CONFIG;
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const G = window.FinckGame;
  const user = await window.FinckNav.iniciarPagina({
    titulo: "Jornada",
    subtitulo: "Títulos, XP e conquistas"
  });
  if (!user) {
    return;
  }
  const {desbloqueadas: desbloqueadas, ctx: ctx} = await G.sincronizarConquistas();
  const estado = await S.obterGamificacao();
  const nivel = G.nivelDe(estado.xp);
  const diario = await G.statusDiario();
  document.getElementById("cardNivel").innerHTML = `\n    <div class="nivel-com-medalha">\n      <div class="medalha-cena" data-medalha\n           title="${U.escapeHTML(nivel.titulo)} — nível ${nivel.level}">\n        <div class="medalha-orbita">\n          <div class="medalha">\n            <div class="medalha__face medalha__face--frente">\n              <span class="medalha__brilho" aria-hidden="true"></span>\n              <span class="medalha__icone" aria-hidden="true">${nivel.icone}</span>\n              <span class="medalha__nivel">${nivel.level}</span>\n              <span class="medalha__rotulo">nível</span>\n              <span class="medalha__xp">${U.numero(estado.xp, 0)} XP</span>\n            </div>\n            <div class="medalha__face medalha__face--verso">\n              <span class="medalha__brilho" aria-hidden="true"></span>\n              <span class="medalha__titulo">${U.escapeHTML(nivel.titulo)}</span>\n              <span class="medalha__lema">${U.escapeHTML(nivel.lema || "")}</span>\n            </div>\n            <span class="medalha__borda" aria-hidden="true"></span>\n          </div>\n        </div>\n        <span class="medalha-dica"><span>Passe o mouse para girar</span></span>\n      </div>\n\n      <div class="nivel-com-medalha__texto">\n        <div class="nivel-topo">\n          <span class="nivel-badge">${nivel.icone} Nível ${nivel.level}</span>\n          <strong>${U.numero(estado.xp, 0)} XP</strong>\n        </div>\n        <h3 class="nivel-titulo">${U.escapeHTML(nivel.titulo)}</h3>\n        <p class="nivel-lema">${U.escapeHTML(nivel.lema || "")}</p>\n        <div class="barra" role="img"\n             aria-label="Progresso para o próximo nível: ${U.percentual(nivel.progresso, 0)}">\n          <div class="barra-preenchida" style="width:${nivel.progresso}%"></div>\n        </div>\n        <p class="nota">${nivel.proximo ? `Faltam ${U.numero(nivel.xpParaProximo, 0)} XP para ${U.escapeHTML(nivel.proximo.titulo)}.` : "Você chegou ao último título da trilha."}</p>\n      </div>\n    </div>`;
  window.FinckFX?.ligarMedalha?.();
  document.getElementById("resumoGame").innerHTML = `\n    <article class="card-indicador"><span>Sequência</span><strong>${estado.streak || 0} dias</strong></article>\n    <article class="card-indicador"><span>Conquistas</span><strong>${desbloqueadas.length} / ${G.CONQUISTAS.length}</strong></article>\n    <article class="card-indicador"><span>Cálculos reais</span><strong>${ctx.analises}</strong></article>\n    <article class="card-indicador"><span>Decisões conscientes</span><strong class="cor-verde">${ctx.evitadas}</strong></article>\n    <article class="card-indicador"><span>Horas de trabalho equivalentes</span><strong>${U.numero(ctx.horasPreservadas, 1)} h</strong></article>`;
  document.getElementById("trilhaNiveis").innerHTML = G.NIVEIS.map(n => {
    const estadoNivel = n.level < nivel.level ? "concluido" : n.level === nivel.level ? "atual" : "bloqueado";
    return `\n      <li class="nivel-trilha nivel-trilha--${estadoNivel}">\n        <span class="nivel-trilha__icone" aria-hidden="true">${n.icone}</span>\n        <div class="nivel-trilha__info">\n          <strong>${U.escapeHTML(n.titulo)}</strong>\n          <small>${U.escapeHTML(n.lema || "")}</small>\n        </div>\n        <span class="nivel-trilha__xp">${U.numero(n.xp, 0)} XP</span>\n      </li>`;
  }).join("");
  document.getElementById("listaConquistas").innerHTML = G.CONQUISTAS.map(c => {
    const ativa = desbloqueadas.includes(c.id);
    return `\n      <article class="conquista${ativa ? " conquista--ativa" : " conquista--bloqueada"}">\n        <span class="conquista-icone" aria-hidden="true">${ativa ? c.icone : "🔒"}</span>\n        <h4>${U.escapeHTML(c.titulo)}</h4>\n        <p>${U.escapeHTML(c.descricao)}</p>\n      </article>`;
  }).join("");
  document.getElementById("chipTeto").textContent = `${diario.total} / ${diario.teto} XP hoje`;
  // PROD-007 — registrar uma saída é organização, não redução de consumo. As
  // duas coisas rendem XP, mas aparecem separadas para não se confundirem.
  const linhaXP = a => {
    const limite = a.unico ? "1 vez na vida" : `${a.usados}/${a.limite} hoje`;
    const esgotado = a.usados >= a.limiteDia;
    return `\n      <li class="item-lista${esgotado ? " item-lista--esgotado" : ""}">\n        <span>${U.escapeHTML(a.rotulo)}</span>\n        <small class="limite">${limite}</small>\n        <strong>+${a.xp} XP</strong>\n      </li>`;
  };
  const visiveis = diario.acoes.filter(a => !a.oculto);
  const consumo = visiveis.filter(a => a.categoria === "consumo");
  const organizacao = visiveis.filter(a => a.categoria !== "consumo");
  document.getElementById("listaXP").innerHTML = `\n    <li class="item-lista item-lista--titulo"><span>Consumo responsável</span></li>\n    ${consumo.map(linhaXP).join("")}\n    <li class="item-lista"><span>Decisão consciente (adiar, usado, reparar, desistir)</span>\n      <small class="limite">até ${cfg.XP.ACOES.decisao.limiteDia} por dia</small>\n      <strong>+${Math.min(...cfg.DECISOES.map(d => d.xp))} a +${Math.max(...cfg.DECISOES.map(d => d.xp))} XP</strong></li>\n    <li class="item-lista item-lista--titulo"><span>Organização financeira</span></li>\n    ${organizacao.map(linhaXP).join("")}`;
});
