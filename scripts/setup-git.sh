#!/bin/sh
# Configure this checkout so every commit is made, and every push authenticated, as the
# project identity. Safe to re-run; `npm install` / `npm ci` run it via the `prepare` script.
#
#   sh scripts/setup-git.sh                  # hooks + identity (+ gh credentials if logged in)
#   sh scripts/setup-git.sh --deny 'regex'   # also add a pattern to the local deny-list (repeatable)
#   sh scripts/setup-git.sh --quiet          # no output unless something needs attention
set -eu

quiet=false
deny=''
while [ $# -gt 0 ]; do
  case "$1" in
    --quiet) quiet=true ;;
    --deny)
      shift
      deny="$deny${1:?--deny needs a pattern}
"
      ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

# Not for CI / EAS builds (the release bot commits as itself) or tarball installs.
if [ -n "${CI:-}" ] || [ -n "${GITHUB_ACTIONS:-}" ] || [ -n "${EAS_BUILD:-}" ]; then exit 0; fi
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

say() { $quiet || printf '%s\n' "$*"; }

root=$(git rev-parse --show-toplevel)
. "$root/.githooks/identity.sh"
GH_DIR="$HOME/.config/gh-0xbeef1eaf"

git config --local core.hooksPath .githooks
git config --local user.name "$ALLOWED_NAME"
git config --local user.email "$ALLOWED_EMAIL"
git config --local user.useConfigOnly true
say "✓ hooks (.githooks) and identity: $ALLOWED_NAME <$ALLOWED_EMAIL>"

if [ -f "$GH_DIR/hosts.yml" ]; then
  git config --local --unset-all credential.https://github.com.helper 2>/dev/null || true
  git config --local --add credential.https://github.com.helper ''
  git config --local --add credential.https://github.com.helper \
    "!GH_CONFIG_DIR=$GH_DIR gh auth git-credential"
  say "✓ pushes authenticate with the gh login in $GH_DIR"
else
  printf '%s\n' "! No 0xbeef1eaf gh login yet; pushes will use your default credentials. Log in with:" \
    "    GH_CONFIG_DIR=$GH_DIR gh auth login --web --git-protocol https" \
    "  then re-run: sh scripts/setup-git.sh" >&2
fi

if [ -n "$deny" ]; then
  mkdir -p "$(dirname "$DENYLIST")"
  printf '%s' "$deny" | while IFS= read -r pattern; do
    grep -qxF -- "$pattern" "$DENYLIST" 2>/dev/null || printf '%s\n' "$pattern" >>"$DENYLIST"
  done
  say "✓ deny-list ($DENYLIST) now has $(grep -c . "$DENYLIST") pattern(s)"
fi
