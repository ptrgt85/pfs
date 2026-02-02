# Development Workflow

## Local Development

### Start Development Server
```bash
npm run dev
```
- Opens at `http://localhost:5174` (or next available port)
- Auto-reloads when you make changes
- Uses your local `.env` file

### Test Before Committing
1. Make code changes
2. Test in browser at localhost
3. Check browser console for errors (F12)
4. Test all affected features

## Git Workflow

### Option 1: Direct to Main (Quick fixes)
```bash
# Make changes
npm run dev  # Test locally

# Commit and push
git add .
git commit -m "Fix: description of fix"
git push
```
**Result:** Deploys immediately to production

### Option 2: Feature Branch (Recommended for new features)
```bash
# Create feature branch
git checkout -b feature/new-feature-name

# Make changes and test
npm run dev

# Commit to branch
git add .
git commit -m "Add: new feature"
git push -u origin feature/new-feature-name
```
**Result:** Vercel creates a preview deployment URL

**Test the preview, then merge:**
```bash
git checkout main
git merge feature/new-feature-name
git push
```

## Vercel Preview Deployments

Every branch you push gets a unique preview URL:
- Go to Vercel Dashboard → Deployments
- Find your branch deployment
- Click to get preview URL
- Test in production-like environment
- Share with others for review

## Environment Variables

### Local (.env file)
- Used when running `npm run dev`
- Never commit `.env` to git
- Copy `.env.example` to `.env` for new developers

### Vercel (Production)
- Set in Vercel Dashboard → Settings → Environment Variables
- Different from local `.env`
- Must redeploy after changing

## Common Commands

```bash
# Run locally
npm run dev

# Build for production (test build)
npm run build
npm run preview

# Check for TypeScript errors
npm run check

# Database operations
npm run db:push      # Push schema changes
npm run db:studio    # Open Drizzle Studio

# Create new branch
git checkout -b feature/branch-name

# Switch branches
git checkout main
git checkout feature/other-branch

# See what changed
git status
git diff

# Undo local changes (careful!)
git checkout -- filename.ts

# Pull latest from remote
git pull
```

## Best Practices

1. **Always test locally first** - `npm run dev`
2. **Use feature branches** for anything non-trivial
3. **Small, focused commits** - easier to review and revert
4. **Test Vercel preview** before merging to main
5. **Keep main branch stable** - it's your production code

## Troubleshooting

### Port already in use
```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### Changes not showing
- Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- Check browser console for errors
- Restart dev server

### Environment variables not loading
- Restart dev server after changing `.env`
- Check `.env` has no quotes around values (except DATABASE_URL)

### Database connection issues
- Check `DATABASE_URL` in `.env`
- Ensure you're connected to internet
- Try `npm run db:push` to test connection
