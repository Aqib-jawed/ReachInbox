import { esClient, EMAILS_INDEX } from "../../config/elasticsearch";
import { prisma } from "../../config/db";
import pino from "pino";

const logger = pino({
  name: "es-indexer",
  level: process.env.LOG_LEVEL || "info",
});

export interface EmailDocument {
  id: string;
  userId: string;
  senderId: string;
  senderEmail?: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: Date;
  sentAt?: Date | null;
}

export interface SearchEmailsQuery {
  userId?: string;
  q?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

/**
 * Upserts an email document into the Elasticsearch index.
 * Gracefully logs without crashing if Elasticsearch is unavailable.
 */
export async function indexEmailDocument(doc: EmailDocument): Promise<boolean> {
  try {
    await esClient.index({
      index: EMAILS_INDEX,
      id: doc.id,
      document: {
        id: doc.id,
        userId: doc.userId,
        senderId: doc.senderId,
        senderEmail: doc.senderEmail,
        recipientEmail: doc.recipientEmail,
        subject: doc.subject,
        body: doc.body,
        status: doc.status,
        scheduledAt: doc.scheduledAt ? doc.scheduledAt.toISOString() : undefined,
        sentAt: doc.sentAt ? doc.sentAt.toISOString() : undefined,
        updatedAt: new Date().toISOString(),
      },
    });

    logger.debug({ docId: doc.id, status: doc.status }, "Indexed email document in Elasticsearch");
    return true;
  } catch (err: any) {
    logger.warn(
      { docId: doc.id, err: err.message },
      "Elasticsearch indexing skipped (ES unavailable). Non-blocking."
    );
    return false;
  }
}

/**
 * Searches emails across subject, body, recipient, and sender.
 * Queries Elasticsearch if available; seamlessly falls back to PostgreSQL ILIKE search if ES is unreachable.
 */
export async function searchEmails(query: SearchEmailsQuery) {
  const { userId, q, status, limit = 50, offset = 0 } = query;

  // Try Elasticsearch first
  try {
    const mustClauses: any[] = [];

    if (userId) {
      mustClauses.push({ term: { userId } });
    }

    if (status) {
      mustClauses.push({ term: { status: status.toUpperCase() } });
    }

    if (q && q.trim()) {
      mustClauses.push({
        multi_match: {
          query: q.trim(),
          fields: ["subject^3", "body", "recipientEmail^2", "senderEmail"],
          fuzziness: "AUTO",
        },
      });
    }

    const esResponse = await esClient.search({
      index: EMAILS_INDEX,
      from: offset,
      size: limit,
      query: mustClauses.length > 0 ? { bool: { must: mustClauses } } : { match_all: {} },
      sort: [{ scheduledAt: { order: "desc" } }],
    });

    const hits = (esResponse.hits?.hits || []).map((hit: any) => ({
      _score: hit._score,
      ...hit._source,
    }));

    const total =
      typeof esResponse.hits?.total === "number"
        ? esResponse.hits.total
        : esResponse.hits?.total?.value || hits.length;

    logger.info({ count: hits.length, total, source: "elasticsearch" }, "Search results from Elasticsearch");

    return {
      source: "elasticsearch",
      total,
      data: hits,
    };
  } catch (esErr: any) {
    logger.info("Elasticsearch search failed or offline. Falling back to PostgreSQL full-text search.");

    // Fallback: PostgreSQL database search
    const whereClause: any = {};
    if (userId) whereClause.userId = userId;
    if (status) whereClause.status = status.toUpperCase();
    if (q && q.trim()) {
      const searchTerm = q.trim();
      whereClause.OR = [
        { subject: { contains: searchTerm, mode: "insensitive" } },
        { body: { contains: searchTerm, mode: "insensitive" } },
        { recipientEmail: { contains: searchTerm, mode: "insensitive" } },
      ];
    }

    const [dbEmails, total] = await Promise.all([
      prisma.scheduledEmail.findMany({
        where: whereClause,
        include: {
          sender: {
            select: {
              id: true,
              etherealEmail: true,
            },
          },
        },
        orderBy: { scheduledAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.scheduledEmail.count({ where: whereClause }),
    ]);

    const formattedData = dbEmails.map((e) => ({
      id: e.id,
      userId: e.userId,
      senderId: e.senderId,
      senderEmail: e.sender.etherealEmail,
      recipientEmail: e.recipientEmail,
      subject: e.subject,
      body: e.body,
      status: e.status,
      scheduledAt: e.scheduledAt,
      sentAt: e.sentAt,
      createdAt: e.createdAt,
    }));

    return {
      source: "postgres_fallback",
      total,
      data: formattedData,
    };
  }
}
