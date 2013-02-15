var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
var Cm = Components.manager;
Cm.QueryInterface(Ci.nsIComponentRegistrar);

var gMenuId = -1;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

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
        var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
        var logcat = 'NO LOGCAT AVAILABLE';
        var content = 'data:text/plain,' + logcat;
        var channel = ioService.newChannel(content, null, null);
        var securityManager = Cc["@mozilla.org/scriptsecuritymanager;1"].getService(Ci.nsIScriptSecurityManager);
        var principal = securityManager.getSystemPrincipal(uri);
        channel.originalURI = uri;
        channel.owner = principal;
        return channel;
    },

    getURIFlags: function(uri) {
        return Ci.nsIAboutModule.URI_SAFE_FOR_UNTRUSTED_CONTENT;
    }
};

const AboutLogcatFactory = XPCOMUtils.generateNSGetFactory([AboutLogcat])(AboutLogcat.prototype.classID);

function attachTo(aWindow) {
    if (gMenuId < 0) {
        Cm.registerFactory(AboutLogcat.prototype.classID,
                AboutLogcat.prototype.classDescription,
                AboutLogcat.prototype.contractID,
                AboutLogcatFactory);
        gMenuId = aWindow.NativeWindow.menu.add("View logcat", null, function() {
            aWindow.BrowserApp.addTab("about:logcat");
        });
    }
}

function detachFrom(aWindow) {
    if (gMenuId >= 0) {
        aWindow.NativeWindow.menu.remove(gMenuId);
        gMenuId = -1;
        Cm.unregisterFactory(AboutLogcat.prototype.classID,
                AboutLogcatFactory);
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
