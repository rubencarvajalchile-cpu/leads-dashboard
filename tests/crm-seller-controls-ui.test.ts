import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const board = readFileSync(new URL("../components/crm/dual-crm-board.tsx", import.meta.url), "utf8")
const workspace = readFileSync(new URL("../components/crm/lead-workspace-panel.tsx", import.meta.url), "utf8")
const legacyBoard = readFileSync(new URL("../components/crm/human-crm-board.tsx", import.meta.url), "utf8")

test("todos los leads humanos activos conservan selector y acceso a ficha", () => {
  assert.match(board, /lead\.authority === "HUMAN" && !terminal/)
  assert.match(board, /"Abrir ficha"/)
  assert.doesNotMatch(board, /!awaitingFirstContact && !terminal/)
})

test("el CRM no agrega accesos directos a WhatsApp", () => {
  for (const source of [board, workspace, legacyBoard]) {
    assert.doesNotMatch(source, /wa\.me|Abrir WhatsApp|> WhatsApp</)
  }
})

test("el tablero permite arrastrar y soltar leads con el mouse", () => {
  assert.match(board, /onMouseDown=/)
  assert.match(board, /onMouseEnter=/)
  assert.match(board, /onMouseUp=/)
  assert.match(board, /dropLead\(column\.key\)/)
  assert.match(board, /Arrastra una tarjeta a otra columna/)
})

test("la ficha muestra la información comercial capturada por Lucas", () => {
  assert.match(workspace, /Información comercial de Lucas/)
  assert.match(workspace, /Comuna/)
  assert.match(workspace, /Consumo mensual/)
  assert.match(workspace, /Es propietario/)
  assert.match(workspace, /Tipo de techo/)
  assert.match(workspace, /Acepta llamada/)
  assert.doesNotMatch(workspace, /Comuna, techo, consumo y conversación aún no se guardan/)
})
