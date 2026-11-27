# Shared by the hooks in this directory (sourced, not executed).
# Keeps every commit in this repo authored and committed as the project identity.

ALLOWED_NAME='0xbeef1eaf'
ALLOWED_EMAIL='151461594+0xbeef1eaf@users.noreply.github.com'

# Trailers that would credit another identity; commit-msg strips them, pre-push rejects them.
FOREIGN_TRAILERS='^(co-authored-by|claude-session|signed-off-by):'

# Optional, untracked: one extended regex per line (case-insensitive) that must never appear in
# commit messages or added lines, e.g. old usernames. Lives in .git/, so it is never published.
DENYLIST="$(git rev-parse --git-common-dir)/info/identity-denylist"

# CI (the release bot commits as github-actions[bot]) and EAS builds are not checked.
in_ci() {
  [ -n "${CI:-}" ] || [ -n "${GITHUB_ACTIONS:-}" ] || [ -n "${EAS_BUILD:-}" ]
}

fail() {
  printf '\033[31m✖ %s\033[0m\n' "$1" >&2
  shift
  for line in "$@"; do printf '  %s\n' "$line" >&2; done
  exit 1
}

# `git var` resolves config, -c overrides and GIT_AUTHOR_*/GIT_COMMITTER_* env vars.
check_ident() {
  label=$1
  ident=$(git var "GIT_${label}_IDENT" 2>/dev/null) ||
    fail "No ${label} identity configured." "Run: sh scripts/setup-git.sh"
  name=${ident% <*}
  email=${ident#*<}
  email=${email%%>*}
  if [ "$name" != "$ALLOWED_NAME" ] || [ "$email" != "$ALLOWED_EMAIL" ]; then
    fail "Commit ${label} is \"$name <$email>\"; this repo only accepts \"$ALLOWED_NAME <$ALLOWED_EMAIL>\"." \
      "Run: sh scripts/setup-git.sh   (or unset GIT_${label}_NAME / GIT_${label}_EMAIL)"
  fi
}

# Prints the deny-list lines that match stdin (nothing when there is no deny-list).
denylist_hits() {
  [ -s "$DENYLIST" ] || { cat >/dev/null; return 0; }
  grep -v -e '^[[:space:]]*#' -e '^[[:space:]]*$' "$DENYLIST" >"${TMPDIR:-/tmp}/denylist.$$" || true
  if [ -s "${TMPDIR:-/tmp}/denylist.$$" ]; then
    grep -i -E -o -f "${TMPDIR:-/tmp}/denylist.$$" | sort -u
  else
    cat >/dev/null
  fi
  rm -f "${TMPDIR:-/tmp}/denylist.$$"
}
