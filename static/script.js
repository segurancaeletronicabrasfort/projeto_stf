document.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname;
    
    // Verifica em qual página estamos
    const isLoginPage = path === "/" || path.includes("index.html");
    const isDashboard = path.includes("dashboard") || path.includes("dashboard.html");

    // =========================================================
    // HELPER: TOAST (SUCESSO / ERRO)
    // =========================================================
    function showToast(message, type = "success", title) {
        const toast    = document.getElementById("appToast");
        const titleEl  = document.getElementById("appToastTitle");
        const msgEl    = document.getElementById("appToastMessage");
        const closeBtn = document.getElementById("appToastClose");

        // Se não existir estrutura de toast no HTML, cai no alert normal
        if (!toast || !titleEl || !msgEl) {
            alert(message);
            return;
        }

        const defaultTitle = type === "error" ? "Erro" : "Sucesso";
        titleEl.textContent = title || defaultTitle;
        msgEl.textContent   = message;

        toast.classList.remove("success", "error", "visible");
        void toast.offsetWidth; // força reflow para reiniciar animação
        toast.classList.add(type === "error" ? "error" : "success", "visible");

        if (closeBtn) {
            closeBtn.onclick = () => toast.classList.remove("visible");
        }

        clearTimeout(toast._timerId);
        toast._timerId = setTimeout(() => {
            toast.classList.remove("visible");
        }, 4000);
    }

    // =========================================================
    // HELPER: VALIDAÇÃO DE SENHA
    // =========================================================
    function validatePasswordRules(password) {
        const minLength = 8;
        if (!password || password.length < minLength) return `A senha deve ter pelo menos ${minLength} caracteres.`;
        if (/\s/.test(password))   return "A senha não pode conter espaços em branco.";
        if (!/[a-z]/.test(password)) return "A senha deve conter pelo menos uma letra minúscula.";
        if (!/[A-Z]/.test(password)) return "A senha deve conter pelo menos uma letra maiúscula.";
        if (!/[0-9]/.test(password)) return "A senha deve conter pelo menos um número.";
        return "";
    }

    // =========================================================
    // HELPER: CONTROLE DOS CARDS (DASHBOARD)
    // =========================================================
    function setupCardsDisplay(role) {
        const cardsContainer = document.getElementById("cardsContainer");
        if (!cardsContainer) return;

        const cards           = cardsContainer.querySelectorAll(".card-action");
        const expandContainer = document.getElementById("expandContainer");
        const btnExpand       = document.getElementById("btnExpandCards");
        const LIMIT = 4;

        // Remove classes antigas para garantir limpeza
        cardsContainer.classList.remove("mobile-mode-carousel", "mobile-mode-vertical");

        // --- CENÁRIO 1: SOLICITANTE ---
        if (role === "solicitante") {
            cardsContainer.classList.add("mobile-mode-vertical");
            cards.forEach(card => card.classList.remove("hidden-card"));
            if (expandContainer) expandContainer.style.display = "none";
            return;
        }

        // --- CENÁRIO 2: ADMIN / SUPERVISOR ---
        cardsContainer.classList.add("mobile-mode-carousel");

        if (cards.length > LIMIT) {
            cards.forEach((card, index) => {
                if (index >= LIMIT) card.classList.add("hidden-card");
            });

            if (expandContainer) expandContainer.style.display = "block";

            if (btnExpand) {
                // Evita múltiplos listeners se o usuário voltar e abrir de novo
                const newBtn = btnExpand.cloneNode(true);
                btnExpand.parentNode.replaceChild(newBtn, btnExpand);

                newBtn.addEventListener("click", () => {
                    const isExpanded = newBtn.getAttribute("data-expanded") === "true";
                    if (isExpanded) {
                        // FECHAR
                        cards.forEach((card, index) => {
                            if (index >= LIMIT) card.classList.add("hidden-card");
                        });
                        newBtn.innerHTML = '<i class="fas fa-chevron-down"></i> Ver todos os serviços';
                        newBtn.setAttribute("data-expanded", "false");
                        cardsContainer.scrollIntoView({ behavior: "smooth" });
                    } else {
                        // ABRIR
                        cards.forEach(card => card.classList.remove("hidden-card"));
                        newBtn.innerHTML = '<i class="fas fa-chevron-up"></i> Recolher serviços';
                        newBtn.setAttribute("data-expanded", "true");
                    }
                });
            }
        } else {
            if (expandContainer) expandContainer.style.display = "none";
        }
    }

    // =========================================================
    // 1. LÓGICA DA PÁGINA DE LOGIN
    // =========================================================
    if (isLoginPage) {
        // Se já tiver token válido, manda direto pro dashboard
        if (localStorage.getItem("userToken")) {
            window.location.href = "/dashboard";
        }

        const loginForm = document.getElementById("loginForm");
        const loginCard = document.querySelector(".login-card");
        const errorBox  = document.getElementById("loginError");

        function showLoginError(msg) {
            if (errorBox) {
                errorBox.textContent = msg;
                errorBox.classList.add("visible");
            } else {
                alert(msg);
            }
            if (loginCard) {
                loginCard.classList.remove("shake");
                void loginCard.offsetWidth; // reset da animação
                loginCard.classList.add("shake");
            }
        }

        function clearLoginError() {
            if (errorBox) errorBox.classList.remove("visible");
        }

        if (loginForm) {
            const usuarioInput = document.getElementById("usuario");
            const senhaInput   = document.getElementById("senha");

            [usuarioInput, senhaInput].forEach((input) => {
                if (input) input.addEventListener("input", clearLoginError);
            });

            loginForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                clearLoginError();

                const usuario   = usuarioInput.value.trim();
                const senha     = senhaInput.value;
                const btnSubmit = loginForm.querySelector("button");
                const originalBtnText = btnSubmit.innerText;

                btnSubmit.disabled = true;
                btnSubmit.innerText = "Autenticando...";

                const formData = new URLSearchParams();
                formData.append("username", usuario);
                formData.append("password", senha);

                try {
                    const response = await fetch("/token", {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        body: formData
                    });

                    if (response.ok) {
                        const data = await response.json();
                        localStorage.setItem("userToken", data.access_token);
                        localStorage.setItem("userName", usuario);
                        window.location.href = "/dashboard";
                    } else {
                        showLoginError("Acesso negado: usuário ou senha incorretos.");
                        btnSubmit.disabled = false;
                        btnSubmit.innerText = originalBtnText;
                    }
                } catch (error) {
                    console.error("Erro:", error);
                    showLoginError("Erro de conexão com o servidor.");
                    btnSubmit.disabled = false;
                    btnSubmit.innerText = originalBtnText;
                }
            });
        }
    }

    // =========================================================
    // 2. LÓGICA DA PÁGINA DE DASHBOARD
    // =========================================================
    // =========================================================
// 2. LÓGICA DA PÁGINA DE DASHBOARD
// =========================================================
if (isDashboard) {
    const token = localStorage.getItem("userToken");

    // --- 2.1 Proteção de Rota ---
    if (!token) {
        alert("Sessão expirada. Faça login novamente.");
        window.location.href = "/";
        return;
    }

    // Elementos principais da tela
    const userDisplay      = document.getElementById("userDisplayName");
    const adminArea        = document.getElementById("adminArea");        // se existir uma seção admin no dashboard
    const adminLinkWrapper = document.getElementById("adminLinkWrapper"); // wrapper do link para /admin_panel
    const biSection        = document.getElementById("biSection");

    // --- 2.1.1 Função para carregar o Power BI via backend ---
    async function loadPowerBI(role) {
        // Só admin e supervisor podem ver BI
        const canSeeBI = role === "admin" || role === "supervisor";

        if (!biSection) return;

        if (!canSeeBI) {
            // Solicitante não vê BI
            biSection.style.display = "none";
            return;
        }

        // Pega o container onde ficará o iframe
        const biContainer = biSection.querySelector(".bi-container");
        if (!biContainer) return;

        // Evita recarregar se já carregou uma vez
        if (biContainer.dataset.loaded === "true") {
            biSection.style.display = "block";
            return;
        }

        try {
            const response = await fetch("/bi-config", {
                method: "GET",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!response.ok) {
                // Se o backend negar, esconde a seção
                console.warn("Acesso ao BI não autorizado para este usuário.");
                biSection.style.display = "none";
                return;
            }

            const data = await response.json();

            // Ajusta visual (se quiser garantir um bom tamanho)
            biSection.style.display = "block";
            biContainer.style.height = "75vh";
            biContainer.style.minHeight = "600px";

            biContainer.innerHTML = `
                <iframe
                    title="Relatório BI"
                    width="100%"
                    height="100%"
                    src="${data.embed_url}"
                    frameborder="0"
                    style="border: none; border-radius: 14px; box-shadow: 0 18px 40px rgba(15,23,42,0.35);"
                    allowfullscreen="true">
                </iframe>
            `;

            biContainer.dataset.loaded = "true";
        } catch (error) {
            console.error("Erro ao carregar BI:", error);
            biSection.style.display = "none";
        }
    }

    // --- 2.2 Carregar usuário + aplicar permissões (RBAC via /users/me) ---
    async function carregarUsuarioEPermissoes() {
        if (!userDisplay) return;

        try {
            const resp = await fetch("/users/me", {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!resp.ok) {
                throw new Error("Falha ao buscar /users/me");
            }

            const user = await resp.json();
            const nomeParaMostrar = user.full_name || user.username || "Usuário";
            const role            = user.role || "solicitante"; // 'admin' | 'supervisor' | 'solicitante'

            // Cabeçalho (Olá, Nome)
            userDisplay.textContent = `Olá, ${nomeParaMostrar}`;
            localStorage.setItem("userFullName", nomeParaMostrar);

            // Cards (carousel / ver mais etc.)
            setupCardsDisplay(role);

            // Área de admin (somente admin)
            const isAdmin = role === "admin";
            if (adminArea)        adminArea.style.display        = isAdmin ? "block" : "none";
            if (adminLinkWrapper) adminLinkWrapper.style.display = isAdmin ? "block" : "none";

            // Power BI: carrega via backend
            await loadPowerBI(role);

        } catch (err) {
            console.error("Erro ao carregar usuário/permissões:", err);

            const fallback =
                localStorage.getItem("userFullName") ||
                localStorage.getItem("userName") ||
                "Usuário";

            if (userDisplay) {
                userDisplay.textContent = `Olá, ${fallback}`;
            }

            // Em caso de erro, por segurança, esconde tudo que é sensível
            if (adminArea)        adminArea.style.display        = "none";
            if (adminLinkWrapper) adminLinkWrapper.style.display = "none";
            if (biSection)        biSection.style.display        = "none";
        }
    }

    // Chama assim que o dashboard carrega
    carregarUsuarioEPermissoes();

    // --- 2.3 Controle do Modal ---
    const btnSettings = document.getElementById("btnSettings");
    const modal       = document.getElementById("settingsModal");

    if (btnSettings && modal) {
        btnSettings.addEventListener("click", () => {
            modal.style.display = "flex";
        });
    }

    // Função global para fechar modais (X)
    window.closeModal = (id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    };

    // --- 2.4 Logout ---
    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            localStorage.clear();
            window.location.href = "/";
        });
    }

    // --- 2.5 Formulário: Trocar Senha ---
    const changePassForm = document.getElementById("changePasswordForm");
    if (changePassForm) {
        changePassForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const oldPass = document.getElementById("oldPass").value;
            const newPass = document.getElementById("newPass").value;

            const errorMsg = validatePasswordRules(newPass);
            if (errorMsg) {
                showToast(errorMsg, "error");
                return;
            }

            if (oldPass === newPass) {
                showToast("A nova senha deve ser diferente da atual.", "error");
                return;
            }

            try {
                const response = await fetch("/users/me/password", {
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}` 
                    },
                    body: JSON.stringify({ old_password: oldPass, new_password: newPass })
                });

                if (response.ok) {
                    showToast("Senha alterada com sucesso! Você será redirecionado para o login.", "success");
                    setTimeout(() => {
                        localStorage.clear();
                        window.location.href = "/";
                    }, 1800);
                } else {
                    const err = await response.json();
                    showToast(err.detail || "Falha ao trocar senha.", "error");
                }
            } catch (error) {
                showToast("Erro de conexão ao tentar alterar senha.", "error");
            }
        });
    }
}
});