import { listAll, listWhere } from "../db.js";
import { fmtL, fmtDate, todayISO, escapeHtml } from "../utils.js";

export async function render(root, ctx) {
  const jornadas = await listAll("jornadas", "fecha");
  const hoy = jornadas.find((j) => j.fecha === todayISO()) || jornadas[0];

  if (!hoy) {
    root.innerHTML = `<div class="empty-state"><div class="es-icon">◆</div><p>Todavía no hay jornadas registradas. Abre la primera en "Jornada del día".</p></div>`;
    return;
  }

  const [movs, ventas, gastos, depositos] = await Promise.all([
    listWhere("inventarioMovimientos", "jornadaId", "==", hoy.id),
    listWhere("ventas", "jornadaId", "==", hoy.id),
    listWhere("gastos", "jornadaId", "==", hoy.id),
    listWhere("depositos", "jornadaId", "==", hoy.id),
  ]);

  const cargado = movs.reduce((s, m) => s + (+m.cargado || 0), 0);
  const vendido = movs.reduce((s, m) => s + (+m.vendido || 0), 0);
  const devuelto = movs.reduce((s, m) => s + (+m.devuelto || 0), 0);
  const totalVentas = ventas.reduce((s, v) => s + (+v.total || 0), 0);
  const totalGastos = gastos.reduce((s, g) => s + (+g.monto || 0), 0);
  const resultado = totalVentas - totalGastos;
  const deposito = depositos[0];

  const estadoDep = !deposito
    ? { t: "Pendiente", c: "stamp-bad" }
    : !deposito.depositado
    ? { t: "Pendiente", c: "stamp-bad" }
    : Number(deposito.monto) === totalVentas
    ? { t: "Completo", c: "stamp-ok" }
    : { t: "Incompleto", c: "stamp-warn" };

  root.innerHTML = `
    ${hoy.fecha !== todayISO() ? `<div class="alert alert-warn">Mostrando la jornada más reciente registrada (${fmtDate(hoy.fecha)}) — hoy no se ha abierto ninguna.</div>` : ""}
    <div class="card" style="margin-bottom:20px;">
      <div class="section-head" style="margin-bottom:4px;">
        <h3 style="margin:0;">${fmtDate(hoy.fecha)} · ${escapeHtml(hoy.diaSemana || "")}</h3>
        <span class="stamp ${hoy.estadoCierre === "cerrada" ? "stamp-ok" : "stamp-warn"}">${hoy.estadoCierre === "cerrada" ? "Cerrada" : "Abierta"}</span>
      </div>
      <div class="muted" style="font-size:13.5px;">Ruta: <strong>${escapeHtml(hoy.rutaNombre || "—")}</strong> · Vehículo: <strong>${escapeHtml(hoy.vehiculoNombre || "—")}</strong></div>
    </div>

    <div class="grid grid-4" style="margin-bottom:18px;">
      <div class="stat"><div class="label">Producto cargado</div><div class="value">${cargado}</div></div>
      <div class="stat"><div class="label">Producto vendido</div><div class="value">${vendido}</div></div>
      <div class="stat"><div class="label">Devoluciones</div><div class="value">${devuelto}</div></div>
      <div class="stat"><div class="label">Estado depósito</div><div class="value"><span class="stamp ${estadoDep.c}">${estadoDep.t}</span></div></div>
    </div>

    <div class="grid grid-3">
      <div class="stat"><div class="label">Ventas del día</div><div class="value pos">${fmtL(totalVentas)}</div></div>
      <div class="stat"><div class="label">Gastos del día</div><div class="value neg">${fmtL(totalGastos)}</div></div>
      <div class="stat"><div class="label">Resultado operativo</div><div class="value ${resultado >= 0 ? "pos" : "neg"}">${fmtL(resultado)}</div></div>
    </div>`;
}
