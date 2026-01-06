document.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname;
    const isLoginPage = path.includes("index.html") || path === "/" || path.endsWith("/");
    const isDashboard = path.includes("dashboard.html");

    // Lógica da página de Login
    if (isLoginPage) {
        const loginForm = document.getElementById("loginForm");
        
        if(loginForm) {
            loginForm.addEventListener("submit", (e) => {
                e.preventDefault();
                const usuario = document.getElementById("usuario").value;
                const senha = document.getElementById("senha").value;

                // Simulação de Autenticação (NUNCA FAÇA ISSO EM PRODUÇÃO REAL)
                if (usuario && senha) {
                    // Salva um token falso no localStorage
                    localStorage.setItem("userToken", "token_autenticado_abv_123");
                    localStorage.setItem("userName", usuario);
                    
                    // Redireciona
                    window.location.href = "dashboard.html";
                } else {
                    alert("Preencha todos os campos.");
                }
            });
        }
    }

    // Lógica da página de Dashboard (Proteção de Rota)
    if (isDashboard) {
        const token = localStorage.getItem("userToken");
        
        if (!token) {
            // Se não tiver token, chuta de volta pro login
            alert("Sessão expirada ou inválida.");
            window.location.href = "index.html";
        }

        // Logout
        const btnLogout = document.getElementById("btnLogout");
        if(btnLogout){
            btnLogout.addEventListener("click", () => {
                localStorage.removeItem("userToken");
                localStorage.removeItem("userName");
                window.location.href = "index.html";
            });
        }
    }
});