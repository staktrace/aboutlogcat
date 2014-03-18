var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
var Cm = Components.manager;
Cm.QueryInterface(Ci.nsIComponentRegistrar);

var gWindow = null;
var gMenuId = -1;
var gDexLoaded = false;
var gJavaCodeURI = null;
var gLastTabId = -1;

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

    observe: function(aSubject, aTopic, aData) {
        switch (aTopic) {
            case 'logcat:get:Return':
                this.populate(this.reformat(JSON.parse(aData).response));
                break;
            case 'logcat:get:Error':
                this.populate("Error: " + JSON.parse(aData).response);
                break;
        }
        Services.obs.removeObserver(this, 'logcat:get:Return', false);
        Services.obs.removeObserver(this, 'logcat:get:Error', false);
    },

    newChannel: function(uri) {
        let message = 'Loading... (takes about 5 seconds)';
        Services.obs.addObserver(this, 'logcat:get:Return', false);
        Services.obs.addObserver(this, 'logcat:get:Error', false);
        try {
            gWindow.sendMessageToJava({ type: "logcat:get", __guid__: "0" });
        } catch (e) {
            message = 'Error obtaining logcat: ' + e;
        }

        var content = 'data:text/html;charset=UTF-8,';
        var channel = Services.io.newChannel(content + encodeURIComponent(message), null, null);
        channel.originalURI = uri;
        channel.owner = Cc["@mozilla.org/systemprincipal;1"].getService(Ci.nsIPrincipal);
        return channel;
    },

    reformat: function(logcat) {
        let reverse = gPrefService.getPrefType('reverse') && gPrefService.getBoolPref('reverse');
        let html = gPrefService.getPrefType('html') && gPrefService.getBoolPref('html');
        let filter = gPrefService.getPrefType('filter') && gPrefService.getCharPref('filter');

        let fcb = s => s;
        if (filter) {
            if (filter[0] == '/') {
                try {
                    filter = new RegExp(filter.substr(1, filter.length - 2));
                } catch (e) {
                    filter = /./;
                }
                fcb = s => filter.test(s);
            } else {
                fcb = s => ~s.indexOf(filter);
            }
        }

        let c = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter);
        c.charset = 'UTF-8';
        let p = Cc["@mozilla.org/parserutils;1"].getService(Ci.nsIParserUtils);
        logcat = p.convertToPlainText(c.ConvertFromUnicode(logcat), 0xff, 0).split("\n");

        if (reverse) {
            logcat = logcat.reverse();
        }

        logcat = logcat.map(ln => fcb(ln) && ln || '').filter(String);

        if (html) {
            // logcat = logcat.map(ln => '<div class="' + ln.split(/\s+/)[4] + '">' + ln + '</div>');
            logcat = logcat.map(ln => {
				if(/\{file: "/.test(ln)) {
					ln = ln.replace(/\{file: "([^"]+)"/, function(x,f) {
						return '{file: "<a href="view-source:'+f.split(" -> ").pop()+'">'+f+'</a>"';
					});
				}
				return '<div class="' + ln.split(/\s+/)[4] + '">' + ln + '</div>';
			});
            var n = logcat.length;
            logcat = '<head>\n'
                + '<meta name="viewport" content="width=1000">\n'
                + '<style type="text/css">\n'
                + '.V{background-color:#eee}\n'
                + '.D{background-color:#abc}\n'
                + '.I{background-color:#def}\n'
                + '.W{background-color:#ffd}\n'
                + '.E{background-color:#fdd}\n'
                + '.F{background-color:#f00}\n'
                + 'div{border-bottom:1px solid #444}\n'
                + 'html,body{margin:0 auto}\n'
                + '</style></head><body><h3>Showing ' + n + ' entries.</h3>' + logcat.join("");
        } else {
            logcat = '<body><pre>' + logcat.join('\n') + '</pre></body>';
        }

        return logcat;
    },

    populate: function(html) {
        // need some delay to let the tab load first
        gWindow.setTimeout(function() {
            gWindow.BrowserApp.getTabForId(gLastTabId).browser.contentDocument.documentElement.innerHTML = html;
        }, 3000);
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
            let tab = gWindow.BrowserApp.addTab("about:logcat");
            gLastTabId = tab.id;
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
