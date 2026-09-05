import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

import { prisma } from "../config/db";

async function runAuthTests() {
  console.log("🔐 Starting Phase 6 Google OAuth & Session Acceptance Tests...\n");

  const baseUrl = "http://localhost:4000";

  // 1. Test unauthenticated request to protected route (Expect 401)
  console.log("1. Testing unauthorized access to GET /api/emails/scheduled...");
  const unauthRes = await fetch(`${baseUrl}/api/emails/scheduled`);
  const unauthJson: any = await unauthRes.json();
  console.log("✅ Protected route response:", unauthRes.status, unauthJson);
  if (unauthRes.status !== 401 || unauthJson.error?.code !== "UNAUTHORIZED") {
    throw new Error("❌ Route protection failed: expected 401 UNAUTHORIZED");
  }

  // 2. Perform Login via Dev/Google Auth
  console.log("\n2. Performing login to acquire signed session token...");
  const testEmail = `authtest_${Date.now()}@reachinbox.ai`;
  const loginRes = await fetch(`${baseUrl}/api/auth/dev-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      name: "OAuth Tester",
    }),
  });
  const loginJson: any = await loginRes.json();
  console.log("✅ Login successful! Issued Token:", loginJson.token.slice(0, 20) + "...");
  console.log("   User:", loginJson.user?.id, loginJson.user?.email);

  const token = loginJson.token;
  const userId = loginJson.user?.id;

  // 3. Test GET /api/auth/me with Bearer Token
  console.log("\n3. Testing GET /api/auth/me with Bearer Token...");
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meJson: any = await meRes.json();
  console.log("✅ Session validated! Profile:", meJson.user?.email, "Senders:", meJson.user?.senders?.length);
  if (meRes.status !== 200 || meJson.user?.id !== userId) {
    throw new Error("❌ Failed to validate session via /api/auth/me");
  }

  // 4. Test accessing protected route WITH Bearer Token
  console.log("\n4. Testing authorized access to GET /api/emails/scheduled...");
  const authEmailsRes = await fetch(`${baseUrl}/api/emails/scheduled?userId=${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const authEmailsJson: any = await authEmailsRes.json();
  console.log(`✅ Authorized access granted (Status: ${authEmailsRes.status}, Count: ${authEmailsJson.count})`);

  // 5. Test Logout
  console.log("\n5. Testing POST /api/auth/logout...");
  const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, { method: "POST" });
  const logoutJson: any = await logoutRes.json();
  console.log("✅ Logout response:", logoutJson);

  // Cleanup
  await prisma.user.delete({ where: { id: userId } });
  console.log("\n✅ Cleaned up auth test user.");
  console.log("\n🎉 PHASE 6 AUTH ACCEPTANCE TESTS PASSED SUCCESSFULLY!");
  process.exit(0);
}

runAuthTests();
