document.addEventListener("DOMContentLoaded", async () => {
  const cfg = window.FINCK_CONFIG;
  const S = window.FinckStore;
  const U = window.FinckUtils;
  const G = window.FinckGame;

  const user = await window.FinckNav.iniciarPagina({
    titulo: "Jornada",
    subtitulo: "Títulos, XP e conquistas",
  });
  if (!user) return;

  const { desbloqueadas, ctx } = await G.sincronizarConquistas();
  const estado = await S.obterGamificacao();
  const nivel = G.nivelDe(estado.xp);
  const diario = await G.statusDiario();

  document.getElementById("cardNivel").innerHTML = `
    <div class="nivel-com-medalha">
      <div class="medalha-cena" data-medalha
           title="${U.escapeHTML(nivel.titulo)} — nível ${nivel.level}">
        <div class="medalha-orbita">
          <div class="medalha">
            <div class="medalha__face medalha__face--frente">
              <span class="medalha__brilho" aria-hidden="true"></span>
              <span class="medalha__icone" aria-hidden="true">${nivel.icone}</span>
              <span class="medalha__nivel">${nivel.level}</span>
              <span class="medalha__rotulo">nível</span>
              <span class="medalha__xp">${U.numero(estado.xp, 0)} XP</span>
            </div>
            <div class="medalha__face medalha__face--verso">
              <span class="medalha__brilho" aria-hidden="true"></span>
              <span class="medalha__titulo">${U.escapeHTML(nivel.titulo)}</span>
              <span class="medalha__lema">${U.escapeHTML(nivel.lema || "")}</span>
            </div>
            <span class="medalha__borda" aria-hidden="true"></span>
          </div>
        </div>
        <span class="medalha-dica"><span>Passe o mouse para girar</span></span>
      </div>

      <div class="nivel-com-medalha__texto">
        <div class="nivel-topo">
          <span class="nivel-badge">${nivel.icone} Nível ${nivel.level}</span>
          <strong>${U.numero(estado.xp, 0)} XP</strong>
        </div>
        <h3 class="nivel-titulo">${U.escapeHTML(nivel.titulo)}</h3>
        <p class="nivel-lema">${U.escapeHTML(nivel.lema || "")}</p>
        <div class="barra" role="img"
             aria-label="Progresso para o próximo nível: ${U.percentual(nivel.progresso, 0)}">
          <div class="barra-preenchida" style="width:${nivel.progresso}%"></div>
        </div>
        <p class="nota">${
          nivel.proximo
            ? `Faltam ${U.numero(nivel.xpParaProximo, 0)} XP para ${U.escapeHTML(nivel.proximo.titulo)}.`
            : "Você chegou ao último título da trilha."
        }</p>
      </div>
    </div>`;

  window.FinckFX?.ligarMedalha?.();

  document.getElementById("resumoGame").innerHTML = `
    <article class="card-indicador"><span>Sequência</span><strong>${estado.streak || 0} dias</strong></article>
    <article class="card-indicador"><span>Conquistas</span><strong>${desbloqueadas.length} / ${G.CONQUISTAS.length}</strong></article>
    <article class="card-indicador"><span>Cálculos reais</span><strong>${ctx.analises}</strong></article>
    <article class="card-indicador"><span>Compras evitadas</span><strong class="cor-verde">${ctx.evitadas}</strong></article>
    <article class="card-indicador"><span>Horas preservadas</span><strong>${U.numero(ctx.horasPreservadas, 1)} h</strong></article>`;

  document.getElementById("trilhaNiveis").innerHTML = G.NIVEIS.map((n) => {
    const estadoNivel = n.level < nivel.level ? "concluido" : n.level === nivel.level ? "atual" : "bloqueado";
    return `
      <li class="nivel-trilha nivel-trilha--${estadoNivel}">
        <span class="nivel-trilha__icone" aria-hidden="true">${n.icone}</span>
        <div class="nivel-trilha__info">
          <strong>${U.escapeHTML(n.titulo)}</strong>
          <small>${U.escapeHTML(n.lema || "")}</small>
        </div>
        <span class="nivel-trilha__xp">${U.numero(n.xp, 0)} XP</span>
      </li>`;
  }).join("");

  document.getElementById("listaConquistas").innerHTML = G.CONQUISTAS.map((c) => {
    const ativa = desbloqueadas.includes(c.id);
    return `
      <article class="conquista${ativa ? " conquista--ativa" : " conquista--bloqueada"}">
        <span class="conquista-icone" aria-hidden="true">${ativa ? c.icone : "🔒"}</span>
        <h4>${U.escapeHTML(c.titulo)}</h4>
        <p>${U.escapeHTML(c.descricao)}</p>
      </article>`;
  }).join("");

  document.getElementById("chipTeto").textContent =
    `${diario.total} / ${diario.teto} XP hoje`;

  document.getElementById("listaXP").innerHTML = diario.acoes.filter((a) => !a.oculto).map((a) => {
    const limite = a.unico ? "1 vez na vida" : `${a.usados}/${a.limite} hoje`;
    const esgotado = a.usados >= a.limiteDia;
    return `
      <li class="item-lista${esgotado ? " item-lista--esgotado" : ""}">
        <span>${U.escapeHTML(a.rotulo)}</span>
        <small class="limite">${limite}</small>
        <strong>+${a.xp} XP</strong>
      </li>`;
  }).join("") + `
      <li class="item-lista"><span>Decisão consciente (adiar, usado, reparar, desistir)</span>
        <small class="limite">até ${cfg.XP.ACOES.decisao.limiteDia} por dia</small>
        <strong>+${Math.min(...cfg.DECISOES.map((d) => d.xp))} a +${Math.max(...cfg.DECISOES.map((d) => d.xp))} XP</strong></li>`;
});
