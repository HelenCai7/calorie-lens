import LegalPage from "@/components/LegalPage";
import { legal } from "@/lib/legal";

export const metadata = {
  title: "Terms of Service · Calorie Lens"
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated={legal.updated}>
      <p>By using {legal.appName}, you agree to these terms. If you do not agree, please do not use the app.</p>

      <h2>Estimates only — not medical advice</h2>
      <p>
        {legal.appName} uses AI and public nutrition databases to <strong>estimate</strong> food types, weights
        and calories from a photo. Estimates can be wrong, sometimes by a lot. Always review and correct the
        results. The app does not provide medical, dietary or nutritional advice and is not a substitute for a
        doctor or registered dietitian. Do not rely on it to manage a medical condition, allergy or eating
        disorder.
      </p>

      <h2>Your account</h2>
      <p>
        You are responsible for activity under your account. You must be at least 13 years old to use the app.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Only upload photos you have the right to use, and do not upload photos of other people.</li>
        <li>Do not try to bypass usage limits, overload the service, or access other users’ data.</li>
        <li>Do not use the app for anything unlawful.</li>
      </ul>

      <h2>Usage limits and changes</h2>
      <p>
        We limit the number of photo analyses per account per day and may change these limits, change
        features, or stop the service at any time.
      </p>

      <h2>No warranty</h2>
      <p>
        The app is provided “as is” without warranties of any kind. To the fullest extent permitted by law, we
        are not liable for any damages arising from your use of the app or reliance on its estimates.
      </p>

      <h2>Privacy</h2>
      <p>
        See our <a href="/privacy">Privacy Policy</a> for how we handle your information.
      </p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${legal.contactEmail}`}>{legal.contactEmail}</a>
      </p>
    </LegalPage>
  );
}
