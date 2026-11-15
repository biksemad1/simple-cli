# Simple CLI – Overblik til Claude Code

Et roligt overblikspanel ved siden af chatten i Claude Code, så det er nemmere at komme i gang for folk, der ikke er vant til terminalen.

Panelet viser:

- **Kontekst** – hvor fyldt samtalen er, som en farvet bjælke (grøn → gul → rød)
- **Forbrug** – omtrentlig pris for sessionen og hvor tæt du er på abonnementets grænser
- **Knapper** – *Komprimér* (pakker samtalen sammen, når den bliver lang) og *Ny samtale*
- **Agenter** – hjælpere (subagenter), Claude har sat i gang, og om de kører eller er færdige
- **Filer** – de filer, Claude har skrevet, med en *Åbn*-knap (HTML åbnes i browseren, scripts i din editor) og en knap til at åbne projektmappen

Panelet åbner af sig selv, hver gang du starter `claude` i en mappe. Har du lukket det, får du det tilbage med `/overblik`.

## Installation

Kræver at [Claude Code](https://claude.com/claude-code) er installeret, og at du er logget ind.

I en terminal, skriv `claude` og derefter:

```
/plugin install overblik --marketplace biksemad1/simple-cli
```

Svar `y` til at tilføje marketplace, og vælg *user* (tryk Enter). Færdig.

Eller direkte fra en shell:

```
claude plugin install overblik --marketplace biksemad1/simple-cli
```

I Claude Desktop-appen: klik **+** ved siden af beskedfeltet → **Plugins** → **Add marketplace** med `biksemad1/simple-cli` → **Add plugin**.

## Gode tips

- **Vedhæft en fil:** træk den ind i terminalvinduet – stien bliver sat ind i beskeden.
- **Vedhæft et billede:** kopiér det og tryk **Alt+V** (eller Ctrl+V).
- **Panelet vises ikke?** Gør terminalvinduet bredere – panelet har brug for plads ved siden af chatten.
- Prisen i kroner er omtrentlig og kun til orientering.

## Opdatering

```
claude plugin update overblik
```
