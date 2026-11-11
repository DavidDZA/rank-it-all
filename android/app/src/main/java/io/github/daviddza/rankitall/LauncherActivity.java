package io.github.daviddza.rankitall;

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
    private static final int TOOLBAR_COLOR = 0xFF12121A;

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
