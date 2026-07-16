
(() => {
    'use strict';


    document.querySelectorAll('.toggle-senha').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.parentElement.querySelector('input');
            input.type = input.type === 'password' ? 'text' : 'password';
            btn.textContent = input.type === 'password' ? '👁' : '🙈';
        });
    });

    function initCaptcha(sliderId, textId, btnId) {
        const slider = document.getElementById(sliderId);
        if (!slider) return;
        const track = slider.parentElement;
        const captchaText = document.getElementById(textId);
        const btn = document.getElementById(btnId);

        let isDragging = false;
        let larguraMax = 0;

        function atualizarLimites() {
            larguraMax = track.clientWidth - slider.clientWidth - 4;
        }

        atualizarLimites();
        window.addEventListener('resize', atualizarLimites);

        slider.addEventListener('mousedown', (e) => {
            isDragging = true;
            track.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const posX = e.clientX - track.getBoundingClientRect().left;
            const novaPos = Math.max(0, Math.min(posX, larguraMax));
            slider.style.transform = `translateX(${novaPos}px)`;
        });

        slider.addEventListener('touchstart', (e) => {
            isDragging = true;
            e.preventDefault();
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            const posX = e.touches[0].clientX - track.getBoundingClientRect().left;
            const novaPos = Math.max(0, Math.min(posX, larguraMax));
            slider.style.transform = `translateX(${novaPos}px)`;
        }, { passive: false });

        document.addEventListener('mouseup', finalizar);
        document.addEventListener('touchend', finalizar);

        function finalizar() {
            if (!isDragging) return;
            isDragging = false;
            track.style.cursor = 'grab';

            const posAtual = parseFloat(
                slider.style.transform?.replace('translateX(', '').replace('px)', '')
            ) || 0;

            if (posAtual >= larguraMax - 10) {
                slider.style.transform = `translateX(${larguraMax}px)`;
                if (captchaText) captchaText.textContent = '✅ Verificado';
                track.classList.add('verificado');
                if (btn) btn.disabled = false;
            } else {
                slider.style.transform = 'translateX(0px)';
                if (captchaText) captchaText.textContent = 'Deslize para verificar →';
                track.classList.remove('verificado');
                if (btn) btn.disabled = true;
            }
        }
    }

    if (document.getElementById('captchaSlider')) {
        initCaptcha('captchaSlider', 'captchaText', 'btnEntrar');
    }
    if (document.getElementById('captchaSliderCad')) {
        initCaptcha('captchaSliderCad', 'captchaTextCad', 'btnCadastrar');
    }

    function exibirMensagem(el, texto, tipo) {
        if (!el) return;
        el.className = `mensagem ${tipo}`;
        el.textContent = texto;
    }

    const formLogin = document.getElementById('loginForm');
    if (formLogin) {
        const mensagemEl = document.getElementById('mensagem');

        formLogin.addEventListener('submit', (e) => {
            e.preventDefault();
            exibirMensagem(mensagemEl, '', '');

            const email = document.getElementById('email').value.trim();
            const senha = document.getElementById('senha').value;

            const perfil = JSON.parse(localStorage.getItem('finckPerfil') || 'null');

            if (perfil && perfil.email === email && perfil.senha === senha) {
                exibirMensagem(mensagemEl, 'Login realizado! Redirecionando...', 'sucesso');
                setTimeout(() => window.location.href = 'index-principal.html', 1200);
            } else {
                exibirMensagem(mensagemEl, 'E-mail ou senha incorretos.', 'erro');
            }
        });
    }

    
    const formCadastro = document.getElementById('cadastroForm');
    if (formCadastro) {
        const mensagemEl = document.getElementById('mensagemCad');

        formCadastro.addEventListener('submit', (e) => {
            e.preventDefault();
            exibirMensagem(mensagemEl, '', '');

            const nome     = document.getElementById('nome').value.trim();
            const email    = document.getElementById('emailCad').value.trim();
            const senha    = document.getElementById('senhaCad').value;
            const confirma = document.getElementById('confirmaSenha').value;

            if (!nome) {
                exibirMensagem(mensagemEl, 'Informe seu nome.', 'erro');
                return;
            }
            if (!email) {
                exibirMensagem(mensagemEl, 'Informe um e-mail válido.', 'erro');
                return;
            }
            if (senha.length < 6) {
                exibirMensagem(mensagemEl, 'A senha deve ter pelo menos 6 caracteres.', 'erro');
                return;
            }
            if (senha !== confirma) {
                exibirMensagem(mensagemEl, 'As senhas não coincidem.', 'erro');
                return;
            }

            const novoPerfil = {
                nome,
                email,
                senha,
                profissao: '',
                renda: 0,
                formatoMoeda: 'BRL',
                formatoData: 'pt-BR'
            };

            localStorage.setItem('finckPerfil', JSON.stringify(novoPerfil));

            exibirMensagem(mensagemEl, 'Conta criada com sucesso! Redirecionando para o login...', 'sucesso');
            setTimeout(() => window.location.href = 'index.html', 2000);
        });
    }
})();
