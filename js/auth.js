/* ============================================================
   FinCK v2 — Autenticação (login, cadastro, captcha, demo)
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  const S = window.FinckStore;
  const U = window.FinckUtils;

  /* ---------- mostrar/ocultar senha ---------- */
  document.querySelectorAll(".toggle-senha").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = btn.parentElement.querySelector("input");
      const visivel = input.type === "text";
      input.type = visivel ? "password" : "text";
      btn.textContent = visivel ? "👁" : "🙈";
      btn.setAttribute("aria-label", visivel ? "Mostrar senha" : "Ocultar senha");
    });
  });

  /* ---------- captcha de arraste ---------- */
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

    /* equivalente por teclado: setas/Home/End movem, Enter/Espaço confirmam */
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
    // acessibilidade: teclado valida o captcha
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

  /* ---------- já autenticado? vai direto ---------- */
  S.usuarioAtual().then(async (user) => {
    if (!user) return;
    location.href = (await S.precisaOnboarding()) ? "onboarding.html" : "home.html";
  });

  /* ---------- login ---------- */
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

  /* ---------- cadastro ---------- */
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
        await S.cadastrar({ nome, email, senha });
        const logado = await S.usuarioAtual();
        if (logado) {
          msg(mensagemEl, "Conta criada! Vamos configurar seu perfil financeiro.", "sucesso");
          setTimeout(() => { location.href = "onboarding.html"; }, 800);
        } else {
          msg(mensagemEl, "Conta criada! Confirme o e-mail e faça login.", "sucesso");
          btn.disabled = false;
        }
      } catch (err) {
        msg(mensagemEl, err.message, "erro");
        btn.disabled = false;
      }
    });
  }

  /* ---------- modo demonstração ---------- */
  const btnDemo = document.getElementById("btnDemo");
  if (btnDemo) {
    btnDemo.addEventListener("click", async () => {
      btnDemo.disabled = true;
      const email = `demo${Date.now()}@finck.local`;
      try {
        await S.cadastrar({ nome: "Usuário Demonstração", email, senha: "finck123" });
        if (!(await S.usuarioAtual())) await S.entrar({ email, senha: "finck123" });
        await window.FinckFinance.carregarDemo();
        U.toast("Dados de demonstração carregados.", "sucesso");
        setTimeout(() => { location.href = "home.html"; }, 600);
      } catch (err) {
        U.toast(err.message, "erro");
        btnDemo.disabled = false;
      }
    });
  }
});
