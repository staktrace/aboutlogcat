import java.io.BufferedReader;
import java.io.InputStreamReader;

public class LogcatGrabber {
    public LogcatGrabber() {
    }

    public static String getLogcat() {
        BufferedReader br = null;
        try {
            Process proc = Runtime.getRuntime().exec(new String[] {
                "logcat", "-v", "threadtime", "-d", "*:D"
            });
            StringBuffer sb = new StringBuffer();
            br = new BufferedReader(new InputStreamReader(proc.getInputStream()));
            for (String s = br.readLine(); s != null; s = br.readLine()) {
                sb.append(s).append('\n');
            }
            return sb.toString();
        } catch (Exception e) {
            return "Unable to get logcat: " + e.toString();
        } finally {
            if (br != null) {
                try {
                    br.close();
                } catch (Exception e) {
                    // ignore
                }
            }
        }
    }
}
