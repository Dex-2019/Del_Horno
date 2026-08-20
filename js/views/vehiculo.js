import { listAll, listWhere, createDoc, updateDocById, deleteDocById } from "../db.js";
import { openModal, toast, confirmDialog, escapeHtml, fmtL, fmtDate } from "../utils.js";

export async function render(root, ctx) {
  const vehiculos = await listAll("vehiculos");

  root.innerHTML = `
    <div class="section-head">
      <span class="muted">${vehiculos.length ? "1 vehículo registrado" : "Sin vehículo registrado"}</span>
      ${ctx.isAdmin && vehiculos.length === 0 ? `<button class="btn" id="btn-new-veh">+ Registrar vehículo</button>` : ""}
    </div>
    <div id="veh-root"></div>`;

  if (!vehiculos.length) {
    root.querySelector("#veh-root").innerHTML = `<div class="empty-state"><div class="es-icon">◈</div><p>Registra los datos del vehículo para empezar a llevar su control.</p></div>`;
    if (ctx.isAdmin) root.querySelector("#btn-new-veh").onclick = () => vehForm();
    return;
  }

  const v = vehiculos[0];
  const [combustible, mantenimientos] = await Promise.all([
    listWhere("combustible", "vehiculoId", "==", v.id, "fecha"),
    listWhere("mantenimientos", "vehiculoId", "==", v.id, "fecha"),
  ]);

  const proximo = mantenimientos.find((m) => m.proximoMantenimiento && v.kilometrajeActual >= (Number(m.proximoMantenimiento) - 300));

  root.querySelector("#veh-root").innerHTML = `
    <div class="card" style="margin-bottom:20px;">
      <div class="section-head" style="margin-bottom:6px;">
        <h3 style="margin:0;">${escapeHtml(v.nombre)} — ${escapeHtml(v.placa || "sin placa")}</h3>
        ${ctx.isAdmin ? `<button class="icon-btn" id="btn-edit-veh">Editar datos</button>` : ""}
      </div>
      ${proximo ? `<div class="alert alert-warn">⚠️ Mantenimiento próximo: <strong>&nbsp;${escapeHtml(proximo.tipo)}</strong> alrededor de ${proximo.proximoMantenimiento} km (actual: ${v.kilometrajeActual} km)</div>` : ""}
      <div class="grid grid-4">
        <div class="stat"><div class="label">Marca / modelo</div><div class="value" style="font-size:15px;">${escapeHtml(v.marca || "—")} ${escapeHtml(v.modelo || "")}</div></div>
        <div class="stat"><div class="label">Año</div><div class="value" style="font-size:15px;">${escapeHtml(v.anio || "—")}</div></div>
        <div class="stat"><div class="label">Estado</div><div class="value" style="font-size:15px;">${escapeHtml(v.estado || "—")}</div></div>
        <div class="stat"><div class="label">Kilometraje actual</div><div class="value">${v.kilometrajeActual ?? "—"}</div></div>
      </div>
    </div>

    <div class="grid grid-2">
      <div>
        <div class="section-head"><h3 style="margin:0; font-size:15px;">Combustible</h3>${ctx.isAdmin ? `<button class="icon-btn" id="btn-add-comb">+ Registrar</button>` : ""}</div>
        <div class="table-wrap">
          <table><thead><tr><th>Fecha</th><th>Km</th><th>Cant.</th><th>Total</th>${ctx.isAdmin ? "<th></th>" : ""}</tr></thead>
          <tbody>
            ${combustible.length ? combustible.map((c) => `<tr>
              <td>${fmtDate(c.fecha)}</td><td class="num">${c.kilometraje}</td><td class="num">${c.cantidad}</td><td class="num">${fmtL(c.total)}</td>
              ${ctx.isAdmin ? `<td class="row-actions"><button class="icon-btn" data-delc="${c.id}">Eliminar</button></td>` : ""}
            </tr>`).join("") : `<tr><td colspan="5"><div class="empty-state"><p>Sin registros de combustible.</p></div></td></tr>`}
          </tbody></table>
        </div>
      </div>
      <div>
        <div class="section-head"><h3 style="margin:0; font-size:15px;">Mantenimiento</h3>${ctx.isAdmin ? `<button class="icon-btn" id="btn-add-mant">+ Registrar</button>` : ""}</div>
        <div class="table-wrap">
          <table><thead><tr><th>Fecha</th><th>Tipo</th><th>Costo</th><th>Próx. (km)</th>${ctx.isAdmin ? "<th></th>" : ""}</tr></thead>
          <tbody>
            ${mantenimientos.length ? mantenimientos.map((m) => `<tr>
              <td>${fmtDate(m.fecha)}</td><td>${escapeHtml(m.tipo)}</td><td class="num">${fmtL(m.costo)}</td><td class="num">${m.proximoMantenimiento ?? "—"}</td>
              ${ctx.isAdmin ? `<td class="row-actions"><button class="icon-btn" data-delm="${m.id}">Eliminar</button></td>` : ""}
            </tr>`).join("") : `<tr><td colspan="5"><div class="empty-state"><p>Sin registros de mantenimiento.</p></div></td></tr>`}
          </tbody></table>
        </div>
      </div>
    </div>`;

  if (!ctx.isAdmin) return;

  root.querySelector("#btn-edit-veh").onclick = () => vehForm(v);
  root.querySelector("#btn-add-comb").onclick = () => combForm(v);
  root.querySelector("#btn-add-mant").onclick = () => mantForm(v);
  root.querySelectorAll("[data-delc]").forEach((b) => b.onclick = async () => {
    if (!confirmDialog("¿Eliminar este registro de combustible?")) return;
    await deleteDocById("combustible", b.dataset.delc);
    toast("Eliminado"); render(root, ctx);
  });
  root.querySelectorAll("[data-delm]").forEach((b) => b.onclick = async () => {
    if (!confirmDialog("¿Eliminar este registro de mantenimiento?")) return;
    await deleteDocById("mantenimientos", b.dataset.delm);
    toast("Eliminado"); render(root, ctx);
  });

  function vehForm(existing) {
    openModal({
      title: existing ? "Editar vehículo" : "Registrar vehículo",
      submitLabel: "Guardar",
      bodyHtml: `
        <div class="form-row">
          <div class="field"><label>Nombre / identificador</label><input name="nombre" required value="${existing ? escapeHtml(existing.nombre) : ""}" placeholder="Camión repartidor"></div>
          <div class="field"><label>Placa</label><input name="placa" value="${existing ? escapeHtml(existing.placa || "") : ""}"></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Marca</label><input name="marca" value="${existing ? escapeHtml(existing.marca || "") : ""}"></div>
          <div class="field"><label>Modelo</label><input name="modelo" value="${existing ? escapeHtml(existing.modelo || "") : ""}"></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Año</label><input name="anio" value="${existing ? escapeHtml(existing.anio || "") : ""}"></div>
          <div class="field"><label>Estado</label><input name="estado" value="${existing ? escapeHtml(existing.estado || "") : "Operativo"}"></div>
        </div>
        <div class="field"><label>Kilometraje actual</label><input type="number" name="kilometrajeActual" min="0" required value="${existing ? existing.kilometrajeActual : 0}"></div>
      `,
      onSubmit: async (fd) => {
        const data = {
          nombre: fd.get("nombre").trim(), placa: fd.get("placa").trim(),
          marca: fd.get("marca").trim(), modelo: fd.get("modelo").trim(),
          anio: fd.get("anio").trim(), estado: fd.get("estado").trim(),
          kilometrajeActual: parseFloat(fd.get("kilometrajeActual")) || 0,
        };
        if (existing) await updateDocById("vehiculos", existing.id, data);
        else await createDoc("vehiculos", data);
        toast("Vehículo guardado");
        render(root, ctx);
      },
    });
  }

  function combForm(v) {
    openModal({
      title: "Registrar combustible",
      bodyHtml: `
        <div class="form-row">
          <div class="field"><label>Fecha</label><input type="date" name="fecha" required></div>
          <div class="field"><label>Kilometraje</label><input type="number" name="kilometraje" min="0" required value="${v.kilometrajeActual || 0}"></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Cantidad (gal)</label><input type="number" step="0.01" name="cantidad" required></div>
          <div class="field"><label>Precio por galón (L)</label><input type="number" step="0.01" name="precio" required></div>
        </div>
        <div class="field"><label>Observación</label><input name="observacion"></div>
      `,
      onSubmit: async (fd) => {
        const cantidad = parseFloat(fd.get("cantidad")) || 0;
        const precio = parseFloat(fd.get("precio")) || 0;
        await createDoc("combustible", {
          vehiculoId: v.id, fecha: fd.get("fecha"),
          kilometraje: parseFloat(fd.get("kilometraje")) || 0,
          cantidad, precio, total: cantidad * precio,
          observacion: fd.get("observacion").trim(),
        });
        toast("Combustible registrado");
        render(root, ctx);
      },
    });
  }

  function mantForm(v) {
    openModal({
      title: "Registrar mantenimiento",
      bodyHtml: `
        <div class="form-row">
          <div class="field"><label>Fecha</label><input type="date" name="fecha" required></div>
          <div class="field"><label>Tipo</label><input name="tipo" placeholder="Cambio de aceite, frenos…" required></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Kilometraje</label><input type="number" name="kilometraje" min="0" value="${v.kilometrajeActual || 0}" required></div>
          <div class="field"><label>Costo (L)</label><input type="number" step="0.01" name="costo" required></div>
        </div>
        <div class="field"><label>Descripción</label><textarea name="descripcion" rows="2"></textarea></div>
        <div class="field"><label>Próximo mantenimiento (km)</label><input type="number" name="proximoMantenimiento" min="0"></div>
      `,
      onSubmit: async (fd) => {
        await createDoc("mantenimientos", {
          vehiculoId: v.id, fecha: fd.get("fecha"), tipo: fd.get("tipo").trim(),
          kilometraje: parseFloat(fd.get("kilometraje")) || 0,
          descripcion: fd.get("descripcion").trim(),
          costo: parseFloat(fd.get("costo")) || 0,
          proximoMantenimiento: fd.get("proximoMantenimiento") ? parseFloat(fd.get("proximoMantenimiento")) : null,
        });
        toast("Mantenimiento registrado");
        render(root, ctx);
      },
    });
  }
}
