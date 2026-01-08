document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("userToken");

    // 1. Segurança básica – só Admin entra aqui
    if (!token) {
        window.location.href = "/";
        return;
    }

    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.role !== "admin") {
            alert("Acesso restrito a Administradores.");
            window.location.href = "/dashboard";
            return;
        }
    } catch (e) {
        window.location.href = "/";
        return;
    }

    // 2. Logout
    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            localStorage.clear();
            window.location.href = "/";
        });
    }

    // Referências do modal de exclusão
    const confirmModal   = document.getElementById("confirmDeleteModal");
    const confirmText    = document.getElementById("confirmDeleteText");
    const confirmBtn     = document.getElementById("confirmDeleteBtn");
    const cancelBtn      = document.getElementById("cancelDeleteBtn");

    let deleteUserId   = null;
    let deleteUsername = "";

    // 3. Função para carregar usuários
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

            if (!response.ok) {
                throw new Error("Falha ao buscar usuários");
            }

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
                tr.innerHTML = `
                    <td>${user.id}</td>
                    <td><strong>${user.username}</strong></td>
                    <td>${user.full_name || "-"}</td>
                    <td>
                        <span class="badge ${user.role}">
                            ${user.role}
                        </span>
                    </td>
                    <td>
                        <button class="btn-icon edit"
                                title="Editar usuário"
                                onclick="openEdit(${user.id}, '${user.full_name || ""}', '${user.role}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon delete"
                                title="Excluir usuário"
                                onclick="deleteUser(${user.id}, '${user.username}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            console.error(error);
            alert("Erro ao carregar usuários.");
        }
    }

    // Carrega a tabela ao entrar
    loadUsers();

    // 4. Lógica de edição
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
            const body = {
                full_name: document.getElementById("editFullName").value,
                role: document.getElementById("editRole").value,
            };

            const pass = document.getElementById("editPassword").value;
            if (pass) body.password = pass;

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
                    alert("Erro ao atualizar: " + (err.detail || "Falha desconhecida."));
                    return;
                }

                document.getElementById("editUserModal").style.display = "none";
                await loadUsers();
                alert("Usuário atualizado com sucesso.");
            } catch (err) {
                alert("Erro de conexão ao atualizar usuário.");
            }
        });
    }

    // 5. Lógica de exclusão usando MODAL (sem confirm nativo)
    window.deleteUser = (id, username) => {
        if (!confirmModal) {
            // fallback: se o modal não existir, usa confirm normal
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
                alert("Usuário excluído com sucesso.");
            } else {
                const err = await res.json();
                alert("Erro ao excluir: " + (err.detail || "Falha desconhecida."));
            }
        } catch (error) {
            alert("Erro de conexão ao excluir usuário.");
        }
    }

<<<<<<< HEAD
    // ==========================================
    // LÓGICA DE CRIAÇÃO (NOVO)
    // ==========================================

    // 1. Função para Abrir o Modal (Chamada pelo botão HTML)
    window.openCreateModal = () => {
        // Limpa os campos antes de abrir
        document.getElementById("adminCreateUserForm").reset();
        document.getElementById("createUserModal").style.display = "flex";
    };

    // 2. Enviar o Formulário de Criação
    const createForm = document.getElementById("adminCreateUserForm");
    if (createForm) {
        createForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            // Pega os dados dos inputs
            const fullName = document.getElementById("createFullName").value;
            const username = document.getElementById("createUsername").value;
            const password = document.getElementById("createPassword").value;
            const role = document.getElementById("createRole").value;

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
                    alert(`Usuário ${username} criado com sucesso!`);
                    document.getElementById("createUserModal").style.display = "none";
                    loadUsers(); // Atualiza a tabela na hora
                } else {
                    const err = await response.json();
                    alert("Erro ao criar: " + (err.detail || "Verifique os dados."));
                }
            } catch (error) {
                console.error(error);
                alert("Erro de conexão ao tentar criar usuário.");
            }
        });
    }

    // Função Global de Fechar Modal
=======
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

    // Função global de fechar modal (já usada no X dos modais)
>>>>>>> 94a2702c4a3210bc3c3b092a8ce6bb6b9f90e596
    window.closeModal = (id) => {
        const m = document.getElementById(id);
        if (m) m.style.display = "none";
    };
});
