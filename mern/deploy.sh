#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# APMC Yard — Fly.io deploy script
# Run once: bash deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

APP_NAME="apmc-yard"
REGION="bom"   # Mumbai — change to nearest if outside India

echo ""
echo "════════════════════════════════════════════"
echo "  APMC Yard — Fly.io Deploy"
echo "════════════════════════════════════════════"
echo ""

# 1. Check flyctl
if ! command -v fly &>/dev/null; then
  echo "▶ flyctl not found. Installing..."
  curl -L https://fly.io/install.sh | sh
  export PATH="$HOME/.fly/bin:$PATH"
fi

# 2. Login check
if ! fly auth whoami &>/dev/null; then
  echo "▶ Please log in to Fly.io:"
  fly auth login
fi

# 3. Create app if it doesn't exist yet
if ! fly apps list 2>/dev/null | grep -q "$APP_NAME"; then
  echo "▶ Creating Fly app: $APP_NAME (region: $REGION)"
  fly apps create "$APP_NAME" --org personal 2>/dev/null || true
fi

# 4. Collect secrets interactively
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Set secrets (press Enter to skip if already set)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

read -rp "MongoDB URI (mongodb+srv://...): " MONGO_URI
read -rp "JWT Secret (min 32 chars random string): " JWT_SEC
read -rp "Admin name (e.g. APMC Admin): " ADMIN_NAME
read -rp "Admin email: " ADMIN_EMAIL
read -rsp "Admin password (min 12 chars): " ADMIN_PASS
echo ""

SECRETS_ARGS=""
[ -n "$MONGO_URI" ]   && SECRETS_ARGS+=" MONGODB_URI='$MONGO_URI'"
[ -n "$JWT_SEC" ]     && SECRETS_ARGS+=" JWT_SECRET='$JWT_SEC'"
[ -n "$ADMIN_NAME" ]  && SECRETS_ARGS+=" ADMIN_NAME='$ADMIN_NAME'"
[ -n "$ADMIN_EMAIL" ] && SECRETS_ARGS+=" ADMIN_EMAIL='$ADMIN_EMAIL'"
[ -n "$ADMIN_PASS" ]  && SECRETS_ARGS+=" ADMIN_PASSWORD='$ADMIN_PASS'"
# CLIENT_ORIGIN is same domain in single-app setup
SECRETS_ARGS+=" CLIENT_ORIGIN='https://$APP_NAME.fly.dev'"

if [ -n "$SECRETS_ARGS" ]; then
  echo "▶ Setting secrets..."
  eval fly secrets set $SECRETS_ARGS --app "$APP_NAME" --stage
fi

# 5. Deploy
echo ""
echo "▶ Deploying (this will build Docker image and push)..."
fly deploy --app "$APP_NAME" --region "$REGION"

echo ""
echo "✅  Deploy complete!"
echo "    App URL : https://$APP_NAME.fly.dev"
echo "    Health  : https://$APP_NAME.fly.dev/api/health"
echo ""

# 6. Seed admin (only if ADMIN_EMAIL was just set)
if [ -n "$ADMIN_EMAIL" ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  read -rp "Create first admin user now? (y/N): " SEED
  if [[ "$SEED" =~ ^[Yy]$ ]]; then
    echo "▶ Running seed script on Fly machine..."
    fly ssh console --app "$APP_NAME" --command "node src/scripts/seedAdmin.js"
    echo ""
    echo "⚠  Remove ADMIN_PASSWORD secret now:"
    echo "   fly secrets unset ADMIN_PASSWORD --app $APP_NAME"
  fi
fi

echo ""
echo "Done! Open: https://$APP_NAME.fly.dev"
