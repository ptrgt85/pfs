# Filing System - Hierarchical Data Management

A SvelteKit web application with PostgreSQL for managing hierarchical company data with multiple levels of subgroups.

## Features

- **Hierarchical Structure**: Company → Project → Precinct → Stage → (Permits, Approvals, Invoices, Lots) → Lot Subgroups
- **Reusable Components**: Modular DataTable component with full CRUD operations
- **Editable Tables**: Double-click cells to edit inline
- **Sortable Columns**: Click column headers to sort data
- **Resizable Columns**: Drag column borders to adjust width
- **Drag & Drop**: Reorder rows by dragging (functionality ready for implementation)
- **Breadcrumb Navigation**: Easy navigation through the hierarchy
- **Relational Database**: Optimized PostgreSQL schema with proper foreign keys
- **Clean UI**: Simple, text and symbol-based interface ready for theming

## Database Structure

```
companies
  ├── projects
  │   └── precincts
  │       └── stages
  │           ├── permits
  │           ├── approvals
  │           ├── invoices
  │           └── lots
  │               └── lot_subgroups
```

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- npm or yarn

## Setup Instructions

### 1. Database Setup

Create a PostgreSQL database:

```bash
createdb filing_system
```

Or using psql:

```sql
CREATE DATABASE filing_system;
```

### 2. Environment Configuration

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and update the database connection string:

```
DATABASE_URL=postgresql://username:password@localhost:5432/filing_system
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Generate Database Schema

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

### 5. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Usage

### Navigation

1. **Home Page**: View all companies
2. **Click a company**: View its projects
3. **Click a project**: View its precincts
4. **Click a precinct**: View its stages
5. **Click a stage**: View tabs for Permits, Approvals, Invoices, and Lots
6. **Click a lot**: View its subgroups

### Table Operations

- **Add**: Click the "+ Add New" button
- **Edit**: Double-click any editable cell
- **Delete**: Click the "✕" button in the Actions column
- **Sort**: Click column headers
- **Resize**: Drag column borders
- **Navigate**: Click on any row to drill down

### Keyboard Shortcuts

- **Enter**: Save cell edit
- **Escape**: Cancel cell edit

## API Endpoints

All endpoints support GET, POST, PUT, and DELETE methods:

- `/api/companies`
- `/api/projects?companyId={id}`
- `/api/precincts?projectId={id}`
- `/api/stages?precinctId={id}`
- `/api/permits?stageId={id}`
- `/api/approvals?stageId={id}`
- `/api/invoices?stageId={id}`
- `/api/lots?stageId={id}`
- `/api/lot-subgroups?lotId={id}`

## Project Structure

```
filing-system-app/
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   └── DataTable.svelte    # Reusable table component
│   │   └── db/
│   │       ├── index.ts             # Database connection
│   │       └── schema.ts            # Database schema
│   └── routes/
│       ├── api/                     # API endpoints
│       ├── companies/[id]/          # Company detail page
│       ├── projects/[id]/           # Project detail page
│       ├── precincts/[id]/          # Precinct detail page
│       ├── stages/[id]/             # Stage detail page
│       ├── lots/[id]/               # Lot detail page
│       └── +page.svelte             # Home page
├── drizzle.config.ts                # Drizzle ORM configuration
└── package.json
```

## Technology Stack

- **Frontend**: SvelteKit, TypeScript
- **Backend**: SvelteKit API routes
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Styling**: Component-scoped CSS

## Future Enhancements

- [ ] Complete drag-and-drop reordering with database persistence
- [ ] Add theme support (dark mode, color schemes)
- [ ] Export data to CSV/Excel
- [ ] Advanced filtering and search
- [ ] User authentication and permissions
- [ ] Audit logging
- [ ] Bulk operations
- [ ] File attachments
- [ ] Dashboard with analytics

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run database migrations
npx drizzle-kit generate
npx drizzle-kit push
```

## License

MIT
