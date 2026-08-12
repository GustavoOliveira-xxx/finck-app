

window.FinckTempo = (() => {
  const cfg = window.FINCK_CONFIG;

  let valorHoraAtual = 0;

  function definirPerfil(perfil) {
    const renda = Number(perfil?.income_monthly) || 0;
    const dias = Number(perfil?.work_days_month) || cfg.PADRAO.work_days_month;
    const horas = Number(perfil?.work_hours_day) || cfg.PADRAO.work_hours_day;
    valorHoraAtual = renda > 0 && dias > 0 && horas > 0 ? renda / dias / horas : 0;
    return valorHoraAtual;
  }

  const valorHora = () => valorHoraAtual;
  const ativo = () => valorHoraAtual > 0;

  const horasDe = (valor) => (valorHoraAtual > 0 ? Math.abs(Number(valor) || 0) / valorHoraAtual : 0);

  function formatar(horas, { longo = false } = {}) {
    const h = Math.abs(Number(horas) || 0);
    if (h === 0) return "0min";

    const horasDia = Number(cfg.PADRAO.work_hours_day) || 8;
    const diasMes = Number(cfg.PADRAO.work_days_month) || 22;

    if (h < 1) return `${Math.round(h * 60)}min`;

    if (h < horasDia * 2) {
      const inteiras = Math.floor(h);
      const minutos = Math.round((h - inteiras) * 60);
      if (minutos === 0) return `${inteiras}h`;
      if (minutos === 60) return `${inteiras + 1}h`;
      return `${inteiras}h${String(minutos).padStart(2, "0")}`;
    }

    const dias = h / horasDia;
    if (dias < diasMes) {
      const texto = dias < 10 ? dias.toFixed(1).replace(".", ",") : String(Math.round(dias));
      return longo ? `${texto} dias de trabalho` : `${texto} dias`;
    }

    const meses = dias / diasMes;
    const texto = meses < 10 ? meses.toFixed(1).replace(".", ",") : String(Math.round(meses));
    return longo ? `${texto} ${meses < 2 ? "mês" : "meses"} de trabalho` : `${texto} ${meses < 2 ? "mês" : "meses"}`;
  }

  const deValor = (valor, opcoes) => formatar(horasDe(valor), opcoes);

  function selo(valor, { classe = "", titulo = true } = {}) {
    if (!ativo()) return "";
    const v = Math.abs(Number(valor) || 0);
    if (v <= 0) return "";
    const texto = deValor(v);
    const completo = `${formatar(horasDe(v), { longo: true })} pelo seu valor-hora atual`;
    return `<span class="selo-tempo ${classe}"${titulo ? ` title="${completo}"` : ""}>` +
           `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">` +
           `<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>` +
           `<span>${texto}</span></span>`;
    }

  const seloTexto = (valor) => (ativo() ? formatar(horasDe(valor), { longo: true }) : "");

  return { definirPerfil, valorHora, ativo, horasDe, formatar, deValor, selo, seloTexto };
})();
