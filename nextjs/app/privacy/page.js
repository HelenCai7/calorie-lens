import LegalPage from "@/components/LegalPage";
import { legal } from "@/lib/legal";

export const metadata = {
  title: "Privacy Policy · Calorie Lens"
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated={legal.updated}>
      <p>
        {legal.appName} (“we”, “us”) is a web app that estimates the calories in a photo of your meal. This
        policy explains what information we collect, how we use it, and the choices you have.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account information.</strong> When you sign in with email or Google, we receive your email
          address and a user ID. If you use Google, Google may also share your name and profile picture.
        </li>
        <li>
          <strong>Meal photos.</strong> When you tap “Analyze”, the photo you took or uploaded is compressed in
          your browser and sent to our server for analysis. We do not store your photos.
        </li>
        <li>
          <strong>Meal records.</strong> When you save a meal, we store the food names, weights, calories and
          the time you saved it, linked to your account.
        </li>
        <li>
          <strong>Usage counts.</strong> To limit each account to a few analyses per day, we store the times
          you ran an analysis for 24 hours.
        </li>
        <li>
          <strong>Technical data.</strong> Our hosting provider keeps standard server logs (such as IP address,
          browser type and request time) for security and debugging.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To identify foods in your photo and estimate weights and calories.</li>
        <li>To save your meal history and show your daily and weekly statistics.</li>
        <li>To enforce daily usage limits and protect the service from abuse.</li>
      </ul>
      <p>We do not sell your personal information and we do not use it for advertising.</p>

      <h2>Services that process your data</h2>
      <ul>
        <li>
          <strong>Google Gemini API</strong> analyzes your meal photo. Google processes the photo under its
          Gemini API terms. If the service is running on Google’s unpaid tier, Google may use submitted content
          to improve its products.
        </li>
        <li>
          <strong>USDA FoodData Central</strong> receives food names (never photos or account details) to look
          up nutrition values.
        </li>
        <li>
          <strong>Supabase</strong> stores your account and meal records.
        </li>
        <li>
          <strong>Upstash</strong> stores daily usage counts and a cache of nutrition lookups.
        </li>
        <li>
          <strong>Vercel</strong> hosts the app and its servers in the United States.
        </li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We use cookies only to keep you signed in. We do not use advertising or third-party tracking cookies.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        Your meal records are kept until you delete them. You can delete all of your saved meals at any time
        with the “清空” (Clear) button in the “最近记录” (Recent meals) section. To delete your account entirely, email us at{" "}
        <a href={`mailto:${legal.contactEmail}`}>{legal.contactEmail}</a> from the address you signed in with,
        and we will delete your account and records within 30 days.
      </p>

      <h2>Children</h2>
      <p>{legal.appName} is not intended for children under 13, and we do not knowingly collect their data.</p>

      <h2>Changes</h2>
      <p>If we change this policy, we will update the date at the top of this page.</p>

      <h2>Contact</h2>
      <p>
        Questions about privacy: <a href={`mailto:${legal.contactEmail}`}>{legal.contactEmail}</a>
      </p>
    </LegalPage>
  );
}
