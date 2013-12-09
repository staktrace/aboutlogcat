var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
var Cm = Components.manager;
Cm.QueryInterface(Ci.nsIComponentRegistrar);

var gWindow = null;
var gMenuId = -1;
var gDexLoaded = false;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/JNI.jsm");

var gPrefService = Services.prefs.getBranch('extensions.aboutlogcat.');

function dump(a) {
    Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService).logStringMessage(a);
}

// Much of this code was "borrowed" from the about:telemetry add-on by Taras

function AboutLogcat() {
}

AboutLogcat.prototype = {
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule]),
    classDescription: "about:logcat",
    classID: Components.ID("{2ccd132e-7fc6-4a52-a766-9e5b61c1cb03}"),
    contractID: "@mozilla.org/network/protocol/about;1?what=logcat",
 
    newChannel: function(uri) {
		var reverse = gPrefService.getPrefType('reverse') && gPrefService.getBoolPref('reverse');
		var html = gPrefService.getPrefType('html') && gPrefService.getBoolPref('html');
        var logcat = 'NO LOGCAT AVAILABLE';
        try {
            logcat = gWindow.sendMessageToJava({ type: "logcat:get" });
        } catch (e) {
            logcat = 'Error obtaining logcat: ' + e;
        }
		
		if(html) {
			logcat = logcat.split("\n");
			if(reverse) logcat = logcat.reverse();
			logcat = logcat.filter(String).map(ln => '<div class="' + ln.split(" ")[4] + '">' + ln + '</div>');
			logcat = '<html><head><style type="text/css">'
				+ '.V{background-color:#eee}'
				+ '.D{background-color:#abc}'
				+ '.I{background-color:#def}'
				+ '.W{background-color:#ffd}'
				+ '.E{background-color:#fdd}'
				+ '.F{background-color:#f00}'
				+ 'div{border-bottom:1px solid #444}'
				+ '</style></head><body>' + logcat.join("");
			var content = 'data:text/html,';
		} else {
			var content = 'data:text/plain,';
		}

        var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
        var channel = ioService.newChannel(content + encodeURIComponent(logcat), null, null);
        // var securityManager = Cc["@mozilla.org/scriptsecuritymanager;1"].getService(Ci.nsIScriptSecurityManager);
        channel.originalURI = uri;
        return channel;
    },

    getURIFlags: function(uri) {
        return Ci.nsIAboutModule.URI_SAFE_FOR_UNTRUSTED_CONTENT;
    }
};

const AboutLogcatFactory = XPCOMUtils.generateNSGetFactory([AboutLogcat])(AboutLogcat.prototype.classID);

function attachTo(aWindow) {
    if (gWindow == null) {
        gWindow = aWindow;
        Cm.registerFactory(AboutLogcat.prototype.classID,
                AboutLogcat.prototype.classDescription,
                AboutLogcat.prototype.contractID,
                AboutLogcatFactory);
        gMenuId = gWindow.NativeWindow.menu.add("View logcat", null, function() {
            gWindow.BrowserApp.addTab("about:logcat");
        });
    }
    if (!gDexLoaded) {
        AddonManager.getAddonByID("projects.aboutlogcat.ffext@staktrace.com", function(addon) {
            gWindow.NativeWindow.loadDex(addon.getResourceURI('java-code.jar').spec, 'LogcatGrabber');
        });
        gDexLoaded = true;
    }
}

function detachFrom(aWindow) {
    if (aWindow != null && gWindow == aWindow) {
        gWindow.NativeWindow.menu.remove(gMenuId);
        gMenuId = -1;
        Cm.unregisterFactory(AboutLogcat.prototype.classID,
                AboutLogcatFactory);
        if (gDexLoaded) {
            AddonManager.getAddonByID("projects.aboutlogcat.ffext@staktrace.com", function(addon) {
                gWindow.NativeWindow.unloadDex(addon.getResourceURI('java-code.jar').spec);
            });
            gDexLoaded = false;
        }
        gWindow = null;
    }
}

var browserListener = {
    onOpenWindow: function(aWindow) {
        var win = aWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
        win.addEventListener("UIReady", function listener(aEvent) {
            win.removeEventListener("UIReady", listener, false);
            attachTo(win);
        }, false);
    },

    onCloseWindow: function(aWindow) {
        detachFrom(aWindow);
    },

    onWindowTitleChange: function(aWindow, aTitle) {
    }
};

function startup(aData, aReason) {
    var enumerator = Services.wm.getEnumerator("navigator:browser");
    while (enumerator.hasMoreElements()) {
        // potential race condition here - the window may not be ready yet at
        // this point, so ideally we would test for that. but i can't find a
        // property that reflects whether or not UIReady has been fired, so
        // for now just assume the window is ready
        attachTo(enumerator.getNext().QueryInterface(Ci.nsIDOMWindow));
    }
    Services.wm.addListener(browserListener);
}

function shutdown(aData, aReason) {
    // When the application is shutting down we normally don't have to clean
    // up any UI changes made
    if (aReason == APP_SHUTDOWN)
        return;

    Services.wm.removeListener(browserListener);
    var enumerator = Services.wm.getEnumerator("navigator:browser");
    while (enumerator.hasMoreElements()) {
        detachFrom(enumerator.getNext().QueryInterface(Ci.nsIDOMWindow));
    }
}

function install(aData, aReason) {
    // nothing to do
}

function uninstall(aData, aReason) {
    // nothing to do
}
