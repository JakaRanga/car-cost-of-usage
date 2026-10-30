import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import type { Collection } from 'mongodb';
import path from 'node:path';

/** Port the HTTP server listens on. */
const PORT = Number(process.env.PORT ?? 3000);
/** MongoDB connection string. */
const MONGO_URL = process.env.MONGO_URL ?? 'mongodb://localhost:27017';
/** MongoDB database name. */
const MONGO_DB = process.env.MONGO_DB ?? 'carcost';
/** Built Angular app served as static files and used for the SPA fallback. */
const BROWSER_DIR = path.resolve(process.cwd(), 'dist/CarCostCompare/browser');

/** Document shape stored in the `comparisons` collection. */
interface ComparisonDoc {
  _id: ObjectId;
  name: string;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/** Comparison as returned by the API (dates as ISO strings). */
interface ComparisonDto {
  id: string;
  name: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** Outcome of validating a comparison request body. */
type ValidationResult =
  | { ok: true; name: string; data: Record<string, unknown> }
  | { ok: false; error: string };

/** Collection handle, assigned once the database connection is open. */
let comparisons: Collection<ComparisonDoc>;

/**
 * Checks whether a value is a non-null, non-array object.
 * @param value Any value from a parsed JSON body.
 * @returns True when the value is a plain object.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates a comparison request body (name, data.settings, data.cars).
 * @param body The parsed request body.
 * @returns The trimmed name and data on success, or an error message.
 */
function validateComparison(body: unknown): ValidationResult {
  if (!isPlainObject(body)) return { ok: false, error: 'Body must be a JSON object' };
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length === 0 || name.length > 100) {
    return { ok: false, error: 'name must be a non-empty string of at most 100 characters' };
  }
  const data = body.data;
  if (!isPlainObject(data)) return { ok: false, error: 'data must be an object' };
  if (!isPlainObject(data.settings)) return { ok: false, error: 'data.settings must be an object' };
  if (!Array.isArray(data.cars)) return { ok: false, error: 'data.cars must be an array' };
  return { ok: true, name, data };
}

/**
 * Converts a MongoDB id string to an ObjectId when it is valid.
 * @param id The id taken from the URL.
 * @returns The ObjectId, or null when the id is malformed.
 */
function toObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

/**
 * Maps a stored document to the API representation.
 * @param doc The MongoDB document.
 * @returns The comparison with string id and ISO dates.
 */
function toDto(doc: ComparisonDoc): ComparisonDto {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    data: doc.data,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/**
 * GET /api/comparisons - lists comparisons, most recently updated first, without data.
 * @param _req The incoming request.
 * @param res The response to send the list to.
 */
async function listComparisons(_req: Request, res: Response): Promise<void> {
  const docs = await comparisons
    .find({}, { projection: { name: 1, updatedAt: 1 } })
    .sort({ updatedAt: -1 })
    .toArray();
  res.json(
    docs.map((doc) => ({
      id: doc._id.toHexString(),
      name: doc.name,
      updatedAt: doc.updatedAt.toISOString(),
    })),
  );
}

/**
 * GET /api/comparisons/:id - returns one comparison with its data.
 * @param req The request carrying the comparison id.
 * @param res The response, 404 when the id is invalid or missing.
 */
async function getComparison(req: Request<{ id: string }>, res: Response): Promise<void> {
  const oid = toObjectId(req.params.id);
  const doc = oid ? await comparisons.findOne({ _id: oid }) : null;
  if (!doc) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(toDto(doc));
}

/**
 * POST /api/comparisons - creates a comparison from the request body.
 * @param req The request carrying name and data.
 * @param res The response, 201 with the created comparison or 400 on invalid input.
 */
async function createComparison(req: Request, res: Response): Promise<void> {
  const result = validateComparison(req.body);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  const now = new Date();
  const doc: ComparisonDoc = {
    _id: new ObjectId(),
    name: result.name,
    data: result.data,
    createdAt: now,
    updatedAt: now,
  };
  await comparisons.insertOne(doc);
  res.status(201).json(toDto(doc));
}

/**
 * PUT /api/comparisons/:id - replaces the name and data of a comparison.
 * @param req The request carrying the comparison id and the new name and data.
 * @param res The response with the updated comparison, 404 when not found, 400 on invalid input.
 */
async function updateComparison(req: Request<{ id: string }>, res: Response): Promise<void> {
  const oid = toObjectId(req.params.id);
  if (!oid) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const result = validateComparison(req.body);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  const doc = await comparisons.findOneAndUpdate(
    { _id: oid },
    { $set: { name: result.name, data: result.data, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!doc) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(toDto(doc));
}

/**
 * DELETE /api/comparisons/:id - removes a comparison.
 * @param req The request carrying the comparison id.
 * @param res The response, 204 when deleted or 404 when not found.
 */
async function deleteComparison(req: Request<{ id: string }>, res: Response): Promise<void> {
  const oid = toObjectId(req.params.id);
  const result = oid ? await comparisons.deleteOne({ _id: oid }) : { deletedCount: 0 };
  if (result.deletedCount === 0) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.status(204).end();
}

/**
 * Catch-all for unknown /api routes.
 * @param _req The incoming request.
 * @param res The response, always a 404 JSON error.
 */
function apiNotFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}

/**
 * SPA fallback: serves the Angular index.html for any non-API GET.
 * @param _req The incoming request.
 * @param res The response carrying index.html.
 */
function spaFallback(_req: Request, res: Response): void {
  res.sendFile(path.join(BROWSER_DIR, 'index.html'));
}

/**
 * Logs unhandled errors and returns a generic 500 JSON response.
 * @param err The error passed down by Express.
 * @param _req The incoming request.
 * @param res The response to send the error to.
 * @param _next Unused; required so Express treats this as an error handler.
 */
function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const status = (err as { status?: number }).status;
  if (status === 400 || status === 413) {
    res.status(status).json({ error: status === 413 ? 'Payload too large' : 'Malformed JSON' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal error' });
}

const app = express();
app.use(express.json({ limit: '1mb' }));
app.get('/api/comparisons', listComparisons);
app.get('/api/comparisons/:id', getComparison);
app.post('/api/comparisons', createComparison);
app.put('/api/comparisons/:id', updateComparison);
app.delete('/api/comparisons/:id', deleteComparison);
app.use('/api', apiNotFound);
app.use(express.static(BROWSER_DIR));
app.get(/^(?!\/api).*/, spaFallback);
app.use(errorHandler);

/**
 * Connects to MongoDB once, then starts the HTTP server.
 */
async function main(): Promise<void> {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  comparisons = client.db(MONGO_DB).collection<ComparisonDoc>('comparisons');
  app.listen(PORT, () => {
    console.log(`CarCostCompare API listening on port ${PORT}`);
  });
}

main().catch((err: unknown) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
