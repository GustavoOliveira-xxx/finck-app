import { readFileSync } from "node:fs";

global.window = {};
eval(readFileSync("/home/user/finck-app/js/ocorrencias.js", "utf8"));
eval(readFileSync("/home/user/finck-app/js/fechamento.js", "utf8"));
const O = window.FinckOcorrencias;
const F = window.FinckFechamento;

let ok = 0, ruim = 0;
const conferir = (t, obtido, esperado) => {
  if (JSON.stringify(obtido) === JSON.stringify(esperado)) { ok++; return; }
  ruim++;
  console.log(`  FALHOU  ${t}\n          esperado ${JSON.stringify(esperado)}\n          obtido   ${JSON.stringify(obtido)}`);
};
const perto = (t, obtido, esperado, tol = 0.01) => {
  if (Math.abs(obtido - esperado) <= tol) { ok++; return; }
  ruim++;
  console.log(`  FALHOU  ${t}: esperado ~${esperado}, obtido ${obtido}`);
};

const HOJE = new Date(2026, 7, 12, 10, 0, 0);

const RECS = [
  { id: "sal", description: "Salário", type: "entrada", amount: 3000, day_of_month: 5, active: true },
  { id: "alu", description: "Aluguel", type: "saida", amount: 1200, day_of_month: 20, active: true },
  { id: "net", description: "Internet", type: "saida", amount: 99, day_of_month: 31, active: true },
  { id: "off", description: "Pausado", type: "saida", amount: 50, day_of_month: 10, active: false },
];

console.log("\nGeração de ocorrências");
const ger = O.gerar(RECS, { referencia: HOJE });
conferir("gera dois ciclos", [...new Set(ger.map((g) => g.cycle))], ["2026-08", "2026-09"]);
conferir("ignora recorrente pausado", ger.some((g) => g.recurring_id === "off"), false);
conferir("três ativos por ciclo", ger.filter((g) => g.cycle === "2026-08").length, 3);
conferir("dia 31 em setembro cai em 30",
  ger.find((g) => g.recurring_id === "net" && g.cycle === "2026-09").due_date, "2026-09-30");
conferir("dia 31 em agosto fica 31",
  ger.find((g) => g.recurring_id === "net" && g.cycle === "2026-08").due_date, "2026-08-31");
conferir("nasce previsto", [...new Set(ger.map((g) => g.status))], ["previsto"]);
conferir("valor previsto congelado",
  ger.find((g) => g.recurring_id === "alu" && g.cycle === "2026-08").planned_amount, 1200);

console.log("Recorrente criado depois não retroage");
const comData = O.gerar(
  [{ id: "x", description: "Novo", type: "saida", amount: 10, day_of_month: 3, active: true,
     created_at: "2026-09-01T00:00:00Z" }],
  { referencia: HOJE });
conferir("não gera para ciclo anterior à criação", comData.map((g) => g.cycle), ["2026-09"]);

console.log("Geração é idempotente pela chave");
const g1 = O.gerar(RECS, { referencia: HOJE });
const g2 = O.gerar(RECS, { referencia: HOJE });
const chave = (g) => `${g.recurring_id}|${g.cycle}`;
conferir("mesmas chaves nas duas passadas",
  g1.map(chave).sort().join(",") === g2.map(chave).sort().join(","), true);
conferir("nenhuma chave repetida", new Set(g1.map(chave)).size, g1.length);

console.log("Vencimento e estados");
const ocs = [
  { recurring_id: "sal", cycle: "2026-08", due_date: "2026-08-05", type: "entrada", planned_amount: 3000, status: "previsto" },
  { recurring_id: "alu", cycle: "2026-08", due_date: "2026-08-20", type: "saida", planned_amount: 1200, status: "previsto" },
  { recurring_id: "net", cycle: "2026-08", due_date: "2026-08-31", type: "saida", planned_amount: 99, status: "previsto" },
];
conferir("já venceu vira pendente", O.paraPendente(ocs, HOJE).map((o) => o.recurring_id), ["sal"]);
conferir("pendentes só o que venceu", O.pendentes(ocs, HOJE).map((o) => o.recurring_id), ["sal"]);
conferir("futuras são as demais", O.futuras(ocs, HOJE).map((o) => o.recurring_id), ["alu", "net"]);

console.log("Ciclo pronto para fechamento");
conferir("agosto não fecha no dia 12", O.cicloPronto(ocs, "2026-08", HOJE), false);
conferir("agosto fecha depois do dia 31",
  O.cicloPronto(ocs, "2026-08", new Date(2026, 8, 1, 10, 0, 0)), true);
conferir("ciclo sem ocorrências não fecha", O.cicloPronto(ocs, "2026-07", HOJE), false);

console.log("Estado conforme o valor informado");
const oc = { planned_amount: 2000, type: "entrada", description: "Salário", due_date: "2026-08-05" };
conferir("valor igual confirma", O.estadoAposValor(oc, 2000), "confirmado");
conferir("valor menor ajusta", O.estadoAposValor(oc, 1850), "ajustado");
conferir("valor maior ajusta", O.estadoAposValor(oc, 2300), "ajustado");
conferir("centavo de diferença ainda confirma", O.estadoAposValor(oc, 2000.001), "confirmado");

console.log("Movimentação gerada");
conferir("entrada não leva categoria", O.movimentacaoDe(oc, 1850).category, null);
conferir("entrada guarda a origem", O.movimentacaoDe(oc, 1850).source, "recorrente");
conferir("usa a data da ocorrência", O.movimentacaoDe(oc, 1850).date, "2026-08-05");
conferir("saída leva categoria",
  O.movimentacaoDe({ ...oc, type: "saida", category: "Moradia" }, 100).category, "Moradia");

console.log("Referência de renda livre e economia");
const soPct = { free_income_percent: 30 };
const soValor = { free_income_amount: 600 };
const ambosPct = { free_income_mode: "percentual", free_income_percent: 30, free_income_amount: 600 };
const ambosValor = { free_income_mode: "valor", free_income_percent: 30, free_income_amount: 600 };
perto("só percentual", F.referencia(soPct, "free_income", 3000).valor, 900);
perto("só valor fixo", F.referencia(soValor, "free_income", 3000).valor, 600);
perto("ambos, modo percentual", F.referencia(ambosPct, "free_income", 3000).valor, 900);
perto("ambos, modo valor", F.referencia(ambosValor, "free_income", 3000).valor, 600);
conferir("nunca soma os dois", F.referencia(ambosPct, "free_income", 3000).valor === 1500, false);
perto("sem configuração é zero", F.referencia({}, "free_income", 3000).valor, 0);

console.log("Referência proporcional à receita real");
perto("percentual acompanha a receita real",
  F.proporcional(soPct, "free_income", 3000, 2700), 810);
perto("valor fixo encolhe na proporção",
  F.proporcional(soValor, "free_income", 3000, 2700), 540);

console.log("Fechamento do ciclo");
const ocsFech = [
  { cycle: "2026-08", type: "entrada", planned_amount: 3000, actual_amount: 2850, status: "ajustado" },
  { cycle: "2026-08", type: "saida", planned_amount: 900, actual_amount: 900, status: "confirmado" },
  { cycle: "2026-08", type: "saida", planned_amount: 100, status: "pendente" },
];
const movs = [
  { type: "entrada", amount: 2850, date: "2026-08-05", source: "recorrente" },
  { type: "saida", amount: 900, date: "2026-08-20", source: "recorrente", category: "Moradia" },
  { type: "saida", amount: 450, date: "2026-08-22", category: "Lazer" },
  { type: "saida", amount: 300, date: "2026-08-25", goal_id: "meta-1" },
  { type: "entrada", amount: 500, date: "2026-08-28" },
  { type: "saida", amount: 999, date: "2026-07-10" },
];
const r = F.resumo("2026-08", {
  ocorrencias: ocsFech, transacoes: movs,
  perfil: { free_income_percent: 30, savings_percent: 20 },
});
perto("receita esperada", r.receitaEsperada, 3000);
perto("receita realizada inclui manual", r.receitaRealizada, 3350);
perto("despesa realizada", r.despesaRealizada, 1650);
perto("recorrentes realizados", r.recorrentesRealizados, 900);
perto("outras despesas", r.outrasDespesas, 750);
perto("resultado", r.resultado, 1700);
conferir("mês anterior não entra", movs.filter((m) => m.date < "2026-08").length, 1);
perto("renda livre usada pelas categorias", r.rendaLivreUsada, 450);
perto("economia realizada por aporte em meta", r.economiaRealizada, 300);
perto("renda livre proporcional", r.rendaLivreProporcional, 1005);
conferir("uma pendência", r.pendencias, 1);
conferir("fechamento incompleto", r.completo, false);
conferir("decisões", r.decisoes,
  { confirmadas: 1, ajustadas: 1, naoRealizadas: 0, naoPagas: 0, pendentes: 1 });

console.log("Estados que não movimentam");
const semMov = [
  { cycle: "2026-09", type: "saida", planned_amount: 700, status: "nao_pago" },
  { cycle: "2026-09", type: "entrada", planned_amount: 300, status: "nao_realizado" },
];
const r2 = F.resumo("2026-09", { ocorrencias: semMov, transacoes: [], perfil: {} });
perto("não realizado não vira receita", r2.receitaRealizada, 0);
perto("não pago não vira despesa", r2.despesaRealizada, 0);
perto("mas continuam no esperado", r2.despesaEsperada, 700);
conferir("ciclo sem pendência fica completo", r2.completo, true);

console.log("Registro do fechamento");
const reg = F.paraRegistro(r);
conferir("ciclo no registro", reg.cycle, "2026-08");
conferir("marca incompleto", reg.complete, false);
conferir("conta pendências", reg.pending_count, 1);
perto("valores arredondados", reg.realized_income, 3350);

console.log(`\n${ok} passaram, ${ruim} falharam\n`);
process.exit(ruim ? 1 : 0);
