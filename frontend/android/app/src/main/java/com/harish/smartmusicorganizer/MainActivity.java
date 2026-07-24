package com.harish.smartmusicorganizer;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.harish.smartmusicorganizer.nativeapplaunch.NativeAppLaunchPlugin;
import com.harish.smartmusicorganizer.nativeplayback.NativeDownloadedPlaybackPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeDownloadedPlaybackPlugin.class);
        registerPlugin(NativeAppLaunchPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
