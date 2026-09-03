export default () => ({
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/documentflow',
  uploadDir: process.env.UPLOAD_DIR || './data/documents',
  previewDir: process.env.PREVIEW_DIR || './data/previews'
});