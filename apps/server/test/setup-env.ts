import * as os from 'os';
import * as path from 'path';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgres://postgres:dongdong@localhost:5432/documentflow_test';
process.env.UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(os.tmpdir(), 'documentflow-test-uploads');
process.env.PREVIEW_DIR = process.env.PREVIEW_DIR || path.join(os.tmpdir(), 'documentflow-test-previews');