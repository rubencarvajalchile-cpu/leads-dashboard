import assert from "node:assert/strict"
import test from "node:test"
import { columnsForBoard, defaultCrmBoardColumns, leadColumnKey, SALES_MOVE_TARGETS, salesSelectValue } from "../lib/crm-board-model.ts"
import type { CrmLeadDTO } from "../lib/crm-model.ts"

function lead(stage: CrmLeadDTO["stage"], authority: CrmLeadDTO["authority"]): CrmLeadDTO {
  return { id: `${authority}-${stage}`, contactName: "Lead", phoneE164: null, authority, stage,
    productInterest: null, priority: "P3", assignedTo: null, updatedAt: "2026-08-25T12:00:00.000Z" }
}

test("expone tres columnas Lucas y cinco Ventas", () => {
  const columns = defaultCrmBoardColumns()
  assert.equal(columnsForBoard(columns, "LUCAS").length, 3)
  assert.equal(columnsForBoard(columns, "SALES").length, 5)
})

test("agrupa etapas sin perder semántica", () => {
  assert.equal(leadColumnKey(lead("AI_QUALIFIED", "AI"), "LUCAS"), "LUCAS_QUALIFYING")
  assert.equal(leadColumnKey(lead("HUMAN_NEGOTIATION", "HUMAN"), "SALES"), "SALES_MANAGING")
  assert.equal(leadColumnKey(lead("DO_NOT_CONTACT", "HUMAN"), "SALES"), "SALES_LOST")
})

test("la solicitud de llamada es la misma ficha visible en ambos tableros", () => {
  const ready = lead("AI_CALL_REQUESTED", "AI")
  assert.equal(leadColumnKey(ready, "LUCAS"), "LUCAS_READY")
  assert.equal(leadColumnKey(ready, "SALES"), "SALES_INBOX")
})

test("lead entrante de Ventas es espejo exacto de listo para llamada", () => {
  assert.equal(leadColumnKey(lead("AI_CALL_REQUESTED", "AI"), "SALES"), "SALES_INBOX")
  assert.equal(leadColumnKey(lead("HUMAN_NEW", "HUMAN"), "SALES"), "SALES_CONTACTED")
  assert.equal(leadColumnKey(lead("HUMAN_CONTACTING", "HUMAN"), "SALES"), "SALES_CONTACTED")
})

test("un lead ya tomado no puede volver a la cola compartida", () => {
  assert.equal(salesSelectValue(lead("HUMAN_NEW", "HUMAN")), "HUMAN_CONTACTING")
  assert.equal(SALES_MOVE_TARGETS.some((target) => target.stage === "HUMAN_NEW"), false)
})

test("un lead humano no vuelve a Lucas", () => {
  assert.equal(leadColumnKey(lead("HUMAN_NEW", "HUMAN"), "LUCAS"), null)
})
