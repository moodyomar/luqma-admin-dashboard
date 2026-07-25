/**
 * Lucky Wheel spin — server-authoritative.
 * Deploy with admin-dashboard/functions (Luqma SOT).
 *
 * Client: httpsCallable(functions, 'spinLuckyWheel')({ businessId })
 *
 * Flow:
 * 1. Auth required
 * 2. Load config.luckyWheel + user points + lastSpinAt
 * 3. Validate eligibility
 * 4. Transaction: deduct points, weighted pick (respect maxWins), write spin + prize
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { adminSpaCallableOpts } from "./adminSpaCallableOptions";

const SEGMENT_TYPES = {
  NONE: "none",
  POINTS: "points",
  PERCENT_OFF: "percent_off",
  FIXED_OFF: "fixed_off",
  FREE_ITEM: "free_item",
} as const;

type SegmentType = (typeof SEGMENT_TYPES)[keyof typeof SEGMENT_TYPES];

interface WheelSegment {
  id: string;
  type: SegmentType;
  weight: number;
  label?: { ar?: string; he?: string } | string;
  maxWins?: number;
  points?: number;
  discountValue?: number;
  maxDiscountAmount?: number;
  itemId?: string;
  categoryId?: string;
  itemName?: string;
  itemPrice?: number;
}

interface LuckyWheelConfig {
  enabled: boolean;
  spinCostPoints: number;
  cooldownHours: number;
  prizeExpiryDays: number;
  segments: WheelSegment[];
}

const DEFAULT_CONFIG: LuckyWheelConfig = {
  enabled: false,
  spinCostPoints: 10,
  cooldownHours: 24,
  prizeExpiryDays: 14,
  segments: [],
};

function normalizeConfig(raw: Record<string, unknown> | undefined): LuckyWheelConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_CONFIG };
  const segmentsIn = Array.isArray(raw.segments) ? raw.segments : [];
  const segments: WheelSegment[] = segmentsIn
    .map((s: any, index: number) => {
      const type = Object.values(SEGMENT_TYPES).includes(s?.type) ? s.type : SEGMENT_TYPES.NONE;
      const weight = Math.max(0, Number(s?.weight) || 0);
      if (weight <= 0) return null;
      const seg: WheelSegment = {
        id: typeof s?.id === "string" && s.id.trim() ? s.id.trim() : `seg_${index}_${type}`,
        type,
        weight,
        label: s?.label,
      };
      if (s?.maxWins != null && Number(s.maxWins) > 0) {
        seg.maxWins = Math.floor(Number(s.maxWins));
      }
      if (type === SEGMENT_TYPES.POINTS) {
        seg.points = Math.max(0, Number(s.points) || 0);
      }
      if (type === SEGMENT_TYPES.PERCENT_OFF) {
        seg.discountValue = Math.min(100, Math.max(0, Number(s.discountValue) || 0));
        if (s.maxDiscountAmount != null && Number(s.maxDiscountAmount) > 0) {
          seg.maxDiscountAmount = Number(s.maxDiscountAmount);
        }
      }
      if (type === SEGMENT_TYPES.FIXED_OFF) {
        seg.discountValue = Math.max(0, Number(s.discountValue) || 0);
      }
      if (type === SEGMENT_TYPES.FREE_ITEM) {
        seg.itemId = typeof s.itemId === "string" ? s.itemId : "";
        seg.categoryId = typeof s.categoryId === "string" ? s.categoryId : "";
        seg.itemName = typeof s.itemName === "string" ? s.itemName : "";
        seg.itemPrice = Math.max(0, Number(s.itemPrice) || 0);
      }
      return seg;
    })
    .filter(Boolean) as WheelSegment[];

  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : false,
    spinCostPoints: Math.max(0, Math.floor(Number(raw.spinCostPoints) || 10)),
    cooldownHours: Math.max(0, Number(raw.cooldownHours) >= 0 ? Number(raw.cooldownHours) : 24),
    // Fractional days OK (2 = 48h). Floor was dropping useful values.
    prizeExpiryDays: Math.max(
      0.5,
      Number(raw.prizeExpiryDays) > 0 ? Number(raw.prizeExpiryDays) : 14
    ),
    segments,
  };
}

function pickWeighted(segments: WheelSegment[]): WheelSegment | null {
  const total = segments.reduce((s, x) => s + x.weight, 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const seg of segments) {
    r -= seg.weight;
    if (r <= 0) return seg;
  }
  return segments[segments.length - 1] || null;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as admin.firestore.Timestamp).toDate === "function") {
    return (value as admin.firestore.Timestamp).toDate();
  }
  const d = new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}

function couponCodeFor(uid: string): string {
  const short = uid.slice(0, 6).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `WHEEL-${short}-${rand}`;
}

export const spinLuckyWheel = onCall(adminSpaCallableOpts, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Must be signed in to spin.");
  }

  const uid = request.auth.uid;
  const businessId =
    typeof request.data?.businessId === "string" ? request.data.businessId.trim() : "";
  if (!businessId) {
    throw new HttpsError("invalid-argument", "businessId is required.");
  }

  const db = admin.firestore();
  const menuRef = db.collection("menus").doc(businessId);
  const userRef = db.collection("users").doc(uid);

  const menuSnap = await menuRef.get();
  if (!menuSnap.exists) {
    throw new HttpsError("not-found", "Business menu not found.");
  }

  const config = normalizeConfig(menuSnap.data()?.config?.luckyWheel);
  if (!config.enabled) {
    throw new HttpsError("failed-precondition", "Lucky wheel is disabled.");
  }
  if (config.segments.length < 2) {
    throw new HttpsError("failed-precondition", "Lucky wheel is not configured.");
  }

  const result = await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }
    const userData = userSnap.data() || {};
    const points = Number(userData.points) || 0;
    if (points < config.spinCostPoints) {
      throw new HttpsError(
        "failed-precondition",
        `Need ${config.spinCostPoints} points (have ${points}).`
      );
    }

    const lastSpinAt = toDate(userData.lastLuckyWheelSpinAt);
    const now = new Date();
    if (config.cooldownHours > 0 && lastSpinAt) {
      const next = new Date(lastSpinAt.getTime() + config.cooldownHours * 60 * 60 * 1000);
      if (now < next) {
        throw new HttpsError(
          "resource-exhausted",
          `Cooldown until ${next.toISOString()}`,
          { nextSpinAt: next.toISOString() }
        );
      }
    }

    // Load segment win stats for maxWins filtering
    const eligible: WheelSegment[] = [];
    for (const seg of config.segments) {
      if (seg.maxWins == null) {
        eligible.push(seg);
        continue;
      }
      const statsRef = menuRef.collection("wheelSegmentStats").doc(seg.id);
      const statsSnap = await tx.get(statsRef);
      const winCount = Number(statsSnap.data()?.winCount) || 0;
      if (winCount < seg.maxWins) {
        eligible.push(seg);
      }
    }

    if (eligible.length === 0) {
      throw new HttpsError("failed-precondition", "No prizes available right now.");
    }

    const won = pickWeighted(eligible);
    if (!won) {
      throw new HttpsError("internal", "Failed to pick segment.");
    }

    const spinRef = userRef.collection("wheelSpins").doc();
    const costPoints = config.spinCostPoints;
    const newPoints = points - costPoints;

    let pointsAwarded = 0;
    let couponId: string | null = null;
    let couponCode: string | null = null;
    let prizeSummary: Record<string, unknown> = { type: won.type };

    // Deduct spin cost
    tx.update(userRef, {
      points: newPoints,
      lastPointsUpdate: admin.firestore.FieldValue.serverTimestamp(),
      lastLuckyWheelSpinAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Grant prize
    if (won.type === SEGMENT_TYPES.POINTS && (won.points || 0) > 0) {
      pointsAwarded = won.points || 0;
      tx.update(userRef, {
        points: newPoints + pointsAwarded,
      });
      prizeSummary = { type: won.type, points: pointsAwarded };
    }

    if (
      won.type === SEGMENT_TYPES.PERCENT_OFF ||
      won.type === SEGMENT_TYPES.FIXED_OFF ||
      won.type === SEGMENT_TYPES.FREE_ITEM
    ) {
      const expiry = new Date(
        Date.now() + config.prizeExpiryDays * 24 * 60 * 60 * 1000
      );
      couponCode = couponCodeFor(uid);
      const couponRef = menuRef.collection("coupons").doc();
      couponId = couponRef.id;

      const discountType =
        won.type === SEGMENT_TYPES.PERCENT_OFF
          ? "percentage"
          : "fixed_amount";
      let discountValue = Number(won.discountValue) || 0;
      if (won.type === SEGMENT_TYPES.FREE_ITEM) {
        discountValue = Number(won.itemPrice) || 0;
      }

      const couponData: Record<string, unknown> = {
        code: couponCode,
        discountType,
        discountValue,
        minimumOrder: 0,
        isActive: true,
        expiryDate: admin.firestore.Timestamp.fromDate(expiry),
        usageCount: 0,
        maxUsage: 1,
        maxUsagePerUser: 1,
        description:
          won.type === SEGMENT_TYPES.FREE_ITEM
            ? `Lucky wheel: ${won.itemName || won.itemId || "free item"}`
            : `Lucky wheel prize`,
        source: "lucky_wheel",
        assignedUserId: uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (won.type === SEGMENT_TYPES.PERCENT_OFF && won.maxDiscountAmount) {
        couponData.maxDiscountAmount = won.maxDiscountAmount;
      }
      if (won.type === SEGMENT_TYPES.FREE_ITEM) {
        couponData.freeItemId = won.itemId || null;
        couponData.freeItemName = won.itemName || null;
        couponData.freeItemCategoryId = won.categoryId || null;
        couponData.prizeType = "free_item";
      }

      tx.set(couponRef, couponData);
      prizeSummary = {
        type: won.type,
        couponId,
        couponCode,
        discountType,
        discountValue,
        freeItemId: won.itemId || null,
        freeItemName: won.itemName || null,
        freeItemCategoryId: won.categoryId || null,
        expiresAt: expiry.toISOString(),
      };
    }

    if (won.maxWins != null) {
      const statsRef = menuRef.collection("wheelSegmentStats").doc(won.id);
      tx.set(
        statsRef,
        {
          segmentId: won.id,
          winCount: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    const cooldownUntil =
      config.cooldownHours > 0
        ? new Date(now.getTime() + config.cooldownHours * 60 * 60 * 1000)
        : null;

    tx.set(spinRef, {
      brandId: businessId,
      segmentId: won.id,
      type: won.type,
      label: won.label || null,
      costPoints,
      pointsBefore: points,
      pointsAfter: newPoints + pointsAwarded,
      pointsAwarded,
      couponId,
      couponCode,
      prize: prizeSummary,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      cooldownUntil: cooldownUntil
        ? admin.firestore.Timestamp.fromDate(cooldownUntil)
        : null,
    });

    return {
      spinId: spinRef.id,
      segmentId: won.id,
      type: won.type,
      label: won.label || null,
      costPoints,
      pointsRemaining: newPoints + pointsAwarded,
      pointsAwarded,
      couponId,
      couponCode,
      prize: prizeSummary,
      cooldownUntil: cooldownUntil?.toISOString() || null,
      segments: config.segments.map((s) => ({
        id: s.id,
        type: s.type,
        weight: s.weight,
        label: s.label || null,
      })),
    };
  });

  logger.info(`[spinLuckyWheel] uid=${uid} business=${businessId} segment=${result.segmentId} type=${result.type}`);
  return result;
});
