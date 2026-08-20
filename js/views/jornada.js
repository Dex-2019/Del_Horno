import { listAll, listWhere, createDoc, updateDocById, getOne } from "../db.js";
import { openModal, toast, escapeHtml, fmtL, fmtDate, todayISO, confirmDialog } from "../utils.js";

export async function render(root, ctx) {
  const [jornadas, rutas, vehiculos] = await Promise.all([
    listAll("jornadas", "fecha"),
    listAll("rutas"),
    listAll("vehiculos"),
  ]);

  root.innerHTML = `
    <div class="section-head">
      <span class="muted">${jornadas.length} jornada(s) registradas</span>
      ${ctx.isAdmin ? `<button class="btn" id="btn-new-jornada">+ Abrir jornada</button>` : ""}
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Fecha</th><th>Ruta</th><th>Km recorridos</th><th>Estado</th><th></th></tr></thead>
        <tbody id="tb"></tbody>
      </table>
    </div>
    <div id="detail" style="margin-top:24px;"></div>`;

  const body = root.querySelector("#tb");
  body.innerHTML = jornadas.length ? jornadas.map((j) => `
    <tr>
      <td>${fmtDate(j.fecha)} <span class="muted" style="font-size:12px">${escapeHtml(j.diaSemana || "")}</span></td>
      <td>${escapeHtml(j.rutaNombre || "—")}</td>
      <td class="num">${j.kmFinal && j.kmInicial ? (j.kmFinal - j.kmInicial) : "—"}</td>
      <td><span class="stamp ${j.estadoCierre === "cerrada" ? "stamp-ok" : "stamp-warn"}">${j.estadoCierre === "cerrada" ? "Cerrada" : "Abierta"}</span></td>
      <td><button class="icon-btn" data-open="${j.id}">Ver / gestionar</button></td>
    </tr>`).join("") : `<tr><td colspan="5"><div class="empty-state"><div class="es-icon">☀</div><p>No hay jornadas registradas todavía.</p></div></td></tr>`;

  body.querySelectorAll("[data-open]").forEach((b) => b.onclick = () => openDetail(b.dataset.open));

  if (ctx.isAdmin) {
    root.querySelector("#btn-new-jornada").onclick = () => openNewForm();
  }

  // abrir automáticamente la jornada más reciente
  if (jornadas.length) openDetail(jornadas[0].id);

  function openNewForm() {
    if (!rutas.length) return toast("Primero registra al menos una ruta.");
    if (!vehiculos.length) return toast("Primero registra el vehículo en el módulo Vehículo.");
    openModal({
      title: "Abrir nueva jornada",
      submitLabel: "Abrir jornada",
      bodyHtml: `
        <div class="form-row">
          <div class="field"><label>Fecha</label><input type="date" name="fecha" value="${todayISO()}" required></div>
          <div class="field"><label>Ruta</label>
            <select name="rutaId" required>${rutas.map((r) => `<option value="${r.id}">${escapeHtml(r.nombre)}</option>`).join("")}</select>
          </div>
        </div>
        <div class="form-row">
          <div class="field"><label>Vehículo</label>
            <select name="vehiculoId" required>${vehiculos.map((v) => `<option value="${v.id}">${escapeHtml(v.nombre)}</option>`).join("")}</select>
          </div>
          <div class="field"><label>Kilometraje inicial</label><input type="number" name="kmInicial" required min="0"></div>
        </div>
      `,
      onSubmit: async (fd) => {
        const fecha = fd.get("fecha");
        const ruta = rutas.find((r) => r.id === fd.get("rutaId"));
        const vehiculo = vehiculos.find((v) => v.id === fd.get("vehiculoId"));
        const id = await createDoc("jornadas", {
          fecha,
          diaSemana: new Date(fecha + "T00:00:00").toLocaleDateString("es-HN", { weekday: "long" }),
          rutaId: ruta.id,
          rutaNombre: ruta.nombre,
          vehiculoId: vehiculo.id,
          vehiculoNombre: vehiculo.nombre,
          kmInicial: parseFloat(fd.get("kmInicial")) || 0,
          kmFinal: null,
          estadoCierre: "abierta",
        });
        toast("Jornada abierta");
        render(root, ctx);
      },
    });
  }

  async function openDetail(jornadaId) {
    const det = root.querySelector("#detail");
    det.innerHTML = `<div class="empty-state"><p>Cargando jornada…</p></div>`;

    const [jornada, movs, ventas, gastos, depositos] = await Promise.all([
      getOne("jornadas", jornadaId),
      listWhere("inventarioMovimientos", "jornadaId", "==", jornadaId),
      listWhere("ventas", "jornadaId", "==", jornadaId),
      listWhere("gastos", "jornadaId", "==", jornadaId),
      listWhere("depositos", "jornadaId", "==", jornadaId),
    ]);
    if (!jornada) { det.innerHTML = ""; return; }

    const cargado = movs.reduce((s, m) => s + (Number(m.cargado) || 0), 0);
    const vendidoInv = movs.reduce((s, m) => s + (Number(m.vendido) || 0), 0);
    const devuelto = movs.reduce((s, m) => s + (Number(m.devuelto) || 0), 0);
    const diferencia = cargado - vendidoInv - devuelto;

    const totalVentas = ventas.reduce((s, v) => s + (Number(v.total) || 0), 0);
    const totalGastos = gastos.reduce((s, g) => s + (Number(g.monto) || 0), 0);
    const resultado = totalVentas - totalGastos;

    const deposito = depositos[0];
    const kmRecorridos = jornada.kmFinal != null ? jornada.kmFinal - jornada.kmInicial : null;

    det.innerHTML = `
      <div class="card" style="margin-bottom:16px;">
        <div class="section-head" style="margin-bottom:6px;">
          <h3 style="margin:0;">Cierre diario — ${fmtDate(jornada.fecha)} · ${escapeHtml(jornada.rutaNombre)}</h3>
          <span class="stamp ${jornada.estadoCierre === "cerrada" ? "stamp-ok" : "stamp-warn"}">${jornada.estadoCierre === "cerrada" ? "Cerrada" : "Abierta"}</span>
        </div>

        ${diferencia !== 0 ? `<div class="alert alert-warn">⚠️ Diferencia de inventario: <strong>&nbsp;${Math.abs(diferencia)} unidades</strong> ${diferencia > 0 ? "sin justificar (cargado no coincide con vendido + devuelto)" : "de más (revisar registros)"}</div>` : ""}

        <div class="grid grid-4" style="margin-bottom:18px;">
          <div class="stat"><div class="label">Cargado</div><div class="value">${cargado}</div></div>
          <div class="stat"><div class="label">Vendido (inv.)</div><div class="value">${vendidoInv}</div></div>
          <div class="stat"><div class="label">Devuelto</div><div class="value">${devuelto}</div></div>
          <div class="stat"><div class="label">Diferencia</div><div class="value ${diferencia === 0 ? "pos" : "warn"}">${diferencia}</div></div>
        </div>

        <div class="grid grid-4" style="margin-bottom:18px;">
          <div class="stat"><div class="label">Ventas totales</div><div class="value pos">${fmtL(totalVentas)}</div></div>
          <div class="stat"><div class="label">Gastos</div><div class="value neg">${fmtL(totalGastos)}</div></div>
          <div class="stat"><div class="label">Resultado operativo</div><div class="value ${resultado >= 0 ? "pos" : "neg"}">${fmtL(resultado)}</div></div>
          <div class="stat"><div class="label">Km recorridos</div><div class="value">${kmRecorridos ?? "—"}</div></div>
        </div>

        <div class="grid grid-2">
          <div class="stat">
            <div class="label">Vehículo</div>
            <div style="font-size:13.5px; margin-top:4px;">
              Km inicial: <strong class="mono">${jornada.kmInicial}</strong><br>
              Km final: <strong class="mono">${jornada.kmFinal ?? "Pendiente"}</strong>
            </div>
            ${ctx.isAdmin && jornada.kmFinal == null ? `<button class="btn btn-sm" style="margin-top:10px;" id="btn-km-final">Registrar km final</button>` : ""}
          </div>
          <div class="stat">
            <div class="label">Depósito bancario</div>
            <div style="font-size:13.5px; margin-top:4px;">
              ${deposito
                ? (deposito.depositado
                    ? `Depositado: <strong>${fmtL(deposito.monto)}</strong> · ${escapeHtml(deposito.banco || "")} <br>Ref: ${escapeHtml(deposito.referencia || "—")}`
                    : `<span class="stamp stamp-bad">Pendiente</span> ${escapeHtml(deposito.motivo || "")}`)
                : `<span class="muted">Sin registrar — ve al módulo Depósitos</span>`}
            </div>
          </div>
        </div>

        ${ctx.isAdmin && jornada.estadoCierre !== "cerrada" ? `<button class="btn" style="margin-top:18px;" id="btn-cerrar">Cerrar jornada</button>` : ""}
      </div>`;

    if (ctx.isAdmin) {
      const kmBtn = det.querySelector("#btn-km-final");
      if (kmBtn) kmBtn.onclick = () => openModal({
        title: "Registrar kilometraje final",
        bodyHtml: `<div class="field"><label>Kilometraje final</label><input type="number" name="kmFinal" min="${jornada.kmInicial}" required></div>`,
        onSubmit: async (fd) => {
          await updateDocById("jornadas", jornada.id, { kmFinal: parseFloat(fd.get("kmFinal")) });
          toast("Kilometraje final registrado");
          openDetail(jornada.id);
        },
      });

      const cerrarBtn = det.querySelector("#btn-cerrar");
      if (cerrarBtn) cerrarBtn.onclick = async () => {
        if (jornada.kmFinal == null) return toast("Registra el kilometraje final antes de cerrar.");
        if (!deposito) return toast("Registra el depósito bancario (o márcalo pendiente) antes de cerrar.");
        if (!confirmDialog("¿Cerrar esta jornada? Ya no podrás editar sus registros.")) return;
        await updateDocById("jornadas", jornada.id, { estadoCierre: "cerrada" });
        toast("Jornada cerrada");
        render(root, ctx);
      };
    }
  }
}
