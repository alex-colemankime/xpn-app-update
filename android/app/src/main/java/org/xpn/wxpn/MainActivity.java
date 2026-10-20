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

    // The widget's keys (WxpnWidget): play or pause, or a stream to play,
    // handed to the web app as the car's commands are (car.js), and kept
    // until it's listening.
    private void fromWidget(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (WxpnWidget.ACTION_TOGGLE.equals(action)) {
            CarBridge.INSTANCE.command("toggle", null);
        } else if (WxpnWidget.ACTION_PLAY.equals(action)) {
            // A stream's name in the widget's top row: that stream, playing.
            CarBridge.INSTANCE.command("play", intent.getStringExtra(WxpnWidget.EXTRA_STATION));
        } else {
            return;
        }
        // Once only: not again when the activity is recreated.
        intent.setAction(Intent.ACTION_MAIN);
    }
}
