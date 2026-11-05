import assert from "node:assert/strict"
import { test } from "node:test"

import {
  canClearStamp,
  canStampSlot,
  parseStamps,
  reconcileStamps,
  stampObjectPath,
  type SignatureStamp,
} from "../src/lib/documents/signature-stamps.ts"

const stamp = (overrides: Partial<SignatureStamp> = {}): SignatureStamp => ({
  imagePath: "document-signatures/invoice/abc/prepared.png",
  name: "Rahim",
  designation: "Engineer",
  signedByUserId: "u1",
  signedAt: "2026-11-05T00:00:00.000Z",
  ...overrides,
})

test("owner: authorized only", () => {
  assert.equal(canStampSlot("owner", "authorized"), true)
  assert.equal(canStampSlot("owner", "prepared"), false)
  assert.equal(canStampSlot("owner", "checked"), false)
})

test("staff/accountant/custom: prepared+checked only", () => {
  for (const role of ["staff", "accountant", "custom", "other"]) {
    assert.equal(canStampSlot(role, "prepared"), true)
    assert.equal(canStampSlot(role, "checked"), true)
    assert.equal(canStampSlot(role, "authorized"), false)
  }
})

test("clear: signer or owner", () => {
  assert.equal(canClearStamp({ role: "staff", isOwner: false, userId: "u1", stamp: stamp() }), true)
  assert.equal(canClearStamp({ role: "staff", isOwner: false, userId: "u2", stamp: stamp() }), false)
  assert.equal(canClearStamp({ role: "owner", isOwner: true, userId: "u9", stamp: stamp() }), true)
  assert.equal(canClearStamp({ role: "owner", isOwner: true, userId: "u9", stamp: undefined }), false)
})

test("parseStamps validates", () => {
  assert.deepEqual(Object.keys(parseStamps({ prepared: stamp(), checked: { name: 1 }, bogus: stamp() })), ["prepared"])
  assert.deepEqual(parseStamps({ prepared: stamp({ imagePath: "signatures/u1/current.png" }) }), {})
  assert.deepEqual(parseStamps({ prepared: stamp({ imagePath: "document-signatures/../x.png" }) }), {})
  assert.deepEqual(parseStamps(null), {})
})

test("reconcile drops renamed/off slots", () => {
  const stamps = {
    prepared: stamp(),
    checked: stamp({ name: "Karim" }),
    authorized: stamp({ name: "Boss" }),
  }
  assert.deepEqual(
    Object.keys(reconcileStamps(stamps, { prepared: "Rahim", checked: "X", authorized: "__off__" })),
    ["prepared"],
  )
})

test("path", () => {
  assert.equal(stampObjectPath("quotation", "abc", "authorized"), "document-signatures/quotation/abc/authorized.png")
})
