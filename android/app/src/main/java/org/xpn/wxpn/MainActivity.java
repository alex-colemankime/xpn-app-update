package org.xpn.wxpn;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own plugins, before the bridge starts: Android Auto
        // (CarAudioPlugin.kt) and the home screen widget (HomeWidgetPlugin.kt).
        registerPlugin(CarAudioPlugin.class);
        registerPlugin(HomeWidgetPlugin.class);
        super.onCreate(savedInstanceState);
        fromWidget(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        fromWidget(intent);
    }

    // The widget's play key (WxpnWidget): play or pause, handed to the web app
    // as the car's commands are (car.js), and kept until it's listening.
    private void fromWidget(Intent intent) {
        if (intent != null && WxpnWidget.ACTION_TOGGLE.equals(intent.getAction())) {
            CarBridge.INSTANCE.command("toggle", null);
            // Once only: not again when the activity is recreated.
            intent.setAction(Intent.ACTION_MAIN);
        }
    }
}
