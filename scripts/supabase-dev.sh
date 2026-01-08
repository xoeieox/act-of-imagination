#!/bin/bash
# Supabase local development helper

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

case "$1" in
  start)
    echo "🚀 Starting local Supabase..."
    supabase start
    echo ""
    echo "✅ Local Supabase running!"
    echo "📊 Studio: http://localhost:54333"
    echo ""
    ;;

  stop)
    echo "🛑 Stopping local Supabase..."
    supabase stop
    echo "✅ Stopped"
    ;;

  restart)
    echo "🔄 Restarting local Supabase..."
    supabase stop
    supabase start
    echo "✅ Restarted"
    ;;

  reset)
    echo "⚠️  Resetting local database (will apply all migrations fresh)..."
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      supabase db reset
      echo "✅ Database reset complete"
    else
      echo "❌ Cancelled"
    fi
    ;;

  status)
    echo "📊 Local Supabase status:"
    supabase status
    ;;

  migrate)
    if [ -z "$2" ]; then
      echo "❌ Error: Migration name required"
      echo "Usage: $0 migrate <migration_name>"
      exit 1
    fi
    echo "📝 Creating new migration: $2"
    supabase migration new "$2"
    echo "✅ Created migration file in supabase/migrations/"
    ;;

  diff)
    echo "🔍 Checking for schema drift..."
    supabase db diff
    ;;

  studio)
    echo "🎨 Opening Supabase Studio..."
    open http://localhost:54333
    ;;

  *)
    echo "Supabase Local Development Helper"
    echo ""
    echo "Usage: $0 {start|stop|restart|reset|status|migrate|diff|studio}"
    echo ""
    echo "Commands:"
    echo "  start     - Start local Supabase"
    echo "  stop      - Stop local Supabase"
    echo "  restart   - Restart local Supabase"
    echo "  reset     - Reset database (applies all migrations fresh)"
    echo "  status    - Show local Supabase status"
    echo "  migrate   - Create new migration file"
    echo "  diff      - Check for schema drift"
    echo "  studio    - Open Supabase Studio in browser"
    exit 1
    ;;
esac
