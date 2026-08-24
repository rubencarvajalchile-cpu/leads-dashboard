import assert from "node:assert/strict"
import test from "node:test"
import { canAgentTransition, canHumanMove, canReturnToAi } from "../lib/crm-model.ts"

test("la IA solo avanza dentro del funnel protegido", () => {
  assert.equal(canAgentTransition("AI_NEW", "AI_QUALIFYING", "AI"), true)
  assert.equal(canAgentTransition("AI_QUALIFIED", "AI_CALL_REQUESTED", "AI"), true)
  assert.equal(canAgentTransition("AI_NEW", "AI_CALL_REQUESTED", "AI"), false)
  assert.equal(canAgentTransition("AI_CALL_REQUESTED", "HUMAN_NEW", "AI"), false)
})

test("la IA no puede mover un lead tomado por un vendedor", () => {
  assert.equal(canAgentTransition("AI_QUALIFYING", "AI_QUALIFIED", "HUMAN"), false)
})

test("el vendedor solo mueve etapas después de la toma humana", () => {
  assert.equal(canHumanMove("HUMAN_NEW", "HUMAN_CONTACTING", "HUMAN"), true)
  assert.equal(canHumanMove("AI_CALL_REQUESTED", "HUMAN_NEW", "AI"), false)
  assert.equal(canHumanMove("AI_CALL_REQUESTED", "HUMAN_NEW", "HUMAN"), false)
})

test("un cierre es terminal y no vuelve silenciosamente al funnel", () => {
  assert.equal(canHumanMove("WON", "HUMAN_CONTACTING", "HUMAN"), false)
  assert.equal(canReturnToAi("WON", "HUMAN"), false)
  assert.equal(canReturnToAi("HUMAN_CONTACTING", "HUMAN"), true)
})

