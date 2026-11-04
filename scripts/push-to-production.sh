#!/bin/bash
# Push migrations and changes to production Supabase

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "🚀 Push to Production Supabase"
echo "================================"
echo ""

case "$1" in
  migrations)
    echo "📦 Pushing migrations to production..."
    echo ""
    echo "⚠️  WARNING: This will apply all pending migrations to PRODUCTION!"
    echo ""

    # Show what migrations exist
    echo "📋 Migrations to apply:"
    ls -la supabase/migrations/
    echo ""

    read -p "Are you sure you want to push to production? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      echo ""
      echo "🔄 Pushing migrations..."
      supabase db push
      echo ""
      echo "✅ Migrations pushed to production!"
    else
      echo "❌ Cancelled"
      exit 1
    fi
    ;;

  diff)
    echo "🔍 Comparing local schema with production..."
    echo ""
    supabase db diff --linked
    ;;

  link)
    echo "🔗 Linking to production Supabase project..."
    echo ""
    echo "You'll need your project reference from:"
    echo "https://supabase.com/dashboard/project/_/settings/general"
    echo ""
    read -p "Enter your Supabase project reference: " PROJECT_REF
    if [ -n "$PROJECT_REF" ]; then
      supabase link --project-ref "$PROJECT_REF"
      echo "✅ Linked to project: $PROJECT_REF"
    else
      echo "❌ No project reference provided"
      exit 1
    fi
    ;;

  status)
    echo "📊 Production database status:"
    echo ""
    supabase db remote list
    ;;

  pull)
    echo "📥 Pulling remote schema changes..."
    echo ""
    echo "⚠️  This will create a new migration from production schema changes."
    read -p "Continue? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      supabase db pull
      echo "✅ Schema pulled from production"
    else
      echo "❌ Cancelled"
    fi
    ;;

  *)
    echo "Push to Production Helper"
    echo ""
    echo "Usage: $0 {migrations|diff|link|status|pull}"
    echo ""
    echo "Commands:"
    echo "  migrations - Push all pending migrations to production"
    echo "  diff       - Compare local schema with production"
    echo "  link       - Link this project to a production Supabase instance"
    echo "  status     - Show remote migration status"
    echo "  pull       - Pull schema changes from production"
    echo ""
    echo "Setup (first time):"
    echo "  1. Run '$0 link' to connect to your production project"
    echo "  2. Run '$0 diff' to see any differences"
    echo "  3. Run '$0 migrations' to push changes"
    exit 1
    ;;
esac
