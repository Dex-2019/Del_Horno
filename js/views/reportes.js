import { listAll } from "../db.js";
import { fmtL, fmtDate, escapeHtml } from "../utils.js";

const TABS = [
  { id: "ventas", label: "Ventas" },
  { id: "inventario", label: "Inventario" },
  { id: "gastos", label: "Gastos" },
  { id: "vehiculo", label: "Vehículo" },
  { id: "banco", label: "Banco" },
];

export async function render(root, ctx) {
  const [jornadas, rutas, ventas, gastos, movs, combustible, mantenimientos, depositos] = await Promise.all([
    listAll("jornadas"), listAll("rutas"), listAll("ventas"), listAll("gastos"),
    listAll("inventarioMovimientos"), listAll("combustible"), listAll("mantenimientos"), listAll("depositos"),
  ]);

  root.innerHTML = `
    <div class="filters">
      <input type="date" id="f-desde" title="Desde">
      <input type="date" id="f-hasta" title="Hasta">
      <select id="f-ruta"><option value="">Todas las rutas</option>${rutas.map((r) => `<option value="${r.id}">${escapeHtml(r.nombre)}</option>`).join("")}</select>
    </div>
    <div class="nav" style="display:flex; padding:0; margin-bottom:18px; gap:4px; flex-wrap:wrap;">
      ${TABS.map((t, i) => `<div class="nav-item tab-btn ${i === 0 ? "active" : ""}" style="border-radius:999px;" data-tab="${t.id}">${t.label}</div>`).join("")}
    </div>
    <div id="rep-body"></div>`;

  const desde = root.querySelector("#f-desde");
  const hasta = root.querySelector("#f-hasta");
  const fRuta = root.querySelector("#f-ruta");
  let activeTab = "ventas";

  [desde, hasta, fRuta].forEach((el) => el.addEventListener("change", draw));
  root.querySelectorAll(".tab-btn").forEach((b) => b.addEventListener("click", () => {
    activeTab = b.dataset.tab;
    root.querySelectorAll(".tab-btn").forEach((x) => x.classList.toggle("active", x === b));
    draw();
  }));

  function filterJornadaIds() {
    return jornadas.filter((j) => {
      if (desde.value && j.fecha < desde.value) return false;
      if (hasta.value && j.fecha > hasta.value) return false;
      if (fRuta.value && j.rutaId !== fRuta.value) return false;
      return true;
    }).map((j) => j.id);
  }

  function draw() {
    const ids = new Set(filterJornadaIds());
    const box = root.querySelector("#rep-body");

    if (activeTab === "ventas") {
      const rows = ventas.filter((v) => ids.has(v.jornadaId));
      const total = rows.reduce((s, v) => s + (+v.total || 0), 0);
      const porProducto = groupSum(rows, "productoNombre", "total");
      const porRuta = groupSum(rows, "rutaNombre", "total");
      box.innerHTML = statRow([["Ventas totales", fmtL(total), "pos"]]) +
        twoCol(
          tableSimple("Por producto", ["Producto", "Total"], porProducto.map(([k, v]) => [escapeHtml(k), fmtL(v)])),
          tableSimple("Por ruta", ["Ruta", "Total"], porRuta.map(([k, v]) => [escapeHtml(k), fmtL(v)]))
        );
    }

    if (activeTab === "inventario") {
      const rows = movs.filter((m) => ids.has(m.jornadaId));
      const cargado = sum(rows, "cargado"), vendido = sum(rows, "vendido"), devuelto = sum(rows, "devuelto");
      const diff = cargado - vendido - devuelto;
      box.innerHTML = statRow([
        ["Cargado", cargado], ["Vendido", vendido], ["Devuelto", devuelto], ["Diferencia total", diff, diff === 0 ? "pos" : "neg"],
      ]);
    }

    if (activeTab === "gastos") {
      const rows = gastos.filter((g) => ids.has(g.jornadaId));
      const total = sum(rows, "monto");
      const porCat = groupSum(rows, "categoria", "monto");
      box.innerHTML = statRow([["Gastos totales", fmtL(total), "neg"]]) +
        tableSimple("Por categoría", ["Categoría", "Total"], porCat.map(([k, v]) => [escapeHtml(k), fmtL(v)]));
    }

    if (activeTab === "vehiculo") {
      const jr = jornadas.filter((j) => ids.has(j.id) && j.kmFinal != null);
      const km = jr.reduce((s, j) => s + (j.kmFinal - j.kmInicial), 0);
      const totalComb = sum(combustible.filter((c) => !desde.value && !hasta.value ? true : (c.fecha >= (desde.value || "0000") && c.fecha <= (hasta.value || "9999"))), "total");
      const totalMant = sum(mantenimientos.filter((m) => !desde.value && !hasta.value ? true : (m.fecha >= (desde.value || "0000") && m.fecha <= (hasta.value || "9999"))), "costo");
      box.innerHTML = statRow([
        ["Km recorridos (jornadas filtradas)", km], ["Combustible", fmtL(totalComb), "neg"], ["Mantenimiento / reparaciones", fmtL(totalMant), "neg"],
      ]);
    }

    if (activeTab === "banco") {
      const rows = depositos.filter((d) => ids.has(d.jornadaId));
      const depositadas = rows.filter((d) => d.depositado);
      const pendientes = jornadas.filter((j) => ids.has(j.id) && !rows.find((d) => d.jornadaId === j.id && d.depositado));
      const totalDep = sum(depositadas, "monto");
      const totalVentasFiltradas = sum(ventas.filter((v) => ids.has(v.jornadaId)), "total");
      box.innerHTML = statRow([
        ["Ventas del período", fmtL(totalVentasFiltradas), "pos"],
        ["Depositado", fmtL(totalDep), "pos"],
        ["Diferencia", fmtL(totalVentasFiltradas - totalDep), totalVentasFiltradas - totalDep === 0 ? "pos" : "warn"],
        ["Jornadas con depósito pendiente", pendientes.length, pendientes.length ? "warn" : "pos"],
      ]);
    }
  }

  draw();

  function sum(arr, field) { return arr.reduce((s, x) => s + (Number(x[field]) || 0), 0); }
  function groupSum(arr, keyField, valField) {
    const map = {};
    arr.forEach((x) => { const k = x[keyField] || "—"; map[k] = (map[k] || 0) + (Number(x[valField]) || 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }
  function statRow(items) {
    return `<div class="grid grid-4" style="margin-bottom:18px;">${items.map(([label, val, cls]) => `
      <div class="stat"><div class="label">${escapeHtml(label)}</div><div class="value ${cls || ""}">${val}</div></div>`).join("")}</div>`;
  }
  function tableSimple(title, headers, rows) {
    return `<div class="card">
      <h3>${escapeHtml(title)}</h3>
      <div class="table-wrap" style="border:none;">
        <table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
        <tbody>${rows.length ? rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}" class="muted">Sin datos</td></tr>`}</tbody></table>
      </div></div>`;
  }
  function twoCol(a, b) { return `<div class="grid grid-2">${a}${b}</div>`; }
}
