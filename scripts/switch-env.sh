#!/bin/bash
# Environment switcher for Supabase

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

case "$1" in
  local)
    echo "🔧 Switching to LOCAL environment..."
    ln -sf .env.local .env
    echo "✅ Now using .env.local"
    echo "🔗 Supabase URL: http://localhost:54331"
    echo ""
    echo "Make sure local Supabase is running:"
    echo "  ./scripts/supabase-dev.sh start"
    ;;

  production|prod)
    echo "🚀 Switching to PRODUCTION environment..."
    echo "⚠️  WARNING: You will be connecting to the LIVE database!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      ln -sf .env.production .env
      echo "✅ Now using .env.production"
    else
      echo "❌ Cancelled"
      exit 1
    fi
    ;;

  status)
    if [ -L .env ]; then
      TARGET=$(readlink .env)
      echo "📍 Current environment: $TARGET"
      echo ""

      case "$TARGET" in
        .env.local)
          echo "🔧 Using LOCAL configuration"
          ;;
        .env.production)
          echo "🚀 Using PRODUCTION configuration"
          ;;
      esac

      echo ""
      echo "Contents (keys hidden):"
      grep -v "ANON_KEY" .env 2>/dev/null || cat .env
    else
      echo "📍 Current .env file (not a symlink):"
      grep -v "ANON_KEY" .env 2>/dev/null || echo "No .env file found"
      echo ""
      echo "Run: $0 local  OR  $0 production"
    fi
    ;;

  *)
    echo "Environment Switcher for Supabase"
    echo ""
    echo "Usage: $0 {local|production|status}"
    echo ""
    echo "Commands:"
    echo "  local       - Switch to local development"
    echo "  production  - Switch to production (requires confirmation)"
    echo "  status      - Show current environment"
    exit 1
    ;;
esac
