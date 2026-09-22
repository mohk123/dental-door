# Dental Door Firebase Admin Setup

## 1. Create Firebase credentials

1. Open Firebase project `dental-door-id-service`.
2. Go to Project settings > Service accounts.
3. Click Generate new private key.
4. Copy the downloaded JSON into `FIREBASE_SERVICE_ACCOUNT_JSON` as a single line.

## 2. Configure `.env`

Copy the new values from `.env.example` into your local `.env`:

```env
FIREBASE_PROJECT_ID=dental-door-id-service
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"dental-door-id-service",...}
FIREBASE_SERVICE_ACCOUNT_BASE64=
ADMIN_PASSWORD=choose_a_strong_admin_password
ADMIN_SESSION_SECRET=choose_a_long_random_secret
```

Keep the service account JSON only on the server. Do not put it in frontend JavaScript.

## 3. Enable Firestore

In Firebase Console, open Firestore Database and create the database if it is not already enabled. The app will create an `appointments` collection automatically when the first request is submitted.

## 4. Run and open

```bash
npm start
```

Website: `http://localhost:3000`

Admin panel: `http://localhost:3000/admin`
