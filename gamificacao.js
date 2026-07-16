
const REGRAS_XP = {
    novaEntrada:       25,
    novaSaida:         10,
    novaMeta:          15,
    metaConcluida:     50,
    perfilCompleto:    30,
    primeiroAcesso:     5,
    analiseConsultada:  5,
    relatorioGerado:   10,
    streakDiario:      10
};


const REGRAS_NIVEIS = [
    { nivel:  1, xpNecessario:    0, nome: "CK Newbie 🆕" },
    { nivel:  2, xpNecessario:  100, nome: "Conscious Planner 📝" },
    { nivel:  3, xpNecessario:  300, nome: "Financial Thinker 💡" },
    { nivel:  4, xpNecessario:  600, nome: "Stark's Investor 🚀" },
    { nivel:  5, xpNecessario: 1000, nome: "Economy \"Knowledgist\" 📚" },
    { nivel:  6, xpNecessario: 1500, nome: "Norman Osborn 🕷️" },
    { nivel:  7, xpNecessario: 2100, nome: "Golden Seeker 🏆" },
    { nivel:  8, xpNecessario: 2800, nome: "Fisk's Counter ⚖️" },
    { nivel:  9, xpNecessario: 3600, nome: "Fantastic Richards 🔬" },
    { nivel: 10, xpNecessario: 4500, nome: "The Miner ⛏️" },
    { nivel: 11, xpNecessario: 5500, nome: "The Philanthropist 🤝" },
    { nivel: 12, xpNecessario: 6600, nome: "Wealth Keeper 💰" },
    { nivel: 13, xpNecessario: 7800, nome: "The Future Guardian 🛡️" },
    { nivel: 14, xpNecessario: 9100, nome: "Wilson Fisk 👑" },
    { nivel: 15, xpNecessario:10500, nome: "Lex Luthor 🦅" },
    { nivel: 16, xpNecessario:12000, nome: "CK's Bruce Wayne 🦇" },
    { nivel: 17, xpNecessario:13600, nome: "Tony Stark 🤖" },
    { nivel: 18, xpNecessario:15300, nome: "EconomisT'Challa 🐆" },
    { nivel: 19, xpNecessario:17100, nome: "The Future Doctor Doom 🎭" },
    { nivel: 20, xpNecessario:19000, nome: "THE TRUE CK ZEMO ⚔️" }
];


const CONQUISTAS = {
    primeira_entrada:  { nome: "Primeiro Dinheiro Registrado", descricao: "Cadastre sua primeira entrada",          icone: "💰" },
    primeira_saida:    { nome: "Primeiro Gasto Registrado",    descricao: "Cadastre sua primeira saída",            icone: "💸" },
    primeira_meta:     { nome: "Definindo Objetivos",          descricao: "Crie sua primeira meta",                 icone: "🎯" },
    meta_concluida:    { nome: "Missão Cumprida",              descricao: "Conclua sua primeira meta",              icone: "✅" },
    perfil_completo:   { nome: "Identidade Definida",          descricao: "Complete todos os dados do perfil",      icone: "👤" },
    streak_7dias:      { nome: "Economista por 7 Dias",        descricao: "Use o app por 7 dias consecutivos",      icone: "🔥" },
    saldo_positivo:    { nome: "Saldo Positivo Mês a Mês",     descricao: "Mantenha saldo positivo por 1 mês",      icone: "📈" },
    mestre_financas:   { nome: "Mestre das Finanças",          descricao: "Alcance o nível 10",                     icone: "🏅" }
};


function mostrarAvisoGamificacao(texto, tipo = "info") {
    const avisoEl = document.getElementById("aviso");
    if (avisoEl) {
        avisoEl.textContent = texto;
        avisoEl.className = `aviso visivel ${tipo}`;
        avisoEl.style.display = "block";
        clearTimeout(avisoEl._timer);
        avisoEl._timer = setTimeout(() => {
            avisoEl.classList.remove("visivel");
            setTimeout(() => { avisoEl.style.display = "none"; }, 300);
        }, 3500);
    } else {
        console.log(`[GAMIFICAÇÃO ${tipo.toUpperCase()}]: ${texto}`);
    }
}


if (typeof mostrarAviso === "undefined") {
    var mostrarAviso = mostrarAvisoGamificacao;
}


function carregarDadosGamificacao() {
    const dados = localStorage.getItem("finck_gamificacao");
    if (dados) {
        try { return JSON.parse(dados); } catch(e) {}
    }
    return { xp: 0, nivel: 1, conquistas: {}, historico: [], ultimoAcesso: null, streakDias: 0 };
}

function salvarDadosGamificacao(dados) {
    localStorage.setItem("finck_gamificacao", JSON.stringify(dados));
}


function calcularNivelPorXP(xp) {
    let nivelAtual = REGRAS_NIVEIS[0];
    for (let i = REGRAS_NIVEIS.length - 1; i >= 0; i--) {
        if (xp >= REGRAS_NIVEIS[i].xpNecessario) {
            nivelAtual = REGRAS_NIVEIS[i];
            break;
        }
    }
    return nivelAtual;
}


function getProgressoNivel(xp, nivelAtual) {
    const proximoNivel = REGRAS_NIVEIS.find(n => n.nivel === nivelAtual + 1);
    if (!proximoNivel) return { percentual: 100, faltante: 0, xpNoNivel: xp, totalNecessario: 0 };

    const nivelAtualDados = REGRAS_NIVEIS.find(n => n.nivel === nivelAtual);
    const totalNecessario = proximoNivel.xpNecessario - nivelAtualDados.xpNecessario;
    const xpNoNivel = xp - nivelAtualDados.xpNecessario;
    const percentual = Math.min(100, Math.round((xpNoNivel / totalNecessario) * 100));
    const faltante = proximoNivel.xpNecessario - xp;

    return { percentual, faltante, xpNoNivel, totalNecessario };
}


function ganharXP(valor, motivo) {
    if (typeof valor !== "number" || valor <= 0) return;

    const dados = carregarDadosGamificacao();
    const nivelAntes = dados.nivel;
    dados.xp += valor;

    const infoNivelNovo = calcularNivelPorXP(dados.xp);
    dados.nivel = infoNivelNovo.nivel;

    if (dados.nivel > nivelAntes) {
        mostrarAvisoGamificacao(`🎉 Parabéns! Você subiu para o Nível ${dados.nivel} — ${infoNivelNovo.nome}!`, "sucesso");
        
        if (dados.nivel >= 10 && !dados.conquistas["mestre_financas"]) {
            dados.conquistas["mestre_financas"] = { desbloqueadaEm: new Date().toISOString() };
        }
    } else {
        mostrarAvisoGamificacao(`+${valor} XP: ${motivo}`, "sucesso");
    }

    dados.historico.unshift({ data: new Date().toISOString(), valor, motivo });
    dados.historico = dados.historico.slice(0, 100);

    salvarDadosGamificacao(dados);
    atualizarInterfaceXP();
}


function desbloquearConquista(idConquista) {
    if (!CONQUISTAS[idConquista]) return;
    const dados = carregarDadosGamificacao();
    if (dados.conquistas[idConquista]) return; 

    dados.conquistas[idConquista] = { desbloqueadaEm: new Date().toISOString() };
    salvarDadosGamificacao(dados);

    const conquista = CONQUISTAS[idConquista];
    mostrarAvisoGamificacao(`🏆 Conquista Desbloqueada: ${conquista.nome}!`, "sucesso");
    atualizarInterfaceXP();
}


function verificarStreakDiario() {
    const dados = carregarDadosGamificacao();
    const hoje = new Date().toISOString().slice(0, 10);

    if (dados.ultimoAcesso === hoje) return; // já registrado hoje

    const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (dados.ultimoAcesso === ontem) {
        dados.streakDias = (dados.streakDias || 0) + 1;
    } else {
        dados.streakDias = 1;
    }

    dados.ultimoAcesso = hoje;
    salvarDadosGamificacao(dados);


    if (dados.streakDias === 1) {
        ganharXP(REGRAS_XP.primeiroAcesso, "Acesso diário");
    } else {
        ganharXP(REGRAS_XP.streakDiario, `Streak de ${dados.streakDias} dias consecutivos!`);
    }

    
    if (dados.streakDias >= 7) {
        desbloquearConquista("streak_7dias");
    }
}

function atualizarInterfaceXP() {
    const dados = carregarDadosGamificacao();
    const infoNivel = calcularNivelPorXP(dados.xp);
    const progresso = getProgressoNivel(dados.xp, infoNivel.nivel);
    const proximoNivel = REGRAS_NIVEIS.find(n => n.nivel === infoNivel.nivel + 1);


    const elNivelCab = document.getElementById("nivelCabecalho");
    if (elNivelCab) elNivelCab.textContent = infoNivel.nivel;

    const elNumeroNivel = document.getElementById("numeroNivel");
    const elNomeNivel   = document.getElementById("nomeNivel");
    const elTextoProg   = document.getElementById("textoProgresso");
    const elBarra       = document.getElementById("barraProgresso");
    const elTotalXP     = document.getElementById("totalXP");
    const elXPProximo   = document.getElementById("xpProximo");

    if (elNumeroNivel) elNumeroNivel.textContent = infoNivel.nivel;
    if (elNomeNivel)   elNomeNivel.textContent   = infoNivel.nome;
    if (elTextoProg)   elTextoProg.textContent   = proximoNivel
        ? `${progresso.xpNoNivel} de ${progresso.totalNecessario} XP para o próximo nível`
        : "Nível máximo alcançado! 🏆";
    if (elBarra)       elBarra.style.width       = `${progresso.percentual}%`;
    if (elTotalXP)     elTotalXP.textContent     = `${dados.xp} XP`;
    if (elXPProximo)   elXPProximo.textContent   = proximoNivel ? `${proximoNivel.xpNecessario} XP` : "MAX";

    renderizarConquistas(dados);

    document.querySelectorAll(".item-catalogo").forEach((el, idx) => {
        const numEl = el.querySelector(".numero-catalogo");
        if (numEl && parseInt(numEl.textContent) === infoNivel.nivel) {
            el.classList.add("nivel-atual");
        } else {
            el.classList.remove("nivel-atual");
        }
    });
}


function renderizarConquistas(dados) {
    const grade = document.getElementById("gradeConquistas");
    if (!grade) return;

    grade.innerHTML = Object.entries(CONQUISTAS).map(([id, conquista]) => {
        const desbloqueada = !!dados.conquistas[id];
        const dataTexto = desbloqueada && dados.conquistas[id].desbloqueadaEm
            ? `<small>${new Date(dados.conquistas[id].desbloqueadaEm).toLocaleDateString("pt-BR")}</small>`
            : "";
        return `
        <div class="conquista ${desbloqueada ? "desbloqueada" : "bloqueada"}">
            <span class="icone">${desbloqueada ? conquista.icone : "🔒"}</span>
            <p>${conquista.nome}</p>
            <small class="descricao-conquista">${conquista.descricao}</small>
            ${dataTexto}
        </div>`;
    }).join("");
}


document.addEventListener("DOMContentLoaded", () => {
    verificarStreakDiario();
    atualizarInterfaceXP();
});
