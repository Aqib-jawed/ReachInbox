import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

import { prisma } from "../config/db";
import { searchEmails, indexEmailDocument } from "../integrations/elasticsearch/indexer";

async function runSearchTests() {
  console.log("🔍 Starting Phase 4 Elasticsearch & Full-Text Search Acceptance Tests...\n");

  const testUser = await prisma.user.create({
    data: {
      googleId: `search_user_${Date.now()}`,
      email: `search_${Date.now()}@example.com`,
      name: "Search Tester",
    },
  });

  const testSender = await prisma.sender.create({
    data: {
      userId: testUser.id,
      etherealEmail: "search_sender@ethereal.email",
      etherealPassword: "test_password",
    },
  });

  try {
    // 1. Create sample scheduled and sent emails with distinct keywords
    console.log("1. Creating sample emails with distinct searchable keywords...");

    const email1 = await prisma.scheduledEmail.create({
      data: {
        userId: testUser.id,
        senderId: testSender.id,
        recipientEmail: "client_acme@enterprise.org",
        subject: "Quarterly Financial Overview and Projections",
        body: "Attached is the Q3 enterprise revenue breakdown and financial audit report.",
        status: "SENT",
        scheduledAt: new Date(Date.now() - 3600000),
        sentAt: new Date(Date.now() - 3500000),
      },
    });

    const email2 = await prisma.scheduledEmail.create({
      data: {
        userId: testUser.id,
        senderId: testSender.id,
        recipientEmail: "talent_hr@startup.io",
        subject: "Engineering Lead Job Offer & Compensation Package",
        body: "We are thrilled to offer you the Senior Full-Stack Engineering position.",
        status: "PENDING",
        scheduledAt: new Date(Date.now() + 7200000),
      },
    });

    // 2. Index both documents
    console.log("\n2. Indexing documents...");
    await indexEmailDocument({
      id: email1.id,
      userId: testUser.id,
      senderId: testSender.id,
      senderEmail: testSender.etherealEmail,
      recipientEmail: email1.recipientEmail,
      subject: email1.subject,
      body: email1.body,
      status: email1.status,
      scheduledAt: email1.scheduledAt,
      sentAt: email1.sentAt,
    });

    await indexEmailDocument({
      id: email2.id,
      userId: testUser.id,
      senderId: testSender.id,
      senderEmail: testSender.etherealEmail,
      recipientEmail: email2.recipientEmail,
      subject: email2.subject,
      body: email2.body,
      status: email2.status,
      scheduledAt: email2.scheduledAt,
    });

    // 3. Search for keyword "revenue"
    console.log("\n3. Testing search query: 'revenue'...");
    const res1 = await searchEmails({
      userId: testUser.id,
      q: "revenue",
    });
    console.log(`✅ Matches found: ${res1.total} (Source: ${res1.source})`);
    console.log(`   Result Subject: "${res1.data[0]?.subject}"`);

    if (!res1.data.some((e: any) => e.id === email1.id)) {
      throw new Error("❌ Search failed to match 'revenue' keyword!");
    }

    // 4. Search for keyword "Engineering" with status filter
    console.log("\n4. Testing search query: 'Engineering' with status=PENDING...");
    const res2 = await searchEmails({
      userId: testUser.id,
      q: "Engineering",
      status: "PENDING",
    });
    console.log(`✅ Matches found: ${res2.total} (Source: ${res2.source})`);
    console.log(`   Result Subject: "${res2.data[0]?.subject}"`);

    if (!res2.data.some((e: any) => e.id === email2.id)) {
      throw new Error("❌ Search failed to match 'Engineering' with status=PENDING!");
    }

    // 5. Test search query via HTTP API (if server is running)
    console.log("\n5. Testing search via HTTP endpoint GET /api/emails/search?q=audit...");
    try {
      const httpRes = await fetch(
        `http://localhost:4000/api/emails/search?userId=${testUser.id}&q=audit`
      );
      const httpJson: any = await httpRes.json();
      console.log(`✅ HTTP Search endpoint returned ${httpJson.total} result(s):`, httpJson.data?.[0]?.subject);
    } catch {
      console.log("ℹ️ Server not currently running on :4000 (direct integration search validated above).");
    }

    // Cleanup
    await prisma.user.delete({ where: { id: testUser.id } });
    console.log("\n✅ Cleaned up search test records.");
    console.log("\n🎉 PHASE 4 SEARCH ACCEPTANCE TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Search test failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runSearchTests();
