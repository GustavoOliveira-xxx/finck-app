

document.addEventListener("DOMContentLoaded", () => {
  const S = window.FinckStore;
  const U = window.FinckUtils;

  const ICONE_OLHO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const ICONE_OLHO_FECHADO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.6A10.6 10.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a15.6 15.6 0 0 1-3.1 3.9M7.4 7.4A15.7 15.7 0 0 0 2.5 12S6 18.5 12 18.5a10.4 10.4 0 0 0 3.4-.6"/><path d="M9.9 10a3 3 0 0 0 4.1 4.1"/></svg>';
  document.querySelectorAll(".toggle-senha").forEach((btn) => {
    btn.innerHTML = ICONE_OLHO;
    btn.addEventListener("click", () => {
      const input = btn.parentElement.querySelector("input");
      const visivel = input.type === "text";
      input.type = visivel ? "password" : "text";
      btn.innerHTML = visivel ? ICONE_OLHO : ICONE_OLHO_FECHADO;
      btn.setAttribute("aria-label", visivel ? "Mostrar senha" : "Ocultar senha");
    });
  });

  function initCaptcha(sliderId, textoId, btnId) {
    const slider = document.getElementById(sliderId);
    if (!slider) return;
    const track = slider.parentElement;
    const texto = document.getElementById(textoId);
    const btn = document.getElementById(btnId);
    let arrastando = false;
    let max = 0;

    const medir = () => { max = track.clientWidth - slider.clientWidth - 4; };
    medir();
    window.addEventListener("resize", medir);

    const mover = (clientX) => {
      if (!arrastando) return;
      const pos = clientX - track.getBoundingClientRect().left;
      slider.style.transform = `translateX(${Math.max(0, Math.min(pos, max))}px)`;
    };

    const validar = () => {
      if (texto) texto.textContent = "✅ Verificado";
      track.classList.add("verificado");
      slider.style.transform = `translateX(${max}px)`;
      slider.setAttribute("aria-valuenow", "100");
      slider.setAttribute("aria-valuetext", "Verificado");
      if (btn) btn.disabled = false;
    };

    const resetar = () => {
      slider.style.transform = "translateX(0px)";
      if (texto) texto.textContent = "Deslize para verificar →";
      track.classList.remove("verificado");
      slider.setAttribute("aria-valuenow", "0");
      slider.setAttribute("aria-valuetext", "Não verificado");
      if (btn) btn.disabled = true;
    };

    const finalizar = () => {
      if (!arrastando) return;
      arrastando = false;
      const atual = parseFloat(String(slider.style.transform).replace(/[^0-9.\-]/g, "")) || 0;
      if (atual >= max - 10) validar(); else resetar();
    };

    slider.addEventListener("mousedown", (e) => { arrastando = true; e.preventDefault(); });
    slider.addEventListener("touchstart", (e) => { arrastando = true; }, { passive: true });
    document.addEventListener("mousemove", (e) => mover(e.clientX));
    document.addEventListener("touchmove", (e) => mover(e.touches[0].clientX), { passive: true });
    document.addEventListener("mouseup", finalizar);
    document.addEventListener("touchend", finalizar);

    slider.addEventListener("keydown", (e) => {
      if (["ArrowRight", "ArrowUp", "End"].includes(e.key)) {
        e.preventDefault();
        validar();
      } else if (["ArrowLeft", "ArrowDown", "Home"].includes(e.key)) {
        e.preventDefault();
        resetar();
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        track.classList.contains("verificado") ? resetar() : validar();
      }
    });

    slider.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") { e.preventDefault(); validar(); }
    });
  }

  initCaptcha("captchaSlider", "captchaText", "btnEntrar");
  initCaptcha("captchaSliderCad", "captchaTextCad", "btnCadastrar");

  const msg = (el, texto, tipo = "") => {
    if (!el) return;
    el.className = `mensagem ${tipo}`;
    el.textContent = texto;
  };

  const TELAS_DE_ENTRADA = ["login", "cadastro"];
  if (TELAS_DE_ENTRADA.includes(document.body.dataset.page)) {
    S.usuarioAtual().then(async (user) => {
      if (!user) return;
      location.href = (await S.precisaOnboarding()) ? "onboarding.html" : "home.html";
    });
  }

  const formLogin = document.getElementById("loginForm");
  if (formLogin) {
    const mensagemEl = document.getElementById("mensagem");
    formLogin.addEventListener("submit", async (e) => {
      e.preventDefault();
      msg(mensagemEl, "");
      const email = document.getElementById("email").value.trim();
      const senha = document.getElementById("senha").value;
      if (!email || !senha) return msg(mensagemEl, "Preencha e-mail e senha.", "erro");

      const btn = document.getElementById("btnEntrar");
      btn.disabled = true;
      try {
        await S.entrar({ email, senha });
        msg(mensagemEl, "Login realizado! Redirecionando...", "sucesso");
        const proxima = (await S.precisaOnboarding()) ? "onboarding.html" : "home.html";
        setTimeout(() => { location.href = proxima; }, 700);
      } catch (err) {
        msg(mensagemEl, err.message, "erro");
        btn.disabled = false;
      }
    });
  }

  const formCadastro = document.getElementById("cadastroForm");
  if (formCadastro) {
    const mensagemEl = document.getElementById("mensagemCad");
    formCadastro.addEventListener("submit", async (e) => {
      e.preventDefault();
      msg(mensagemEl, "");
      const nome = document.getElementById("nome").value.trim();
      const email = document.getElementById("emailCad").value.trim();
      const senha = document.getElementById("senhaCad").value;
      const confirma = document.getElementById("confirmaSenha").value;
      const aceite = document.getElementById("aceite").checked;

      if (!nome) return msg(mensagemEl, "Informe seu nome.", "erro");
      if (!/^\S+@\S+\.\S+$/.test(email)) return msg(mensagemEl, "Informe um e-mail válido.", "erro");
      if (senha.length < 6) return msg(mensagemEl, "A senha precisa ter ao menos 6 caracteres.", "erro");
      if (senha !== confirma) return msg(mensagemEl, "As senhas não conferem.", "erro");
      if (!aceite) return msg(mensagemEl, "É necessário aceitar o uso educacional.", "erro");

      const btn = document.getElementById("btnCadastrar");
      btn.disabled = true;
      try {
        const { precisaConfirmar } = await S.cadastrar({ nome, email, senha });
        const logado = await S.usuarioAtual();
        if (logado && !precisaConfirmar) {
          msg(mensagemEl, "Conta criada! Vamos configurar seu perfil financeiro.", "sucesso");
          setTimeout(() => { location.href = "onboarding.html"; }, 800);
        } else {
          mostrarConfirmacaoPendente(email, mensagemEl);
        }
      } catch (err) {
        msg(mensagemEl, err.message, "erro");
        btn.disabled = false;
      }
    });
  }

  function mostrarConfirmacaoPendente(email, mensagemEl) {
    const card = document.querySelector(".auth-card");
    const form = document.getElementById("cadastroForm");
    if (!card || !form) {
      msg(mensagemEl, "Conta criada! Confirme o e-mail e faça login.", "sucesso");
      return;
    }
    form.hidden = true;
    const aviso = document.createElement("div");
    aviso.className = "aviso-confirmacao";
    aviso.innerHTML = `
      <h3>Falta confirmar seu e-mail</h3>
      <p>Enviamos um link para <strong>${U.escapeHTML(email)}</strong>.
         Abra o link e depois entre normalmente.</p>
      <p class="auth-sub">Não chegou? Confira o spam — ou peça outro.</p>
      <div class="acoes-confirmacao">
        <button type="button" class="btn-secundario" id="btnReenviar">Reenviar e-mail</button>
        <a class="btn-primario" href="index.html">Ir para o login</a>
      </div>
      <p class="mensagem" id="msgReenvio" role="status"></p>`;
    card.appendChild(aviso);

    const btnReenviar = document.getElementById("btnReenviar");
    const msgReenvio = document.getElementById("msgReenvio");
    let espera = 0;
    btnReenviar.addEventListener("click", async () => {
      if (espera > 0) return;
      btnReenviar.disabled = true;
      try {
        await S.reenviarConfirmacao(email);
        msg(msgReenvio, "E-mail reenviado. Pode levar um minuto.", "sucesso");
      } catch (err) {
        msg(msgReenvio, err.message, "erro");
      }

      espera = 60;
      const tick = setInterval(() => {
        espera--;
        btnReenviar.textContent = espera > 0 ? `Reenviar em ${espera}s` : "Reenviar e-mail";
        if (espera <= 0) { clearInterval(tick); btnReenviar.disabled = false; }
      }, 1000);
      btnReenviar.textContent = `Reenviar em ${espera}s`;
    });
  }

  const formRecuperar = document.getElementById("recuperarForm");
  if (formRecuperar) {
    const mensagemEl = document.getElementById("msgRecuperar");
    formRecuperar.addEventListener("submit", async (e) => {
      e.preventDefault();
      msg(mensagemEl, "");
      const email = document.getElementById("emailRecuperar").value.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) return msg(mensagemEl, "Informe um e-mail válido.", "erro");

      const btn = document.getElementById("btnRecuperar");
      btn.disabled = true;
      try {
        await S.recuperarSenha(email);

        msg(mensagemEl,
          "Se existir uma conta com esse e-mail, o link de redefinição já está a caminho. O link vale por 1 hora.",
          "sucesso");
        formRecuperar.reset();
      } catch (err) {
        msg(mensagemEl, err.message, "erro");
      } finally {
        setTimeout(() => { btn.disabled = false; }, 3000);
      }
    });
  }

  const formNovaSenha = document.getElementById("novaSenhaForm");
  if (formNovaSenha) {
    const mensagemEl = document.getElementById("msgNovaSenha");
    const btn = document.getElementById("btnNovaSenha");

    const erroNaUrl = new URLSearchParams(location.hash.slice(1)).get("error_description");
    if (erroNaUrl) {
      msg(mensagemEl, "Este link expirou ou já foi usado. Peça outro na página de recuperação.", "erro");
      btn.disabled = true;
    }

    formNovaSenha.addEventListener("submit", async (e) => {
      e.preventDefault();
      msg(mensagemEl, "");
      const senha = document.getElementById("senhaNova").value;
      const confirma = document.getElementById("senhaNovaConfirma").value;
      if (senha.length < 6) return msg(mensagemEl, "A senha precisa ter ao menos 6 caracteres.", "erro");
      if (senha !== confirma) return msg(mensagemEl, "As senhas não conferem.", "erro");

      btn.disabled = true;
      try {
        await S.definirNovaSenha(senha);
        msg(mensagemEl, "Senha atualizada! Redirecionando para o login…", "sucesso");
        await S.sair();
        setTimeout(() => { location.href = "index.html"; }, 1200);
      } catch (err) {
        msg(mensagemEl, err.message, "erro");
        btn.disabled = false;
      }
    });
  }

  const btnDemo = document.getElementById("btnDemo");
  if (btnDemo) {
    btnDemo.addEventListener("click", async () => {
      btnDemo.disabled = true;
      const rotulo = btnDemo.textContent;
      btnDemo.textContent = "Preparando demonstração…";
      try {
        await S.entrarDemo();
        await window.FinckFinance.carregarDemo();
        U.toast("Demonstração pronta. Nada foi salvo em nenhuma conta.", "sucesso");
        setTimeout(() => { location.href = "home.html"; }, 500);
      } catch (err) {
        U.toast(err.message, "erro");
        btnDemo.disabled = false;
        btnDemo.textContent = rotulo;
      }
    });
  }
});
