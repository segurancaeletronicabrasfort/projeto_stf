document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("userToken");

    // 1. Verificação de Segurança (Se não for Admin, chuta fora)
    if (!token) {
        window.location.href = "/";
        return;
    }
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.role !== 'admin') {
            alert("Acesso restrito a Administradores.");
            window.location.href = "/dashboard";
            return;
        }
    } catch (e) {
        window.location.href = "/";
    }

    // 2. Logout
    document.getElementById("btnLogout").addEventListener("click", () => {
        localStorage.clear();
        window.location.href = "/";
    });

    // 3. Função para Carregar Usuários
    async function loadUsers() {
        const tbody = document.getElementById("usersTableBody");
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Carregando...</td></tr>';

        try {
            const response = await fetch("/users", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const users = await response.json();

            tbody.innerHTML = ""; // Limpa

            users.forEach(user => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${user.id}</td>
                    <td><strong>${user.username}</strong></td>
                    <td>${user.full_name}</td>
                    <td><span class="badge ${user.role}">${user.role}</span></td>
                    <td>
                        <button class="btn-icon edit" onclick="openEdit(${user.id}, '${user.full_name}', '${user.role}')"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon delete" onclick="deleteUser(${user.id}, '${user.username}')"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            alert("Erro ao carregar usuários");
        }
    }

    // Carrega a lista ao abrir
    loadUsers();

    // 4. Lógica de Edição
    window.openEdit = (id, name, role) => {
        document.getElementById("editUserId").value = id;
        document.getElementById("editFullName").value = name;
        document.getElementById("editRole").value = role;
        document.getElementById("editPassword").value = ""; // Limpa senha
        document.getElementById("editUserModal").style.display = "flex";
    };

    document.getElementById("editUserForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = document.getElementById("editUserId").value;
        const body = {
            full_name: document.getElementById("editFullName").value,
            role: document.getElementById("editRole").value
        };
        
        const pass = document.getElementById("editPassword").value;
        if(pass) body.password = pass; // Só envia se preencheu

        await fetch(`/users/${id}`, {
            method: "PUT",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        document.getElementById("editUserModal").style.display = "none";
        loadUsers(); // Recarrega tabela
        alert("Usuário atualizado!");
    });

    // 5. Lógica de Deleção
    window.deleteUser = async (id, username) => {
        if(confirm(`Tem certeza que deseja EXCLUIR o usuário ${username}? Essa ação não tem volta.`)) {
            const res = await fetch(`/users/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            
            if(res.ok) {
                alert("Usuário deletado.");
                loadUsers();
            } else {
                const err = await res.json();
                alert("Erro: " + err.detail);
            }
        } catch (error) {
            alert("Erro de conexão ao excluir usuário.");
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

    // Função global de fechar modal (já usada no X dos modais)
    window.closeModal = (id) => {
        document.getElementById(id).style.display = "none";
    };
});