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

        const loginForm = document.getElementById("loginForm");
        
        if(loginForm) {
            loginForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                
                const usuario = document.getElementById("usuario").value;
                const senha = document.getElementById("senha").value;
                const btnSubmit = loginForm.querySelector("button");
                const originalBtnText = btnSubmit.innerText;

                // Feedback visual
                btnSubmit.disabled = true;
                btnSubmit.innerText = "Autenticando...";

                // Prepara dados para o formato OAuth2 (form-data)
                const formData = new URLSearchParams();
                formData.append('username', usuario);
                formData.append('password', senha);

                try {
                    const response = await fetch("/token", {
                        method: "POST",
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: formData
                    });

                    if (response.ok) {
                        const data = await response.json();
                        
                        // Salva Token e Nome
                        localStorage.setItem("userToken", data.access_token);
                        localStorage.setItem("userName", usuario);
                        
                        window.location.href = "/dashboard";
                    } else {
                        alert("Acesso Negado: Usuário ou senha incorretos.");
                        btnSubmit.disabled = false;
                        btnSubmit.innerText = originalBtnText;
                    }
                } catch (error) {
                    console.error("Erro:", error);
                    alert("Erro de conexão com o servidor.");
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
        const userDisplay = document.querySelector("#userDisplayName"); // Ajustado para o ID novo
        if (userDisplay) {
            const savedName = localStorage.getItem("userName");
            if (savedName) userDisplay.innerText = `Olá, ${savedName}`;
        }

        // --- 2.3 Verificar Permissão de Admin (RBAC) ---
        try {
            // Decodifica a parte do meio do JWT (Payload)
            const payload = JSON.parse(atob(token.split('.')[1]));
            
            // Se for Admin, mostra a área de criar usuário
            if (payload.role === 'admin') {
                const adminArea = document.getElementById("adminArea");
                if(adminArea) adminArea.style.display = "block";
            }
        } catch (e) {
            console.error("Erro ao ler token:", e);
        }

        // --- 2.4 Controle do Modal ---
        const btnSettings = document.getElementById("btnSettings");
        const modal = document.getElementById("settingsModal");
        
        if(btnSettings && modal) {
            btnSettings.addEventListener("click", () => {
                modal.style.display = "flex";
            });
        }

        // Função global para fechar modal (usada pelo botão X)
        window.closeModal = (id) => {
            document.getElementById(id).style.display = "none";
        }

        // --- 2.5 Logout ---
        const btnLogout = document.getElementById("btnLogout");
        if(btnLogout){
            btnLogout.addEventListener("click", () => {
                localStorage.removeItem("userToken");
                localStorage.removeItem("userName");
                window.location.href = "/";
            });
        }

        // --- 2.6 Formulário: Trocar Senha ---
        const changePassForm = document.getElementById("changePasswordForm");
        if(changePassForm) {
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
        if(createUserForm) {
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