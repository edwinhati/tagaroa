import { type SQL, sql } from "bun";
import type { CreateFileInput, File, UpdateFileInput } from "../model/file";
import type { LoggerPort } from "../ports/logger.port.js";

export interface FindUniqueParams {
  where: {
    id?: string;
    key?: string;
    url?: string;
    search?: string;
  };
}

export interface FindManyParams {
  where?: {
    search?: string;
    content_type?: string;
  };
  orderBy?: string;
  offset?: number;
  limit?: number;
}

export class FileRepository {
  private readonly db: SQL;
  private readonly logger: LoggerPort;
  private readonly selectCols = `
    	id, url, key, size, content_type, original_name, 
    	deleted_at, created_at, updated_at
  	`;

  constructor(db?: SQL, logger?: LoggerPort) {
    this.db = db || sql;
    this.logger = logger || {
      setContext: () => {},
      verbose: () => {},
      debug: () => {},
      info: () => {},
      log: () => {},
      warn: () => {},
      error: () => {},
    };
  }

  private buildWhere(where: Record<string, unknown>): {
    clause: string;
    values: unknown[];
  } {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    conditions.push("deleted_at IS NULL");

    if (where.id) {
      conditions.push(`id = $${paramIndex++}`);
      values.push(where.id);
    }

    if (where.key) {
      conditions.push(`key = $${paramIndex++}`);
      values.push(where.key);
    }

    if (where.url) {
      conditions.push(`url = $${paramIndex++}`);
      values.push(where.url);
    }

    if (where.content_type) {
      conditions.push(`content_type = $${paramIndex++}`);
      values.push(where.content_type);
    }

    if (where.search) {
      const searchValue =
        typeof where.search === "object"
          ? JSON.stringify(where.search)
          : String(where.search);
      const searchPattern = `%${searchValue}%`;
      conditions.push(
        `(LOWER(original_name) LIKE LOWER($${paramIndex}) OR LOWER(key) LIKE LOWER($${paramIndex}))`,
      );
      values.push(searchPattern);
      paramIndex++;
    }

    const clause =
      conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
    return { clause, values };
  }

  private validateOrderBy(orderBy: string): string {
    const allowedColumns = new Set([
      "id",
      "url",
      "key",
      "size",
      "content_type",
      "original_name",
      "created_at",
      "updated_at",
    ]);

    const parts = orderBy.trim().split(/\s+/);
    const column = parts[0];
    const direction = parts[1]?.toUpperCase() || "ASC";

    if (!allowedColumns.has(column)) {
      throw new Error(`Invalid ORDER BY column: ${column}`);
    }

    if (direction !== "ASC" && direction !== "DESC") {
      throw new Error(`Invalid ORDER BY direction: ${direction}`);
    }

    return `${column} ${direction}`;
  }

  async create(input: CreateFileInput): Promise<File> {
    const ctx = "FileRepository";
    this.logger.debug(`Creating file - key:${input.key}`, ctx);

    const id = input.id || crypto.randomUUID();
    const now = new Date();

    const [file] = await this.db`
      	INSERT INTO files (
        	id, url, key, size, content_type, original_name,
        	created_at, updated_at
      	)
      	VALUES (
        	${id}, ${input.url}, ${input.key}, ${input.size},
        	${input.content_type}, ${input.original_name},
        	${now}, ${now}
      	)
      	RETURNING id, url, key, size, content_type, original_name, 
        	deleted_at, created_at, updated_at
    	`;

    this.logger.info(`Created file - id:${id} key:${input.key}`, ctx);

    return file as File;
  }

  async findUnique(params: FindUniqueParams): Promise<File | null> {
    const ctx = "FileRepository";
    this.logger.debug(
      `Finding unique file - where:${JSON.stringify(params.where)}`,
      ctx,
    );

    const { clause, values } = this.buildWhere(params.where);

    const query = `
      	SELECT ${this.selectCols}
      	FROM files
      	${clause}
      	LIMIT 1
    	`;

    const [file] = await this.db.unsafe(query, values);
    return file ? (file as File) : null;
  }

  async findMany(params: FindManyParams): Promise<File[]> {
    const ctx = "FileRepository";
    this.logger.debug(
      `Finding many files - params:${JSON.stringify(params)}`,
      ctx,
    );

    const {
      where = {},
      orderBy = "created_at DESC",
      offset = 0,
      limit = 50,
    } = params;
    const { clause, values } = this.buildWhere(where);

    const validatedOrderBy = this.validateOrderBy(orderBy);
    const query = `
      	SELECT ${this.selectCols}
      	FROM files
      	${clause}
      	ORDER BY ${validatedOrderBy}
      	LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    	`;

    const files = await this.db.unsafe(query, [...values, limit, offset]);
    this.logger.debug(`Found ${files.length} files`, ctx);
    return files as File[];
  }

  async count(where: Record<string, unknown> = {}): Promise<number> {
    const ctx = "FileRepository";
    this.logger.debug(`Counting files - where:${JSON.stringify(where)}`, ctx);

    const { clause, values } = this.buildWhere(where);

    const query = `
      	SELECT COUNT(*) as count
      	FROM files
      	${clause}
    	`;

    const [result] = await this.db.unsafe(query, values);
    return Number(result.count);
  }

  async update(id: string, input: UpdateFileInput): Promise<File | null> {
    const ctx = "FileRepository";
    this.logger.debug(
      `Updating file - id:${id} input:${JSON.stringify(input)}`,
      ctx,
    );

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.url !== undefined) {
      updates.push(`url = $${paramIndex++}`);
      values.push(input.url);
    }

    if (input.key !== undefined) {
      updates.push(`key = $${paramIndex++}`);
      values.push(input.key);
    }

    if (input.size !== undefined) {
      updates.push(`size = $${paramIndex++}`);
      values.push(input.size);
    }

    if (input.content_type !== undefined) {
      updates.push(`content_type = $${paramIndex++}`);
      values.push(input.content_type);
    }

    if (input.original_name !== undefined) {
      updates.push(`original_name = $${paramIndex++}`);
      values.push(input.original_name);
    }

    if (input.deleted_at !== undefined) {
      updates.push(`deleted_at = $${paramIndex++}`);
      values.push(input.deleted_at);
    }

    if (updates.length === 0) {
      return this.findUnique({ where: { id } });
    }

    const now = new Date();
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now);

    values.push(id);
    const query = `
      	UPDATE files
      	SET ${updates.join(", ")}
      	WHERE id = $${paramIndex} AND deleted_at IS NULL
      	RETURNING ${this.selectCols}
    	`;

    const [file] = await this.db.unsafe(query, values);
    this.logger.info(`Updated file - id:${id}`, ctx);
    return file ? (file as File) : null;
  }

  async softDelete(id: string): Promise<boolean> {
    const ctx = "FileRepository";
    this.logger.debug(`Soft deleting file - id:${id}`, ctx);
    const result = await this.update(id, { deleted_at: new Date() });
    return result !== null;
  }

  async getContentTypeAggregations(
    where: Record<string, unknown> = {},
  ): Promise<Record<string, { count: number; total_size: number }>> {
    const ctx = "FileRepository";
    this.logger.debug(
      `Getting content type aggregations - where:${JSON.stringify(where)}`,
      ctx,
    );

    const { clause, values } = this.buildWhere(where);

    const query = `
      	SELECT
        	content_type as key,
        	COUNT(*) as count,
        	COALESCE(SUM(size), 0) as total_size
      	FROM files
      	${clause}
      	GROUP BY content_type
      	ORDER BY content_type
    	`;

    const rows = await this.db.unsafe(query, values);
    const aggregations: Record<string, { count: number; total_size: number }> =
      {};

    for (const row of rows) {
      aggregations[row.key] = {
        count: Number(row.count),
        total_size: Number(row.total_size),
      };
    }

    this.logger.debug(
      `Got ${Object.keys(aggregations).length} content type aggregations`,
      ctx,
    );
    return aggregations;
  }
}
