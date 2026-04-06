import path from 'path';
import { pathToFileURL } from 'url';
import { glob } from 'tinyglobby';

/**
 * Expands glob patterns to file paths and dynamically imports each matched file.
 * Returns the imported module objects in an unspecified order.
 * Forward slashes are normalised so patterns work on Windows too.
 */
export async function importGlob(patterns: string[]): Promise<unknown[]> {
  const files = await glob(patterns.map((p) => p.replace(/\\/g, '/')));

  return Promise.all(files.map((file) => import(pathToFileURL(path.resolve(file)).href)));
}
