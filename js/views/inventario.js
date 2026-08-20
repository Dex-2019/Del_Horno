import { listAll, listWhere, createDoc, updateDocById, deleteDocById } from "../db.js";
import { openModal, toast, confirmDialog, escapeHtml, fmtDate } from "../utils.js";

export async function render(root, ctx) {
  const [jornadas, productos] = await Promise.all([listAll("jornadas", "fecha"), listAll("productos")]);

  root.innerHTML = `
    <div class="filters">
      <select id="sel-jornada">
        ${jornadas.length ? jornadas.map((j) => `<option value="${j.id}">${fmtDate(j.fecha)} — ${escapeHtml(j.rutaNombre || "")}</option>`).join("") : `<option value="">Sin jornadas</option>`}
      </select>
      ${ctx.isAdmin ? `<button class="btn" id="btn-add">+ Registrar producto</button>` : ""}
    </div>
    <div id="inv-body"></div>`;

  if (!jornadas.length) {
    root.querySelector("#inv-body").innerHTML = `<div class="empty-state"><div class="es-icon">▧</div><p>Primero abre una jornada en "Jornada del día".</p></div>`;
    return;
  }

  const sel = root.querySelector("#sel-jornada");
  sel.onchange = () => loadFor(sel.value);
  loadFor(sel.value);

  if (ctx.isAdmin) {
    root.querySelector("#btn-add").onclick = () => openForm(sel.value);
  }

  async function loadFor(jornadaId) {
    const box = root.querySelector("#inv-body");
    box.innerHTML = `<div class="empty-state"><p>Cargando…</p></div>`;
    const movs = await listWhere("inventarioMovimientos", "jornadaId", "==", jornadaId);

    const totC = movs.reduce((s, m) => s + (+m.cargado || 0), 0);
    const totV = movs.reduce((s, m) => s + (+m.vendido || 0), 0);
    const totD = movs.reduce((s, m) => s + (+m.devuelto || 0), 0);
    const diff = totC - totV - totD;

    box.innerHTML = `
      ${diff !== 0 ? `<div class="alert alert-warn">⚠️ Diferencia de inventario: <strong>&nbsp;${Math.abs(diff)} unidades</strong></div>` : `<div class="alert alert-ok">✅ El inventario cuadra (cargado = vendido + devuelto)</div>`}
      <div class="grid grid-4" style="margin-bottom:18px;">
        <div class="stat"><div class="label">Cargado</div><div class="value">${totC}</div></div>
        <div class="stat"><div class="label">Vendido</div><div class="value">${totV}</div></div>
        <div class="stat"><div class="label">Devuelto</div><div class="value">${totD}</div></div>
        <div class="stat"><div class="label">Diferencia</div><div class="value ${diff === 0 ? "pos" : "warn"}">${diff}</div></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Producto</th><th>Cargado</th><th>Vendido</th><th>Devuelto</th><th>Diferencia</th>${ctx.isAdmin ? "<th></th>" : ""}</tr></thead>
          <tbody id="mv-body"></tbody>
        </table>
      </div>`;

    const body = box.querySelector("#mv-body");
    body.innerHTML = movs.length ? movs.map((m) => {
      const d = (+m.cargado || 0) - (+m.vendido || 0) - (+m.devuelto || 0);
      return `<tr>
        <td>${escapeHtml(m.productoNombre)}</td>
        <td class="num">${m.cargado ?? 0}</td>
        <td class="num">${m.vendido ?? 0}</td>
        <td class="num">${m.devuelto ?? 0}</td>
        <td class="num ${d !== 0 ? "" : ""}">${d}</td>
        ${ctx.isAdmin ? `<td class="row-actions">
          <button class="icon-btn" data-edit="${m.id}">Editar</button>
          <button class="icon-btn" data-del="${m.id}">Eliminar</button>
        </td>` : ""}
      </tr>`;
    }).join("") : `<tr><td colspan="6"><div class="empty-state"><p>Sin movimientos de inventario para esta jornada.</p></div></td></tr>`;

    if (ctx.isAdmin) {
      body.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => openForm(jornadaId, movs.find((m) => m.id === b.dataset.edit)));
      body.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => {
        if (!confirmDialog("¿Eliminar este movimiento?")) return;
        await deleteDocById("inventarioMovimientos", b.dataset.del);
        toast("Movimiento eliminado");
        loadFor(jornadaId);
      });
    }
  }

  function openForm(jornadaId, existing) {
    if (!productos.length) return toast("Primero registra productos en el catálogo.");
    openModal({
      title: existing ? "Editar movimiento de inventario" : "Registrar producto en la jornada",
      submitLabel: existing ? "Guardar cambios" : "Registrar",
      bodyHtml: `
        <div class="field"><label>Producto</label>
          <select name="productoId" ${existing ? "disabled" : ""} required>
            ${productos.map((p) => `<option value="${p.id}" ${existing?.productoId === p.id ? "selected" : ""}>${escapeHtml(p.nombre)}</option>`).join("")}
          </select>
        </div>
        <div class="form-row">
          <div class="field"><label>Cargado</label><input type="number" name="cargado" min="0" value="${existing ? existing.cargado : 0}" required></div>
          <div class="field"><label>Vendido</label><input type="number" name="vendido" min="0" value="${existing ? existing.vendido : 0}" required></div>
        </div>
        <div class="field"><label>Devuelto</label><input type="number" name="devuelto" min="0" value="${existing ? existing.devuelto : 0}" required></div>
      `,
      onSubmit: async (fd) => {
        const producto = productos.find((p) => p.id === (existing?.productoId || fd.get("productoId")));
        const data = {
          jornadaId,
          productoId: producto.id,
          productoNombre: producto.nombre,
          cargado: parseFloat(fd.get("cargado")) || 0,
          vendido: parseFloat(fd.get("vendido")) || 0,
          devuelto: parseFloat(fd.get("devuelto")) || 0,
        };
        if (existing) await updateDocById("inventarioMovimientos", existing.id, data);
        else await createDoc("inventarioMovimientos", data);
        toast("Guardado");
        loadFor(jornadaId);
      },
    });
  }
}
