import * as admin from "firebase-admin";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";

/**
 * Single source of truth for customer (menu / marketplace) Expo push delivery.
 * Kept in parity with menu-app/functions/index.js sendNotificationToUser + sendPushNotifications.
 *
 * - Phone lookup tries multiple normalizations (orders vs users/{id}.phone).
 * - Uses Expo tokens only; excludes appType === "driver".
 * - Includes any other appType (e.g. future Jeeb) — only drivers are excluded.
 * - Batches by expoExperienceId when set, else one request per token, to avoid
 *   Expo PUSH_TOO_MANY_EXPERIENCE_IDS when one user has Luqma + Refresh tokens.
 */

export type LocalizedPushContent = {
  ar: { title: string; body: string };
  he: { title: string; body: string };
};

export function buildPhoneLookupVariants(rawPhone: string): string[] {
  const raw = String(rawPhone).trim();
  const normalizeForLookup = (p: string): string => {
    const s = String(p).replace(/\s+/g, "").replace(/-/g, "");
    if (s.startsWith("+")) return s;
    if (s.startsWith("972") && s.length >= 9) return "+" + s;
    if (s.startsWith("0") && s.length === 10) return "+972" + s.slice(1);
    if (s.length === 9 && /^\d+$/.test(s)) return "+972" + s;
    return s;
  };
  const normalized = normalizeForLookup(raw);
  const variants: string[] = [raw, normalized];
  if (normalized.startsWith("+")) variants.push(normalized.slice(1));
  if (raw !== normalized) variants.push(normalized);
  const seen = new Set<string>();
  return variants.filter((p) => {
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });
}

export async function findUserDocByPhone(
  phone: string | undefined | null
): Promise<QueryDocumentSnapshot | null> {
  if (!phone || String(phone).trim() === "") {
    console.log("No phone provided for customer push lookup");
    return null;
  }
  const variants = buildPhoneLookupVariants(phone);
  for (const tryPhone of variants) {
    const snap = await admin
      .firestore()
      .collection("users")
      .where("phone", "==", tryPhone)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0];
  }
  console.log(
    "No user found with phone:",
    phone,
    "(tried variants:",
    variants.join(", "),
    ")"
  );
  return null;
}

function isExpoToken(token: string): boolean {
  return (
    token.startsWith("ExponentPushToken") || token.startsWith("Expo")
  );
}

type PushTokenObj = {
  token: string;
  active?: boolean;
  appType?: string;
  expoExperienceId?: string | number | null;
};

async function sendExpoPushChunks(messages: Record<string, unknown>[]): Promise<void> {
  if (!messages || messages.length === 0) return;
  const fetch = require("node-fetch");
  const chunks: Record<string, unknown>[][] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }
  for (const chunk of chunks) {
    try {
      const firstToken = String((chunk[0] as { to?: string })?.to || "(none)");
      const masked =
        firstToken.length > 30
          ? firstToken.slice(0, 20) + "..." + firstToken.slice(-6)
          : firstToken;
      console.log(
        `[customerExpoPush] Sending chunk of ${chunk.length} message(s), first token: ${masked}`
      );
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
          "X-API-Version": "2.0.0",
        },
        body: JSON.stringify(chunk),
      });
      if (!response.ok) {
        const errBody = await response.text();
        console.error(
          `Expo API error: ${response.status} ${response.statusText}`,
          errBody || "(no body)"
        );
        continue;
      }
      const data = await response.json();
      console.log("Expo push response:", JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("Error sending push notifications chunk:", err);
    }
  }
}

export type CustomerExpoPushLog = {
  orderId: string;
  status: string;
  deliveryMethod: string;
};

/**
 * Send localized Expo notification to all non-driver Expo tokens for the user with this phone.
 */
export async function sendLocalizedExpoToCustomerByPhone(options: {
  phone: string | undefined | null;
  content: LocalizedPushContent;
  data: {
    orderId: string;
    status: string;
    deliveryMethod?: string;
    screen?: string;
  };
  /** When set, writes notificationLogs entry (same shape as legacy functions). */
  log?: CustomerExpoPushLog | null;
}): Promise<void> {
  const { phone, content, data, log } = options;
  const userSnap = await findUserDocByPhone(phone);
  if (!userSnap) return;

  const userId = userSnap.id;
  const userData = userSnap.data();

  const pushTokenObjs: PushTokenObj[] = ((userData.pushTokens || []) as PushTokenObj[]).filter(
    (t) =>
      t &&
      t.active !== false &&
      typeof t.token === "string" &&
      isExpoToken(t.token) &&
      t.appType !== "driver"
  );

  const menuTokenObjs = pushTokenObjs;

  const legacyTokenStrings: string[] = [];
  if (menuTokenObjs.length === 0) {
    const pt = userData.pushToken;
    const fc = userData.fcmToken;
    if (typeof pt === "string" && isExpoToken(pt)) legacyTokenStrings.push(pt);
    else if (typeof fc === "string" && isExpoToken(fc)) legacyTokenStrings.push(fc);
  }

  if (menuTokenObjs.length === 0 && legacyTokenStrings.length === 0) {
    console.log(
      `No active Expo (non-driver) push tokens for user ${userId} (phone: ${phone})`
    );
    return;
  }

  const language = (userData.language as string) || "ar";
  const localizedContent =
    content[language as keyof LocalizedPushContent] || content.ar;

  const screen =
    data.screen ||
    (data.orderId ? "MyOrdersScreen" : "ProfileTab");

  const messagePayload = {
    sound: "default" as const,
    title: localizedContent.title,
    body: localizedContent.body,
    data: {
      orderId: String(data.orderId || ""),
      status: String(data.status || ""),
      screen: String(screen),
    },
    channelId: "default",
  };

  const groups = new Map<string, Record<string, unknown>[]>();
  for (const t of menuTokenObjs) {
    const msg: Record<string, unknown> = { ...messagePayload, to: t.token };
    const key =
      t.expoExperienceId != null
        ? String(t.expoExperienceId)
        : `single:${t.token}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(msg);
  }

  const inGroups = new Set<string>();
  for (const [, msgs] of groups) {
    for (const m of msgs) inGroups.add(String((m as { to: string }).to));
  }
  for (const token of legacyTokenStrings) {
    if (!inGroups.has(token)) {
      groups.set(`single:${token}`, [{ ...messagePayload, to: token }]);
    }
  }

  let totalSent = 0;
  for (const [, messages] of groups) {
    await sendExpoPushChunks(messages);
    totalSent += messages.length;
  }

  if (log) {
    await admin.firestore().collection("notificationLogs").add({
      userId,
      orderId: log.orderId,
      status: log.status,
      deliveryMethod: log.deliveryMethod,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      tokensCount: totalSent,
    });
  }

  console.log(
    `✅ Sent ${totalSent} customer Expo notification(s) (${data.orderId ? `order ${data.orderId}` : "event"})`
  );
}
