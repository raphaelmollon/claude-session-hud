#!/bin/sh
# Declares this mod in CLAUDE_CODE_PLUGIN_DIRS, in the `env` block of the
# Claude Code user settings. Other folders already listed are kept.
#
#   sh install.sh               # install
#   sh install.sh --uninstall   # remove
#
# Needs python3 or node to edit the JSON.

set -eu

mode=install
case "${1:-}" in
  --uninstall) mode=uninstall ;;
  '') ;;
  *) echo "usage: sh install.sh [--uninstall]" >&2; exit 2 ;;
esac

mod_dir=$(cd "$(dirname "$0")" && pwd -P)
config_dir=${CLAUDE_CONFIG_DIR:-$HOME/.claude}
sep=:

# Git Bash, MSYS2 or Cygwin on Windows: Claude Code reads Windows paths there.
case "$(uname -s)" in
  MINGW* | MSYS* | CYGWIN*)
    mod_dir=$(cygpath -w "$mod_dir")
    config_dir=$(cygpath -u "$config_dir")
    sep=';'
    ;;
esac

settings=$config_dir/settings.json
mkdir -p "$config_dir"
[ -f "$settings" ] && cp "$settings" "$settings.bak-session-hud"

export SETTINGS="$settings" MOD_DIR="$mod_dir" SEP="$sep" MODE="$mode"

# Run each one rather than look it up: Windows has a python3 that only opens
# the Store, and often names the real one python.
py=
for candidate in python3 python; do
  if "$candidate" -c 'import sys; sys.exit(sys.version_info < (3,))' >/dev/null 2>&1; then
    py=$candidate
    break
  fi
done

if [ -n "$py" ]; then
  "$py" - <<'EOF'
import json, os

path, mod, sep, mode = (os.environ[k] for k in ("SETTINGS", "MOD_DIR", "SEP", "MODE"))
key = lambda d: os.path.normcase(os.path.abspath(os.path.expanduser(d.strip()))).rstrip("\\/")

try:
    with open(path, encoding="utf-8") as f:
        text = f.read()
    settings = json.loads(text) if text.strip() else {}
except FileNotFoundError:
    settings = {}

env = settings.setdefault("env", {})
dirs = [d.strip() for d in env.get("CLAUDE_CODE_PLUGIN_DIRS", "").split(sep) if d.strip()]
others = [d for d in dirs if key(d) != key(mod)]

if mode == "install" and len(others) < len(dirs):
    print(f"session-hud is already declared in {path}")
    raise SystemExit(0)

dirs = others if mode == "uninstall" else others + [mod]
if dirs:
    env["CLAUDE_CODE_PLUGIN_DIRS"] = sep.join(dirs)
else:
    env.pop("CLAUDE_CODE_PLUGIN_DIRS", None)

with open(path, "w", encoding="utf-8") as f:
    json.dump(settings, f, indent=2, ensure_ascii=False)
    f.write("\n")

print(f"session-hud {'removed from' if mode == 'uninstall' else 'declared in'} {path}")
EOF
elif command -v node >/dev/null 2>&1; then
  node - <<'EOF'
const fs = require('fs')
const os = require('os')
const p = require('path')

const { SETTINGS: path, MOD_DIR: mod, SEP: sep, MODE: mode } = process.env
const key = d => {
  d = d.trim()
  if (d === '~' || /^~[\\/]/.test(d)) d = os.homedir() + d.slice(1)
  d = p.resolve(d).replace(/[\\/]+$/, '')
  return process.platform === 'win32' ? d.toLowerCase() : d
}

let settings = {}
try {
  const text = fs.readFileSync(path, 'utf8')
  if (text.trim() !== '') settings = JSON.parse(text)
} catch (e) {
  if (e.code !== 'ENOENT') throw e
}

const env = (settings.env ??= {})
const dirs = (env.CLAUDE_CODE_PLUGIN_DIRS ?? '').split(sep).map(d => d.trim()).filter(Boolean)
const others = dirs.filter(d => key(d) !== key(mod))

if (mode === 'install' && others.length < dirs.length) {
  console.log(`session-hud is already declared in ${path}`)
  process.exit(0)
}

const next = mode === 'uninstall' ? others : [...others, mod]
if (next.length > 0) env.CLAUDE_CODE_PLUGIN_DIRS = next.join(sep)
else delete env.CLAUDE_CODE_PLUGIN_DIRS

fs.writeFileSync(path, JSON.stringify(settings, null, 2) + '\n')
console.log(`session-hud ${mode === 'uninstall' ? 'removed from' : 'declared in'} ${path}`)
EOF
else
  echo "python3 or node is needed to edit $settings." >&2
  echo "Add this folder to CLAUDE_CODE_PLUGIN_DIRS in its \"env\" block by hand:" >&2
  echo "  $mod_dir" >&2
  exit 1
fi

echo 'Restart Claude Code to apply.'
