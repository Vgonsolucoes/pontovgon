import { test } from "node:test";
import assert from "node:assert/strict";
import { confirmedEnrollment, positiveDeviceUserId, supportsFaceSync, enrollmentMetadata } from "../server/lib/face-sync";
import { facePhoto, photoAudit } from "../server/lib/face-photo";
test("photos accept only bounded embedded JPG/PNG; audit excludes image bytes", () => {
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const image = "data:image/png;base64," + bytes.toString("base64");
  assert.equal(facePhoto(image).hash.length, 64);
  assert.deepEqual(photoAudit({ name: "isolated", photoUrl: image }), { name: "isolated", hasPhoto: true });
  for (const invalid of ["https://example.invalid/photo.jpg", "data:image/svg+xml;base64,PHN2Zy8+", "data:image/jpeg;base64," + bytes.toString("base64"), image + "x", "data:image/png;base64," + Buffer.alloc(1100000).toString("base64")]) assert.throws(() => facePhoto(invalid));
});
test("face enrollment gates the agent version and validates identity, device, image and confirmation", () => {
  for (const version of [null, "1.0.3", "0.9.9", "invalid"]) assert.equal(supportsFaceSync(version), false);
  for (const version of ["1.0.4", "1.0.10", "1.1.0", "2.0.0"]) assert.equal(supportsFaceSync(version), true);
  const payload = { employeeId: "employee", deviceUniqueId: "device", deviceSerialNumber: "SERIAL", registration: "001", expectedUserId: 1, imageHash: "hash" };
  const result = { ...payload, userId: 1, userConfirmed: true, photoRegistered: true };
  assert.equal(confirmedEnrollment(payload, result, true), true);
  for (const change of [{ photoRegistered: false }, { userId: 2 }, { registration: "002" }, { deviceUniqueId: "other" }, { imageHash: "other" }, { employeeId: "other" }]) assert.equal(confirmedEnrollment(payload, { ...result, ...change }, true), false);
  assert.equal(confirmedEnrollment(payload, { ...result, photoRegistered: false }, false), true);
  assert.equal(confirmedEnrollment({}, result, true), false);
  assert.deepEqual(enrollmentMetadata({ ...payload, imageBase64: "private-image" }), payload);
  assert.equal(positiveDeviceUserId("123"), 123); assert.equal(positiveDeviceUserId(null), null);
  for (const invalid of ["0", "1.2", "-1", "9007199254740992"]) assert.throws(() => positiveDeviceUserId(invalid));
});
