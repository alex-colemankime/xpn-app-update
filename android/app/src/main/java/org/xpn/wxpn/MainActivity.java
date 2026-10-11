package org.xpn.wxpn;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own plugin, for Android Auto (CarAudioPlugin.kt), before
        // the bridge starts.
        registerPlugin(CarAudioPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
