// Génère (ou régénère) le projet Android de l'appli : une TWA (Trusted Web Activity) qui ouvre le site
// https://daviddza.github.io/rank-it-all/ en plein écran. Les réglages sont dans twa-manifest.json ;
// après modification : cd android && npm install && npm run generate, puis commiter le résultat.
// La compilation et la signature se font dans GitHub Actions (.github/workflows/android.yml).
import { ConsoleLog, TwaGenerator, TwaManifest } from '@bubblewrap/core';

const manifest = await TwaManifest.fromFile('./twa-manifest.json');
await new TwaGenerator().createTwaProject('.', manifest, new ConsoleLog('android'));
console.log(`Projet généré : ${manifest.packageId}, version ${manifest.appVersionName} (${manifest.appVersionCode})`);
