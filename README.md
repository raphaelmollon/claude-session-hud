# session-hud

Mod Claude Code : un bandeau permanent au-dessus du prompt qui affiche

- le contexte de la session (jauge, tokens utilisés / fenêtre) et ce qu'un `/compact` libérerait ;
- les limites 5 h et hebdomadaire, avec le délai avant réinitialisation ;
- l'état Remote Control (`/rc` ou `/off`) ;
- le modèle, l'effort, l'abonnement, la version de Claude Code, le répertoire courant et l'état git (fichiers à committer, commits à pousser).

```
Ctx  42%      84k/200k  /compact to free 60k   5h  23%   reset in 2h 14m   7d  61%    /rc   Opus 5.5 · high · Max · v2.1.289 · E:\tools\claude_mods · 1 to commit · 2 to push
```

## Installation

1. Cloner le dépôt où vous voulez :

   ```sh
   git clone https://github.com/raphaelmollon/claude-session-hud.git
   ```

2. Déclarer le dossier dans les réglages de Claude Code, avec le script de votre plateforme, lancé depuis le clone :

   | Plateforme | Commande |
   | --- | --- |
   | Windows (PowerShell) | `powershell -ExecutionPolicy Bypass -File install.ps1` |
   | macOS, Linux, Git Bash, WSL | `sh install.sh` |

   Le script ajoute le chemin du clone à `CLAUDE_CODE_PLUGIN_DIRS`, dans le bloc `env` de `settings.json` (dans `CLAUDE_CONFIG_DIR` s'il est défini, sinon `~/.claude`). Les autres mods déjà déclarés sont conservés, relancer le script ne change rien, et une copie du fichier d'origine est gardée dans `settings.json.bak-session-hud`. `install.sh` a besoin de Python 3 ou de Node.js.

   Pour désinstaller : `install.ps1 -Uninstall` ou `sh install.sh --uninstall`.

   Sans script, ajoutez vous-même le chemin absolu du clone :

   ```json
   {
     "env": {
       "CLAUDE_CODE_PLUGIN_DIRS": "C:\\chemin\\vers\\claude-session-hud"
     }
   }
   ```

   Pour plusieurs mods, séparez les chemins par `;` sous Windows et par `:` ailleurs.

3. Relancer Claude Code.

Pour mettre à jour : `git pull` dans le clone, puis relancer Claude Code.

## Développement

Les définitions de types de `.claude-plugin/types/` sont générées par Claude Code et ne sont pas versionnées. Les tests sont dans `tests/session-hud.test.ts`.

## Licence

[MIT](LICENSE)
