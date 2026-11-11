// Génère (ou régénère) le projet Android de l'appli : une TWA (Trusted Web Activity) qui ouvre le site
// https://daviddza.github.io/rank-it-all/ en plein écran. Les réglages sont dans twa-manifest.json ;
// après modification : cd android && npm install && npm run generate, puis commiter le résultat.
// La compilation et la signature se font dans GitHub Actions (.github/workflows/android.yml).
import { readFile, writeFile } from 'node:fs/promises';
import { ConsoleLog, TwaGenerator, TwaManifest } from '@bubblewrap/core';

const manifest = await TwaManifest.fromFile('./twa-manifest.json');
const settings = JSON.parse(await readFile('./twa-manifest.json', 'utf8'));
await new TwaGenerator().createTwaProject('.', manifest, new ConsoleLog('android'));

// Retouches du projet généré (version 3, 11/11/2026). Chez un testeur (Pixel 10 Pro), l'appli restait figée sur
// le logo : la bibliothèque androidbrowserhelper n'a ni délai maximum ni solution de secours si Chrome ne répond
// pas pendant le lancement (connexion au navigateur, envoi de l'image du logo).

// 1. Plus d'image de lancement envoyée à Chrome (l'étape la plus fragile) : le site affiche lui-même un écran
//    « Chargement… » tout de suite.
const manifestPath = 'app/src/main/AndroidManifest.xml';
const xml = await readFile(manifestPath, 'utf8');
const withoutSplash = xml.replace(/\s*<meta-data android:name="android\.support\.customtabs\.trusted\.SPLASH_IMAGE_DRAWABLE"[^>]*\/>/, '');
if (withoutSplash === xml) throw new Error(`Image de lancement introuvable dans ${manifestPath} : retouche à revoir`);
await writeFile(manifestPath, withoutSplash);

// 2. Filet de sécurité : si Chrome n'a pas pris le relais au bout de 8 s, le site s'ouvre dans un onglet Chrome
//    intégré (avec une barre d'adresse), au lieu de rester bloqué.
const packagePath = manifest.packageId.replaceAll('.', '/');
await writeFile(
  `app/src/main/java/${packagePath}/LauncherActivity.java`,
  `package ${manifest.packageId};

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

/**
 * Lance le site en plein écran (TWA). Fichier écrit par generate.mjs : à modifier là-bas.
 * Si Chrome ne prend pas le relais à temps, le site est ouvert dans un onglet Chrome intégré.
 */
public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {

    /** Au-delà, le lancement plein écran est considéré comme bloqué. */
    private static final long FALLBACK_DELAY_MS = 8000;

    private static final String EXTRA_SESSION = "android.support.customtabs.extra.SESSION";
    private static final String EXTRA_TOOLBAR_COLOR = "android.support.customtabs.extra.TOOLBAR_COLOR";
    private static final int TOOLBAR_COLOR = 0xFF${settings.themeColor.slice(1, 7).toUpperCase()};

    private final Handler mHandler = new Handler(Looper.getMainLooper());
    private final Runnable mFallback = new Runnable() {
        @Override
        public void run() {
            openInCustomTab();
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Setting an orientation crashes the app due to the transparent background on Android 8.0
        // Oreo and below. We only set the orientation on Oreo and above. This only affects the
        // splash screen and Chrome will still respect the orientation.
        // See https://github.com/GoogleChromeLabs/bubblewrap/issues/496 for details.
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_USER_PORTRAIT);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }
        armFallback();
    }

    @Override
    protected void onRestart() {
        super.onRestart(); // referme cet écran si le site a déjà été ouvert
        armFallback();
    }

    @Override
    protected void onStop() {
        // Le site est affiché (ou l'utilisateur est parti) : plus de secours à prévoir pour l'instant.
        mHandler.removeCallbacks(mFallback);
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        mHandler.removeCallbacks(mFallback);
        super.onDestroy();
    }

    private void armFallback() {
        mHandler.removeCallbacks(mFallback);
        if (!isFinishing()) {
            mHandler.postDelayed(mFallback, FALLBACK_DELAY_MS);
        }
    }

    /** Ouvre le site dans un onglet Chrome intégré (Custom Tab), à défaut dans le navigateur, puis se referme. */
    private void openInCustomTab() {
        if (isFinishing()) {
            return;
        }
        Uri url = getLaunchingUrl();
        Intent customTab = new Intent(Intent.ACTION_VIEW, url);
        Bundle extras = new Bundle();
        extras.putBinder(EXTRA_SESSION, null);
        extras.putInt(EXTRA_TOOLBAR_COLOR, TOOLBAR_COLOR);
        customTab.putExtras(extras);
        try {
            startActivity(customTab);
        } catch (ActivityNotFoundException e) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, url));
            } catch (ActivityNotFoundException ignored) {
                return; // aucun navigateur : rien d'autre à tenter
            }
        }
        finish(); // le lancement plein écran encore en attente est abandonné avec cet écran
    }
}
`,
);

console.log(`Projet généré : ${manifest.packageId}, version ${manifest.appVersionName} (${manifest.appVersionCode})`);
