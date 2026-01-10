document.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname;
    
    // Verifica em qual página estamos
    const isLoginPage = path === "/" || path.includes("index.html");
    const isDashboard = path.includes("dashboard") || path.includes("dashboard.html");

    // Helper global de toast (sucesso/erro)
    function showToast(message, type = "success", title) {
        const toast = document.getElementById("appToast");
        const titleEl = document.getElementById("appToastTitle");
        const msgEl = document.getElementById("appToastMessage");
        const closeBtn = document.getElementById("appToastClose");

        if (!toast || !titleEl || !msgEl) {
            alert(message);
            return;
        }

        const defaultTitle = type === "error" ? "Erro" : "Sucesso";
        titleEl.textContent = title || defaultTitle;
        msgEl.textContent = message;

        toast.classList.remove("success", "error", "visible");
        void toast.offsetWidth; // força reflow
        toast.classList.add(type === "error" ? "error" : "success", "visible");

        if (closeBtn) closeBtn.onclick = () => toast.classList.remove("visible");

        clearTimeout(toast._timerId);
        toast._timerId = setTimeout(() => {
            toast.classList.remove("visible");
        }, 4000);
    }

    // Validação de regras de senha
    function validatePasswordRules(password) {
        const minLength = 8;
        if (!password || password.length < minLength) return `A senha deve ter pelo menos ${minLength} caracteres.`;
        if (/\s/.test(password)) return "A senha não pode conter espaços em branco.";
        if (!/[a-z]/.test(password)) return "A senha deve conter pelo menos uma letra minúscula.";
        if (!/[A-Z]/.test(password)) return "A senha deve conter pelo menos uma letra maiúscula.";
        if (!/[0-9]/.test(password)) return "A senha deve conter pelo menos um número.";
        return "";
    }

    // =========================================================
    // 1. LÓGICA DA PÁGINA DE LOGIN
    // =========================================================
    if (isLoginPage) {
        if (localStorage.getItem("userToken")) {
            window.location.href = "/dashboard";
        }

        const loginForm = document.getElementById("loginForm");
        const loginCard = document.querySelector(".login-card");
        const errorBox = document.getElementById("loginError");

        function showLoginError(msg) {
            if (errorBox) {
                errorBox.textContent = msg;
                errorBox.classList.add("visible");
            } else {
                alert(msg);
            }
            if (loginCard) {
                loginCard.classList.remove("shake");
                void loginCard.offsetWidth;
                loginCard.classList.add("shake");
            }
        }

        function clearLoginError() {
            if (errorBox) errorBox.classList.remove("visible");
        }

        if (loginForm) {
            const usuarioInput = document.getElementById("usuario");
            const senhaInput = document.getElementById("senha");

            [usuarioInput, senhaInput].forEach((input) => {
                if (input) input.addEventListener("input", clearLoginError);
            });

            loginForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                clearLoginError();

                const usuario = usuarioInput.value.trim();
                const senha = senhaInput.value;
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
    if (isDashboard) {
        const token = localStorage.getItem("userToken");

        // --- 2.1 Proteção de Rota ---
        if (!token) {
            alert("Sessão expirada. Faça login novamente.");
            window.location.href = "/";
            return;
        }

        // --- 2.2 Exibir Nome do Usuário ---
        const userDisplay = document.getElementById("userDisplayName");
        async function carregarNomeUsuario() {
            if (!userDisplay) return;
            try {
                const resp = await fetch("/users/me", {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (!resp.ok) throw new Error("Falha ao buscar /users/me");
                
                const user = await resp.json();
                const nomeParaMostrar = user.full_name || user.username || "Usuário";
                
                // Exibe nome e cargo formatado
                const cargo = user.role.charAt(0).toUpperCase() + user.role.slice(1);
                userDisplay.innerHTML = `Olá, ${nomeParaMostrar}`;
                
                localStorage.setItem("userFullName", nomeParaMostrar);
            } catch (err) {
                const fallback = localStorage.getItem("userFullName") || localStorage.getItem("userName") || "Usuário";
                userDisplay.textContent = `Olá, ${fallback}`;
            }
        }
        carregarNomeUsuario();

        // --- 2.3 Controle de Acesso (RBAC) & Cards ---
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const role = payload.role; // 'admin', 'supervisor' ou 'solicitante'

            // APLICA A LÓGICA DOS CARDS (Chama a função nova)
            setupCardsDisplay(role);

            // Elementos da tela
            const adminArea = document.getElementById("adminArea");
            const biSection = document.getElementById("biSection");

            // Lógica de Visibilidade (Quem vê o quê)
            if (role === 'admin') {
                if(adminArea) adminArea.style.display = "block";
                if(biSection) biSection.style.display = "block";
            } else if (role === 'supervisor') {
                if(adminArea) adminArea.style.display = "none";
                if(biSection) biSection.style.display = "block";
            } else {
                // SOLICITANTE: Não vê admin nem BI
                if(adminArea) adminArea.style.display = "none";
                if(biSection) biSection.style.display = "none";
            }

        } catch (e) {
            console.error("Erro ao processar permissões:", e);
        }

        // --- 2.4 Controle do Modal ---
        const btnSettings = document.getElementById("btnSettings");
        const modal = document.getElementById("settingsModal");

        if (btnSettings && modal) {
            btnSettings.addEventListener("click", () => {
                modal.style.display = "flex";
            });
        }

        window.closeModal = (id) => {
            const el = document.getElementById(id);
            if (el) el.style.display = "none";
        };

        // --- 2.5 Logout ---
        const btnLogout = document.getElementById("btnLogout");
        if (btnLogout) {
            btnLogout.addEventListener("click", () => {
                localStorage.clear();
                window.location.href = "/";
            });
        }

        // --- 2.6 Formulário: Trocar Senha ---
        const changePassForm = document.getElementById("changePasswordForm");
        if (changePassForm) {
            changePassForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                const oldPass = document.getElementById("oldPass").value;
                const newPass = document.getElementById("newPass").value;

                const errorMsg = validatePasswordRules(newPass);
                if (errorMsg) { showToast(errorMsg, "error"); return; }
                if (oldPass === newPass) { showToast("A nova senha deve ser diferente.", "error"); return; }

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
                        showToast("Senha alterada! Redirecionando...", "success");
                        setTimeout(() => { localStorage.clear(); window.location.href = "/"; }, 1800);
                    } else {
                        const err = await response.json();
                        showToast(err.detail || "Falha ao trocar senha.", "error");
                    }
                } catch (error) {
                    showToast("Erro de conexão.", "error");
                }
            });
        }

        // --- 2.7 Criar Usuário (Admin) ---
        const createUserForm = document.getElementById("createUserForm");
        if (createUserForm) {
            createUserForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                const uName = document.getElementById("newUsername").value;
                const uFull = document.getElementById("newFullname").value;
                const uPass = document.getElementById("newUserPass").value;
                const uRole = document.getElementById("newUserRole").value;

                try {
                    const response = await fetch("/users/create", {
                        method: "POST",
                        headers: { 
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}` 
                        },
                        body: JSON.stringify({ username: uName, password: uPass, full_name: uFull, role: uRole })
                    });

                    if (response.ok) {
                        showToast(`Usuário ${uName} criado!`, "success");
                        createUserForm.reset();
                    } else {
                        const err = await response.json();
                        showToast(err.detail || "Erro ao criar.", "error");
                    }
                } catch (error) {
                    showToast("Erro de conexão.", "error");
                }
            });
        }
    }
});

// =========================================================
// FUNÇÃO EXTRA: CONTROLE DE CARDS (EXPANDIR/RECOLHER)
// =========================================================
function setupCardsDisplay(role) {
    const cardsContainer = document.getElementById("cardsContainer");
    if (!cardsContainer) return;

    const cards = cardsContainer.querySelectorAll(".card-action");
    const expandContainer = document.getElementById("expandContainer");
    const btnExpand = document.getElementById("btnExpandCards");
    const LIMIT = 4;

    // Se for Solicitante, mostra TUDO e esconde o botão
    if (role === 'solicitante') {
        cards.forEach(card => card.classList.remove("hidden-card"));
        if(expandContainer) expandContainer.style.display = "none";
        return;
    }

    // Se for Admin ou Supervisor
    if (cards.length > LIMIT) {
        // Esconde os extras
        cards.forEach((card, index) => {
            if (index >= LIMIT) card.classList.add("hidden-card");
        });

        // Mostra botão
        if(expandContainer) expandContainer.style.display = "block";

        if (btnExpand) {
            // Remove listeners antigos
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
                    cardsContainer.scrollIntoView({ behavior: 'smooth' });
                } else {
                    // ABRIR
                    cards.forEach(card => card.classList.remove("hidden-card"));
                    newBtn.innerHTML = '<i class="fas fa-chevron-up"></i> Recolher serviços';
                    newBtn.setAttribute("data-expanded", "true");
                }
            });
        }
    } else {
        if(expandContainer) expandContainer.style.display = "none";
    }
}