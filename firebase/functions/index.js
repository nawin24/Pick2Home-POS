/**
 * pick2home-pos — Cloud Functions
 * Region: asia-south1 (Mumbai)
 * Project: pick2home-1
 *
 * Add POS-specific server-side logic here.
 * (Shared app functions live in C:\pick2home\functions\index.js)
 */

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

// ── Global region: Mumbai ──────────────────────────────────────────────────
setGlobalOptions({ region: "asia-south1" });

// ── Init Admin SDK ─────────────────────────────────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// ══════════════════════════════════════════════════════════════════════════
// 1. POS BILL CREATED → update inventory & daily sales summary
// ══════════════════════════════════════════════════════════════════════════
exports.onPosBillCreated = onDocumentCreated(
  "pos_bills/{billId}",
  async (event) => {
    const bill = event.data.data();
    if (!bill) return;

    const { items = [], totalAmount = 0, createdAt } = bill;
    const batch = db.batch();

    // Deduct inventory for each item sold at POS
    for (const item of items) {
      const invRef = db.collection("store_inventory").doc(item.productId);
      batch.update(invRef, {
        quantity: admin.firestore.FieldValue.increment(-item.quantity),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Update daily sales summary
    const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const summaryRef = db.collection("pos_daily_summary").doc(dateStr);
    batch.set(
      summaryRef,
      {
        date: dateStr,
        totalRevenue: admin.firestore.FieldValue.increment(totalAmount),
        totalBills: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await batch.commit();
    console.log(`POS bill ${event.params.billId} processed — ₹${totalAmount}`);
  }
);

// ══════════════════════════════════════════════════════════════════════════
// 2. GET DAILY SALES SUMMARY (callable)
// ══════════════════════════════════════════════════════════════════════════
exports.getPosDailySummary = onCall(async (request) => {
  // Only POS staff or admins can call this
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");

  const { date } = request.data; // "YYYY-MM-DD" or null for today
  const dateStr = date || new Date().toISOString().slice(0, 10);

  const doc = await db.collection("pos_daily_summary").doc(dateStr).get();
  return doc.exists ? doc.data() : { date: dateStr, totalRevenue: 0, totalBills: 0 };
});

// ══════════════════════════════════════════════════════════════════════════
// 3. CLOSE POS SESSION (callable)
// ══════════════════════════════════════════════════════════════════════════
exports.closePosSession = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");

  const { sessionId, closingCash } = request.data;
  if (!sessionId) throw new HttpsError("invalid-argument", "sessionId is required.");

  const sessionRef = db.collection("pos_sessions").doc(sessionId);
  const session = await sessionRef.get();
  if (!session.exists) throw new HttpsError("not-found", "Session not found.");
  if (session.data().staffId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "You can only close your own session.");
  }

  await sessionRef.update({
    status: "closed",
    closedAt: admin.firestore.FieldValue.serverTimestamp(),
    closingCash: closingCash || 0,
  });

  return { success: true, sessionId };
});

// ══════════════════════════════════════════════════════════════════════════
// 4. LOW STOCK ALERT — triggers when inventory drops below threshold
// ══════════════════════════════════════════════════════════════════════════
exports.checkLowStock = onDocumentUpdated(
  "store_inventory/{productId}",
  async (event) => {
    const after = event.data.after.data();
    const before = event.data.before.data();
    if (!after) return;

    const LOW_STOCK_THRESHOLD = after.lowStockThreshold || 5;
    const wasOk = (before.quantity || 0) > LOW_STOCK_THRESHOLD;
    const isLow = (after.quantity || 0) <= LOW_STOCK_THRESHOLD;

    if (wasOk && isLow) {
      await db.collection("admin_notifications").add({
        type: "low_stock",
        productId: event.params.productId,
        productName: after.productName || "Unknown",
        currentStock: after.quantity,
        threshold: LOW_STOCK_THRESHOLD,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
      });
      console.log(`Low stock alert: ${after.productName} — ${after.quantity} left`);
    }
  }
);
