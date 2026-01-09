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
        // fallback se o HTML ainda não estiver disponível
        alert(message);
        return;
    }

    // Define título padrão por tipo
    const defaultTitle = type === "error" ? "Erro" : "Sucesso";

    titleEl.textContent = title || defaultTitle;
    msgEl.textContent = message;

    toast.classList.remove("success", "error", "visible");
    // força reflow para reiniciar animação
    void toast.offsetWidth;
    toast.classList.add(type === "error" ? "error" : "success", "visible");

    // Fechar manualmente
    if (closeBtn) {
        closeBtn.onclick = () => toast.classList.remove("visible");
    }

    // Fecha automático após 4s
    clearTimeout(toast._timerId);
    toast._timerId = setTimeout(() => {
        toast.classList.remove("visible");
    }, 4000);
}
// Regras de senha:
// - mínimo 8 caracteres
// - pelo menos 1 letra minúscula
// - pelo menos 1 letra maiúscula
// - pelo menos 1 número
// - sem espaços
function validatePasswordRules(password) {
    const minLength = 8;

    if (!password || password.length < minLength) {
        return `A senha deve ter pelo menos ${minLength} caracteres.`;
    }
    if (/\s/.test(password)) {
        return "A senha não pode conter espaços em branco.";
    }
    if (!/[a-z]/.test(password)) {
        return "A senha deve conter pelo menos uma letra minúscula.";
    }
    if (!/[A-Z]/.test(password)) {
        return "A senha deve conter pelo menos uma letra maiúscula.";
    }
    if (!/[0-9]/.test(password)) {
        return "A senha deve conter pelo menos um número.";
    }

    return ""; // ok
}

    // =========================================================
    // 1. LÓGICA DA PÁGINA DE LOGIN
    // =========================================================
    if (isLoginPage) {
        // Se já tiver token, manda direto pro dashboard
        if (localStorage.getItem("userToken")) {
            window.location.href = "/dashboard";
        }

        const loginForm  = document.getElementById("loginForm");
        const loginCard  = document.querySelector(".login-card");
        const errorBox   = document.getElementById("loginError");

        function showLoginError(msg) {
            if (!errorBox) {
                alert(msg);
                return;
            }
            errorBox.textContent = msg;
            errorBox.classList.add("visible");

            // força reinício da animação do shake
            if (loginCard) {
                loginCard.classList.remove("shake");
                void loginCard.offsetWidth; // reset animação
                loginCard.classList.add("shake");
            }
        }

        function clearLoginError() {
            if (errorBox) errorBox.classList.remove("visible");
        }

        if (loginForm) {
            const usuarioInput = document.getElementById("usuario");
            const senhaInput   = document.getElementById("senha");

            // Limpa erro ao digitar novamente
            [usuarioInput, senhaInput].forEach((input) => {
                if (input) {
                    input.addEventListener("input", clearLoginError);
                }
            });

            loginForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                
                clearLoginError();

                const usuario = usuarioInput.value.trim();
                const senha   = senhaInput.value;
                const btnSubmit = loginForm.querySelector("button");
                const originalBtnText = btnSubmit.innerText;

                // Feedback visual
                btnSubmit.disabled = true;
                btnSubmit.innerText = "Autenticando...";

                // Prepara dados para o formato OAuth2 (form-data)
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
                        
                        // Salva Token e Nome
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
                    showLoginError("Erro de conexão com o servidor. Tente novamente em instantes.");
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

       // --- 2.2 Exibir Nome do Usuário (usar full_name) ---
const userDisplay = document.getElementById("userDisplayName");

async function carregarNomeUsuario() {
    if (!userDisplay) return;

    try {
        const resp = await fetch("/users/me", {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!resp.ok) {
            throw new Error("Falha ao buscar /users/me");
        }

        const user = await resp.json();

        // Usa o nome completo se existir, senão cai pro username
        const nomeParaMostrar = user.full_name || user.username || "Usuário";

        userDisplay.textContent = `Olá, ${nomeParaMostrar}`;

        // Guarda como fallback para próximos acessos
        localStorage.setItem("userFullName", nomeParaMostrar);
    } catch (err) {
        console.error("Erro ao carregar nome:", err);

        // Fallback: se der erro na API, usa algo salvo localmente
        const fallback =
            localStorage.getItem("userFullName") ||
            localStorage.getItem("userName") ||
            "Usuário";

        userDisplay.textContent = `Olá, ${fallback}`;
    }
}

// chama assim que a página carregar
carregarNomeUsuario();


        // --- 2.3 Verificar Permissão de Admin (RBAC) ---
        try {
            // Decodifica a parte do meio do JWT (Payload)
            const payload = JSON.parse(atob(token.split('.')[1]));
            
            // Se for Admin, mostra a área de criar usuário
            if (payload.role === "admin") {
                const adminArea = document.getElementById("adminArea");
                if (adminArea) adminArea.style.display = "block";
            }
        } catch (e) {
            console.error("Erro ao ler token:", e);
        }

        // --- 2.4 Controle do Modal ---
        const btnSettings = document.getElementById("btnSettings");
        const modal = document.getElementById("settingsModal");
        
        if (btnSettings && modal) {
            btnSettings.addEventListener("click", () => {
                modal.style.display = "flex";
            });
        }

        // Função global para fechar modal (usada pelo botão X)
        window.closeModal = (id) => {
            const el = document.getElementById(id);
            if (el) el.style.display = "none";
        };

        // --- 2.5 Logout ---
        const btnLogout = document.getElementById("btnLogout");
        if (btnLogout){
            btnLogout.addEventListener("click", () => {
                localStorage.removeItem("userToken");
                localStorage.removeItem("userName");
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

        // Validação das regras de senha
        const errorMsg = validatePasswordRules(newPass);
        if (errorMsg) {
            showToast(errorMsg, "error");
            return;
        }

        if (oldPass === newPass) {
            showToast("A nova senha deve ser diferente da senha atual.", "error");
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
                showToast(
                    "Senha alterada com sucesso! Você será redirecionado para fazer login novamente.",
                    "success"
                );

                setTimeout(() => {
                    localStorage.clear();
                    window.location.href = "/";
                }, 1800);
            } else {
                const err = await response.json();
                showToast(err.detail || "Falha ao trocar senha.", "error");
            }
        } catch (error) {
            console.error(error);
            showToast("Erro de conexão com o servidor.", "error");
        }
    });
}}});

