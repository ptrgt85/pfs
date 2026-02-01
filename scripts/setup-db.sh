#!/bin/bash

echo "🗄️  Setting up Filing System Database..."

# Check if .env exists
if [ ! -f .env ]; then
  echo "⚠️  .env file not found. Creating from .env.example..."
  cp .env.example .env
  echo "✅ Created .env file. Please update it with your database credentials."
  exit 1
fi

# Source the .env file
source .env

# Extract database name from DATABASE_URL
DB_NAME=$(echo $DATABASE_URL | sed 's/.*\/\([^?]*\).*/\1/')

echo "📦 Database name: $DB_NAME"

# Check if database exists
if psql -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
  echo "✅ Database '$DB_NAME' already exists"
else
  echo "🔨 Creating database '$DB_NAME'..."
  createdb $DB_NAME
  echo "✅ Database created"
fi

# Generate and push schema
echo "🔄 Generating database schema..."
npx drizzle-kit generate

echo "🚀 Pushing schema to database..."
npx drizzle-kit push

echo "✅ Database setup complete!"
echo ""
echo "Next steps:"
echo "  1. Run 'npm run dev' to start the development server"
echo "  2. Open http://localhost:5173 in your browser"
