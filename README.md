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

2. Déclarer le dossier dans `~/.claude/settings.json` (chemin absolu vers le clone) :

   ```json
   {
     "env": {
       "CLAUDE_CODE_PLUGIN_DIRS": "C:\\chemin\\vers\\claude-session-hud"
     }
   }
   ```

3. Relancer Claude Code.

Pour mettre à jour : `git pull` dans le clone, puis relancer Claude Code.

## Développement

Les définitions de types de `.claude-plugin/types/` sont générées par Claude Code et ne sont pas versionnées. Les tests sont dans `tests/session-hud.test.ts`.
