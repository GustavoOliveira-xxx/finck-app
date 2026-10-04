window.FinckIA = (() => {
  const cfg = window.FINCK_CONFIG;
  const S = window.FinckStore;
  // A rota da IA mora na Vercel (api/buscar-preco-ia.js): busca de preço pelo
  // link e pelo print, e a estimativa de impacto ambiental. A chave do Gemini
  // fica só lá; daqui sai apenas o pedido, com o token da sessão.
  const IA = cfg.BUSCA_IA || {};
  const ATIVA = IA.ATIVA === true && !!IA.ENDPOINT;
  const MSG = {
    semIA: "Os recursos de IA não estão disponíveis neste servidor.",
    demo: "Na demonstração, os recursos de IA ficam desligados. Entre com uma conta para usar.",
    sessao: "Sua sessão expirou. Entre novamente para usar a IA.",
    rede: "Não consegui falar com o servidor. Confira sua internet e tente de novo."
  };
  let situacao = null;
  // GET sem login e sem gastar cota, uma vez por página: o print e o impacto
  // ambiental perguntam a mesma coisa. Sem resposta (servidor estático, rota
  // antiga ou fora do ar), devolve null e quem decide é o próprio pedido.
  function status() {
    if (!ATIVA) {
      return Promise.resolve(null);
    }
    if (!situacao) {
      situacao = (async () => {
        const ctrl = new AbortController;
        const alarme = setTimeout(() => ctrl.abort(), 6000);
        try {
          const r = await fetch(IA.ENDPOINT, {
            method: "GET",
            cache: "no-store",
            signal: ctrl.signal
          });
          const s = r.ok ? await r.json().catch(() => null) : null;
          return s && s.ok === true ? s : null;
        } catch {
          return null;
        } finally {
          clearTimeout(alarme);
        }
      })();
    }
    return situacao;
  }
  // { ok: true } quando dá para pedir; { ok: false, motivo } quando já se sabe
  // que não vai funcionar aqui.
  async function disponivel() {
    if (!ATIVA) {
      return {
        ok: false,
        motivo: MSG.semIA
      };
    }
    const s = await status();
    if (s && s.ia === false) {
      return {
        ok: false,
        motivo: MSG.semIA
      };
    }
    if (s && S.emDemo() && s.demo === false) {
      return {
        ok: false,
        motivo: MSG.demo,
        demo: true
      };
    }
    return {
      ok: true
    };
  }
  // Em conta real vai o token da sessão; na demonstração não há token, e o
  // servidor responde pelo caminho anônimo se ele estiver liberado.
  async function pedir(corpo) {
    const token = S.emDemo() ? null : await S.tokenAcesso();
    if (!S.emDemo() && !token) {
      return {
        ok: false,
        codigo: "SEM_LOGIN",
        motivo: MSG.sessao
      };
    }
    try {
      const cabecalhos = {
        "Content-Type": "application/json"
      };
      if (token) {
        cabecalhos.Authorization = `Bearer ${token}`;
      }
      const r = await fetch(IA.ENDPOINT, {
        method: "POST",
        headers: cabecalhos,
        body: JSON.stringify(corpo)
      });
      // A Vercel recusa corpo grande antes da função, e responde sem JSON.
      if (r.status === 413) {
        return {
          ok: false,
          codigo: "GRANDE_DEMAIS",
          motivo: "O pedido ficou grande demais para enviar."
        };
      }
      return await r.json().catch(() => null) || {
        ok: false,
        codigo: "REDE",
        motivo: MSG.rede
      };
    } catch {
      return {
        ok: false,
        codigo: "REDE",
        motivo: MSG.rede
      };
    }
  }
  return {
    ATIVA: ATIVA,
    MSG: MSG,
    status: status,
    disponivel: disponivel,
    pedir: pedir
  };
})();
