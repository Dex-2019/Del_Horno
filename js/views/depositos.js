import { listAll, listWhere, createDoc, updateDocById } from "../db.js";
import { openModal, toast, escapeHtml, fmtL, fmtDate } from "../utils.js";

function estadoDeposito(ventas, deposito) {
  if (!deposito) return { label: "🔴 Depósito pendiente", cls: "stamp-bad" };
  if (!deposito.depositado) return { label: "🔴 Depósito pendiente", cls: "stamp-bad" };
  if (Number(deposito.monto) === Number(ventas)) return { label: "✅ Depósito completo", cls: "stamp-ok" };
  if (Number(deposito.monto) < Number(ventas)) return { label: "⚠️ Depósito incompleto", cls: "stamp-warn" };
  return { label: "⚠️ Monto distinto a ventas", cls: "stamp-warn" };
}

export async function render(root, ctx) {
  const jornadas = await listAll("jornadas", "fecha");

  root.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Fecha</th><th>Ruta</th><th>Ventas</th><th>Depositado</th><th>Banco</th><th>Referencia</th><th>Estado</th>${ctx.isAdmin ? "<th></th>" : ""}</tr></thead>
        <tbody id="dep-body"><tr><td colspan="8"><div class="empty-state"><p>Cargando…</p></div></td></tr></tbody>
      </table>
    </div>`;

  const body = root.querySelector("#dep-body");

  if (!jornadas.length) {
    body.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="es-icon">▣</div><p>No hay jornadas registradas todavía.</p></div></td></tr>`;
    return;
  }

  const rowsData = await Promise.all(jornadas.map(async (j) => {
    const [ventas, depositosArr] = await Promise.all([
      listWhere("ventas", "jornadaId", "==", j.id),
      listWhere("depositos", "jornadaId", "==", j.id),
    ]);
    const totalVentas = ventas.reduce((s, v) => s + (+v.total || 0), 0);
    return { jornada: j, totalVentas, deposito: depositosArr[0] || null };
  }));

  body.innerHTML = rowsData.map(({ jornada, totalVentas, deposito }) => {
    const est = estadoDeposito(totalVentas, deposito);
    return `<tr>
      <td>${fmtDate(jornada.fecha)}</td>
      <td>${escapeHtml(jornada.rutaNombre || "—")}</td>
      <td class="num">${fmtL(totalVentas)}</td>
      <td class="num">${deposito && deposito.depositado ? fmtL(deposito.monto) : "—"}</td>
      <td>${escapeHtml(deposito?.banco || "—")}</td>
      <td class="mono">${escapeHtml(deposito?.referencia || "—")}</td>
      <td><span class="stamp ${est.cls}">${est.label.replace(/^\S+\s/, "")}</span></td>
      ${ctx.isAdmin ? `<td><button class="icon-btn" data-reg="${jornada.id}">${deposito ? "Editar" : "Registrar"}</button></td>` : ""}
    </tr>`;
  }).join("");

  if (!ctx.isAdmin) return;

  body.querySelectorAll("[data-reg]").forEach((b) => {
    b.onclick = () => {
      const row = rowsData.find((r) => r.jornada.id === b.dataset.reg);
      openForm(row.jornada, row.totalVentas, row.deposito);
    };
  });

  function openForm(jornada, totalVentas, existing) {
    openModal({
      title: `Depósito — ${fmtDate(jornada.fecha)} (Ventas: ${fmtL(totalVentas)})`,
      submitLabel: "Guardar",
      bodyHtml: `
        <div class="field"><label>¿Fue depositada la venta?</label>
          <select name="depositado" id="sel-dep">
            <option value="si" ${existing?.depositado ? "selected" : ""}>Sí</option>
            <option value="no" ${existing && !existing.depositado ? "selected" : ""}>No</option>
          </select>
        </div>
        <div id="dep-si-fields">
          <div class="form-row">
            <div class="field"><label>Monto depositado (L)</label><input type="number" step="0.01" name="monto" value="${existing?.monto ?? totalVentas}"></div>
            <div class="field"><label>Banco</label><input name="banco" value="${existing ? escapeHtml(existing.banco || "") : ""}"></div>
          </div>
          <div class="form-row">
            <div class="field"><label>Fecha del depósito</label><input type="date" name="fechaDeposito" value="${existing?.fechaDeposito || jornada.fecha}"></div>
            <div class="field"><label>N.º de referencia</label><input name="referencia" value="${existing ? escapeHtml(existing.referencia || "") : ""}"></div>
          </div>
        </div>
        <div id="dep-no-fields" class="hidden">
          <div class="field"><label>Motivo</label><input name="motivo" value="${existing ? escapeHtml(existing.motivo || "") : ""}"></div>
        </div>
        <div class="field"><label>Observación</label><textarea name="observacion" rows="2">${existing ? escapeHtml(existing.observacion || "") : ""}</textarea></div>
      `,
      onSubmit: async (fd) => {
        const depositado = fd.get("depositado") === "si";
        if (depositado && !fd.get("referencia").trim()) {
          throw new Error("El número de referencia es obligatorio cuando el depósito fue realizado.");
        }
        const data = {
          jornadaId: jornada.id,
          fecha: jornada.fecha,
          depositado,
          monto: depositado ? parseFloat(fd.get("monto")) || 0 : 0,
          banco: depositado ? fd.get("banco").trim() : "",
          fechaDeposito: depositado ? fd.get("fechaDeposito") : "",
          referencia: depositado ? fd.get("referencia").trim() : "",
          motivo: !depositado ? fd.get("motivo").trim() : "",
          observacion: fd.get("observacion").trim(),
        };
        if (existing) await updateDocById("depositos", existing.id, data);
        else await createDoc("depositos", data);
        toast("Depósito guardado");
        render(root, ctx);
      },
    });

    const overlay = document.getElementById("modal-overlay");
    const selDep = overlay.querySelector("#sel-dep");
    const fieldsSi = overlay.querySelector("#dep-si-fields");
    const fieldsNo = overlay.querySelector("#dep-no-fields");
    const toggle = () => {
      const si = selDep.value === "si";
      fieldsSi.classList.toggle("hidden", !si);
      fieldsNo.classList.toggle("hidden", si);
    };
    selDep.addEventListener("change", toggle);
    toggle();
  }
}
