import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

interface GetAuthNewUserCountsRequest {
  businessId: string;
  timeRange: "1d" | "yesterday" | "7d" | "month" | "30d" | "custom" | string;
  customDateStart?: string;
  customDateEnd?: string;
}

interface GetAuthNewUserCountsResponse {
  newUsers: number;
  previousNewUsers: number;
}

/** Match AnalyticsPage resolveAnalyticsPeriod */
function computeDateBounds(
  timeRange: string,
  customDateStart: string | undefined,
  customDateEnd: string | undefined,
  now: Date
): {
  startDate: Date;
  rangeEnd: Date;
  previousStartDate: Date;
  previousRangeEnd: Date;
} {
  let startDate = new Date(now);
  let rangeEnd = new Date(now);
  rangeEnd.setHours(23, 59, 59, 999);

  if (timeRange === "custom" && customDateStart && customDateEnd) {
    startDate = new Date(customDateStart);
    startDate.setHours(0, 0, 0, 0);
    rangeEnd = new Date(customDateEnd);
    rangeEnd.setHours(23, 59, 59, 999);
  } else if (timeRange === "1d") {
    startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
  } else if (timeRange === "yesterday") {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 1);
    startDate.setHours(0, 0, 0, 0);
    rangeEnd = new Date(startDate);
    rangeEnd.setHours(23, 59, 59, 999);
  } else if (timeRange === "month") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate.setHours(0, 0, 0, 0);
  } else if (timeRange === "7d") {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (timeRange === "30d") {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else {
    // Unknown range → last 7 days (safe default), never silently expand to 30
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  let previousStartDate: Date;
  let previousRangeEnd: Date;

  if (timeRange === "1d" || timeRange === "yesterday") {
    previousRangeEnd = new Date(startDate);
    previousRangeEnd.setDate(previousRangeEnd.getDate() - 1);
    previousRangeEnd.setHours(23, 59, 59, 999);
    previousStartDate = new Date(previousRangeEnd);
    previousStartDate.setHours(0, 0, 0, 0);
  } else if (timeRange === "month") {
    previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    previousStartDate.setHours(0, 0, 0, 0);
    previousRangeEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    previousRangeEnd.setHours(23, 59, 59, 999);
  } else {
    const periodMs = Math.max(0, rangeEnd.getTime() - startDate.getTime());
    previousRangeEnd = new Date(startDate.getTime() - 1);
    previousStartDate = new Date(previousRangeEnd.getTime() - periodMs);
  }

  return { startDate, rangeEnd, previousStartDate, previousRangeEnd };
}

function isInRange(created: Date, rangeStart: Date, rangeEnd: Date): boolean {
  if (Number.isNaN(created.getTime())) {
    return false;
  }
  return (
    created.getTime() >= rangeStart.getTime() &&
    created.getTime() <= rangeEnd.getTime()
  );
}

/**
 * Callable: new customer registrations in the selected analytics period, from Firebase Auth
 * creation time. Only counts Auth users that have a root `users/{uid}` doc (same set as
 * dashboard "إجمالي المستخدمين"). Requires deployed function + admin login.
 */
export const getAuthNewUserCounts = functions.https.onCall(
  async (
    data: GetAuthNewUserCountsRequest,
    context
  ): Promise<GetAuthNewUserCountsResponse> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "المستخدم غير مصادق عليه"
      );
    }

    const callerClaims = context.auth.token as {
      roles?: string[];
      businessIds?: string[];
    };

    if (!callerClaims.roles || !callerClaims.roles.includes("admin")) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "فقط المسؤولون يمكنهم عرض هذه الإحصائية"
      );
    }

    if (!data.businessId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "معرف العمل مطلوب"
      );
    }

    if (
      !callerClaims.businessIds ||
      !callerClaims.businessIds.includes(data.businessId)
    ) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "ليس لديك صلاحية لهذا العمل"
      );
    }

    const timeRange = data.timeRange || "7d";
    const now = new Date();
    const { startDate, rangeEnd, previousStartDate, previousRangeEnd } =
      computeDateBounds(
        timeRange,
        data.customDateStart,
        data.customDateEnd,
        now
      );

    const usersSnap = await admin.firestore().collection("users").get();
    const customerUids = new Set(usersSnap.docs.map((d) => d.id));

    let newUsers = 0;
    let previousNewUsers = 0;
    let pageToken: string | undefined;

    do {
      const result = await admin.auth().listUsers(1000, pageToken);
      for (const user of result.users) {
        if (!customerUids.has(user.uid)) {
          continue;
        }
        const created = new Date(user.metadata.creationTime);
        if (isInRange(created, startDate, rangeEnd)) {
          newUsers++;
        }
        if (isInRange(created, previousStartDate, previousRangeEnd)) {
          previousNewUsers++;
        }
      }
      pageToken = result.pageToken;
    } while (pageToken);

    return { newUsers, previousNewUsers };
  }
);
