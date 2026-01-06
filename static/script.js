document.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname;
    
    // Verifica em qual página estamos (Index ou Dashboard)
    // O backend serve "/" para index e "/dashboard" para dashboard
    const isLoginPage = path === "/" || path.includes("index.html");
    const isDashboard = path.includes("dashboard") || path.includes("dashboard.html");

    // ==========================================
    // LÓGICA DA PÁGINA DE LOGIN
    // ==========================================
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

                // Feedback visual de carregamento
                btnSubmit.disabled = true;
                btnSubmit.innerText = "Autenticando...";

                // Prepara os dados no formato form-urlencoded (padrão OAuth2)
                const formData = new URLSearchParams();
                formData.append('username', usuario);
                formData.append('password', senha);

                try {
                    // Faz a chamada REAL ao Backend Python
                    const response = await fetch("/token", {
                        method: "POST",
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        body: formData
                    });

                    if (response.ok) {
                        const data = await response.json();
                        
                        // Salva o Token Seguro e o usuário
                        localStorage.setItem("userToken", data.access_token);
                        localStorage.setItem("userName", usuario); // Apenas para exibição
                        
                        // Redireciona
                        window.location.href = "/dashboard";
                    } else {
                        // Erro de login
                        alert("Acesso Negado: Verifique suas credenciais.");
                        btnSubmit.disabled = false;
                        btnSubmit.innerText = originalBtnText;
                    }
                } catch (error) {
                    console.error("Erro:", error);
                    alert("Erro de conexão com o servidor de segurança.");
                    btnSubmit.disabled = false;
                    btnSubmit.innerText = originalBtnText;
                }
            });
        }
    }

    // ==========================================
    // LÓGICA DA PÁGINA DE DASHBOARD (Proteção)
    // ==========================================
    if (isDashboard) {
        const token = localStorage.getItem("userToken");
        
        // 1. Verificação primária: Existe token?
        if (!token) {
            alert("Sessão expirada. Faça login novamente.");
            window.location.href = "/";
            return;
        }

        // 2. (Opcional) Validar token com o servidor para garantir que não é falso
        fetch("/users/me", {
            headers: { "Authorization": `Bearer ${token}` }
        }).then(response => {
            if (!response.ok) {
                // Se o token for inválido ou expirado no server, desloga
                logout();
            }
        }).catch(() => logout());

        // Atualiza nome do usuário na Navbar (se existir o elemento)
        const userDisplay = document.querySelector(".nav-user span");
        if (userDisplay) {
            const savedName = localStorage.getItem("userName");
            if (savedName) userDisplay.innerText = `Olá, ${savedName}`;
        }

        // Lógica de Logout
        const btnLogout = document.getElementById("btnLogout");
        if(btnLogout){
            btnLogout.addEventListener("click", logout);
        }
    }

    function logout() {
        localStorage.removeItem("userToken");
        localStorage.removeItem("userName");
        window.location.href = "/";
    }
});