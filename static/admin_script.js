document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("userToken");

    /* ======================================================
       HELPERS: SEGURANÇA (XSS) + TOAST + REGRAS
       ====================================================== */

    // PROTEÇÃO CONTRA XSS: Transforma texto perigoso em texto seguro
    function escapeHtml(text) {
        if (!text) return "";
        return text.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Helper para escapar apenas aspas simples (usado dentro de onclick)
    function escapeJsString(text) {
        if (!text) return "";
        return text.toString().replace(/'/g, "\\'");
    }

    function ensureToastContainer() {
        let container = document.getElementById("toastContainer");
        if (!container) {
            container = document.createElement("div");
            container.id = "toastContainer";
            container.className = "toast-container";
            document.body.appendChild(container);
        }
        return container;
    }

    function showToast(message, type = "info") {
        const container = ensureToastContainer();
        const toast = document.createElement("div");
        toast.className = `toast-notification ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        requestAnimationFrame(() => {
            toast.classList.add("show");
        });
        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    function validatePasswordRules(password) {
        const minLength = 8;
        if (!password || password.length < minLength) return `A senha deve ter pelo menos ${minLength} caracteres.`;
        if (/\s/.test(password)) return "A senha não pode conter espaços em branco.";
        if (!/[0-9]/.test(password)) return "A senha deve conter pelo menos um número.";
        if (!/[A-Z]/.test(password)) return "A senha deve conter pelo menos uma letra maiúscula.";
        if (!/[a-zA-Z]/.test(password)) return "A senha deve conter pelo menos uma letra.";
        return "";
    }

    /* ======================================================
       1. Segurança básica – só Admin entra aqui
       ====================================================== */
    if (!token) {
        window.location.href = "/";
        return;
    }

    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.role !== "admin") {
            showToast("Acesso restrito a Administradores.", "error");
            window.location.href = "/dashboard";
            return;
        }
    } catch (e) {
        window.location.href = "/";
        return;
    }

    /* ======================================================
       2. Logout
       ====================================================== */
    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            localStorage.clear();
            window.location.href = "/";
        });
    }

    /* ======================================================
       Referências do modal de exclusão
       ====================================================== */
    const confirmModal = document.getElementById("confirmDeleteModal");
    const confirmText = document.getElementById("confirmDeleteText");
    const confirmBtn = document.getElementById("confirmDeleteBtn");
    const cancelBtn = document.getElementById("cancelDeleteBtn");
    let deleteUserId = null;
    let deleteUsername = "";

    /* ======================================================
       3. Função para carregar usuários
       ====================================================== */
    async function loadUsers() {
        const tbody = document.getElementById("usersTableBody");
        if (!tbody) return;

        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding:16px; color:#64748b;">
                    Carregando usuários...
                </td>
            </tr>
        `;

        try {
            const response = await fetch("/users", {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) throw new Error("Falha ao buscar usuários");

            const users = await response.json();
            tbody.innerHTML = "";

            if (!users.length) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align:center; padding:18px; color:#94a3b8;">
                            Nenhum usuário cadastrado até o momento.
                        </td>
                    </tr>
                `;
                return;
            }

            users.forEach((user) => {
                const tr = document.createElement("tr");
                
                // VARIAVEIS TRATADAS (Anti-XSS e Anti-Quebra de JS)
                const safeUsername = escapeHtml(user.username);
                const safeFullname = escapeHtml(user.full_name || "-");
                const safeRole = escapeHtml(user.role);
                const safeId = escapeHtml(user.id);
                
                // Para passar no onclick, precisamos escapar aspas simples especificamente
                const jsFullname = escapeJsString(user.full_name || "");
                const jsUsername = escapeJsString(user.username);
                const jsRole = escapeJsString(user.role);

                // Montagem Segura da Tabela
                tr.innerHTML = `
                    <td>${safeId}</td>
                    <td><strong>${safeUsername}</strong></td>
                    <td>${safeFullname}</td>
                    <td>
                        <span class="badge ${safeRole}">
                            ${safeRole}
                        </span>
                    </td>
                    <td>
                        <button class="btn-icon edit"
                                title="Editar usuário"
                                onclick="openEdit(${user.id}, '${jsFullname}', '${jsRole}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon delete"
                                title="Excluir usuário"
                                onclick="deleteUser(${user.id}, '${jsUsername}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            console.error(error);
            showToast("Erro ao carregar usuários.", "error");
        }
    }

    /* ======================================================
       4. LÓGICA DE CRIAÇÃO (NOVO)
       ====================================================== */
    window.openCreateModal = () => {
        const form = document.getElementById("adminCreateUserForm");
        if (form) form.reset();
        const modal = document.getElementById("createUserModal");
        if (modal) modal.style.display = "flex";
    };

    const createForm = document.getElementById("adminCreateUserForm");
    if (createForm) {
        createForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const fullName = document.getElementById("createFullName").value.trim();
            const username = document.getElementById("createUsername").value.trim();
            const password = document.getElementById("createPassword").value;
            const role = document.getElementById("createRole").value;

            const pwdError = validatePasswordRules(password);
            if (pwdError) {
                showToast(pwdError, "error");
                return;
            }

            try {
                const response = await fetch("/users/create", {
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ 
                        username: username, 
                        password: password, 
                        full_name: fullName, 
                        role: role 
                    })
                });

                if (response.ok) {
                    showToast(`Usuário ${username} criado com sucesso!`, "success");
                    const modal = document.getElementById("createUserModal");
                    if (modal) modal.style.display = "none";
                    loadUsers();
                } else {
                    const err = await response.json();
                    showToast("Erro ao criar: " + (err.detail || "Verifique os dados."), "error");
                }
            } catch (error) {
                console.error(error);
                showToast("Erro de conexão.", "error");
            }
        });
    }

    // Carrega a tabela ao entrar
    loadUsers();

    /* ======================================================
       5. Lógica de edição
       ====================================================== */
    window.openEdit = (id, name, role) => {
        const modal = document.getElementById("editUserModal");
        if (!modal) return;

        document.getElementById("editUserId").value = id;
        document.getElementById("editFullName").value = name;
        document.getElementById("editRole").value = role;
        document.getElementById("editPassword").value = "";

        modal.style.display = "flex";
    };

    const editForm = document.getElementById("editUserForm");
    if (editForm) {
        editForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const id = document.getElementById("editUserId").value;
            const newFullName = document.getElementById("editFullName").value;
            const newRole = document.getElementById("editRole").value;
            const newPass = document.getElementById("editPassword").value;

            const body = {
                full_name: newFullName,
                role: newRole,
            };

            if (newPass) {
                const pwdError = validatePasswordRules(newPass);
                if (pwdError) {
                    showToast(pwdError, "error");
                    return;
                }
                body.password = newPass;
            }

            try {
                const res = await fetch(`/users/${id}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(body),
                });

                if (!res.ok) {
                    const err = await res.json();
                    showToast("Erro ao atualizar: " + (err.detail || "Falha desconhecida."), "error");
                    return;
                }

                const modal = document.getElementById("editUserModal");
                if (modal) modal.style.display = "none";

                await loadUsers();
                showToast("Usuário atualizado com sucesso.", "success");
            } catch (err) {
                console.error(err);
                showToast("Erro de conexão.", "error");
            }
        });
    }

    /* ======================================================
       6. Lógica de exclusão usando MODAL
       ====================================================== */
    window.deleteUser = (id, username) => {
        if (!confirmModal) {
            if (confirm(`Tem certeza que deseja EXCLUIR o usuário ${username}?`)) {
                performDelete(id);
            }
            return;
        }

        deleteUserId = id;
        deleteUsername = username;

        if (confirmText) {
            confirmText.textContent =
                `Tem certeza que deseja excluir o usuário "${username}"? ` +
                `Essa ação não poderá ser desfeita.`;
        }
        confirmModal.style.display = "flex";
    };

    async function performDelete(id) {
        try {
            const res = await fetch(`/users/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                await loadUsers();
                showToast("Usuário excluído com sucesso.", "success");
            } else {
                const err = await res.json();
                showToast("Erro ao excluir: " + (err.detail || "Falha desconhecida."), "error");
            }
        } catch (error) {
            console.error(error);
            showToast("Erro de conexão ao excluir usuário.", "error");
        }
    }

    if (confirmBtn) {
        confirmBtn.addEventListener("click", async () => {
            if (!deleteUserId) {
                confirmModal.style.display = "none";
                return;
            }
            await performDelete(deleteUserId);
            deleteUserId = null;
            deleteUsername = "";
            confirmModal.style.display = "none";
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener("click", () => {
            deleteUserId = null;
            deleteUsername = "";
            confirmModal.style.display = "none";
        });
    }

    window.closeModal = (id) => {
        const m = document.getElementById(id);
        if (m) m.style.display = "none";
    };
});