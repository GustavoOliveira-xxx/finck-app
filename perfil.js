
document.addEventListener('DOMContentLoaded', () => {

    const formPerfil         = document.getElementById('formPerfil');
    const aviso              = document.getElementById('aviso');
    const btnSair            = document.getElementById('btnSair');
    const modalSenha         = document.getElementById('modalSenha');
    const fecharModalSenha   = document.getElementById('fecharModalSenha');
    const formSenha          = document.getElementById('formSenha');
    const btnAlterarSenha    = document.getElementById('btnAlterarSenha');
    const btnExportarBackup  = document.getElementById('btnExportarBackup');
    const btnApagarTudo      = document.getElementById('btnApagarTudo');

    const estatEntradasEl        = document.getElementById('estatEntradas');
    const estatSaidasEl          = document.getElementById('estatSaidas');
    const estatSaldoEl           = document.getElementById('estatSaldo');
    const estatMetasEl           = document.getElementById('estatMetas');
    const estatMetasConcluidasEl = document.getElementById('estatMetasConcluidas');
    const estatTaxaEconomiaEl    = document.getElementById('estatTaxaEconomia');

 
    function formatarMoeda(valor) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    }

    function mostrarAviso(texto, tipo = 'info') {
        if (!aviso) return;
        aviso.textContent = texto;
        aviso.className = `aviso visivel ${tipo}`;
        aviso.style.display = 'block';
        clearTimeout(aviso._timer);
        aviso._timer = setTimeout(() => {
            aviso.classList.remove('visivel');
            setTimeout(() => { aviso.style.display = 'none'; }, 300);
        }, 3500);
    }

    function pegarDadosPerfil() {
        const dados = localStorage.getItem('finckPerfil');
        return dados ? JSON.parse(dados) : { nome: '', email: '', profissao: '', renda: 0, senha: '123456', formatoMoeda: 'BRL', formatoData: 'pt-BR' };
    }

    function salvarDadosPerfil(dados) {
        localStorage.setItem('finckPerfil', JSON.stringify(dados));
    }

    function pegarTransacoes() {
        const dados = localStorage.getItem('finckTransacoes');
        return dados ? JSON.parse(dados) : [];
    }

    function pegarMetas() {
        const dados = localStorage.getItem('finckMetas');
        return dados ? JSON.parse(dados) : [];
    }

    function verificarPerfilCompleto(perfil) {
        return !!(perfil.nome && perfil.email && perfil.profissao && perfil.renda > 0);
    }

  
    function carregarDadosPerfil() {
        const perfil = pegarDadosPerfil();
        const el = (id) => document.getElementById(id);
        if (el('nomeUsuario'))     el('nomeUsuario').value     = perfil.nome     || '';
        if (el('emailUsuario'))    el('emailUsuario').value    = perfil.email    || '';
        if (el('profissaoUsuario')) el('profissaoUsuario').value = perfil.profissao || '';
        if (el('rendaUsuario'))    el('rendaUsuario').value    = perfil.renda    || '';
        if (el('formatoMoeda'))    el('formatoMoeda').value    = perfil.formatoMoeda || 'BRL';
        if (el('formatoData'))     el('formatoData').value     = perfil.formatoData  || 'pt-BR';
    }

    function atualizarEstatisticas() {
        const transacoes = pegarTransacoes();
        const metas      = pegarMetas();

        let totalEntradas = 0, totalSaidas = 0;
        transacoes.forEach(t => {
            if (t.tipo === 'entrada') totalEntradas += Number(t.valor);
            else totalSaidas += Number(t.valor);
        });

        const saldo        = totalEntradas - totalSaidas;
        const taxaEconomia = totalEntradas > 0 ? ((saldo / totalEntradas) * 100).toFixed(1) : 0;
        const concluidas   = metas.filter(m => (Number(m.valorAtual) / Number(m.valorTotal)) >= 0.999).length;

        if (estatEntradasEl)        estatEntradasEl.textContent        = formatarMoeda(totalEntradas);
        if (estatSaidasEl)          estatSaidasEl.textContent          = formatarMoeda(totalSaidas);
        if (estatSaldoEl)           estatSaldoEl.textContent           = formatarMoeda(saldo);
        if (estatMetasEl)           estatMetasEl.textContent           = metas.length;
        if (estatMetasConcluidasEl) estatMetasConcluidasEl.textContent = concluidas;
        if (estatTaxaEconomiaEl)    estatTaxaEconomiaEl.textContent    = `${taxaEconomia}%`;
    }

   
    if (formPerfil) {
        formPerfil.addEventListener('submit', e => {
            e.preventDefault();
            const perfil = pegarDadosPerfil();
            const el = (id) => document.getElementById(id);

            const perfilAnteriorCompleto = verificarPerfilCompleto(perfil);

            perfil.nome      = el('nomeUsuario').value.trim();
            perfil.email     = el('emailUsuario').value.trim();
            perfil.profissao = el('profissaoUsuario').value.trim();
            perfil.renda     = parseFloat(el('rendaUsuario').value) || 0;
            perfil.formatoMoeda = el('formatoMoeda').value;
            perfil.formatoData  = el('formatoData').value;

            salvarDadosPerfil(perfil);
            mostrarAviso('Dados salvos com sucesso!', 'sucesso');

            
            if (!perfilAnteriorCompleto && verificarPerfilCompleto(perfil)) {
                if (typeof ganharXP !== 'undefined') ganharXP(REGRAS_XP.perfilCompleto, 'Perfil completo!');
                if (typeof desbloquearConquista !== 'undefined') desbloquearConquista('perfil_completo');
            }
        });
    }

    
    if (btnAlterarSenha) {
        btnAlterarSenha.addEventListener('click', () => {
            if (modalSenha) { modalSenha.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
        });
    }

    if (fecharModalSenha) {
        fecharModalSenha.addEventListener('click', () => {
            if (modalSenha) { modalSenha.style.display = 'none'; document.body.style.overflow = 'auto'; }
            if (formSenha) formSenha.reset();
        });
    }

    if (modalSenha) {
        modalSenha.addEventListener('click', (e) => {
            if (e.target === modalSenha) {
                modalSenha.style.display = 'none';
                document.body.style.overflow = 'auto';
                if (formSenha) formSenha.reset();
            }
        });
    }

    if (formSenha) {
        formSenha.addEventListener('submit', e => {
            e.preventDefault();
            const perfil    = pegarDadosPerfil();
            const senhaAtual = document.getElementById('senhaAtual').value;
            const novaSenha  = document.getElementById('novaSenha').value;
            const confirma   = document.getElementById('confirmaSenha').value;

            if (senhaAtual !== perfil.senha) { mostrarAviso('Senha atual incorreta!', 'erro'); return; }
            if (novaSenha !== confirma)       { mostrarAviso('As senhas não coincidem!', 'erro'); return; }
            if (novaSenha.length < 6)         { mostrarAviso('A senha deve ter pelo menos 6 caracteres!', 'erro'); return; }

            perfil.senha = novaSenha;
            salvarDadosPerfil(perfil);
            mostrarAviso('Senha alterada com sucesso!', 'sucesso');
            if (modalSenha) { modalSenha.style.display = 'none'; document.body.style.overflow = 'auto'; }
            formSenha.reset();
        });
    }

    if (btnExportarBackup) {
        btnExportarBackup.addEventListener('click', () => {
            const dados = {
                perfil:       pegarDadosPerfil(),
                transacoes:   pegarTransacoes(),
                metas:        pegarMetas(),
                gamificacao:  JSON.parse(localStorage.getItem('finck_gamificacao') || '{}')
            };
            const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `finck_backup_${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            mostrarAviso('Backup exportado com sucesso!', 'sucesso');
        });
    }

    
    if (btnApagarTudo) {
        btnApagarTudo.addEventListener('click', () => {
            if (!confirm('Tem certeza? TODOS os dados serão apagados permanentemente!')) return;
            if (!confirm('Confirme novamente: essa ação não pode ser desfeita!')) return;

            localStorage.removeItem('finckPerfil');
            localStorage.removeItem('finckTransacoes');
            localStorage.removeItem('finckMetas');
            localStorage.removeItem('finck_gamificacao');

            mostrarAviso('Todos os dados foram removidos!', 'info');
            setTimeout(() => window.location.href = 'index.html', 1500);
        });
    }


    const btnImportarBackup   = document.getElementById('btnImportarBackup');
    const inputImportarBackup = document.getElementById('inputImportarBackup');

    if (btnImportarBackup && inputImportarBackup) {
        btnImportarBackup.addEventListener('click', () => inputImportarBackup.click());

        inputImportarBackup.addEventListener('change', (e) => {
            const arquivo = e.target.files[0];
            if (!arquivo) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const dados = JSON.parse(ev.target.result);

                    if (!dados.perfil && !dados.transacoes && !dados.metas && !dados.gamificacao) {
                        mostrarAviso('Arquivo de backup inválido ou corrompido.', 'erro');
                        return;
                    }

                    if (!confirm('Isso irá substituir TODOS os seus dados atuais pelo backup. Continuar?')) return;

                    if (dados.perfil)      localStorage.setItem('finckPerfil',      JSON.stringify(dados.perfil));
                    if (dados.transacoes)  localStorage.setItem('finckTransacoes',  JSON.stringify(dados.transacoes));
                    if (dados.metas)       localStorage.setItem('finckMetas',       JSON.stringify(dados.metas));
                    if (dados.gamificacao) localStorage.setItem('finck_gamificacao', JSON.stringify(dados.gamificacao));

                    mostrarAviso('Backup importado com sucesso! Recarregando...', 'sucesso');
                    setTimeout(() => window.location.reload(), 1500);
                } catch (err) {
                    mostrarAviso('Erro ao ler o arquivo. Verifique se é um backup válido do FINCK.', 'erro');
                }
            };
            reader.readAsText(arquivo);
            inputImportarBackup.value = ''; 
        });
    }

    if (btnSair) {
        btnSair.addEventListener('click', () => {
            if (confirm('Deseja realmente sair da sua conta?')) window.location.href = 'index.html';
        });
    }

    
    carregarDadosPerfil();
    atualizarEstatisticas();
});
