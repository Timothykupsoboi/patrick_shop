export interface DBResult {
  rows: any[];
  insertId?: number;
  rowsAffected: number;
}

export interface IDatabase {
  execute(sql: string, params?: any[]): Promise<DBResult>;
  transaction<T>(callback: (tx: IDatabase) => Promise<T>): Promise<T>;
}

// ----------------------------------------------------
// Web / Electron Implementation (IndexedDB Relational Sync)
// ----------------------------------------------------
class WebDatabase implements IDatabase {
  private static dbName = 'pos_local_db';
  private static version = 1;
  private db: IDBDatabase | null = null;
  private memoryTables: { [tableName: string]: any[] } = {};

  constructor() {
    this.initIndexedDB();
  }

  private initIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        resolve();
        return;
      }

      const request = window.indexedDB.open(WebDatabase.dbName, WebDatabase.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.loadAllTablesFromIndexedDB().then(resolve);
      };

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('tables')) {
          db.createObjectStore('tables');
        }
      };
    });
  }

  private async loadAllTablesFromIndexedDB() {
    if (!this.db) return;
    try {
      const transaction = this.db.transaction(['tables'], 'readonly');
      const store = transaction.objectStore('tables');

      const getAllKeys = () => new Promise<string[]>((res, rej) => {
        const req = store.getAllKeys();
        req.onsuccess = () => res(req.result as string[]);
        req.onerror = () => rej(req.error);
      });

      const keys = await getAllKeys();
      for (const key of keys) {
        const getVal = () => new Promise<any>((res, rej) => {
          const req = store.get(key);
          req.onsuccess = () => res(req.result);
          req.onerror = () => rej(req.error);
        });
        const records = await getVal();
        this.memoryTables[key] = records || [];
      }
    } catch (e) {
      console.error('Error loading tables from IndexedDB', e);
    }
  }

  private async saveTableToIndexedDB(tableName: string) {
    if (!this.db) return;
    return new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction(['tables'], 'readwrite');
      const store = transaction.objectStore('tables');
      const records = this.memoryTables[tableName] || [];
      const request = store.put(records, tableName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ---------------------------------------------------------------
  // Helper: tokenize SQL value tokens from a comma-separated list,
  // respecting parentheses and quoted strings.
  // ---------------------------------------------------------------
  private splitTokens(str: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let depth = 0;
    let inQuote = false;
    let quoteChar = '';

    for (let i = 0; i < str.length; i++) {
      const ch = str[i];

      if (inQuote) {
        current += ch;
        if (ch === quoteChar) inQuote = false;
        continue;
      }

      if (ch === "'" || ch === '"') {
        inQuote = true;
        quoteChar = ch;
        current += ch;
        continue;
      }

      if (ch === '(') { depth++; current += ch; continue; }
      if (ch === ')') { depth--; current += ch; continue; }

      if (ch === ',' && depth === 0) {
        tokens.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) tokens.push(current.trim());
    return tokens;
  }

  // ---------------------------------------------------------------
  // Helper: resolve a value token from the VALUES clause.
  // ---------------------------------------------------------------
  private resolveValueToken(
    token: string, params: any[], paramIndex: { idx: number }
  ): any {
    const t = token.trim();
    if (t === '?') {
      return params[paramIndex.idx++];
    }
    if (t.toLowerCase() === 'null') return null;
    if (t.toLowerCase() === 'true') return 1;
    if (t.toLowerCase() === 'false') return 0;
    if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
      return t.substring(1, t.length - 1);
    }
    if (!isNaN(Number(t))) return Number(t);
    return t;
  }

  // ---------------------------------------------------------------
  // Helper: evaluate a SET assignment value.
  // ---------------------------------------------------------------
  private resolveSetValue(
    valExpr: string, row: any, params: any[], paramIndex: { idx: number }
  ): any {
    const v = valExpr.trim();
    if (v === '?') return params[paramIndex.idx++];
    if (v.toLowerCase() === 'null') return null;
    if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
      return v.substring(1, v.length - 1);
    }
    // Handle expressions like "version+1" or "current_stock - ?"
    const incrMatch = v.match(/^(\w+)\s*\+\s*(\d+)$/);
    if (incrMatch) {
      const field = incrMatch[1].toLowerCase();
      const inc = parseInt(incrMatch[2], 10);
      return (Number(row[field]) || 0) + inc;
    }
    const decrMatch = v.match(/^(\w+)\s*-\s*\?$/);
    if (decrMatch) {
      const field = decrMatch[1].toLowerCase();
      const dec = params[paramIndex.idx++];
      return (Number(row[field]) || 0) - Number(dec);
    }
    const addMatch = v.match(/^(\w+)\s*\+\s*\?$/);
    if (addMatch) {
      const field = addMatch[1].toLowerCase();
      const add = params[paramIndex.idx++];
      return (Number(row[field]) || 0) + Number(add);
    }
    if (!isNaN(Number(v))) return Number(v);
    return v;
  }

  // ---------------------------------------------------------------
  // Helper: normalize value for comparison (booleans → 0/1).
  // ---------------------------------------------------------------
  private normalizeForCompare(val: any): any {
    if (typeof val === 'boolean') return val ? 1 : 0;
    return val;
  }

  // ---------------------------------------------------------------
  // Helper: evaluate a single condition (supports LIKE, operators).
  // ---------------------------------------------------------------
  private evaluateSingleCondition(
    cond: string, row: any, params: any[], paramIndex: { idx: number }
  ): boolean {
    cond = cond.trim();
    if (!cond) return true;

    // Handle LIKE / NOT LIKE
    const likeMatch = cond.match(/(\w+)\s+(not\s+like|like)\s+(\?|'[^']*')/i);
    if (likeMatch) {
      const field = likeMatch[1].toLowerCase();
      const isNot = likeMatch[2].toLowerCase().startsWith('not');
      let pattern: string;
      if (likeMatch[3] === '?') {
        pattern = String(params[paramIndex.idx++] ?? '');
      } else {
        pattern = likeMatch[3].substring(1, likeMatch[3].length - 1);
      }
      // Convert SQL LIKE pattern to JS regex: % => .* and _ => .
      const regexStr = pattern.replace(/[.*+?^${}()|[\]\\]/g, ch => {
        if (ch === '%') return '.*';
        if (ch === '_') return '.';
        return '\\' + ch;
      });
      const regex = new RegExp('^' + regexStr + '$', 'i');
      const rowVal = String(row[field] ?? '');
      const matches = regex.test(rowVal);
      return isNot ? !matches : matches;
    }

    // Handle standard comparison operators
    const condMatch = cond.match(/(\w+)\s*(=|!=|<>|>=|<=|>|<|is not|is)\s*(\?|null|'[^']*'|"[^"]*"|-?\d+(?:\.\d+)?)/i);
    if (!condMatch) return true; // unknown condition — pass through

    const field = condMatch[1].toLowerCase();
    const op = condMatch[2].toLowerCase();
    let val: any = condMatch[3];

    if (val === '?') {
      val = params[paramIndex.idx++];
    } else if (val.toLowerCase() === 'null') {
      val = null;
    } else if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
      val = val.substring(1, val.length - 1);
    } else if (!isNaN(Number(val))) {
      val = Number(val);
    }

    const rowVal = this.normalizeForCompare(row[field]);
    const cmpVal = this.normalizeForCompare(val);

    switch (op) {
      case '=':
      case 'is':
        // eslint-disable-next-line eqeqeq
        return rowVal == cmpVal;
      case '!=':
      case '<>':
      case 'is not':
        // eslint-disable-next-line eqeqeq
        return rowVal != cmpVal;
      case '>':
        return rowVal > cmpVal;
      case '<':
        return rowVal < cmpVal;
      case '>=':
        return rowVal >= cmpVal;
      case '<=':
        return rowVal <= cmpVal;
    }
    return true;
  }

  // ---------------------------------------------------------------
  // Helper: evaluate a WHERE clause against a row.
  // Supports AND / OR conditions and LIKE operator.
  // ---------------------------------------------------------------
  private evaluateWhere(
    whereClause: string, row: any, params: any[], paramIndex: { idx: number }
  ): boolean {
    // Split by OR first (lowest precedence)
    const orParts = whereClause.split(/\bor\b/i);
    if (orParts.length > 1) {
      for (const orPart of orParts) {
        const pIdx = { idx: paramIndex.idx };
        const andConds = orPart.split(/\band\b/i).map(c => c.trim());
        let allPass = true;
        for (const cond of andConds) {
          if (!this.evaluateSingleCondition(cond, row, params, pIdx)) {
            allPass = false;
            break;
          }
        }
        if (allPass) {
          paramIndex.idx = pIdx.idx;
          return true;
        }
      }
      return false;
    }

    // No OR — just AND conditions
    const conditions = whereClause.split(/\band\b/i).map(c => c.trim());
    for (const cond of conditions) {
      if (!this.evaluateSingleCondition(cond, row, params, paramIndex)) {
        return false;
      }
    }
    return true;
  }

  // SQL parser simulator for IndexedDB operations
  async execute(sql: string, params: any[] = []): Promise<DBResult> {
    if (!this.db) {
      await this.initIndexedDB();
    }

    const cleanSql = sql.replace(/\s+/g, ' ').trim();

    // CREATE TABLE
    if (/^create table/i.test(cleanSql)) {
      const match = cleanSql.match(/create table (?:if not exists )?(\w+)/i);
      if (match) {
        const tableName = match[1].toLowerCase();
        if (!this.memoryTables[tableName]) {
          this.memoryTables[tableName] = [];
          await this.saveTableToIndexedDB(tableName);
        }
      }
      return { rows: [], rowsAffected: 0 };
    }

    // INSERT INTO or INSERT OR REPLACE INTO / REPLACE INTO
    if (/^(insert into|insert or replace into|replace into)/i.test(cleanSql)) {
      const match = cleanSql.match(/^(?:insert into|insert or replace into|replace into) (\w+)\s*\(([^)]+)\)\s*values\s*\((.+)\)$/i);
      if (match) {
        const tableName = match[1].toLowerCase();
        const columns = match[2].split(',').map(c => c.trim().toLowerCase());
        const valueTokens = this.splitTokens(match[3]);

        const paramIndex = { idx: 0 };
        const record: any = {};
        columns.forEach((col, i) => {
          const token = valueTokens[i];
          if (token !== undefined) {
            record[col] = this.resolveValueToken(token, params, paramIndex);
          }
        });

        if (!this.memoryTables[tableName]) {
          this.memoryTables[tableName] = [];
        }

        // If it's a replace operation, remove existing item with the same ID first
        if (/replace/i.test(cleanSql) && record.id) {
          this.memoryTables[tableName] = this.memoryTables[tableName].filter(
            (row: any) => row.id !== record.id
          );
        }

        this.memoryTables[tableName].push(record);
        await this.saveTableToIndexedDB(tableName);

        return {
          rows: [],
          rowsAffected: 1,
          insertId: this.memoryTables[tableName].length,
        };
      }
    }

    // SELECT
    if (/^select/i.test(cleanSql)) {
      // Handle JOIN queries
      const joinMatch = cleanSql.match(/from (\w+)\s+(?:\w+\s+)?join (\w+)\s+(?:\w+\s+)?on\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/i);
      const fromMatch = cleanSql.match(/from (\w+)/i);

      if (!fromMatch) return { rows: [], rowsAffected: 0 };

      const tableName = fromMatch[1].toLowerCase();
      let rows = [...(this.memoryTables[tableName] || [])];

      // Perform in-memory JOIN if present
      if (joinMatch) {
        const joinTableName = joinMatch[2].toLowerCase();
        const leftAlias = joinMatch[3].toLowerCase();
        const leftKey = joinMatch[4].toLowerCase();
        const rightKey = joinMatch[6].toLowerCase();
        const joinTable = this.memoryTables[joinTableName] || [];

        // Determine which side references which table (left vs right)
        const mainIsLeft = leftAlias === tableName || tableName.startsWith(leftAlias);
        const joinKeyOnMain = mainIsLeft ? leftKey : rightKey;
        const joinKeyOnJoin = mainIsLeft ? rightKey : leftKey;

        const joinMap = new Map<string, any>();
        for (const jRow of joinTable) {
          const k = String(jRow[joinKeyOnJoin] ?? '');
          joinMap.set(k, jRow);
        }

        rows = rows
          .map(row => {
            const joinRow = joinMap.get(String(row[joinKeyOnMain] ?? ''));
            if (!joinRow) return null;
            const merged: any = { ...row };
            for (const [k, v] of Object.entries(joinRow)) {
              if (!(k in merged)) merged[k] = v;
              // Also accessible with table prefix (e.g. products_name)
              merged[`${joinTableName}_${k}`] = v;
            }
            return merged;
          })
          .filter(Boolean);
      }

      // WHERE clause — strip table alias prefixes (st.deleted → deleted)
      const whereMatch = cleanSql.match(/where (.+?)(?:\s+order\s+by|\s+group\s+by|\s+limit\s+|$)/i);
      if (whereMatch) {
        const whereClause = whereMatch[1].trim().replace(/(\w+)\.(\w+)/g, '$2');
        const preWhere = cleanSql.split(/where/i)[0];
        const preWhereParamCount = (preWhere.match(/\?/g) || []).length;

        rows = rows.filter(row => {
          const pIdx = { idx: preWhereParamCount };
          return this.evaluateWhere(whereClause, row, params, pIdx);
        });
      }

      // GROUP BY + aggregates
      const groupByMatch = cleanSql.match(/group by (\w+)/i);
      const selectPart = cleanSql.match(/^select (.+?) from/i);
      const selectFields = selectPart ? selectPart[1].toLowerCase().trim() : '*';

      if (selectFields.includes('count(')) {
        const countAliasMatch = selectFields.match(/count\([^)]*\)\s+as\s+(\w+)/i);
        const countKey = countAliasMatch ? countAliasMatch[1] : 'count';

        if (groupByMatch) {
          const groupField = groupByMatch[1].toLowerCase();
          const groups: { [key: string]: number } = {};
          for (const row of rows) {
            const val = String(row[groupField] ?? 'null');
            groups[val] = (groups[val] || 0) + 1;
          }
          rows = Object.keys(groups).map(k => {
            const r: any = {};
            r[groupField] = k;
            r[countKey] = groups[k];
            return r;
          });
        } else {
          rows = [{ [countKey]: rows.length }];
        }
      } else if (selectFields.includes('sum(')) {
        const sumMatch = selectFields.match(/sum\((\w+)\)\s*(?:as\s+(\w+))?/i);
        if (sumMatch) {
          const sumField = sumMatch[1].toLowerCase();
          const alias = sumMatch[2] || 'sum';
          const total = rows.reduce((acc, r) => acc + (Number(r[sumField]) || 0), 0);
          rows = [{ [alias]: total }];
        }
      }

      // ORDER BY
      const orderMatch = cleanSql.match(/order by (\w+)\s*(asc|desc)?/i);
      if (orderMatch && !selectFields.includes('count(')) {
        const field = orderMatch[1].toLowerCase();
        const direction = (orderMatch[2] || 'asc').toLowerCase();
        rows = rows.sort((a, b) => {
          const av = a[field] ?? '';
          const bv = b[field] ?? '';
          if (av < bv) return direction === 'asc' ? -1 : 1;
          if (av > bv) return direction === 'asc' ? 1 : -1;
          return 0;
        });
      }

      // LIMIT
      const limitMatch = cleanSql.match(/limit (\d+)/i);
      if (limitMatch && !selectFields.includes('count(')) {
        rows = rows.slice(0, parseInt(limitMatch[1], 10));
      }

      return {
        rows: JSON.parse(JSON.stringify(rows)),
        rowsAffected: 0,
      };
    }

    // UPDATE
    if (/^update/i.test(cleanSql)) {
      const match = cleanSql.match(/update (\w+)\s+set\s+(.+?)\s+where\s+(.+)/i);
      if (match) {
        const tableName = match[1].toLowerCase();
        const setPart = match[2];
        const wherePart = match[3];
        const rows = this.memoryTables[tableName] || [];

        // Parse SET assignments carefully (handle commas in quotes)
        const setAssignments = this.splitTokens(setPart);

        const assignments: { col: string; valueExpr: string }[] = [];
        for (const a of setAssignments) {
          const eqIdx = a.indexOf('=');
          if (eqIdx >= 0) {
            assignments.push({
              col: a.substring(0, eqIdx).trim().toLowerCase(),
              valueExpr: a.substring(eqIdx + 1).trim(),
            });
          }
        }

        // Count ? in SET clause (determines param offset for WHERE)
        const setParamCount = (setPart.match(/\?/g) || []).length;

        let updatedCount = 0;
        this.memoryTables[tableName] = rows.map(row => {
          const whereParamIdx = { idx: setParamCount };
          if (!this.evaluateWhere(wherePart, row, params, whereParamIdx)) {
            return row;
          }

          const updated = { ...row };
          const setParamIdx = { idx: 0 };
          for (const a of assignments) {
            updated[a.col] = this.resolveSetValue(a.valueExpr, row, params, setParamIdx);
          }
          updatedCount++;
          return updated;
        });

        await this.saveTableToIndexedDB(tableName);
        return {
          rows: [],
          rowsAffected: updatedCount,
        };
      }
    }

    // DELETE
    if (/^delete from/i.test(cleanSql)) {
      const match = cleanSql.match(/delete from (\w+)(?:\s+where\s+(.+))?/i);
      if (match) {
        const tableName = match[1].toLowerCase();
        const wherePart = match[2];
        const rows = this.memoryTables[tableName] || [];

        let deletedCount = 0;
        if (!wherePart) {
          deletedCount = rows.length;
          this.memoryTables[tableName] = [];
        } else {
          this.memoryTables[tableName] = rows.filter(row => {
            const pIdx = { idx: 0 };
            if (this.evaluateWhere(wherePart, row, params, pIdx)) {
              deletedCount++;
              return false;
            }
            return true;
          });
        }

        await this.saveTableToIndexedDB(tableName);
        return {
          rows: [],
          rowsAffected: deletedCount,
        };
      }
    }

    if (!/^alter table/i.test(cleanSql)) {
      console.warn(`Unsupported Web SQL syntax: ${sql}`);
    }
    return { rows: [], rowsAffected: 0 };
  }

  async transaction<T>(callback: (tx: IDatabase) => Promise<T>): Promise<T> {
    return await callback(this);
  }
}

export const db: IDatabase = new WebDatabase();
