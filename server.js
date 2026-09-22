const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const { Resend } = require("resend");
require("dotenv").config({ path: path.join(__dirname, ".env"), override: true });

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const resend = new Resend(process.env.RESEND_API_KEY);
const CONTACT_TO = process.env.CONTACT_TO || "mohak1802bhal@gmail.com";
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@resend.dev";
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "dental-door-id-service";
const FIREBASE_SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";
const FIREBASE_SERVICE_ACCOUNT_BASE64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || process.env.RESEND_API_KEY || "dental-door-dev-secret";
const APPOINTMENT_STATUSES = new Set(["new", "contacted", "booked", "closed"]);
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
let firebaseAccessToken = null;

const normalizeAppointment = (body = {}) => ({
  name: String(body.name || "").trim(),
  email: String(body.email || "").trim().toLowerCase(),
  phone: String(body.phone || "").trim(),
  service: String(body.service || "").trim(),
  message: String(body.message || "").trim(),
});

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const parseFirebaseServiceAccount = () => {
  const rawJson = FIREBASE_SERVICE_ACCOUNT_JSON || Buffer.from(FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8");

  if (!rawJson) {
    throw new Error("Firebase is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_BASE64 in .env.");
  }

  try {
    return JSON.parse(rawJson);
  } catch (_error) {
    throw new Error("Firebase service account must be valid JSON.");
  }
};

const base64Url = (value) => Buffer.from(value).toString("base64url");

const getFirebaseAccessToken = async () => {
  if (firebaseAccessToken && firebaseAccessToken.expiresAt > Date.now() + 60_000) {
    return firebaseAccessToken.value;
  }

  const serviceAccount = parseFirebaseServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/datastore",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );
  const unsignedJwt = `${header}.${claim}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsignedJwt), serviceAccount.private_key).toString("base64url");
  const jwt = `${unsignedJwt}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || "Could not authenticate with Firebase.");
  }

  firebaseAccessToken = {
    value: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
  };

  return firebaseAccessToken.value;
};

const firestoreValue = (value) => {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "number") return { doubleValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  return { stringValue: String(value) };
};

const toFirestoreFields = (data) =>
  Object.entries(data).reduce((fields, [key, value]) => {
    fields[key] = firestoreValue(value);
    return fields;
  }, {});

const fromFirestoreFields = (fields = {}) =>
  Object.entries(fields).reduce((data, [key, value]) => {
    if ("stringValue" in value) data[key] = value.stringValue;
    else if ("timestampValue" in value) data[key] = value.timestampValue;
    else if ("doubleValue" in value) data[key] = value.doubleValue;
    else if ("integerValue" in value) data[key] = Number(value.integerValue);
    else if ("booleanValue" in value) data[key] = value.booleanValue;
    else data[key] = null;
    return data;
  }, {});

const normalizeFirestoreDocument = (document) => {
  const id = document.name.split("/").pop();
  return { id, ...fromFirestoreFields(document.fields) };
};

const firebaseRequest = async (url, options = {}) => {
  const accessToken = await getFirebaseAccessToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.error?.message || data?.message || `Firebase request failed with ${response.status}`;
    throw new Error(message);
  }

  return data;
};

const createAdminToken = () => {
  const payload = {
    role: "admin",
    exp: Date.now() + 1000 * 60 * 60 * 8,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", ADMIN_SESSION_SECRET).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
};

const verifyAdminToken = (token = "") => {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return false;

  const expectedSignature = crypto.createHmac("sha256", ADMIN_SESSION_SECRET).update(encodedPayload).digest("base64url");
  if (
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    return payload.role === "admin" && Number(payload.exp) > Date.now();
  } catch (_error) {
    return false;
  }
};

const requireAdmin = (req, res, next) => {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!verifyAdminToken(token)) {
    return res.status(401).json({ success: false, message: "Admin login required" });
  }

  return next();
};

const storeAppointment = async (appointment, emailStatus = "pending", emailError = "") => {
  const now = new Date().toISOString();
  const document = await firebaseRequest(`${FIRESTORE_BASE_URL}/appointments`, {
    method: "POST",
    body: JSON.stringify({
      fields: toFirestoreFields({
        ...appointment,
        status: "new",
        admin_notes: "",
        email_status: emailStatus,
        email_error: emailError || "",
        created_at: now,
        updated_at: now,
      }),
    }),
  });

  return normalizeFirestoreDocument(document);
};

const updateAppointmentEmailStatus = async (id, emailStatus, emailError = "") => {
  if (!id) return null;

  const document = await firebaseRequest(
    `${FIRESTORE_BASE_URL}/appointments/${encodeURIComponent(id)}?updateMask.fieldPaths=email_status&updateMask.fieldPaths=email_error&updateMask.fieldPaths=updated_at`,
    {
      method: "PATCH",
      body: JSON.stringify({
        fields: toFirestoreFields({
          email_status: emailStatus,
          email_error: emailError || "",
          updated_at: new Date().toISOString(),
        }),
      }),
    }
  );

  return normalizeFirestoreDocument(document);
};

const getAppointments = async ({ status, search }) => {
  const result = await firebaseRequest(`${FIRESTORE_BASE_URL}:runQuery`, {
    method: "POST",
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "appointments" }],
        orderBy: [{ field: { fieldPath: "created_at" }, direction: "DESCENDING" }],
      },
    }),
  });

  const query = search.toLowerCase();
  return result
    .filter((row) => row.document)
    .map((row) => normalizeFirestoreDocument(row.document))
    .filter((appointment) => !APPOINTMENT_STATUSES.has(status) || appointment.status === status)
    .filter((appointment) => {
      if (!query) return true;
      return [appointment.name, appointment.email, appointment.phone]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(query));
    });
};

const updateAppointment = async (id, status, adminNotes) => {
  const document = await firebaseRequest(
    `${FIRESTORE_BASE_URL}/appointments/${encodeURIComponent(id)}?updateMask.fieldPaths=status&updateMask.fieldPaths=admin_notes&updateMask.fieldPaths=updated_at`,
    {
      method: "PATCH",
      body: JSON.stringify({
        fields: toFirestoreFields({
          status,
          admin_notes: adminNotes || "",
          updated_at: new Date().toISOString(),
        }),
      }),
    }
  );

  return normalizeFirestoreDocument(document);
};

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/admin/login", (req, res) => {
  const password = String(req.body?.password || "");

  if (!ADMIN_PASSWORD) {
    return res.status(500).json({
      success: false,
      message: "Admin login is not configured. Set ADMIN_PASSWORD in .env.",
    });
  }

  const passwordMatches =
    password.length === ADMIN_PASSWORD.length &&
    crypto.timingSafeEqual(Buffer.from(password), Buffer.from(ADMIN_PASSWORD));

  if (!passwordMatches) {
    return res.status(401).json({ success: false, message: "Incorrect admin password" });
  }

  return res.json({ success: true, token: createAdminToken() });
});

app.get("/api/admin/appointments", requireAdmin, async (req, res) => {
  const status = String(req.query.status || "").toLowerCase();
  const search = String(req.query.search || "").trim();

  try {
    const appointments = await getAppointments({ status, search });

    return res.json({ success: true, appointments });
  } catch (error) {
    console.error("Admin appointment list failed", error);
    return res.status(500).json({ success: false, message: error.message || "Could not load appointments" });
  }
});

app.patch("/api/admin/appointments/:id", requireAdmin, async (req, res) => {
  const id = String(req.params.id || "");
  const status = String(req.body?.status || "").toLowerCase();
  const adminNotes = String(req.body?.admin_notes || "").trim();

  if (!APPOINTMENT_STATUSES.has(status)) {
    return res.status(400).json({ success: false, message: "Invalid appointment status" });
  }

  try {
    const appointment = await updateAppointment(id, status, adminNotes);

    return res.json({ success: true, appointment });
  } catch (error) {
    console.error("Admin appointment update failed", error);
    return res.status(500).json({ success: false, message: error.message || "Could not update appointment" });
  }
});

app.post("/api/send-appointment", async (req, res) => {
  const appointment = normalizeAppointment(req.body);
  const { name, email, phone, service, message } = appointment;

  if (!name || !email || !phone || !service) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return res.status(400).json({ success: false, message: "Please enter a valid email address" });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({
      success: false,
      message: "Email service not configured. Please set RESEND_API_KEY in .env.",
    });
  }

  let storedAppointment = null;
  try {
    storedAppointment = await storeAppointment(appointment);
  } catch (error) {
    console.error("Appointment storage failed", error);
    return res.status(500).json({
      success: false,
      message: `Could not save appointment request: ${error.message || "Unknown database error"}`,
    });
  }

  const subject = `New Appointment Request - ${name}`;
  const html = `
    <h2>New Appointment Request from Dental Door</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
    <p><strong>Service:</strong> ${escapeHtml(service)}</p>
    <p><strong>Message:</strong> ${escapeHtml(message || "N/A")}</p>
    <p><strong>Submitted At:</strong> ${new Date().toLocaleString()}</p>
  `;

  // Resend requires a verified sender address; include user details in display name.
  const senderName = String(name).replace(/[\r\n<>]/g, " ").trim();
  const senderEmailLabel = String(email).replace(/[\r\n<>"]/g, "").trim();

  try {
    const result = await resend.emails.send({
      from: `${senderName || "Website Visitor"} (${senderEmailLabel}) via Dental Door <${FROM_EMAIL}>`,
      to: CONTACT_TO,
      replyTo: email,
      subject,
      html,
    });

    if (result.error) {
      throw new Error(result.error.message || "Resend API error");
    }

    await updateAppointmentEmailStatus(storedAppointment?.id, "sent");

    return res.json({ success: true, appointmentId: storedAppointment?.id || null });
  } catch (error) {
    console.error("Email send failed", error);
    await updateAppointmentEmailStatus(storedAppointment?.id, "failed", error.message || "Unknown error");
    return res.status(502).json({
      success: false,
      message: `Failed to send email: ${error.message || "Unknown error"}`,
    });
  }
});

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

app.listen(port, () => {
  console.log(`SMTP server running at http://localhost:${port}`);
});
