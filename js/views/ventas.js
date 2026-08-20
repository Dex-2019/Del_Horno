import { listAll, listWhere, createDoc, updateDocById, deleteDocById } from "../db.js";
import { openModal, toast, confirmDialog, escapeHtml, fmtL, fmtDate } from "../utils.js";

export async function render(root, ctx) {
  const [jornadas, productos] = await Promise.all([listAll("jornadas", "fecha"), listAll("productos")]);

  root.innerHTML = `
    <div class="filters">
      <select id="sel-jornada">
        ${jornadas.length ? jornadas.map((j) => `<option value="${j.id}">${fmtDate(j.fecha)} — ${escapeHtml(j.rutaNombre || "")}</option>`).join("") : `<option value="">Sin jornadas</option>`}
      </select>
      ${ctx.isAdmin ? `<button class="btn" id="btn-add">+ Nueva venta</button>` : ""}
    </div>
    <div id="v-body"></div>`;

  if (!jornadas.length) {
    root.querySelector("#v-body").innerHTML = `<div class="empty-state"><div class="es-icon">L</div><p>Primero abre una jornada en "Jornada del día".</p></div>`;
    return;
  }

  const sel = root.querySelector("#sel-jornada");
  sel.onchange = () => load(sel.value);
  load(sel.value);
  if (ctx.isAdmin) root.querySelector("#btn-add").onclick = () => openForm(sel.value);

  async function load(jornadaId) {
    const jornada = jornadas.find((j) => j.id === jornadaId);
    const box = root.querySelector("#v-body");
    const ventas = await listWhere("ventas", "jornadaId", "==", jornadaId);
    const total = ventas.reduce((s, v) => s + (+v.total || 0), 0);

    box.innerHTML = `
      <div class="stat" style="max-width:260px; margin-bottom:18px;">
        <div class="label">Ventas del día — ${escapeHtml(jornada?.rutaNombre || "")}</div>
        <div class="value pos">${fmtL(total)}</div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Producto</th><th>Cantidad</th><th>P. unitario</th><th>Total</th><th>Observación</th>${ctx.isAdmin ? "<th></th>" : ""}</tr></thead>
          <tbody id="v-rows"></tbody>
        </table>
      </div>`;

    const rows = box.querySelector("#v-rows");
    rows.innerHTML = ventas.length ? ventas.map((v) => `
      <tr>
        <td>${escapeHtml(v.productoNombre)}</td>
        <td class="num">${v.cantidad}</td>
        <td class="num">${fmtL(v.precioUnitario)}</td>
        <td class="num"><strong>${fmtL(v.total)}</strong></td>
        <td class="muted">${escapeHtml(v.observacion || "—")}</td>
        ${ctx.isAdmin ? `<td class="row-actions">
          <button class="icon-btn" data-edit="${v.id}">Editar</button>
          <button class="icon-btn" data-del="${v.id}">Eliminar</button>
        </td>` : ""}
      </tr>`).join("") : `<tr><td colspan="6"><div class="empty-state"><p>Sin ventas registradas para esta jornada.</p></div></td></tr>`;

    if (ctx.isAdmin) {
      rows.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => openForm(jornadaId, ventas.find((v) => v.id === b.dataset.edit)));
      rows.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => {
        if (!confirmDialog("¿Eliminar esta venta?")) return;
        await deleteDocById("ventas", b.dataset.del);
        toast("Venta eliminada");
        load(jornadaId);
      });
    }
  }

  function openForm(jornadaId, existing) {
    if (!productos.length) return toast("Primero registra productos en el catálogo.");
    const jornada = jornadas.find((j) => j.id === jornadaId);
    openModal({
      title: existing ? "Editar venta" : "Registrar venta",
      submitLabel: existing ? "Guardar cambios" : "Registrar venta",
      bodyHtml: `
        <div class="field"><label>Producto</label>
          <select name="productoId" required>
            ${productos.map((p) => `<option value="${p.id}" data-precio="${p.precio}" ${existing?.productoId === p.id ? "selected" : ""}>${escapeHtml(p.nombre)}</option>`).join("")}
          </select>
        </div>
        <div class="form-row">
          <div class="field"><label>Cantidad</label><input type="number" name="cantidad" min="1" step="1" value="${existing ? existing.cantidad : 1}" required></div>
          <div class="field"><label>Precio unitario (L)</label><input type="number" name="precioUnitario" min="0" step="0.01" value="${existing ? existing.precioUnitario : productos[0]?.precio || 0}" required></div>
        </div>
        <div class="field"><label>Observación</label><input name="observacion" value="${existing ? escapeHtml(existing.observacion || "") : ""}"></div>
      `,
      onSubmit: async (fd, form) => {
        const producto = productos.find((p) => p.id === fd.get("productoId"));
        const cantidad = parseFloat(fd.get("cantidad")) || 0;
        const precioUnitario = parseFloat(fd.get("precioUnitario")) || 0;
        const data = {
          jornadaId,
          fecha: jornada.fecha,
          rutaId: jornada.rutaId,
          rutaNombre: jornada.rutaNombre,
          productoId: producto.id,
          productoNombre: producto.nombre,
          cantidad,
          precioUnitario,
          total: cantidad * precioUnitario,
          observacion: fd.get("observacion").trim(),
        };
        if (existing) await updateDocById("ventas", existing.id, data);
        else await createDoc("ventas", data);
        toast("Venta guardada");
        load(jornadaId);
      },
    });

    // autocompletar precio al elegir producto
    const overlay = document.getElementById("modal-overlay");
    const selProd = overlay.querySelector('select[name="productoId"]');
    const precioInput = overlay.querySelector('input[name="precioUnitario"]');
    selProd.addEventListener("change", () => {
      const opt = selProd.selectedOptions[0];
      if (opt && !existing) precioInput.value = opt.dataset.precio;
    });
  }
}
