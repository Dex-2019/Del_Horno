import { db } from "../firebase-config.js";
import { collection, getDocs, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { openModal, toast, confirmDialog, escapeHtml } from "../utils.js";

export async function render(root, ctx) {
  if (!ctx.isAdmin) {
    root.innerHTML = `<div class="empty-state"><p>No tienes permiso para ver esta sección.</p></div>`;
    return;
  }

  const snap = await getDocs(collection(db, "usuarios"));
  const usuarios = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));

  root.innerHTML = `
    <div class="alert alert-warn">
      ℹ️ Aquí se define el <strong>&nbsp;rol&nbsp;</strong> de cada persona (administrador o socio). La cuenta de acceso
      (correo/contraseña) se crea primero en <strong>&nbsp;Firebase Authentication&nbsp;</strong> desde la consola de Firebase;
      luego pega aquí su UID para asignarle nombre y rol.
    </div>
    <div class="section-head">
      <span class="muted">${usuarios.length} usuario(s) con perfil asignado</span>
      <button class="btn" id="btn-new">+ Asignar rol a usuario</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nombre</th><th>Rol</th><th>UID</th><th></th></tr></thead>
        <tbody id="tb"></tbody>
      </table>
    </div>`;

  const body = root.querySelector("#tb");
  body.innerHTML = usuarios.length ? usuarios.map((u) => `
    <tr>
      <td><strong>${escapeHtml(u.nombre || "—")}</strong></td>
      <td><span class="stamp ${u.rol === "administrador" ? "stamp-ok" : "stamp-neutral"}">${u.rol === "administrador" ? "Administrador" : "Socio · solo lectura"}</span></td>
      <td class="mono muted" style="font-size:12px;">${escapeHtml(u.uid)}</td>
      <td class="row-actions">
        <button class="icon-btn" data-edit="${u.uid}">Editar</button>
        <button class="icon-btn" data-del="${u.uid}">Eliminar</button>
      </td>
    </tr>`).join("") : `<tr><td colspan="4"><div class="empty-state"><p>Aún no hay perfiles asignados.</p></div></td></tr>`;

  root.querySelector("#btn-new").onclick = () => openForm();
  body.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => openForm(usuarios.find((u) => u.uid === b.dataset.edit)));
  body.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => {
    if (!confirmDialog("¿Quitar el perfil de este usuario? (no elimina su cuenta de Firebase Authentication)")) return;
    await deleteDoc(doc(db, "usuarios", b.dataset.del));
    toast("Perfil eliminado");
    render(root, ctx);
  });

  function openForm(existing) {
    openModal({
      title: existing ? "Editar usuario" : "Asignar rol a usuario",
      submitLabel: "Guardar",
      bodyHtml: `
        <div class="field"><label>UID de Firebase Authentication</label>
          <input name="uid" required ${existing ? "readonly" : ""} value="${existing ? escapeHtml(existing.uid) : ""}" placeholder="Cópialo desde Authentication → Users"></div>
        <div class="field"><label>Nombre</label>
          <input name="nombre" required value="${existing ? escapeHtml(existing.nombre || "") : ""}"></div>
        <div class="field"><label>Rol</label>
          <select name="rol">
            <option value="administrador" ${existing?.rol === "administrador" ? "selected" : ""}>Administrador</option>
            <option value="socio" ${existing?.rol === "socio" ? "selected" : ""}>Socio (solo lectura)</option>
          </select>
        </div>
      `,
      onSubmit: async (fd) => {
        const uid = fd.get("uid").trim();
        await setDoc(doc(db, "usuarios", uid), { nombre: fd.get("nombre").trim(), rol: fd.get("rol") });
        toast("Usuario guardado");
        render(root, ctx);
      },
    });
  }
}
