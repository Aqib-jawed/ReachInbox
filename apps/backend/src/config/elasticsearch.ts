import { Client } from "@elastic/elasticsearch";
import pino from "pino";

const logger = pino({
  name: "elasticsearch-client",
  level: process.env.LOG_LEVEL || "info",
});

const esNode = process.env.ELASTICSEARCH_URL || "http://localhost:9200";

export const esClient = new Client({
  node: esNode,
  maxRetries: 0,
  requestTimeout: 1000,
});

export const EMAILS_INDEX = "emails";

export async function initElasticsearch(): Promise<boolean> {
  try {
    const health = await esClient.cluster.health({});
    logger.info({ status: health.status }, "Connected to Elasticsearch cluster");

    const indexExists = await esClient.indices.exists({ index: EMAILS_INDEX });
    if (!indexExists) {
      await esClient.indices.create({
        index: EMAILS_INDEX,
        mappings: {
          properties: {
            id: { type: "keyword" },
            userId: { type: "keyword" },
            senderId: { type: "keyword" },
            senderEmail: { type: "keyword" },
            recipientEmail: { type: "keyword" },
            subject: { type: "text" },
            body: { type: "text" },
            status: { type: "keyword" },
            scheduledAt: { type: "date" },
            sentAt: { type: "date" },
            createdAt: { type: "date" },
            updatedAt: { type: "date" },
          },
        },
      });
      logger.info(`Elasticsearch index '${EMAILS_INDEX}' created successfully`);
    }

    return true;
  } catch (err: any) {
    logger.warn(
      { message: err.message },
      "Elasticsearch is unreachable or initializing. Fallback search mode will be active."
    );
    return false;
  }
}

export async function checkElasticsearchHealth(): Promise<boolean> {
  try {
    const health = await esClient.cluster.health({});
    return health.status === "green" || health.status === "yellow";
  } catch {
    return false;
  }
}
