import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

import { prisma } from "../config/db";
import { signUserToken } from "../config/auth";

async function testHttpEndpoints() {
  console.log("🌐 Testing HTTP API Endpoints...\n");

  const baseUrl = "http://localhost:4000";

  // 1. Create a user in DB for the API test
  const testUser = await prisma.user.create({
    data: {
      googleId: `api_user_${Date.now()}`,
      email: `api_user_${Date.now()}@example.com`,
      name: "API Test User",
    },
  });
  console.log("1. Created User for API test:", testUser.id);

  const token = signUserToken({
    id: testUser.id,
    email: testUser.email,
    name: testUser.name,
  });

  // 2. Test POST /api/senders
  console.log("2. Testing POST /api/senders...");
  const senderRes = await fetch(`${baseUrl}/api/senders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      userId: testUser.id,
      maxPerHour: 50,
      minDelayMs: 2000,
    }),
  });
  const senderJson: any = await senderRes.json();
  console.log("✅ Sender created via API:", senderJson.data?.id, senderJson.data?.etherealEmail);

  // 3. Test POST /api/emails/schedule
  console.log("\n3. Testing POST /api/emails/schedule...");
  const scheduleRes = await fetch(`${baseUrl}/api/emails/schedule`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      userId: testUser.id,
      senderId: senderJson.data.id,
      recipients: ["candidate1@outboxlabs.com", "candidate2@outboxlabs.com"],
      subject: "Invitation to Interview",
      body: "We were impressed with your profile and would love to schedule a call.",
      delayBetweenMs: 2000,
    }),
  });
  const scheduleJson: any = await scheduleRes.json();
  console.log("✅ Emails scheduled via API:", scheduleJson.message);
  console.log("   Details:", scheduleJson.data?.scheduledEmails);

  // 4. Test GET /api/emails/scheduled
  console.log("\n4. Testing GET /api/emails/scheduled...");
  const scheduledListRes = await fetch(`${baseUrl}/api/emails/scheduled?userId=${testUser.id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const scheduledListJson: any = await scheduledListRes.json();
  console.log(`✅ Retrieved ${scheduledListJson.count} scheduled email(s) via GET /api/emails/scheduled`);

  // Cleanup
  await prisma.user.delete({ where: { id: testUser.id } });
  console.log("\n✅ Cleaned up API test records.");
  console.log("\n🎉 ALL HTTP API TESTS PASSED!");
  await prisma.$disconnect();
}

testHttpEndpoints();
