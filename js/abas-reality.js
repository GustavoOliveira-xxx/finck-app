(() => {
  const PAINEIS = {
    calculo: "painelCalculo",
    calculos: "painelCalculos"
  };
  const movimentoLiberado = () => {
    const reduz = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return !reduz && (document.documentElement.dataset.animacoes || "completa") === "completa";
  };
  function trocar(aba) {
    if (!PAINEIS[aba]) {
      aba = "calculo";
    }
    Object.entries(PAINEIS).forEach(([id, painelId]) => {
      const painel = document.getElementById(painelId);
      const botao = document.querySelector(`.aba[data-aba="${id}"]`);
      if (painel) {
        painel.hidden = id !== aba;
      }
      if (botao) {
        botao.classList.toggle("ativa", id === aba);
        botao.setAttribute("aria-selected", String(id === aba));
        botao.tabIndex = id === aba ? 0 : -1;
      }
    });
    if (history.replaceState) {
      history.replaceState(null, "", aba === "calculos" ? "#calculos" : "#calculo");
    }
    if (aba === "calculos") {
      window.FinckCalculos?.recarregar?.();
    }
    try {
      window.scrollTo({
        top: 0,
        behavior: movimentoLiberado() ? "smooth" : "instant"
      });
    } catch {
      window.scrollTo(0, 0);
    }
  }

  // "Seu histórico": o histórico como aprendizado, não só como tabela.
  // Os números vêm de FinckReality.resumoHistorico; a frase conta apenas as
  // decisões salvas, não o que aconteceu depois (isso é o acompanhamento).
  function historicoHTML(analises) {
    const R = window.FinckReality;
    const U = window.FinckUtils;
    const lista = analises || [];
    if (!R || !U || !lista.length) {
      return "";
    }
    const r = R.resumoHistorico(lista);
    const leitura = R.leituraHistorico ? R.leituraHistorico(lista) : null;
    const numero = (valor, rotulo, detalhe = "") => `
        <li><strong>${valor}</strong> <span>${rotulo}${detalhe ? ` <small>${detalhe}</small>` : ""}</span></li>`;
    const plural = (n, um, varios) => n === 1 ? um : varios;
    return `
      <h3>Seu histórico</h3>
      <ul class="resumo-decisoes__numeros">
        ${numero(r.total, plural(r.total, "compra analisada", "compras analisadas"))}
        ${numero(U.moeda(r.valor_avaliado), plural(r.total, "avaliado", "avaliados"))}
        ${numero(r.adiadas, plural(r.adiadas, "adiada", "adiadas"), "Esperar")}
        ${numero(r.descartadas, plural(r.descartadas, "descartada", "descartadas"), "Não comprar")}
        ${r.com_alternativa ? numero(r.com_alternativa, "com alternativa", "usado, conserto ou aluguel") : ""}
        ${numero(r.realizadas, plural(r.realizadas, "realizada", "realizadas"), "Comprar agora")}
        ${r.sem_decisao ? numero(r.sem_decisao, "sem decisão ainda") : ""}
      </ul>
      <p class="resumo-decisoes__frase">${U.escapeHTML(R.fraseHistorico(r))}</p>
      ${leitura ? `<p class="resumo-decisoes__leitura"><span class="resumo-decisoes__origem">Leitura do FinCK, feita por regra, sem IA:</span> ${U.escapeHTML(leitura)}</p>` : ""}
      <p class="nota">Conta as decisões salvas no momento da análise, não a prova do que aconteceu depois. O acompanhamento de 30 dias, em <a href="decisoes.html">Decisões</a>, registra o que veio depois.</p>`;
  }
  function renderHistorico(host, analises) {
    if (host) {
      host.innerHTML = historicoHTML(analises);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const abas = [ ...document.querySelectorAll(".aba[data-aba]") ];
    abas.forEach(b => b.addEventListener("click", () => trocar(b.dataset.aba)));
    // Padrão de abas do WAI-ARIA: setas trocam de aba, Home e End
    // vão para a primeira e a última, e só a aba ativa entra no Tab.
    abas.forEach((b, i) => {
      b.tabIndex = b.classList.contains("ativa") ? 0 : -1;
      b.addEventListener("keydown", e => {
        const destino = {
          ArrowRight: (i + 1) % abas.length,
          ArrowLeft: (i - 1 + abas.length) % abas.length,
          Home: 0,
          End: abas.length - 1
        }[e.key];
        if (destino === undefined) {
          return;
        }
        e.preventDefault();
        trocar(abas[destino].dataset.aba);
        abas[destino].focus();
      });
    });
    document.addEventListener("click", e => {
      const alvo = e.target.closest("[data-ir-aba]");
      if (!alvo) {
        return;
      }
      e.preventDefault();
      trocar(alvo.dataset.irAba);
      // "Fazer minha primeira análise" já deixa o cursor no campo do item.
      if (alvo.dataset.focar) {
        document.getElementById(alvo.dataset.focar)?.focus({
          preventScroll: true
        });
      }
    });
    if (location.hash === "#calculos") {
      trocar("calculos");
    }
  });
  window.FinckAbasReality = {
    trocar: trocar,
    historicoHTML: historicoHTML,
    renderHistorico: renderHistorico
  };
})();
