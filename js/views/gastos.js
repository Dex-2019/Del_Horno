import { listAll, listWhere, createDoc, updateDocById, deleteDocById } from "../db.js";
import { openModal, toast, confirmDialog, escapeHtml, fmtL, fmtDate } from "../utils.js";

const CATEGORIAS_BASE = ["Combustible", "Mantenimiento", "Reparación", "Aceite", "Llantas", "Alimentación", "Mano de obra", "Otros"];

export async function render(root, ctx) {
  const [jornadas, cats] = await Promise.all([listAll("jornadas", "fecha"), listAll("categoriasGasto")]);
  const categorias = cats.length ? cats.map((c) => c.nombre) : CATEGORIAS_BASE;

  root.innerHTML = `
    <div class="filters">
      <select id="sel-jornada">
        ${jornadas.length ? jornadas.map((j) => `<option value="${j.id}">${fmtDate(j.fecha)} — ${escapeHtml(j.rutaNombre || "")}</option>`).join("") : `<option value="">Sin jornadas</option>`}
      </select>
      ${ctx.isAdmin ? `<button class="btn" id="btn-add">+ Nuevo gasto</button> <button class="btn btn-ghost" id="btn-cat">+ Categoría</button>` : ""}
    </div>
    <div id="g-body"></div>`;

  if (!jornadas.length) {
    root.querySelector("#g-body").innerHTML = `<div class="empty-state"><div class="es-icon">−</div><p>Primero abre una jornada en "Jornada del día".</p></div>`;
    return;
  }

  const sel = root.querySelector("#sel-jornada");
  sel.onchange = () => load(sel.value);
  load(sel.value);

  if (ctx.isAdmin) {
    root.querySelector("#btn-add").onclick = () => openForm(sel.value);
    root.querySelector("#btn-cat").onclick = () => openModal({
      title: "Nueva categoría de gasto",
      bodyHtml: `<div class="field"><label>Nombre de la categoría</label><input name="nombre" required></div>`,
      onSubmit: async (fd) => {
        await createDoc("categoriasGasto", { nombre: fd.get("nombre").trim() });
        toast("Categoría creada");
        render(root, ctx);
      },
    });
  }

  async function load(jornadaId) {
    const box = root.querySelector("#g-body");
    const jornada = jornadas.find((j) => j.id === jornadaId);
    const gastos = await listWhere("gastos", "jornadaId", "==", jornadaId);
    const total = gastos.reduce((s, g) => s + (+g.monto || 0), 0);

    box.innerHTML = `
      <div class="stat" style="max-width:260px; margin-bottom:18px;">
        <div class="label">Gastos del día — ${escapeHtml(jornada?.rutaNombre || "")}</div>
        <div class="value neg">${fmtL(total)}</div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Categoría</th><th>Descripción</th><th>Monto</th><th>Responsable</th>${ctx.isAdmin ? "<th></th>" : ""}</tr></thead>
          <tbody id="g-rows"></tbody>
        </table>
      </div>`;

    const rows = box.querySelector("#g-rows");
    rows.innerHTML = gastos.length ? gastos.map((g) => `
      <tr>
        <td><span class="tag">${escapeHtml(g.categoria)}</span></td>
        <td>${escapeHtml(g.descripcion || "—")}</td>
        <td class="num">${fmtL(g.monto)}</td>
        <td class="muted">${escapeHtml(g.responsable || "—")}</td>
        ${ctx.isAdmin ? `<td class="row-actions">
          <button class="icon-btn" data-edit="${g.id}">Editar</button>
          <button class="icon-btn" data-del="${g.id}">Eliminar</button>
        </td>` : ""}
      </tr>`).join("") : `<tr><td colspan="5"><div class="empty-state"><p>Sin gastos registrados para esta jornada.</p></div></td></tr>`;

    if (ctx.isAdmin) {
      rows.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => openForm(jornadaId, gastos.find((g) => g.id === b.dataset.edit)));
      rows.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => {
        if (!confirmDialog("¿Eliminar este gasto?")) return;
        await deleteDocById("gastos", b.dataset.del);
        toast("Gasto eliminado");
        load(jornadaId);
      });
    }
  }

  function openForm(jornadaId, existing) {
    const jornada = jornadas.find((j) => j.id === jornadaId);
    openModal({
      title: existing ? "Editar gasto" : "Nuevo gasto",
      submitLabel: existing ? "Guardar cambios" : "Registrar gasto",
      bodyHtml: `
        <div class="form-row">
          <div class="field"><label>Categoría</label>
            <select name="categoria">${categorias.map((c) => `<option ${existing?.categoria === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}</select>
          </div>
          <div class="field"><label>Monto (L)</label><input type="number" name="monto" min="0" step="0.01" value="${existing ? existing.monto : ""}" required></div>
        </div>
        <div class="field"><label>Descripción</label><input name="descripcion" value="${existing ? escapeHtml(existing.descripcion || "") : ""}"></div>
        <div class="field"><label>Responsable</label><input name="responsable" value="${existing ? escapeHtml(existing.responsable || "") : ""}"></div>
        <div class="field"><label>Observación</label><textarea name="observacion" rows="2">${existing ? escapeHtml(existing.observacion || "") : ""}</textarea></div>
      `,
      onSubmit: async (fd) => {
        const data = {
          jornadaId,
          fecha: jornada.fecha,
          categoria: fd.get("categoria"),
          descripcion: fd.get("descripcion").trim(),
          monto: parseFloat(fd.get("monto")) || 0,
          responsable: fd.get("responsable").trim(),
          observacion: fd.get("observacion").trim(),
        };
        if (existing) await updateDocById("gastos", existing.id, data);
        else await createDoc("gastos", data);
        toast("Gasto guardado");
        load(jornadaId);
      },
    });
  }
}
