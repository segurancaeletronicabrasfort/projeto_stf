document.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname;
    
    // Verifica em qual página estamos
    const isLoginPage = path === "/" || path.includes("index.html");
    const isDashboard = path.includes("dashboard") || path.includes("dashboard.html");

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

    // FUNÇÃO PARA CONTROLAR A EXIBIÇÃO DOS CARDS
function setupCardsDisplay(role) {
    const cardsContainer = document.getElementById("cardsContainer");
    if (!cardsContainer) return;

    // Pega todos os cards (links com a classe .card-action)
    const cards = cardsContainer.querySelectorAll(".card-action");
    const expandContainer = document.getElementById("expandContainer");
    const btnExpand = document.getElementById("btnExpandCards");
    const LIMIT = 4; // Limite de cards para Admin/Supervisor

    // Lógica 1: Se for Solicitante, mostra tudo e esconde o botão
    if (role === 'solicitante') {
        cards.forEach(card => card.style.display = "block"); // Mostra todos
        if(expandContainer) expandContainer.style.display = "none";
        return;
    }

    // Lógica 2: Se for Admin ou Supervisor
    // Verifica se tem mais cards que o limite
    if (cards.length > LIMIT) {
        
        // Esconde os cards excedentes (do índice 4 em diante)
        cards.forEach((card, index) => {
            if (index >= LIMIT) {
                card.classList.add("hidden-card"); // Usa CSS para esconder
            }
        });

        // Mostra o botão de expandir
        if(expandContainer) expandContainer.style.display = "block";

        // Adiciona o evento de clique no botão
        if (btnExpand) {
            // Remove listeners antigos para evitar duplicação (cloneNode truque)
            const newBtn = btnExpand.cloneNode(true);
            btnExpand.parentNode.replaceChild(newBtn, btnExpand);

            newBtn.addEventListener("click", () => {
                const isExpanded = newBtn.getAttribute("data-expanded") === "true";

                if (isExpanded) {
                    // SE ESTÁ ABERTO -> FECHAR
                    cards.forEach((card, index) => {
                        if (index >= LIMIT) card.classList.add("hidden-card");
                    });
                    newBtn.innerHTML = '<i class="fas fa-chevron-down"></i> Ver todos os serviços';
                    newBtn.setAttribute("data-expanded", "false");
                    
                    // Rola suavemente de volta para o topo dos cards
                    cardsContainer.scrollIntoView({ behavior: 'smooth' });
                } else {
                    // SE ESTÁ FECHADO -> ABRIR
                    cards.forEach(card => card.classList.remove("hidden-card"));
                    newBtn.innerHTML = '<i class="fas fa-chevron-up"></i> Recolher serviços';
                    newBtn.setAttribute("data-expanded", "true");
                }
            });
        }
    } else {
        // Se tiver 4 ou menos cards, não precisa de botão
        if(expandContainer) expandContainer.style.display = "none";
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
        const userDisplay = document.querySelector("#userDisplayName");
        if (userDisplay) {
            const savedName = localStorage.getItem("userName");
            if (savedName) userDisplay.innerText = `Olá, ${savedName}`;
        }

        // --- 2.3 Controle de Acesso (RBAC) ---
        try {
            // Decodifica o Token
            const payload = JSON.parse(atob(token.split('.')[1]));
            const role = payload.role; // 'admin', 'supervisor' ou 'solicitante'
            
            // --- NOVA CHAMADA: Configura os cards baseado no cargo ---
            setupCardsDisplay(role); 

            // Elementos da tela
            const adminArea = document.getElementById("adminArea");
            const biSection = document.getElementById("biSection");

            // ... (o resto da lógica de AdminArea e BI continua igual) ...
            if (role === 'admin') {
                if(adminArea) adminArea.style.display = "block";
                if(biSection) biSection.style.display = "block";
            } else if (role === 'supervisor') {
                if(adminArea) adminArea.style.display = "none";
                if(biSection) biSection.style.display = "block";
            } else {
                if(adminArea) adminArea.style.display = "none";
                if(biSection) biSection.style.display = "none";
            }

            // Atualiza o texto de boas-vindas com o cargo
            const userDisplay = document.querySelector("#userDisplayName");
            if (userDisplay) {
                const savedName = localStorage.getItem("userName");
                // Capitaliza a primeira letra do cargo (ex: admin -> Admin)
                const roleName = role.charAt(0).toUpperCase() + role.slice(1);
                userDisplay.innerHTML = `Olá, ${savedName} <small>(${roleName})</small>`;
            }

        } catch (e) {
            console.error("Erro ao processar permissões:", e);
            // Por segurança, se der erro, esconde tudo sensível
            if(document.getElementById("biSection")) document.getElementById("biSection").style.display = "none";
            if(document.getElementById("adminArea")) document.getElementById("adminArea").style.display = "none";
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
                        alert("Senha alterada com sucesso! Faça login novamente.");
                        localStorage.clear();
                        window.location.href = "/";
                    } else {
                        const err = await response.json();
                        alert("Erro: " + (err.detail || "Falha ao trocar senha"));
                    }
                } catch (error) {
                    alert("Erro de conexão.");
                }
            });
        }

        // --- 2.7 Formulário: Criar Usuário (Apenas Admin) ---
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
                        body: JSON.stringify({ 
                            username: uName, 
                            password: uPass, 
                            full_name: uFull, 
                            role: uRole 
                        })
                    });

                    if (response.ok) {
                        alert(`Usuário ${uName} criado com sucesso!`);
                        createUserForm.reset();
                    } else {
                        const err = await response.json();
                        alert("Erro ao criar: " + (err.detail || "Dados inválidos"));
                    }
                } catch (error) {
                    alert("Erro de conexão.");
                }
            });
        }
    }
});
