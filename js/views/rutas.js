import { listAll, createDoc, updateDocById, deleteDocById } from "../db.js";
import { openModal, closeModal, toast, confirmDialog, escapeHtml } from "../utils.js";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Sin asignar"];

export async function render(root, ctx) {
  const rutas = await listAll("rutas");
  rutas.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

  root.innerHTML = `
    <div class="section-head">
      <span class="muted">${rutas.length} ruta(s) registrada(s)</span>
      ${ctx.isAdmin ? `<button class="btn" id="btn-new-ruta">+ Nueva ruta</button>` : ""}
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Ruta</th><th>Día asignado</th><th>Estado</th><th>Observaciones</th>
          ${ctx.isAdmin ? "<th></th>" : ""}
        </tr></thead>
        <tbody id="rutas-body"></tbody>
      </table>
    </div>`;

  const body = root.querySelector("#rutas-body");
  if (rutas.length === 0) {
    body.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="es-icon">➜</div><p>No hay rutas registradas todavía.</p></div></td></tr>`;
  } else {
    body.innerHTML = rutas.map((r) => `
      <tr>
        <td><strong>${escapeHtml(r.nombre)}</strong>${r.descripcion ? `<div class="muted" style="font-size:12px">${escapeHtml(r.descripcion)}</div>` : ""}</td>
        <td>${escapeHtml(r.diaAsignado || "Sin asignar")}</td>
        <td><span class="stamp ${r.estado === "activa" ? "stamp-ok" : "stamp-neutral"}">${r.estado === "activa" ? "Activa" : "Inactiva"}</span></td>
        <td class="muted">${escapeHtml(r.observaciones || "—")}</td>
        ${ctx.isAdmin ? `<td class="row-actions">
          <button class="icon-btn" data-edit="${r.id}">Editar</button>
          <button class="icon-btn" data-del="${r.id}">Eliminar</button>
        </td>` : ""}
      </tr>`).join("");
  }

  if (!ctx.isAdmin) return;

  root.querySelector("#btn-new-ruta").onclick = () => openForm();
  body.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => openForm(rutas.find((r) => r.id === b.dataset.edit)));
  body.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => {
    if (!confirmDialog("¿Eliminar esta ruta?")) return;
    await deleteDocById("rutas", b.dataset.del);
    toast("Ruta eliminada");
    render(root, ctx);
  });

  function openForm(existing) {
    openModal({
      title: existing ? "Editar ruta" : "Nueva ruta",
      submitLabel: existing ? "Guardar cambios" : "Crear ruta",
      bodyHtml: `
        <div class="field"><label>Nombre de la ruta</label>
          <input name="nombre" required value="${existing ? escapeHtml(existing.nombre) : ""}" placeholder="Ruta 1"></div>
        <div class="field"><label>Descripción</label>
          <input name="descripcion" value="${existing ? escapeHtml(existing.descripcion || "") : ""}" placeholder="Zona / colonias que cubre"></div>
        <div class="form-row">
          <div class="field"><label>Día asignado</label>
            <select name="diaAsignado">${DIAS.map((d) => `<option ${existing?.diaAsignado === d ? "selected" : ""}>${d}</option>`).join("")}</select>
          </div>
          <div class="field"><label>Estado</label>
            <select name="estado">
              <option value="activa" ${existing?.estado === "activa" ? "selected" : ""}>Activa</option>
              <option value="inactiva" ${existing?.estado === "inactiva" ? "selected" : ""}>Inactiva</option>
            </select>
          </div>
        </div>
        <div class="field"><label>Observaciones</label>
          <textarea name="observaciones" rows="2">${existing ? escapeHtml(existing.observaciones || "") : ""}</textarea></div>
      `,
      onSubmit: async (fd) => {
        const data = {
          nombre: fd.get("nombre").trim(),
          descripcion: fd.get("descripcion").trim(),
          diaAsignado: fd.get("diaAsignado"),
          estado: fd.get("estado"),
          observaciones: fd.get("observaciones").trim(),
        };
        if (existing) await updateDocById("rutas", existing.id, data);
        else await createDoc("rutas", data);
        toast(existing ? "Ruta actualizada" : "Ruta creada");
        render(root, ctx);
      },
    });
  }
}
