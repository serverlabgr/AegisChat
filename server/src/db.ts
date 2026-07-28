import pg from "pg";
import { config } from "./config.js";

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 20,
});

export type DbClient = pg.Pool | pg.PoolClient;

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
  client: DbClient = pool,
): Promise<pg.QueryResult<T>> {
  return client.query<T>(text, params);
}
