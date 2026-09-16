# Val 2026 – Direktrapportering

En mobilanpassad React/Vite-sida för att följa preliminära svenska valresultat.

## Köra lokalt

```bash
npm install
npm run dev
```

Lokalt används Vites proxy för att hämta aktuella data från Valmyndighetens API. GitHub Pages kan inte anropa API:et direkt från webbläsaren eftersom API:et inte tillåter CORS, så GitHub Actions hämtar i stället aktuell data när sidan byggs.

## Publicera på GitHub Pages

1. Skapa ett publikt repository, till exempel `val-2026-live`.
2. Pusha projektet till repositoryts `main`-branch.
3. Öppna **Settings → Pages** och välj **GitHub Actions** som källa.
4. Workflow-filen publicerar automatiskt sidan efter varje push.

Sidan blir då tillgänglig på `https://<ditt-användarnamn>.github.io/val-2026-live/`.
