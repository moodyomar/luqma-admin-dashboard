import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

interface GetAuthNewUserCountsRequest {
  businessId: string;
  timeRange: "1d" | "7d" | "30d" | "custom" | string;
  customDateStart?: string;
  customDateEnd?: string;
}

interface GetAuthNewUserCountsResponse {
  newUsers: number;
  previousNewUsers: number;
}

function computeDateBounds(
  timeRange: string,
  customDateStart: string | undefined,
  customDateEnd: string | undefined,
  now: Date
): {
  startDate: Date;
  rangeEnd: Date;
  previousStartDate: Date;
} {
  const timeRanges: Record<string, number> = { "1d": 1, "7d": 7, "30d": 30 };
  let startDate: Date;
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
  } else {
    const days = timeRanges[timeRange] != null ? timeRanges[timeRange] : 30;
    startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  const periodMs = rangeEnd.getTime() - startDate.getTime();
  const previousRangeEnd = new Date(startDate.getTime() - 1);
  const previousStartDate = new Date(previousRangeEnd.getTime() - periodMs);

  return { startDate, rangeEnd, previousStartDate };
}

function isInCurrentRange(
  created: Date,
  rangeStart: Date,
  rangeEnd: Date,
  timeRange: string
): boolean {
  if (Number.isNaN(created.getTime())) {
    return false;
  }
  if (timeRange === "1d") {
    const today = new Date(rangeEnd);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return created >= today && created < tomorrow;
  }
  return (
    created.getTime() >= rangeStart.getTime() &&
    created.getTime() <= rangeEnd.getTime()
  );
}

/** Previous period: calendar yesterday for 1d; else [previousStartDate, startDate] inclusive (matches AnalyticsPage). */
function isInPreviousRange(
  created: Date,
  previousStartDate: Date,
  startDate: Date,
  timeRange: string
): boolean {
  if (Number.isNaN(created.getTime())) {
    return false;
  }
  if (timeRange === "1d") {
    const endYesterday = new Date(startDate.getTime() - 1);
    const startYesterday = new Date(endYesterday);
    startYesterday.setHours(0, 0, 0, 0);
    return created >= startYesterday && created <= endYesterday;
  }
  return (
    created.getTime() >= previousStartDate.getTime() &&
    created.getTime() <= startDate.getTime()
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
    const { startDate, rangeEnd, previousStartDate } = computeDateBounds(
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
        if (isInCurrentRange(created, startDate, rangeEnd, timeRange)) {
          newUsers++;
        }
        if (isInPreviousRange(created, previousStartDate, startDate, timeRange)) {
          previousNewUsers++;
        }
      }
      pageToken = result.pageToken;
    } while (pageToken);

    return { newUsers, previousNewUsers };
  }
);
