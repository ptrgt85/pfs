# Quick Start Guide

Get the Filing System up and running in 5 minutes!

## Prerequisites Check

```bash
# Check Node.js version (need v18+)
node --version

# Check PostgreSQL is installed
psql --version

# Check if PostgreSQL is running
pg_isready
```

## Setup Steps

### 1. Configure Database

```bash
# Create .env file
cp .env.example .env

# Edit .env and set your database credentials
# DATABASE_URL=postgresql://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/filing_system
```

### 2. Run Setup Script

```bash
# Make script executable (if not already)
chmod +x scripts/setup-db.sh

# Run the setup
./scripts/setup-db.sh
```

Or manually:

```bash
# Create database
createdb filing_system

# Generate and push schema
npx drizzle-kit generate
npx drizzle-kit push
```

### 3. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:5173`

## First Steps in the App

1. **Add a Company**: Click "+ Add New" on the home page
2. **Add Projects**: Click on the company, then add projects
3. **Add Precincts**: Click on a project, then add precincts
4. **Add Stages**: Click on a precinct, then add stages
5. **Add Details**: Click on a stage to add permits, approvals, invoices, and lots

## Common Issues

### Database Connection Error

- Check PostgreSQL is running: `pg_isready`
- Verify credentials in `.env`
- Ensure database exists: `psql -l | grep filing_system`

### Port Already in Use

```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9

# Or use a different port
npm run dev -- --port 3000
```

### TypeScript Errors

These are expected during initial setup and will resolve once the dev server runs and generates types.

## Sample Data

To add sample data, use the UI or run SQL:

```sql
-- Connect to database
psql filing_system

-- Add sample company
INSERT INTO companies (name, abn, owners) 
VALUES ('Acme Corp', '12345678901', 'John Doe');

-- Add sample project
INSERT INTO projects (company_id, name, description) 
VALUES (1, 'Downtown Development', 'City center project');
```

## Next Steps

- Explore the hierarchical navigation
- Try editing cells by double-clicking
- Sort columns by clicking headers
- Resize columns by dragging borders
- Add data at each level

## Support

For issues, check:
- README.md for full documentation
- Database schema in `src/lib/db/schema.ts`
- API routes in `src/routes/api/`
