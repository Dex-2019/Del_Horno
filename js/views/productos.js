import { listAll, createDoc, updateDocById, deleteDocById } from "../db.js";
import { openModal, toast, confirmDialog, escapeHtml, fmtL } from "../utils.js";

export async function render(root, ctx) {
  const productos = await listAll("productos");
  productos.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

  root.innerHTML = `
    <div class="section-head">
      <span class="muted">${productos.length} producto(s) en catálogo</span>
      ${ctx.isAdmin ? `<button class="btn" id="btn-new">+ Nuevo producto</button>` : ""}
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Producto</th><th>Unidad</th><th>Precio</th><th>Estado</th>${ctx.isAdmin ? "<th></th>" : ""}</tr></thead>
        <tbody id="tb"></tbody>
      </table>
    </div>`;

  const body = root.querySelector("#tb");
  body.innerHTML = productos.length ? productos.map((p) => `
    <tr>
      <td><strong>${escapeHtml(p.nombre)}</strong>${p.descripcion ? `<div class="muted" style="font-size:12px">${escapeHtml(p.descripcion)}</div>` : ""}</td>
      <td>${escapeHtml(p.unidad || "—")}</td>
      <td class="num">${fmtL(p.precio)}</td>
      <td><span class="stamp ${p.activo ? "stamp-ok" : "stamp-neutral"}">${p.activo ? "Activo" : "Inactivo"}</span></td>
      ${ctx.isAdmin ? `<td class="row-actions">
        <button class="icon-btn" data-edit="${p.id}">Editar</button>
        <button class="icon-btn" data-del="${p.id}">Eliminar</button>
      </td>` : ""}
    </tr>`).join("") : `<tr><td colspan="5"><div class="empty-state"><div class="es-icon">▤</div><p>Todavía no hay productos en el catálogo.</p></div></td></tr>`;

  if (!ctx.isAdmin) return;

  root.querySelector("#btn-new").onclick = () => openForm();
  body.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => openForm(productos.find((p) => p.id === b.dataset.edit)));
  body.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => {
    if (!confirmDialog("¿Eliminar este producto?")) return;
    await deleteDocById("productos", b.dataset.del);
    toast("Producto eliminado");
    render(root, ctx);
  });

  function openForm(existing) {
    openModal({
      title: existing ? "Editar producto" : "Nuevo producto",
      submitLabel: existing ? "Guardar cambios" : "Crear producto",
      bodyHtml: `
        <div class="field"><label>Nombre</label>
          <input name="nombre" required value="${existing ? escapeHtml(existing.nombre) : ""}" placeholder="Bolsa de pan dulce"></div>
        <div class="field"><label>Descripción</label>
          <input name="descripcion" value="${existing ? escapeHtml(existing.descripcion || "") : ""}"></div>
        <div class="form-row">
          <div class="field"><label>Unidad de medida</label>
            <input name="unidad" value="${existing ? escapeHtml(existing.unidad || "") : ""}" placeholder="bolsa, unidad, docena…"></div>
          <div class="field"><label>Precio de venta (L)</label>
            <input name="precio" type="number" step="0.01" min="0" required value="${existing ? existing.precio : ""}"></div>
        </div>
        <div class="field"><label><input type="checkbox" name="activo" ${!existing || existing.activo ? "checked" : ""} style="width:auto; margin-right:6px;">Producto activo</label></div>
      `,
      onSubmit: async (fd) => {
        const data = {
          nombre: fd.get("nombre").trim(),
          descripcion: fd.get("descripcion").trim(),
          unidad: fd.get("unidad").trim(),
          precio: parseFloat(fd.get("precio")) || 0,
          activo: fd.get("activo") === "on",
        };
        if (existing) await updateDocById("productos", existing.id, data);
        else await createDoc("productos", data);
        toast(existing ? "Producto actualizado" : "Producto creado");
        render(root, ctx);
      },
    });
  }
}
