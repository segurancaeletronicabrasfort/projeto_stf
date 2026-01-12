document.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname;
    
    // Verifica em qual página estamos
    const isLoginPage = path === "/" || path.includes("index.html");
    const isDashboard = path.includes("dashboard") || path.includes("dashboard.html");

    // --- HELPER: PARSE JWT SEGURO (UTF-8) ---
    // Substitui o 'atob' simples para evitar erros com acentos e caracteres especiais
    function parseJwt(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            return null;
        }
    }

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
                
                userDisplay.innerHTML = `Olá, ${nomeParaMostrar}`;
                localStorage.setItem("userFullName", nomeParaMostrar);
            } catch (err) {
                const fallback = localStorage.getItem("userFullName") || localStorage.getItem("userName") || "Usuário";
                userDisplay.textContent = `Olá, ${fallback}`;
            }
        }
        carregarNomeUsuario();

        // --- 2.3 Controle de Acesso (RBAC), Cards & POWER BI ---
        try {
            const payload = parseJwt(token);
            
            if (payload) {
                const role = payload.role; // 'admin', 'supervisor' ou 'solicitante'

                // APLICA A LÓGICA DOS CARDS
                setupCardsDisplay(role);

                // Elementos da tela
                const adminArea = document.getElementById("adminArea");
                const biContainer = document.getElementById("biSection");

                // ======================================================
                // NOVA LÓGICA DE POWER BI SEGURO (BACKEND PROXY)
                // ======================================================
                async function loadPowerBI() {
                    if (!biContainer) return;

                    try {
                        const response = await fetch("/bi-config", {
                            method: "GET",
                            headers: { "Authorization": `Bearer ${token}` }
                        });

                        if (response.ok) {
                            const data = await response.json();
                            
                            // MUDANÇA AQUI: Ajuste de CSS para o tamanho ficar correto
                            // 1. Forçamos o container a ter pelo menos 80% da altura da tela (80vh)
                            // 2. Usamos aspect-ratio para manter formato widescreen (16/9)
                            biContainer.style.display = "block";
                            biContainer.style.height = "75vh"; // Ocupa 75% da altura da tela
                            biContainer.style.minHeight = "600px"; // Garante que não fique minúsculo em telas pequenas
                            
                            biContainer.innerHTML = `
                                <iframe title="Relatório BI" 
                                    width="100%" 
                                    height="100%" 
                                    src="${data.embed_url}" 
                                    frameborder="0" 
                                    style="border: none; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"
                                    allowFullScreen="true">
                                </iframe>
                            `;
                        } else {
                            biContainer.style.display = "none";
                            console.log("Acesso ao BI não autorizado.");
                        }
                    } catch (error) {
                        console.error("Erro ao carregar BI:", error);
                        biContainer.style.display = "none";
                    }
                }

                // Lógica de Visibilidade
                if (role === 'admin') {
                    if(adminArea) adminArea.style.display = "block";
                    loadPowerBI(); // Admin vê BI
                } else if (role === 'supervisor') {
                    if(adminArea) adminArea.style.display = "none";
                    loadPowerBI(); // Supervisor vê BI
                } else {
                    // SOLICITANTE: Não vê admin nem BI
                    if(adminArea) adminArea.style.display = "none";
                    if(biContainer) biContainer.style.display = "none";
                }

            } else {
                console.error("Token inválido ou corrompido.");
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
    }
});

// =========================================================
// FUNÇÃO EXTRA: CONTROLE DE CARDS + LAYOUT MOBILE
// =========================================================
function setupCardsDisplay(role) {
    const cardsContainer = document.getElementById("cardsContainer");
    if (!cardsContainer) return;

    const cards = cardsContainer.querySelectorAll(".card-action");
    const expandContainer = document.getElementById("expandContainer");
    const btnExpand = document.getElementById("btnExpandCards");
    const LIMIT = 4;

    // Remove classes antigas para garantir limpeza
    cardsContainer.classList.remove('mobile-mode-carousel', 'mobile-mode-vertical');

    // --- CENÁRIO 1: SOLICITANTE ---
    if (role === 'solicitante') {
        cardsContainer.classList.add('mobile-mode-vertical');
        cards.forEach(card => card.classList.remove("hidden-card"));
        if(expandContainer) expandContainer.style.display = "none";
        return;
    }

    // --- CENÁRIO 2: ADMIN / SUPERVISOR ---
    cardsContainer.classList.add('mobile-mode-carousel');

    if (cards.length > LIMIT) {
        cards.forEach((card, index) => {
            if (index >= LIMIT) card.classList.add("hidden-card");
        });

        if(expandContainer) expandContainer.style.display = "block";

        if (btnExpand) {
            const newBtn = btnExpand.cloneNode(true);
            btnExpand.parentNode.replaceChild(newBtn, btnExpand);

            newBtn.addEventListener("click", () => {
                const isExpanded = newBtn.getAttribute("data-expanded") === "true";
                if (isExpanded) { // FECHAR
                    cards.forEach((card, index) => {
                        if (index >= LIMIT) card.classList.add("hidden-card");
                    });
                    newBtn.innerHTML = '<i class="fas fa-chevron-down"></i> Ver todos os serviços';
                    newBtn.setAttribute("data-expanded", "false");
                    cardsContainer.scrollIntoView({ behavior: 'smooth' });
                } else { // ABRIR
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