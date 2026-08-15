import { readFileSync } from "node:fs";

global.window = {};
global.window.FinckUtils = {};
eval(readFileSync("/home/user/finck-app/js/ocorrencias.js", "utf8"));
eval(readFileSync("/home/user/finck-app/js/programacao.js", "utf8"));
const P = window.FinckProgramacao;

let ok = 0, ruim = 0;
const conferir = (t, obtido, esperado) => {
  const igual = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (igual) { ok++; return; }
  ruim++;
  console.log(`  FALHOU  ${t}\n          esperado ${JSON.stringify(esperado)}\n          obtido   ${JSON.stringify(obtido)}`);
};

const HOJE = new Date(2026, 7, 12, 10, 0, 0);

console.log("\nPróxima data de um recorrente");
conferir("dia ainda por vir neste mês", P.proximaData(20, HOJE).toISOString().slice(0, 10), "2026-08-20");
conferir("dia já passou, vai para o mês seguinte", P.proximaData(5, HOJE).toISOString().slice(0, 10), "2026-09-05");
conferir("dia de hoje conta como hoje", P.proximaData(12, HOJE).toISOString().slice(0, 10), "2026-08-12");
conferir("dia 31 em mês de 30 dias cai no último",
  P.proximaData(31, new Date(2026, 8, 15, 10, 0, 0)).toISOString().slice(0, 10), "2026-09-30");
conferir("dia 30 em fevereiro cai em 28",
  P.proximaData(30, new Date(2027, 1, 5, 10, 0, 0)).toISOString().slice(0, 10), "2027-02-28");
conferir("virada de ano",
  P.proximaData(3, new Date(2026, 11, 20, 10, 0, 0)).toISOString().slice(0, 10), "2027-01-03");

console.log("Compromissos e acúmulo");
const recs = [
  { id: "a", description: "Aluguel",    type: "saida",   amount: 700, day_of_month: 20, active: true },
  { id: "b", description: "Academia",   type: "saida",   amount: 100, day_of_month: 18, active: true },
  { id: "c", description: "Assinatura", type: "saida",   amount: 50,  day_of_month: 15, active: true },
  { id: "d", description: "Salário",    type: "entrada", amount: 3000, day_of_month: 5, active: true },
  { id: "e", description: "Pausado",    type: "saida",   amount: 999, day_of_month: 16, active: false },
];

const pan = P.panorama({ recorrentes: recs }, 2000, { referencia: HOJE, dias: 30 });
conferir("só saídas ativas entram", pan.compromissos.map((c) => c.descricao), ["Assinatura", "Academia", "Aluguel"]);
conferir("ordenados por data", pan.compromissos.map((c) => c.iso), ["2026-08-15", "2026-08-18", "2026-08-20"]);
conferir("acúmulo bate com a especificação", pan.compromissos.map((c) => c.acumulado), [50, 150, 850]);
conferir("total comprometido", pan.comprometidoTotal, 850);
conferir("não comprometido", pan.naoComprometido, 1150);
conferir("próximo compromisso", pan.proximo.descricao, "Assinatura");
conferir("entrada não vira compromisso", pan.compromissos.some((c) => c.descricao === "Salário"), false);
conferir("pausado não vira compromisso", pan.compromissos.some((c) => c.descricao === "Pausado"), false);
conferir("nada vencido quando tudo é futuro", pan.vencidos.length, 0);

console.log("Marcos por data");
conferir("um marco por data", pan.marcos.map((m) => [m.iso, m.acumulado]),
  [["2026-08-15", 50], ["2026-08-18", 150], ["2026-08-20", 850]]);

const doisNoMesmoDia = P.panorama({ recorrentes: [
  { id: "x", description: "A", type: "saida", amount: 100, day_of_month: 20, active: true },
  { id: "y", description: "B", type: "saida", amount: 300, day_of_month: 20, active: true },
] }, 1000, { referencia: HOJE });
conferir("mesmo dia soma num marco só", doisNoMesmoDia.marcos.map((m) => [m.iso, m.acumulado]),
  [["2026-08-20", 400], ["2026-09-20", 800]]);
conferir("comprometido até o próximo soma o dia inteiro", doisNoMesmoDia.comprometidoAteProximo, 400);

console.log("Janela cobre todas as repetições, não só a próxima");
const mensal = [{ id: "m", description: "Internet", type: "saida", amount: 99, day_of_month: 10, active: true }];
const doisMeses = P.panorama({ recorrentes: mensal }, 1000, { referencia: HOJE, dias: 60 });
conferir("conta mensal aparece duas vezes em 60 dias", doisMeses.compromissos.map((c) => c.iso),
  ["2026-09-10", "2026-10-10"]);
conferir("total soma as duas", doisMeses.comprometidoTotal, 198);

console.log("Projeção não inventa datas passadas");
conferir("dia 10 já passou e não entra sem ocorrência",
  P.panorama({ recorrentes: mensal }, 1000, { referencia: HOJE, dias: 30 })
    .compromissos.some((c) => c.iso === "2026-08-10"), false);

console.log("Ocorrências mandam no que já foi decidido");
const base = (status, extra = {}) => ({
  id: `o-${status}`, recurring_id: "m", cycle: "2026-08", due_date: "2026-08-10",
  description: "Internet", type: "saida", planned_amount: 99, status, ...extra,
});
const comOcs = (ocs, dias = 30) =>
  P.panorama({ ocorrencias: ocs, recorrentes: [] }, 1000, { referencia: HOJE, dias });

conferir("pendente vencida continua comprometida",
  comOcs([base("pendente")]).comprometidoTotal, 99);
conferir("pendente vencida vem marcada",
  comOcs([base("pendente")]).compromissos.map((c) => c.vencido), [true]);
conferir("prevista ainda não vencida também conta",
  comOcs([{ ...base("previsto"), due_date: "2026-08-25" }]).comprometidoTotal, 99);
conferir("confirmada sai da lista, o saldo já caiu",
  comOcs([base("confirmado", { actual_amount: 99 })]).comprometidoTotal, 0);
conferir("ajustada também sai",
  comOcs([base("ajustado", { actual_amount: 120 })]).comprometidoTotal, 0);
conferir("não paga sai, a decisão é respeitada",
  comOcs([base("nao_pago")]).comprometidoTotal, 0);
conferir("não realizada sai",
  comOcs([base("nao_realizado")]).comprometidoTotal, 0);
conferir("entrada prevista nunca vira compromisso",
  comOcs([{ ...base("pendente"), type: "entrada" }]).comprometidoTotal, 0);

console.log("Ocorrência substitui a projeção no ciclo que ela cobre");
const semDobra = P.panorama(
  { ocorrencias: [base("nao_pago")], recorrentes: mensal }, 1000, { referencia: HOJE, dias: 30 });
conferir("com a regra junto, o ciclo coberto não volta pela projeção",
  semDobra.compromissos.map((c) => c.iso), ["2026-09-10"]);
const dobraProibida = P.panorama(
  { ocorrencias: [{ ...base("previsto"), due_date: "2026-08-20" }], recorrentes: mensal },
  1000, { referencia: HOJE, dias: 30 });
conferir("ocorrência e regra do mesmo ciclo não somam duas vezes",
  dobraProibida.comprometidoTotal, 198);
conferir("a data que vale é a da ocorrência, não a da regra",
  dobraProibida.compromissos.map((c) => c.iso), ["2026-08-20", "2026-09-10"]);
const horizonte = P.panorama(
  { ocorrencias: [base("pendente")], recorrentes: mensal }, 1000, { referencia: HOJE, dias: 60 });
conferir("além do ciclo coberto a regra volta a projetar",
  horizonte.compromissos.map((c) => c.iso), ["2026-08-10", "2026-09-10", "2026-10-10"]);

console.log("Vencidas somam e aparecem no total");
const duasVencidas = P.panorama({ ocorrencias: [
  { ...base("pendente"), id: "v1", due_date: "2026-08-05" },
  { ...base("pendente"), id: "v2", due_date: "2026-08-08", planned_amount: 40 },
  { ...base("previsto"), id: "f1", due_date: "2026-08-20", planned_amount: 200 },
], recorrentes: [] }, 1000, { referencia: HOJE, dias: 30 });
conferir("duas vencidas", duasVencidas.vencidos.length, 2);
conferir("total vencido", duasVencidas.totalVencido, 139);
conferir("próximo é o primeiro não vencido", duasVencidas.proximo.iso, "2026-08-20");
conferir("até o próximo inclui as vencidas", duasVencidas.comprometidoAteProximo, 339);
conferir("total comprometido soma tudo", duasVencidas.comprometidoTotal, 339);

console.log("Só vencidas, nenhuma futura");
const soVencidas = P.panorama({ ocorrencias: [
  { ...base("pendente"), id: "v1", due_date: "2026-08-05" },
], recorrentes: [] }, 1000, { referencia: HOJE, dias: 30 });
conferir("sem próximo quando tudo já venceu", soVencidas.proximo, null);
conferir("até o próximo cai no total vencido", soVencidas.comprometidoAteProximo, 99);

console.log("Texto de quando");
conferir("venceu ontem", P.quandoTexto(-1), "venceu ontem");
conferir("venceu há dias", P.quandoTexto(-5), "venceu há 5 dias");
conferir("hoje", P.quandoTexto(0), "hoje");
conferir("amanhã", P.quandoTexto(1), "amanhã");
conferir("em dias", P.quandoTexto(9), "em 9 dias");
conferir("um mes no singular", P.quandoTexto(36), "em 1 mês");
conferir("dois meses no plural", P.quandoTexto(57), "em 2 meses");
conferir("limite de 30 dias ainda em dias", P.quandoTexto(30), "em 30 dias");

console.log("Sem recorrentes");
const vazio = P.panorama({ recorrentes: [] }, 500, { referencia: HOJE });
conferir("sem compromissos", vazio.compromissos, []);
conferir("nada comprometido", vazio.comprometidoTotal, 0);
conferir("tudo livre", vazio.naoComprometido, 500);
conferir("sem próximo", vazio.proximo, null);
conferir("fonte ausente não quebra", P.panorama(undefined, 500, { referencia: HOJE }).compromissos, []);

console.log("Saldo negativo após compromissos");
const apertado = P.panorama({ recorrentes: recs }, 400, { referencia: HOJE, dias: 30 });
conferir("não comprometido pode ser negativo", apertado.naoComprometido, -450);

console.log(`\n${ok} passaram, ${ruim} falharam\n`);
process.exit(ruim ? 1 : 0);
