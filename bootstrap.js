var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
var Cm = Components.manager;
Cm.QueryInterface(Ci.nsIComponentRegistrar);

var gWindow = null;
var gMenuId = -1;
var gDexLoaded = false;
var gJavaCodeURI = null;

Cu.import("resource://gre/modules/Services.jsm");
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
        let reverse = gPrefService.getPrefType('reverse') && gPrefService.getBoolPref('reverse');
        let html = gPrefService.getPrefType('html') && gPrefService.getBoolPref('html');
        let filter = gPrefService.getPrefType('filter') && gPrefService.getCharPref('filter');
        let logcat = 'NO LOGCAT AVAILABLE', fcb;
        try {
            logcat = gWindow.sendMessageToJava({ type: "logcat:get" });
        } catch (e) {
            logcat = 'Error obtaining logcat: ' + e;
        }

        if (filter) {

            if (filter[0] == '/') {
                fcb = (() => {
                    try {
                        filter = new RegExp(filter);
                    } catch (e) {
                        filter = /./;
                    }
                    return s => filter.test(s);
                });
            } else {
                fcb = s => ~s.indexOf(filter);
            }

        } else {

            fcb = s => s;
        }

        if (html) {
            let c = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
                .createInstance(Ci.nsIScriptableUnicodeConverter);
            c.charset = 'UTF-8';
            let p = Cc["@mozilla.org/parserutils;1"].getService(Ci.nsIParserUtils);
            logcat = p.convertToPlainText(c.ConvertFromUnicode(logcat),0xff,0).split("\n");
            if (reverse) {
                logcat = logcat.reverse();
            }
            logcat = logcat.map(ln => fcb(ln) && '<div class="' + ln.split(" ")[4] + '">' + ln + '</div>' || '').filter(String);
            var n = logcat.length;
            logcat = '<html><head><style type="text/css">'
                + '.V{background-color:#eee}'
                + '.D{background-color:#abc}'
                + '.I{background-color:#def}'
                + '.W{background-color:#ffd}'
                + '.E{background-color:#fdd}'
                + '.F{background-color:#f00}'
                + 'div{border-bottom:1px solid #444}'
                + 'html,body{margin:0 auto}'
                + '</style></head><body><h3>Showing ' + n + ' entries.</h3>' + logcat.join("");
            var content = 'data:text/html;charset=UTF-8,';
        } else {
            var content = 'data:text/plain,';
        }

        var channel = Services.io.newChannel(content + encodeURIComponent(logcat), null, null);
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
        gWindow.NativeWindow.loadDex(gJavaCodeURI, 'LogcatGrabber');
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
            gWindow.NativeWindow.unloadDex(gJavaCodeURI);
            gDexLoaded = false;
        }
        gWindow = null;
    }
}

var browserListener = {
    onOpenWindow: function(aWindow) {
        attachToStub(aWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow));
    },

    onCloseWindow: function(aWindow) {
        detachFrom(aWindow);
    },

    onWindowTitleChange: function(aWindow, aTitle) {
    }
};

function attachToStub(aWindow) {

    if (aWindow.document.readyState == "complete") {
        attachTo(aWindow);
    } else {
        aWindow.addEventListener("UIReady", function listener() {
            aWindow.removeEventListener("UIReady", listener, false);
            attachTo(aWindow);
        }, false);
    }
}

function startup(aData, aReason) {
    let {AddonManager} = Cu.import("resource://gre/modules/AddonManager.jsm", {});
    AddonManager.getAddonByID(aData.id, function(aAddon) {
        gJavaCodeURI = aAddon.getResourceURI('java-code.jar').spec;
        let enumerator = Services.wm.getEnumerator("navigator:browser");
        while (enumerator.hasMoreElements()) {
            attachToStub(enumerator.getNext().QueryInterface(Ci.nsIDOMWindow));
        }
        Services.wm.addListener(browserListener);
    });
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
