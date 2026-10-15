// Validação com usuários: o roteiro da avaliação do FinCK com participantes
// voluntários, as respostas de cada sessão e os indicadores (docs/validacao-com-usuarios.md).
//
// Tudo fica neste aparelho (localStorage), sem nome, e-mail nem dado
// financeiro de verdade: cada participante é um código (P01, P02...). As
// contas dos indicadores são puras e ficam em window.FinckValidacao para os
// testes usarem as mesmas.
window.FinckValidacao = (() => {
  const CHAVE = "finck.validacao";
  const FATORES = [
    { id: "preco", rotulo: "O preço" },
    { id: "renda", rotulo: "A renda do mês" },
    { id: "horas", rotulo: "Horas de trabalho" },
    { id: "mes", rotulo: "O peso no orçamento do mês" },
    { id: "contas", rotulo: "Contas fixas e parcelas" },
    { id: "metas", rotulo: "Metas e reserva" },
    { id: "acumulados", rotulo: "Gastos acumulados (pequenos gastos, categoria em alta)" },
    { id: "alternativas", rotulo: "Alternativas (esperar, usado, conserto)" },
    { id: "duraveis", rotulo: "Durabilidade e descarte (ODS 12)" }
  ];
  // Fatores que mostram o impacto além do preço: tempo de trabalho, peso no
  // mês ou efeito nas metas.
  const DE_IMPACTO = [ "horas", "mes", "metas" ];
  const DECISOES = [
    { id: "comprar", rotulo: "Compraria agora" },
    { id: "esperar", rotulo: "Esperaria" },
    { id: "alternativa", rotulo: "Buscaria alternativa" },
    { id: "nao", rotulo: "Não compraria" },
    { id: "nao_sei", rotulo: "Não sabe" }
  ];
  const ESCALAS = [
    { id: "clareza", rotulo: "As informações foram claras." },
    { id: "facilidade", rotulo: "Foi fácil fazer as tarefas." },
    { id: "utilidade", rotulo: "As informações ajudariam a decidir uma compra." },
    { id: "origem", rotulo: "Entendi de onde vieram os números." },
    { id: "habitos", rotulo: "O FinCK me ajudou a perceber hábitos de consumo." }
  ];
  const CENARIO = "Você recebe R$ 3.500,00 por mês e já tem R$ 1.354,00 em contas fixas. Nos últimos 30 dias, gastou R$ 695,60 em pequenos gastos (delivery, lanche, transporte). Você quer comprar um fone de ouvido de R$ 800,00.";

  function ler() {
    try {
      const lista = JSON.parse(localStorage.getItem(CHAVE) || "[]");
      return Array.isArray(lista) ? lista : [];
    } catch {
      return [];
    }
  }
  function gravar(lista) {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(lista));
      return true;
    } catch {
      return false;
    }
  }
  function proximoCodigo(lista = ler()) {
    const maior = lista.reduce((m, s) => Math.max(m, Number(String(s.codigo || "").replace(/\D/g, "")) || 0), 0);
    return `P${String(maior + 1).padStart(2, "0")}`;
  }

  const pct = (n, total) => total ? n / total * 100 : null;
  const media = lista => lista.length ? lista.reduce((s, v) => s + v, 0) / lista.length : null;

  // Os indicadores da seção 6 do relatório. Mudar a escolha não é medida de
  // acerto: aparece só como informação.
  function indicadores(sessoes = []) {
    const n = sessoes.length;
    const conta = f => sessoes.filter(f).length;
    const fatores = (s, etapa) => Array.isArray(s?.[etapa]?.fatores) ? s[etapa].fatores : [];
    const escalas = Object.fromEntries(ESCALAS.map(e => [ e.id, media(sessoes.map(s => Number(s.escalas?.[e.id])).filter(v => v >= 1 && v <= 5)) ]));
    return {
      participantes: n,
      compreenderam_impacto: pct(conta(s => fatores(s, "depois").some(f => DE_IMPACTO.includes(f))), n),
      identificaram_acumulados: pct(conta(s => s.depois?.acumulados === "sim"), n),
      explicaram_diferenca: pct(conta(s => s.depois?.diferenca === "sim"), n),
      explicaram_em_parte: pct(conta(s => s.depois?.diferenca === "parcialmente"), n),
      fatores_antes: media(sessoes.map(s => fatores(s, "antes").length)),
      fatores_depois: media(sessoes.map(s => fatores(s, "depois").length)),
      mudaram_escolha: pct(conta(s => s.antes?.decisao && s.depois?.decisao && s.antes.decisao !== s.depois.decisao), n),
      sem_ajuda: pct(conta(s => s.tarefa?.ajuda === "sem"), n),
      tempo_medio_s: media(sessoes.map(s => Number(s.tarefa?.tempo_s)).filter(v => v > 0)),
      escalas: escalas
    };
  }

  // Uma linha por sessão, com cabeçalho; campos de texto entre aspas.
  function paraCSV(sessoes = []) {
    const campo = v => {
      const t = v === null || v === undefined ? "" : String(v);
      return /[",;\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const colunas = [
      [ "codigo", s => s.codigo ], [ "data", s => s.data ], [ "faixa_etaria", s => s.perfil?.faixa ], [ "usa_app_financas", s => s.perfil?.app ],
      [ "decisao_antes", s => s.antes?.decisao ], [ "fatores_antes", s => (s.antes?.fatores || []).join("|") ], [ "comentario_antes", s => s.antes?.comentario ],
      [ "tempo_ate_impacto_s", s => s.tarefa?.tempo_s ], [ "ajuda", s => s.tarefa?.ajuda ],
      [ "decisao_depois", s => s.depois?.decisao ], [ "fatores_depois", s => (s.depois?.fatores || []).join("|") ], [ "explicacao_preco_impacto", s => s.depois?.explicacao ],
      [ "explicou_diferenca", s => s.depois?.diferenca ], [ "identificou_acumulados", s => s.depois?.acumulados ],
      ...ESCALAS.map(e => [ `escala_${e.id}`, s => s.escalas?.[e.id] ]),
      [ "o_que_ajudou", s => s.comentarios?.ajudou ], [ "o_que_confundiu", s => s.comentarios?.confundiu ]
    ];
    return [ colunas.map(([nome]) => nome).join(";"), ...sessoes.map(s => colunas.map(([, f]) => campo(f(s))).join(";")) ].join("\n");
  }

  return {
    CHAVE: CHAVE,
    FATORES: FATORES,
    DE_IMPACTO: DE_IMPACTO,
    DECISOES: DECISOES,
    ESCALAS: ESCALAS,
    CENARIO: CENARIO,
    ler: ler,
    gravar: gravar,
    proximoCodigo: proximoCodigo,
    indicadores: indicadores,
    paraCSV: paraCSV
  };
})();

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page !== "validacao") {
    return;
  }
  const V = window.FinckValidacao;
  const U = window.FinckUtils;
  const esc = t => U.escapeHTML(t);
  const $ = id => document.getElementById(id);
  const form = $("formSessao");

  const opcoes = (nome, lista, tipo = "radio") => lista.map(o => `<label class="chip"><input type="${tipo}" name="${nome}" value="${esc(o.id)}"><span>${esc(o.rotulo)}</span></label>`).join("");
  $("cenario").textContent = V.CENARIO;
  $("decisaoAntes").innerHTML = opcoes("decisaoAntes", V.DECISOES);
  $("decisaoDepois").innerHTML = opcoes("decisaoDepois", V.DECISOES);
  $("fatoresAntes").innerHTML = opcoes("fatoresAntes", V.FATORES, "checkbox");
  $("fatoresDepois").innerHTML = opcoes("fatoresDepois", V.FATORES, "checkbox");
  $("escalas").innerHTML = V.ESCALAS.map(e => `
    <fieldset class="escala-validacao">
      <legend>${esc(e.rotulo)}</legend>
      <div class="escala-validacao__opcoes">${[ 1, 2, 3, 4, 5 ].map(n => `<label class="chip"><input type="radio" name="escala_${e.id}" value="${n}"><span>${n}</span></label>`).join("")}</div>
      <small>1 = discordo totalmente · 5 = concordo totalmente</small>
    </fieldset>`).join("");

  const marcado = nome => form.querySelector(`input[name="${nome}"]:checked`)?.value || null;
  const marcados = nome => [ ...form.querySelectorAll(`input[name="${nome}"]:checked`) ].map(i => i.value);
  const texto = id => $(id).value.trim().slice(0, 600) || null;

  function novoCodigo() {
    $("codigo").textContent = V.proximoCodigo();
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    if (!$("consentimento").checked) {
      U.erroCampo("consentimento", "Confirme que o participante concordou em participar.");
      return;
    }
    const lista = V.ler();
    const sessao = {
      codigo: V.proximoCodigo(lista),
      data: U.hojeISO(),
      perfil: {
        faixa: $("faixa").value || null,
        app: marcado("usaApp")
      },
      antes: {
        decisao: marcado("decisaoAntes"),
        fatores: marcados("fatoresAntes"),
        comentario: texto("comentarioAntes")
      },
      tarefa: {
        tempo_s: Number($("tempo").value) > 0 ? Math.round(Number($("tempo").value)) : null,
        ajuda: marcado("ajuda")
      },
      depois: {
        decisao: marcado("decisaoDepois"),
        fatores: marcados("fatoresDepois"),
        explicacao: texto("explicacao"),
        diferenca: marcado("diferenca"),
        acumulados: marcado("acumulados")
      },
      escalas: Object.fromEntries(V.ESCALAS.map(es => [ es.id, Number(marcado(`escala_${es.id}`)) || null ])),
      comentarios: {
        ajudou: texto("ajudou"),
        confundiu: texto("confundiu")
      }
    };
    if (!V.gravar([ ...lista, sessao ])) {
      U.toast("Não foi possível salvar neste navegador.", "erro");
      return;
    }
    form.reset();
    U.toast(`Sessão ${sessao.codigo} salva neste aparelho.`, "sucesso");
    novoCodigo();
    render();
    $("resultados").scrollIntoView({
      block: "start"
    });
  });

  const fmtPct = v => v === null ? "sem dados" : U.percentual(v, 0);
  const fmtNum = (v, casas = 1) => v === null ? "sem dados" : U.numero(v, casas);

  function render() {
    const lista = V.ler();
    const r = V.indicadores(lista);
    const linha = (rotulo, valor, nota = "") => `<li><span>${esc(rotulo)}${nota ? `<small class="explica-numero">${esc(nota)}</small>` : ""}</span><strong>${esc(valor)}</strong></li>`;
    $("indicadores").innerHTML = `
      <ul class="lista-resumo">
        ${linha("Participantes", String(r.participantes))}
        ${linha("Compreenderam o impacto da compra", fmtPct(r.compreenderam_impacto), "Depois do FinCK, citaram horas de trabalho, peso no mês ou efeito nas metas.")}
        ${linha("Identificaram despesas acumuladas", fmtPct(r.identificaram_acumulados), "Perceberam pequenos gastos que somam ou uma categoria em alta.")}
        ${linha("Explicaram a diferença entre preço e impacto", fmtPct(r.explicaram_diferenca), r.explicaram_em_parte ? `Em parte: ${fmtPct(r.explicaram_em_parte)}.` : "")}
        ${linha("Fatores considerados, em média", `${fmtNum(r.fatores_antes)} antes · ${fmtNum(r.fatores_depois)} depois`)}
        ${linha("Concluíram a tarefa sem ajuda", fmtPct(r.sem_ajuda))}
        ${linha("Tempo médio até ver o impacto", r.tempo_medio_s === null ? "sem dados" : `${fmtNum(r.tempo_medio_s, 0)} s`)}
        ${V.ESCALAS.map(e => linha(e.rotulo, r.escalas[e.id] === null ? "sem dados" : `${fmtNum(r.escalas[e.id])} de 5`)).join("")}
        ${linha("Mudaram a escolha depois de ver o impacto", fmtPct(r.mudaram_escolha), "Informação, não medida de acerto: comprar também pode ser uma escolha consciente.")}
      </ul>`;
    $("listaSessoes").innerHTML = lista.length ? lista.map((s, i) => `
      <li class="item-lista">
        <span><strong>${esc(s.codigo)}</strong> · ${esc(U.dataBR(s.data))}</span>
        <button type="button" class="btn-texto" data-apagar="${i}">Apagar</button>
      </li>`).join("") : `<li class="vazio">Nenhuma sessão salva ainda.</li>`;
    $("btnExportarCSV").disabled = !lista.length;
    $("btnExportarJSON").disabled = !lista.length;
    $("btnApagarTudo").disabled = !lista.length;
  }

  $("listaSessoes").addEventListener("click", async e => {
    const b = e.target.closest("[data-apagar]");
    if (!b) {
      return;
    }
    const lista = V.ler();
    const s = lista[Number(b.dataset.apagar)];
    if (!s || !await U.confirmar(`Apagar a sessão ${s.codigo}?`, "As respostas dela saem deste aparelho.", { confirmar: "Apagar" })) {
      return;
    }
    lista.splice(Number(b.dataset.apagar), 1);
    V.gravar(lista);
    render();
  });

  function baixar(nome, conteudo, tipo) {
    const url = URL.createObjectURL(new Blob([ conteudo ], { type: tipo }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $("btnExportarCSV").addEventListener("click", () => baixar(`finck-validacao-${U.hojeISO()}.csv`, `﻿${V.paraCSV(V.ler())}`, "text/csv;charset=utf-8"));
  $("btnExportarJSON").addEventListener("click", () => baixar(`finck-validacao-${U.hojeISO()}.json`, JSON.stringify({ sessoes: V.ler(), indicadores: V.indicadores(V.ler()) }, null, 2), "application/json"));
  $("btnApagarTudo").addEventListener("click", async () => {
    if (!await U.confirmar("Apagar todas as sessões?", "As respostas saem deste aparelho. Exporte antes se precisar delas.", { confirmar: "Apagar tudo" })) {
      return;
    }
    V.gravar([]);
    render();
  });

  novoCodigo();
  render();
});
