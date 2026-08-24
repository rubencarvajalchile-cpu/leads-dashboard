import assert from "node:assert/strict"
import test from "node:test"
import { resolveCrmEnabled } from "../lib/crm-config.ts"

test("el CRM queda activo después de instalar la base", () => {
  assert.equal(resolveCrmEnabled(undefined), true)
  assert.equal(resolveCrmEnabled("true"), true)
})

test("existe un apagado explícito para rollback operativo", () => {
  assert.equal(resolveCrmEnabled("false"), false)
  assert.equal(resolveCrmEnabled(" FALSE "), false)
})
