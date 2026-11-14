package dev.acadiasafe;

import java.net.URI;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.time.Duration;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeDriverService;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import static org.junit.jupiter.api.Assertions.*;

/** Browser tests use the real React UI, session API, PostgreSQL and enabled FastAPI gateway. */
class PortalTest {
    private WebDriver driver;
    private WebDriverWait wait;
    private String baseUrl;
    private String email;
    private String password;
    private Path profile;

    private static By testId(String id) {
        return By.cssSelector("[data-testid='" + id + "']");
    }

    private static String requiredEnvironment(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("Set " + name + " for an authorized test account");
        }
        return value;
    }

    @BeforeEach
    void openBrowser() throws IOException {
        baseUrl = System.getenv().getOrDefault("APP_BASE_URL", "http://localhost:5000").replaceAll("/+$", "");
        URI origin = URI.create(baseUrl);
        assertTrue(origin.getScheme().equals("http") || origin.getScheme().equals("https"), "APP_BASE_URL must be HTTP(S)");
        assertNull(origin.getUserInfo(), "Do not put credentials in APP_BASE_URL");
        email = requiredEnvironment("E2E_EMAIL");
        password = requiredEnvironment("E2E_PASSWORD");
        ChromeOptions options = new ChromeOptions();
        options.setAcceptInsecureCerts("true".equals(System.getenv("E2E_ACCEPT_INSECURE_CERTS")));
        profile = Files.createTempDirectory(Path.of(System.getenv().getOrDefault("CHROME_PROFILE_ROOT", System.getProperty("java.io.tmpdir"))), "acadia-selenium-");
        options.addArguments("--headless=new", "--window-size=1440,1000", "--disable-dev-shm-usage", "--user-data-dir=" + profile);
        // Explicit opt-in for isolated root-based CI containers, never needed on ordinary hosts.
        if ("true".equals(System.getenv("CHROME_NO_SANDBOX"))) options.addArguments("--no-sandbox");
        String binary = System.getenv("CHROME_BINARY");
        if (binary != null && !binary.isBlank()) options.setBinary(binary);
        String executable = System.getenv("CHROMEDRIVER_PATH");
        if (executable != null && !executable.isBlank()) {
            var service = new ChromeDriverService.Builder().usingDriverExecutable(new java.io.File(executable)).build();
            driver = new ChromeDriver(service, options);
        } else {
            driver = new ChromeDriver(options);
        }
        driver.manage().timeouts().pageLoadTimeout(Duration.ofSeconds(30));
        driver.manage().timeouts().scriptTimeout(Duration.ofSeconds(15));
        wait = new WebDriverWait(driver, Duration.ofSeconds(15));
        driver.get(baseUrl + "/");
        wait.until(ExpectedConditions.visibilityOfElementLocated(testId("input-email")));
    }

    @AfterEach
    void closeBrowser() throws IOException {
        try {
            if (driver != null) driver.quit();
        } finally {
            if (profile != null) {
                try (var files = Files.walk(profile)) {
                    for (Path file : files.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(file);
                }
            }
        }
    }

    private void login(String submittedPassword) {
        driver.findElement(testId("input-email")).sendKeys(email);
        driver.findElement(testId("input-password")).sendKeys(submittedPassword);
        driver.findElement(testId("select-role")).click();
        wait.until(ExpectedConditions.elementToBeClickable(testId("option-role-admin"))).click();
        driver.findElement(testId("button-login")).click();
    }

    private void loginSuccessfully() {
        login(password);
        wait.until(ExpectedConditions.visibilityOfElementLocated(testId("text-username")));
        assertEquals("Admin", driver.findElement(testId("text-user-role")).getText());
    }

    private void heading(String expected) {
        wait.until(ExpectedConditions.textToBe(By.cssSelector("header h1"), expected));
    }

    private int sessionStatus() {
        Object result = ((JavascriptExecutor) driver).executeAsyncScript("""
            const done = arguments[arguments.length - 1];
            fetch('/api/me', { credentials: 'include' }).then(r => done(r.status)).catch(() => done(-1));
            """);
        return ((Number) result).intValue();
    }

    @Test
    void validCredentialsOpenDashboardAndAuthenticateSession() {
        loginSuccessfully();
        heading("Dashboard");
        assertEquals(200, sessionStatus());
        var session = driver.manage().getCookieNamed("connect.sid");
        assertNotNull(session, "The real login endpoint must create a server session");
        assertTrue(session.isHttpOnly());
        if (baseUrl.startsWith("https://")) assertTrue(session.isSecure());
    }

    @Test
    void invalidCredentialsStaySignedOut() {
        login(UUID.randomUUID().toString());
        wait.until(ExpectedConditions.visibilityOfElementLocated(By.xpath("//*[text()='Invalid credentials']")));
        assertTrue(driver.findElement(testId("input-email")).isDisplayed());
        assertTrue(driver.findElements(testId("button-logout")).isEmpty());
        assertEquals(401, sessionStatus());
    }

    @Test
    void sessionSurvivesReloadAndDirectNavigation() {
        loginSuccessfully();
        String username = driver.findElement(testId("text-username")).getText();
        String cookie = driver.manage().getCookieNamed("connect.sid").getValue();
        driver.navigate().refresh();
        heading("Dashboard");
        assertEquals(username, driver.findElement(testId("text-username")).getText());
        driver.get(baseUrl + "/settings");
        heading("Settings");
        assertEquals(cookie, driver.manage().getCookieNamed("connect.sid").getValue());
        assertEquals(200, sessionStatus());
    }

    @Test
    void logoutInvalidatesSessionAndProtectedRouteReload() {
        loginSuccessfully();
        driver.findElement(testId("button-logout")).click();
        wait.until(ExpectedConditions.visibilityOfElementLocated(testId("input-email")));
        assertEquals(401, sessionStatus());
        driver.get(baseUrl + "/settings");
        wait.until(ExpectedConditions.visibilityOfElementLocated(testId("input-email")));
        assertEquals(401, sessionStatus());
        assertTrue(driver.findElements(testId("text-username")).isEmpty());
    }

    @ParameterizedTest(name = "direct SPA route {0} renders {1}")
    @CsvSource({"/,Dashboard", "/alerts,SOS Alerts", "/escorts,Escort Requests",
        "/reports,Incident Reports", "/broadcast,Broadcast Alerts", "/patrols,Campus Patrol",
        "/map,Campus Map", "/settings,Settings"})
    void directSpaRoutesAndRefreshWork(String path, String expectedHeading) {
        loginSuccessfully();
        driver.get(baseUrl + path);
        heading(expectedHeading);
        driver.navigate().refresh();
        heading(expectedHeading);
        assertEquals(200, sessionStatus());
        assertTrue(driver.findElement(testId("button-logout")).isDisplayed());
    }

    @Test
    void campusMapWritesThroughRebuiltBackend() {
        loginSuccessfully();
        driver.get(baseUrl + "/map");
        heading("Campus Map");
        String name = "Selenium fixture " + System.getenv().getOrDefault("E2E_RUN_ID", "standalone") + " " + UUID.randomUUID();
        driver.findElement(testId("button-toggle-add-location")).click();
        driver.findElement(testId("input-location-name")).sendKeys(name);
        driver.findElement(testId("input-location-lat")).sendKeys("45.087");
        driver.findElement(testId("input-location-lng")).sendKeys("-64.366");
        driver.findElement(testId("input-location-description")).sendKeys("Disposable browser-test fixture");
        driver.findElement(testId("button-add-location")).click();
        wait.until(ExpectedConditions.visibilityOfElementLocated(By.xpath("//*[text()='Location added to campus map']")));
        // Inspect the real API using this browser's cookie; no response interception/stubbing.
        Object value = ((JavascriptExecutor) driver).executeAsyncScript("""
            const name = arguments[0], done = arguments[arguments.length - 1];
            fetch('/api/campus-locations', {credentials:'include'}).then(r => {
              if (!r.ok) throw new Error('API failed');
              return r.json();
            }).then(rows => done(rows.find(row => row.name === name)?.id ?? -1)).catch(() => done(-1));
            """, name);
        long id = ((Number) value).longValue();
        assertTrue(id > 0, "UI-created location must be persisted through FastAPI");
        try {
            driver.navigate().refresh();
            heading("Campus Map");
            // Removal via the authenticated API keeps cleanup independent of map tile availability.
            Object status = ((JavascriptExecutor) driver).executeAsyncScript("""
                const id = arguments[0], done = arguments[arguments.length - 1];
                fetch('/api/campus-locations/' + id, {method:'DELETE', credentials:'include'})
                  .then(r => done(r.status)).catch(() => done(-1));
                """, id);
            assertEquals(200, ((Number) status).intValue());
        } finally {
            ((JavascriptExecutor) driver).executeAsyncScript("""
                const id = arguments[0], done = arguments[arguments.length - 1];
                fetch('/api/campus-locations/' + id, {method:'DELETE', credentials:'include'})
                  .then(() => done(true)).catch(() => done(false));
                """, id);
        }
    }
    @Test
    void sosAlertCanBeAssignedAndResolvedThroughDashboard() {
        loginSuccessfully();
        String name = "Selenium SOS " + System.getenv().getOrDefault("E2E_RUN_ID", "standalone") + " " + UUID.randomUUID();
        Object value = ((JavascriptExecutor) driver).executeAsyncScript("""
            const name = arguments[0], done = arguments[arguments.length - 1];
            fetch('/api/sos-alerts', {method:'POST', credentials:'include',
              headers:{'Content-Type':'application/json'},
              body:JSON.stringify({student_name:name, location:'Disposable browser fixture', lat:45.087, lng:-64.366})})
              .then(async r => done(r.status === 201 ? (await r.json()).id : -1)).catch(() => done(-1));
            """, name);
        long id = ((Number) value).longValue();
        assertTrue(id > 0, "SOS fixture must be persisted by the enabled FastAPI service");
        driver.get(baseUrl + "/alerts");
        heading("SOS Alerts");
        var row = testId("row-alert-" + id);
        wait.until(ExpectedConditions.textToBePresentInElementLocated(row, name));
        driver.findElement(testId("button-assign-" + id)).click();
        wait.until(ExpectedConditions.elementToBeClickable(testId("button-en-route-" + id))).click();
        wait.until(ExpectedConditions.elementToBeClickable(testId("button-resolve-" + id))).click();
        wait.until(ExpectedConditions.textToBePresentInElementLocated(row, "RESOLVED"));
        driver.navigate().refresh();
        heading("SOS Alerts");
        wait.until(ExpectedConditions.textToBePresentInElementLocated(row, "RESOLVED"));
        assertTrue(driver.findElements(testId("button-assign-" + id)).isEmpty());
    }

}
